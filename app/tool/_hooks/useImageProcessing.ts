// FILE: app/tool/_hooks/useImageProcessing.ts
import { useState, useCallback } from 'react';
import { useHistory, TriggerType } from '../../context/HistoryContext';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import type { StoredFile } from '@/src/types/storage';

// Interface for the hook's props - NOT empty
interface UseImageProcessingProps {
    toolTitle: string;
    toolRoute: string;
}

// Type alias for the processing function - uses Record<string, unknown> for options
type ProcessingFunction = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    options?: Record<string, unknown> // Represents an arbitrary object for options
) => void;

// Interface for the hook's return value - NOT empty
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
        options?: Record<string, unknown> // Options here are also Record<string, unknown>
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
        inputFile: StoredFile,
        processingFunction: ProcessingFunction,
        trigger: TriggerType,
        outputFileName: string,
        options: Record<string, unknown> = {} // Default options to empty object
    ): Promise<string | null> => {
        if (!inputFile.blob || inputFile.category !== 'image') {
             const errMsg = `Invalid input file provided to processImage: ID ${inputFile.id}, Category ${inputFile.category}, Blob exists: ${!!inputFile.blob}`;
             console.error(errMsg); setError(errMsg); return null;
        }

        setIsLoading(true); setError(null); setProcessedImageSrc(null); setFileName(inputFile.name);

        let generatedDataUrl: string | null = null;
        let newImageId: string | undefined = undefined;
        let status: 'success' | 'error' = 'success';
        let historyOutput: string | Record<string, unknown> = 'Image processed successfully.';
        // Use Record<string, unknown> explicitly for inputDetails as well
        const inputDetails: Record<string, unknown> = { inputFileId: inputFile.id, fileName: inputFile.name, originalSize: inputFile.size, ...options };
        let objectUrlToRevoke: string | null = null;

        try {
            const img = new window.Image();
            objectUrlToRevoke = URL.createObjectURL(inputFile.blob);
            setOriginalImageSrc(objectUrlToRevoke);

            if (!objectUrlToRevoke) { throw new Error("Failed to create object URL from input blob."); }

            const loadPromise = new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = (event: unknown) => {
                    console.error("Failed to load image data:", event);
                    if (objectUrlToRevoke) { URL.revokeObjectURL(objectUrlToRevoke); }
                    reject(new Error('Failed to load image from blob.'));
                };
                img.src = objectUrlToRevoke!; // Non-null assertion is okay after the check
            });

            await loadPromise;

            if (img.naturalWidth <= 0 || img.naturalHeight <= 0) throw new Error(`Invalid image dimensions: ${img.naturalWidth}x${img.naturalHeight}`);

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Failed to get canvas context.');

            processingFunction(ctx, img, options);

            generatedDataUrl = canvas.toDataURL('image/png');
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error("Canvas toBlob failed.");

            newImageId = await addImage(blob, outputFileName, 'image/png');
            // Ensure historyOutput is Record<string, unknown> when setting object properties
            historyOutput = { message: 'Image processed successfully.', imageId: newImageId } as Record<string, unknown>;
            setProcessedImageSrc(generatedDataUrl);

        } catch (err: unknown) {
            console.error("Processing Error:", err);
            const message = err instanceof Error ? err.message : 'An unknown error occurred during processing.';
            setError(`Error processing image: ${message}`);
            setProcessedImageSrc(null); setOriginalImageSrc(null); status = 'error';
            // Ensure historyOutput is string on error
            historyOutput = `Error: ${message}`;
            inputDetails.error = message; // Add error detail to input log
            newImageId = undefined;
        } finally {
            setIsLoading(false);
            addHistoryEntry({
                toolName: toolTitle, toolRoute: toolRoute, trigger: trigger,
                input: inputDetails, output: historyOutput, status: status,
            });
            if (objectUrlToRevoke) {
                URL.revokeObjectURL(objectUrlToRevoke);
            }
        }
        return newImageId || null;
    }, [addImage, addHistoryEntry, toolRoute, toolTitle]); // Correct dependencies

    return {
        originalImageSrc, processedImageSrc, fileName, isLoading, error,
        setOriginalImageSrc, setProcessedImageSrc, setFileName, setError, setIsLoading,
        processImage,
    };
};

export default useImageProcessing;