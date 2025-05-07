// FILE: app/tool/_hooks/useImageProcessing.ts
import { useState, useCallback } from 'react';
import { useHistory, TriggerType } from '../../context/HistoryContext';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import type { StoredFile } from '@/src/types/storage';

interface UseImageProcessingProps {
  toolTitle: string;
  toolRoute: string;
}

type ProcessingFunction = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  options?: Record<string, unknown>
) => void;

export interface ProcessImageResult {
  // Exporting this interface
  id: string | null;
  dataUrl: string | null;
  blob: Blob | null;
}

interface UseImageProcessingReturn {
  originalImageSrc: string | null;
  processedImageSrc: string | null;
  processedImageBlob: Blob | null;
  fileName: string | null;
  isLoading: boolean;
  error: string | null;
  setOriginalImageSrc: React.Dispatch<React.SetStateAction<string | null>>;
  processImage: (
    inputFile: StoredFile,
    processingFunction: ProcessingFunction,
    trigger: TriggerType,
    outputFileName: string,
    options?: Record<string, unknown>,
    saveOutputToLibrary?: boolean
  ) => Promise<ProcessImageResult>;
  clearProcessingOutput: () => void;
}

const useImageProcessing = ({
  toolTitle,
  toolRoute,
}: UseImageProcessingProps): UseImageProcessingReturn => {
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(
    null
  );
  const [processedImageBlob, setProcessedImageBlob] = useState<Blob | null>(
    null
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { addHistoryEntry } = useHistory();
  const { addImage } = useImageLibrary();

  const clearProcessingOutput = useCallback(() => {
    setProcessedImageSrc(null);
    setProcessedImageBlob(null);
    setError(null);
  }, []);

  // In app/tool/_hooks/useImageProcessing.ts

  const processImage = useCallback(
    async (
      inputFile: StoredFile,
      processingFunction: ProcessingFunction,
      trigger: TriggerType,
      outputFileName: string,
      options: Record<string, unknown> = {},
      saveOutputToLibrary: boolean = true
    ): Promise<ProcessImageResult> => {
      setOriginalImageSrc(null);
      clearProcessingOutput();
      setFileName(inputFile.name);

      if (!inputFile.blob || !inputFile.type?.startsWith('image/')) {
        const errMsg = `Invalid input file: ID ${inputFile.id || 'unknown'}, Type ${inputFile.type || 'unknown'}`;
        console.error(errMsg);
        setError(errMsg);
        setIsLoading(false);
        return { id: null, dataUrl: null, blob: null };
      }

      setIsLoading(true);

      let tempOriginalObjectUrl: string | null = null;
      const result: ProcessImageResult = {
        id: null,
        dataUrl: null,
        blob: null,
      };
      let status: 'success' | 'error' = 'success';
      let historyOutputDetails: string | Record<string, unknown> =
        'Processing started.';
      const inputDetails: Record<string, unknown> = {
        inputFileId: inputFile.id,
        fileName: inputFile.name,
        originalSize: inputFile.size,
        originalType: inputFile.type,
        requestedSaveToLibrary: saveOutputToLibrary,
        ...options,
      };

      try {
        const img = new window.Image();

        tempOriginalObjectUrl = URL.createObjectURL(inputFile.blob);
        setOriginalImageSrc(tempOriginalObjectUrl);

        // Explicit check to satisfy TypeScript
        if (tempOriginalObjectUrl === null) {
          throw new Error(
            'Object URL creation unexpectedly returned null for original image.'
          );
        }
        const urlForImgElement: string = tempOriginalObjectUrl; // Now it's definitely a string

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (errEvent) => {
            console.error('Failed to load image for processing:', errEvent);
            reject(new Error('Failed to load image from blob for processing.'));
          };
          img.src = urlForImgElement; // Assign the guaranteed string
        });

        if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
          throw new Error(
            `Invalid image dimensions: ${img.naturalWidth}x${img.naturalHeight}`
          );
        }

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context.');

        processingFunction(ctx, img, options);

        const outputMimeType =
          inputFile.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        const quality = outputMimeType === 'image/jpeg' ? 0.9 : undefined;

        result.dataUrl = canvas.toDataURL(outputMimeType, quality);
        const processedBlobFromCanvas = await new Promise<Blob | null>(
          (resolve) => canvas.toBlob(resolve, outputMimeType, quality)
        );

        if (!processedBlobFromCanvas)
          throw new Error('Canvas toBlob failed for processed image.');

        result.blob = processedBlobFromCanvas;
        setProcessedImageSrc(result.dataUrl);
        setProcessedImageBlob(result.blob);

        if (saveOutputToLibrary) {
          const newImageId = await addImage(
            result.blob,
            outputFileName,
            outputMimeType
          );
          result.id = newImageId;
          historyOutputDetails = {
            message: 'Image processed and saved successfully.',
            savedImageId: newImageId,
            outputType: outputMimeType,
            outputSize: result.blob.size,
          };
        } else {
          historyOutputDetails = {
            message: 'Image processed (not saved to library).',
            outputType: outputMimeType,
            outputSize: result.blob.size,
          };
        }
        status = 'success';
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown processing error.';
        console.error('Image Processing Error:', err);
        setError(message);
        setOriginalImageSrc(null);
        // clearProcessingOutput() would also clear error, so set error after or ensure it doesn't
        setProcessedImageSrc(null); // Ensure these are also cleared
        setProcessedImageBlob(null);
        status = 'error';
        historyOutputDetails = `Error: ${message}`;
        inputDetails.error = message;
      } finally {
        setIsLoading(false);
        if (tempOriginalObjectUrl) {
          // Check before revoking
          URL.revokeObjectURL(tempOriginalObjectUrl);
        }
        addHistoryEntry({
          toolName: toolTitle,
          toolRoute: toolRoute,
          trigger: trigger,
          input: inputDetails,
          output: historyOutputDetails,
          status: status,
          eventTimestamp: Date.now(),
        });
      }
      return result;
    },
    [
      toolTitle,
      toolRoute,
      addImage,
      addHistoryEntry,
      clearProcessingOutput,
      setOriginalImageSrc,
      setError,
      setFileName,
      setIsLoading,
      setProcessedImageBlob,
      setProcessedImageSrc,
    ]
  );

  return {
    originalImageSrc,
    processedImageSrc,
    processedImageBlob,
    fileName,
    isLoading,
    error,
    setOriginalImageSrc, // Keep this if parent needs to set it (e.g. from URL param initially)
    processImage,
    clearProcessingOutput,
  };
};

export default useImageProcessing;
