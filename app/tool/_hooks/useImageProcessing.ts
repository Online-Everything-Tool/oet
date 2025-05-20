// FILE: app/tool/_hooks/useImageProcessing.ts
import { useState, useCallback } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';

type ProcessingFunction = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  options?: Record<string, unknown>
) => void;

export interface ProcessImageResult {
  id: string | null;
  dataUrl: string | null;
  blob: Blob | null;
}

interface UseImageProcessingReturn {
  originalImageSrc: string | null;
  processedImageSrc: string | null;
  processedImageBlob: Blob | null;
  processedFileId: string | null;
  fileName: string | null;
  isLoading: boolean;
  error: string | null;
  setOriginalImageSrc: React.Dispatch<React.SetStateAction<string | null>>;
  processImage: (
    inputFile: StoredFile,
    processingFunction: ProcessingFunction,
    outputFileName: string,
    options?: Record<string, unknown>,
    saveOutputToLibrary?: boolean
  ) => Promise<ProcessImageResult>;
  clearProcessingOutput: () => void;
}

const useImageProcessing = (): UseImageProcessingReturn => {
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(
    null
  );
  const [processedImageBlob, setProcessedImageBlob] = useState<Blob | null>(
    null
  );
  const [processedFileId, setProcessedFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { addFile } = useFileLibrary();

  const clearProcessingOutput = useCallback(() => {
    setProcessedImageSrc(null);
    setProcessedImageBlob(null);
    setProcessedFileId(null);
    setError(null);
  }, []);

  const processImage = useCallback(
    async (
      inputFile: StoredFile,
      processingFunction: ProcessingFunction,
      outputFileName: string,
      options: Record<string, unknown> = {},

      createPermanentEntry: boolean = true
    ): Promise<ProcessImageResult> => {
      console.log(
        'process image:',
        inputFile,
        processingFunction,
        outputFileName,
        options,
        createPermanentEntry
      );

      setOriginalImageSrc(null);
      clearProcessingOutput();
      setFileName(inputFile.filename);

      if (!inputFile.blob || !inputFile.type?.startsWith('image/')) {
        const errMsg = `Invalid input file: ID ${inputFile.id || 'unknown'}, Type ${inputFile.type || 'unknown'}`;
        setError(errMsg);
        setIsLoading(false);
        return { id: null, dataUrl: null, blob: null };
      }

      setIsLoading(true);
      setError(null);

      let tempOriginalObjectUrl: string | null = null;

      const result: ProcessImageResult = {
        id: null,
        dataUrl: null,
        blob: null,
      };
      try {
        const img = new window.Image();
        tempOriginalObjectUrl = URL.createObjectURL(inputFile.blob);
        setOriginalImageSrc(tempOriginalObjectUrl);

        if (tempOriginalObjectUrl === null)
          throw new Error('Object URL creation failed.');
        const urlForImgElement: string = tempOriginalObjectUrl;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (errEvent) =>
            reject(
              new Error(`Failed to load image for processing: ${errEvent}`)
            );
          img.src = urlForImgElement;
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
        const processedBlobFromCanvas = await new Promise<Blob | null>(
          (resolve) => canvas.toBlob(resolve, outputMimeType, quality)
        );
        if (!processedBlobFromCanvas) throw new Error('Canvas toBlob failed.');

        result.blob = processedBlobFromCanvas;

        result.dataUrl = canvas.toDataURL(outputMimeType, quality);

        const isTemporary = !createPermanentEntry;
        const newFileId = await addFile(
          result.blob,
          outputFileName,
          outputMimeType,
          isTemporary
        );

        if (!newFileId)
          throw new Error(
            'Failed to save processed image to library (temporary or permanent).'
          );

        result.id = newFileId;

        setProcessedImageSrc(result.dataUrl);
        setProcessedImageBlob(result.blob);
        setProcessedFileId(result.id);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown processing error.';
        console.error('Image Processing Error:', err);
        setError(message);

        setOriginalImageSrc(null);
        clearProcessingOutput();
      } finally {
        setIsLoading(false);
        if (tempOriginalObjectUrl) {
          URL.revokeObjectURL(tempOriginalObjectUrl);
        }
      }
      return result;
    },
    [addFile, clearProcessingOutput]
  );

  return {
    originalImageSrc,
    processedImageSrc,
    processedImageBlob,
    processedFileId,
    fileName,
    isLoading,
    error,
    setOriginalImageSrc,
    processImage,
    clearProcessingOutput,
  };
};

export default useImageProcessing;
