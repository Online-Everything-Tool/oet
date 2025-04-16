// FILE: app/tool/_hooks/useImageProcessing.ts

import { useState, useCallback } from 'react';
import { useHistory, TriggerType } from '../../context/HistoryContext';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import { LibraryImage } from '@/src/types/image';

interface UseImageProcessingProps {
    toolTitle: string;
    toolRoute: string;
}

// Use Record<string, unknown> for options
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
        libraryImage: LibraryImage,
        processingFunction: ProcessingFunction,
        trigger: TriggerType,
        outputFileName: string,
        options?: Record<string, unknown>
    ) => Promise<string | null>;
}

const useImageProcessing = ({ toolTitle, toolRoute }: UseImageProcessingProps): UseImageProcessingReturn => {
    const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
    const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const { addHistoryEntry } = useHistory();
    const { addImage } = useImageLibrary();

    const processImage = useCallback(async (
        libraryImage: LibraryImage,
        processingFunction: ProcessingFunction,
        trigger: TriggerType,
        outputFileName: string,
        options: Record<string, unknown> = {}
    ): Promise<string | null> => {
        setIsLoading(true);
        setError(null);
        setProcessedImageSrc(null);
        setFileName(libraryImage.name);

        let generatedDataUrl: string | null = null;
        let newImageId: string | undefined = undefined;
        let status: 'success' | 'error' = 'success';
        let historyOutput: string | Record<string, unknown> = 'Image processed successfully.';
        const inputDetails = { fileName: libraryImage.name, originalSrcLength: libraryImage.blob.size, ...options };
        let objectUrlToRevoke: string | null = null;

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const img = new (window as any).Image();
            objectUrlToRevoke = URL.createObjectURL(libraryImage.blob);

            const loadPromise = new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                // Use unknown for the error handler parameter
                img.onerror = (event: unknown) => { // FIXED LINE 69 (using unknown)
                    // Log the event (which is now unknown)
                    console.error("Failed to load image data:", event);
                    // You could add type checks here if needed:
                    // if (event instanceof ErrorEvent) { ... }
                    reject(new Error('Failed to load image.'));
                };
                img.src = objectUrlToRevoke;
            });

            await loadPromise;

            if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
                throw new Error(`Invalid image dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
            }
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Failed to get canvas context.');
            }

            processingFunction(ctx, img, options);

            generatedDataUrl = canvas.toDataURL('image/png');
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob) {
                throw new Error("Canvas toBlob failed.");
            }

            newImageId = await addImage(blob, outputFileName, 'image/png');
            historyOutput = { message: 'Image processed successfully.', imageId: newImageId };
            setProcessedImageSrc(generatedDataUrl);

        } catch (err: unknown) {
            console.error("Processing Error:", err);
            const message = err instanceof Error ? err.message : 'An unknown error occurred during processing.';
            setError(`Error processing image: ${message}`);
            setProcessedImageSrc(null);
            status = 'error';
            historyOutput = `Error: ${message}`;
            (inputDetails as Record<string, unknown>).error = message;
            return null;
        } finally {
            setIsLoading(false);
            addHistoryEntry({
                toolName: toolTitle,
                toolRoute: toolRoute,
                trigger: trigger,
                input: inputDetails,
                output: historyOutput,
                status: status,
            });
            if (objectUrlToRevoke) {
                URL.revokeObjectURL(objectUrlToRevoke);
            }
        }
        return newImageId || null;
    }, [addImage, addHistoryEntry, toolTitle, toolRoute]);

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