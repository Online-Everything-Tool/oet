// FILE: app/tool/_hooks/useImageProcessing.ts
import { useState, useCallback } from 'react';
import {
  useHistory,
  TriggerType,
  NewHistoryData,
} from '../../context/HistoryContext'; // Import NewHistoryData
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
  id: string | null; // Will now always be populated if blob generated
  dataUrl: string | null;
  blob: Blob | null;
}

interface UseImageProcessingReturn {
  originalImageSrc: string | null;
  processedImageSrc: string | null;
  processedImageBlob: Blob | null; // Keep this for potential direct use? Or rely solely on ID? Let's keep for now.
  processedFileId: string | null; // Store the ID of the processed file (temp or perm)
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
    saveOutputToLibrary?: boolean // Now dictates the isTemporary flag for addImage
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
  const [processedFileId, setProcessedFileId] = useState<string | null>(null); // New state for the ID
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { addHistoryEntry } = useHistory();
  // Assuming useImageLibrary now correctly handles adding temporary/permanent files
  // and potentially generating thumbnails before calling the base addFile.
  const { addImage } = useImageLibrary();

  const clearProcessingOutput = useCallback(() => {
    setProcessedImageSrc(null);
    setProcessedImageBlob(null);
    setProcessedFileId(null); // Clear the ID too
    setError(null);
  }, []);

  const processImage = useCallback(
    async (
      inputFile: StoredFile,
      processingFunction: ProcessingFunction,
      trigger: TriggerType,
      outputFileName: string,
      options: Record<string, unknown> = {},
      // Renamed for clarity: this flag determines if the saved file is permanent
      createPermanentEntry: boolean = true
    ): Promise<ProcessImageResult> => {
      console.log(
        'process image:',
        inputFile,
        processingFunction,
        trigger,
        outputFileName,
        options,
        createPermanentEntry
      );

      // Reset state for the new operation
      setOriginalImageSrc(null); // Reset original preview
      clearProcessingOutput(); // Clear previous processed results
      setFileName(inputFile.name); // Set the original filename context

      if (!inputFile.blob || !inputFile.type?.startsWith('image/')) {
        const errMsg = `Invalid input file: ID ${inputFile.id || 'unknown'}, Type ${inputFile.type || 'unknown'}`;
        setError(errMsg);
        setIsLoading(false); // Ensure loading is stopped
        return { id: null, dataUrl: null, blob: null };
      }

      setIsLoading(true);
      setError(null); // Clear previous errors

      let tempOriginalObjectUrl: string | null = null;
      // Initialize result structure
      const result: ProcessImageResult = {
        id: null,
        dataUrl: null,
        blob: null,
      };
      let historyStatus: 'success' | 'error' = 'success';
      let historyOutputDetails: Record<string, unknown> = {}; // Use object for details
      const historyInputDetails: Record<string, unknown> = {
        inputFileId: inputFile.id,
        fileName: inputFile.name,
        originalSize: inputFile.size,
        originalType: inputFile.type,
        requestedSavePreference: createPermanentEntry, // Log user's intent
        ...options,
      };
      let fileIdForHistory: string | null = null;

      try {
        const img = new window.Image();
        tempOriginalObjectUrl = URL.createObjectURL(inputFile.blob);
        setOriginalImageSrc(tempOriginalObjectUrl); // Show original image

        if (tempOriginalObjectUrl === null)
          throw new Error('Object URL creation failed.');
        const urlForImgElement: string = tempOriginalObjectUrl;

        // Load image from blob URL
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

        // Process image on canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context.');
        processingFunction(ctx, img, options);

        // Get processed blob
        const outputMimeType =
          inputFile.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        const quality = outputMimeType === 'image/jpeg' ? 0.9 : undefined;
        const processedBlobFromCanvas = await new Promise<Blob | null>(
          (resolve) => canvas.toBlob(resolve, outputMimeType, quality)
        );
        if (!processedBlobFromCanvas) throw new Error('Canvas toBlob failed.');

        result.blob = processedBlobFromCanvas;
        // Generate data URL *after* blob confirmation for consistency
        result.dataUrl = canvas.toDataURL(outputMimeType, quality);

        const isTemporary = !createPermanentEntry;
        const newFileId = await addImage(
          // Using useImageLibrary's addImage
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
        fileIdForHistory = newFileId; // Use this ID for history entry

        // Update local state
        setProcessedImageSrc(result.dataUrl);
        setProcessedImageBlob(result.blob);
        setProcessedFileId(result.id);

        // Prepare history output details
        historyStatus = 'success';
        historyOutputDetails = {
          message: `Image processed ${isTemporary ? '(temporary)' : '(saved permanently)'}.`,
          outputFileId: result.id, // Use consistent field name maybe?
          outputType: outputMimeType,
          outputSize: result.blob.size,
          isTemporary: isTemporary,
        };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown processing error.';
        console.error('Image Processing Error:', err);
        setError(message);
        // Clear potentially partially set states on error
        setOriginalImageSrc(null); // Maybe keep original? Depends on UX. Let's clear.
        clearProcessingOutput(); // Clear all processed states including ID
        historyStatus = 'error';
        historyOutputDetails = { error: message };
        historyInputDetails.error = message; // Add error to input details for history context
      } finally {
        setIsLoading(false);
        if (tempOriginalObjectUrl) {
          URL.revokeObjectURL(tempOriginalObjectUrl); // Clean up original blob URL
        }

        // --- Log to History ---
        const historyEntryData: NewHistoryData = {
          toolName: toolTitle,
          toolRoute: toolRoute,
          trigger: trigger,
          input: historyInputDetails,
          output: historyOutputDetails, // Contains non-file metadata
          status: historyStatus,
          eventTimestamp: Date.now(),
          // Pass the file ID (temp or perm) to be linked
          outputFileIds: fileIdForHistory ? [fileIdForHistory] : [],
        };
        await addHistoryEntry(historyEntryData); // Let HistoryContext handle logging
      }
      return result;
    },
    [
      toolTitle,
      toolRoute,
      addImage, // From useImageLibrary
      addHistoryEntry, // From useHistory
      clearProcessingOutput, // Local callback
      // No dependency on fileLibrary functions directly
    ]
  );

  return {
    originalImageSrc,
    processedImageSrc,
    processedImageBlob,
    processedFileId, // Return the ID
    fileName,
    isLoading,
    error,
    setOriginalImageSrc,
    processImage,
    clearProcessingOutput,
  };
};

export default useImageProcessing;
