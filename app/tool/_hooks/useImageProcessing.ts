// FILE: app/tool/_hooks/useImageProcessing.ts
import { useState, useCallback } from 'react';
import { useHistory, TriggerType } from '../../context/HistoryContext'; // Uses updated HistoryContext
import { useImageLibrary } from '@/app/context/ImageLibraryContext'; // Uses updated ImageLibraryContext
import type { StoredFile } from '@/src/types/storage'; // Uses updated StoredFile type

interface UseImageProcessingProps {
  toolTitle: string;
  toolRoute: string;
}

type ProcessingFunction = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  options?: Record<string, unknown>
) => void;

interface UseImageProcessingReturn {
  originalImageSrc: string | null;
  processedImageSrc: string | null;
  fileName: string | null;
  isLoading: boolean;
  error: string | null;
  setOriginalImageSrc: React.Dispatch<React.SetStateAction<string | null>>;
  setProcessedImageSrc: React.Dispatch<React.SetStateAction<string | null>>;
  setFileName: React.Dispatch<React.SetStateAction<string | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  processImage: (
    inputFile: StoredFile,
    processingFunction: ProcessingFunction,
    trigger: TriggerType,
    outputFileName: string,
    options?: Record<string, unknown>
  ) => Promise<string | null>; // Returns image ID or null
}

const useImageProcessing = ({
  toolTitle,
  toolRoute,
}: UseImageProcessingProps): UseImageProcessingReturn => {
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(
    null
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { addHistoryEntry } = useHistory(); // Use updated HistoryContext
  const { addImage } = useImageLibrary(); // Use updated ImageLibraryContext

  const processImage = useCallback(
    async (
      inputFile: StoredFile,
      processingFunction: ProcessingFunction,
      trigger: TriggerType,
      outputFileName: string,
      options: Record<string, unknown> = {}
    ): Promise<string | null> => {
      // *** MODIFIED VALIDATION: Check type instead of category ***
      if (!inputFile.blob || !inputFile.type?.startsWith('image/')) {
        // *** MODIFIED ERROR MESSAGE ***
        const errMsg = `Invalid input file provided to processImage: ID ${inputFile.id}, Type ${inputFile.type || 'unknown'}, Blob exists: ${!!inputFile.blob}`;
        console.error(errMsg);
        setError(errMsg);
        return null;
      }

      setIsLoading(true);
      setError(null);
      setProcessedImageSrc(null);
      setFileName(inputFile.name);

      let generatedDataUrl: string | null = null;
      let newImageId: string | undefined = undefined;
      let status: 'success' | 'error' = 'success';
      let historyOutput: string | Record<string, unknown> =
        'Image processed successfully.';
      const inputDetails: Record<string, unknown> = {
        inputFileId: inputFile.id,
        fileName: inputFile.name,
        originalSize: inputFile.size,
        originalType: inputFile.type,
        ...options,
      };
      let objectUrlToRevoke: string | null = null;

      try {
        const img = new window.Image();
        objectUrlToRevoke = URL.createObjectURL(inputFile.blob);
        setOriginalImageSrc(objectUrlToRevoke);

        if (!objectUrlToRevoke) {
          throw new Error('Failed to create object URL from input blob.');
        }

        const loadPromise = new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (event: unknown) => {
            console.error('Failed to load image data:', event);
            if (objectUrlToRevoke) {
              URL.revokeObjectURL(objectUrlToRevoke);
            }
            reject(new Error('Failed to load image from blob.'));
          };
          img.src = objectUrlToRevoke!;
        });

        await loadPromise;

        if (img.naturalWidth <= 0 || img.naturalHeight <= 0)
          throw new Error(
            `Invalid image dimensions: ${img.naturalWidth}x${img.naturalHeight}`
          );

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context.');

        processingFunction(ctx, img, options);

        // Determine output type (e.g., PNG default, could be option)
        const outputMimeType = 'image/png'; // Or make configurable via options
        generatedDataUrl = canvas.toDataURL(outputMimeType);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, outputMimeType)
        );
        if (!blob) throw new Error('Canvas toBlob failed.');

        // Use addImage from context - it handles thumbnails and saving to 'files' table
        newImageId = await addImage(blob, outputFileName, outputMimeType);

        // Update history output to reference the new image ID
        historyOutput = {
          message: 'Image processed successfully.',
          imageId: newImageId,
          outputType: outputMimeType,
          outputSize: blob.size,
        } as Record<string, unknown>;
        setProcessedImageSrc(generatedDataUrl);
      } catch (err: unknown) {
        console.error('Processing Error:', err);
        const message =
          err instanceof Error
            ? err.message
            : 'An unknown error occurred during processing.';
        setError(`Error processing image: ${message}`);
        setProcessedImageSrc(null);
        setOriginalImageSrc(null);
        status = 'error';
        historyOutput = `Error: ${message}`;
        inputDetails.error = message;
        newImageId = undefined;
      } finally {
        setIsLoading(false);
        // Use updated addHistoryEntry signature
        addHistoryEntry({
          toolName: toolTitle,
          toolRoute: toolRoute,
          trigger: trigger,
          input: inputDetails,
          output: historyOutput,
          status: status,
          eventTimestamp: Date.now(), // Add event timestamp
        });
        if (objectUrlToRevoke) {
          URL.revokeObjectURL(objectUrlToRevoke);
        }
      }
      // Return the ID of the newly created image file or null on failure
      return newImageId || null;
    },
    [addImage, addHistoryEntry, toolRoute, toolTitle]
  ); // Correct dependencies

  return {
    originalImageSrc,
    processedImageSrc,
    fileName,
    isLoading,
    error,
    setOriginalImageSrc,
    setProcessedImageSrc,
    setFileName,
    setError,
    setIsLoading,
    processImage,
  };
};

export default useImageProcessing;
