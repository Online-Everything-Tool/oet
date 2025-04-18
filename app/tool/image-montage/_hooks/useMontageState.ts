// --- FILE: app/tool/image-montage/_hooks/useMontageState.ts ---
import { useState, useCallback, ChangeEvent } from 'react';
import { useHistory } from '@/app/context/HistoryContext';

// Constants moved here or imported if needed elsewhere
const DEFAULT_OVERLAP_PERCENT = 20;
const MAX_OVERLAP_PERCENT = 80;
const MAX_TILT_DEG = 25;

// Type definition (can also be imported from a shared types file)
interface MontageImage {
    id: number; // Keep ID for React key, but use index for moving
    image: HTMLImageElement;
    alt: string;
    tilt: number;
    overlapPercent: number;
}

const getRandomTilt = (): number => {
    const deg = Math.floor(Math.random() * (MAX_TILT_DEG + 1));
    const sign = Math.random() < 0.5 ? -1 : 1;
    return deg === 0 ? 0 : deg * sign;
};

interface UseMontageStateReturn {
    montageImages: MontageImage[];
    addImagesFromFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>; // Renamed for clarity
    clearMontage: () => void;
    handleTiltChange: (imageId: number, newTilt: number) => void;
    handleOverlapChange: (imageId: number, newOverlap: number) => void;
    handleMoveImageLeft: (indexToMove: number) => void;
    handleMoveImageRight: (indexToMove: number) => void;
    isLoading: boolean; // Keep loading related to file processing here
    error: string | null; // Keep file processing error here
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useMontageState(toolTitle: string, toolRoute: string): UseMontageStateReturn {
    const [montageImages, setMontageImages] = useState<MontageImage[]>([]);
    const [isLoading, setIsLoading] = useState(false); // Loading state specifically for file processing
    const [error, setError] = useState<string | null>(null); // Error state specifically for file processing
    const { addHistoryEntry } = useHistory();

    const addImagesFromFiles = useCallback(async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsLoading(true);
        setError(null);
        const filePromises: Promise<MontageImage>[] = [];
        const addedFileNames: string[] = [];
        const currentImageCount = montageImages.length;

        Array.from(files).forEach((file, index) => {
            if (file.type.startsWith('image/')) {
                addedFileNames.push(file.name);
                const promise = new Promise<MontageImage>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if (e.target?.result && typeof e.target.result === 'string') {
                            const img = new Image();
                            img.onload = () => resolve({
                                id: Date.now() + Math.random(),
                                image: img, alt: file.name, tilt: getRandomTilt(),
                                overlapPercent: (currentImageCount + index) === 0 ? 0 : DEFAULT_OVERLAP_PERCENT,
                            });
                            img.onerror = () => reject(new Error(`Failed to load image data for ${file.name}`));
                            img.src = e.target.result;
                        } else reject(new Error(`Failed to read file ${file.name} as data URL.`));
                    };
                    reader.onerror = (error) => reject(error);
                    reader.readAsDataURL(file);
                });
                filePromises.push(promise);
            } else console.warn(`Skipping non-image file: ${file.name}`);
        });

        try {
            const newImages = await Promise.all(filePromises);
            if (newImages.length === 0 && addedFileNames.length > 0) {
                throw new Error("No valid image files were processed successfully.");
            }
            const updatedImageList = [...montageImages, ...newImages];
            setMontageImages(updatedImageList);
            addHistoryEntry({
                toolName: toolTitle, toolRoute: toolRoute, trigger: 'upload',
                input: { fileNames: addedFileNames.join(', ').substring(0, 500), addedCount: newImages.length },
                output: { message: `Added ${newImages.length} image(s). Total: ${updatedImageList.length}.` },
                status: 'success',
            });
        } catch (err) {
            console.error("Error loading one or more images:", err);
            const errorMsg = `Error processing files: ${err instanceof Error ? err.message : 'Unknown error'}`;
            setError(errorMsg);
            addHistoryEntry({
                toolName: toolTitle, toolRoute: toolRoute, trigger: 'upload',
                input: { fileNames: addedFileNames.join(', ').substring(0, 500), error: errorMsg },
                output: { message: errorMsg }, status: 'error',
            });
        } finally {
            setIsLoading(false);
            if (event.target) event.target.value = ''; // Reset file input
        }
    }, [addHistoryEntry, montageImages, toolTitle, toolRoute]); // Dependencies

    const clearMontage = useCallback(() => {
        const previousCount = montageImages.length;
        setMontageImages([]);
        setError(null); // Clear file processing errors too
        // Note: isSaved/isCopied states are managed in the main component
        if (previousCount > 0) {
            addHistoryEntry({
                toolName: toolTitle, toolRoute: toolRoute, trigger: 'click',
                input: { action: 'clear', previousCount: previousCount },
                output: { message: `Cleared ${previousCount} image(s).` },
                status: 'success',
            });
        }
    }, [montageImages.length, addHistoryEntry, toolTitle, toolRoute]);

    const handleTiltChange = useCallback((imageId: number, newTilt: number) => {
        setMontageImages((prevImages) => prevImages.map((img) => img.id === imageId ? { ...img, tilt: newTilt } : img));
        // Resetting save/copy status will be handled in the main component where those states live
    }, []);

    const handleOverlapChange = useCallback((imageId: number, newOverlap: number) => {
        setMontageImages((prevImages) => prevImages.map((img) => img.id === imageId ? { ...img, overlapPercent: Math.max(0, Math.min(MAX_OVERLAP_PERCENT, newOverlap)) } : img));
    }, []);

    const handleMoveImageLeft = useCallback((indexToMove: number) => {
        if (indexToMove <= 0) return;
        setMontageImages(prevImages => {
            const newImages = [...prevImages];
            [newImages[indexToMove - 1], newImages[indexToMove]] = [newImages[indexToMove], newImages[indexToMove - 1]];
            return newImages;
        });
    }, []);

    const handleMoveImageRight = useCallback((indexToMove: number) => {
        setMontageImages(prevImages => {
            if (indexToMove >= prevImages.length - 1) return prevImages;
            const newImages = [...prevImages];
            [newImages[indexToMove + 1], newImages[indexToMove]] = [newImages[indexToMove], newImages[indexToMove + 1]];
            return newImages;
        });
    }, []);

    return {
        montageImages,
        addImagesFromFiles,
        clearMontage,
        handleTiltChange,
        handleOverlapChange,
        handleMoveImageLeft,
        handleMoveImageRight,
        isLoading,
        error,
        setIsLoading, // Still need setters if main component modifies them
        setError,
    };
}
// --- END FILE: app/tool/image-montage/_hooks/useMontageState.ts ---