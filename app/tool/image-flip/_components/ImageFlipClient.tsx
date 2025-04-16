// FILE: app/tool/image-flip/_components/ImageFlipClient.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image'; // Use Next.js Image component
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import { LibraryImage } from '@/app/lib/db';
import ImageSelectionModal from '@/app/tool/_components/ImageSelectionModal';
import useImageProcessing from "@/app/tool/_hooks/useImageProcessing"; // Import the updated hook

interface ImageFlipClientProps {
    toolTitle: string;
    toolRoute: string;
}

export default function ImageFlipClient({ toolTitle, toolRoute }: ImageFlipClientProps) {
    const [flipType, setFlipType] = useState<'horizontal' | 'vertical'>('horizontal');
    const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
    const [selectedLibraryImage, setSelectedLibraryImage] = useState<LibraryImage | null>(null);
    const [isCopied, setIsCopied] = useState<boolean>(false); // Local state for copy feedback
    const [lastProcessedImageId, setLastProcessedImageId] = useState<string | null>(null); // Store ID of the last *output* image

    const {
        originalImageSrc,
        processedImageSrc,
        fileName, // Original filename from hook
        isLoading,
        error,
        setOriginalImageSrc,
        setProcessedImageSrc,
        setFileName,
        setError, // Need setError for dependency arrays
        setIsLoading,
        processImage,
    } = useImageProcessing({ toolTitle, toolRoute });

    const { getImage } = useImageLibrary(); // Get the function to fetch blobs by ID

    const flip = useCallback((ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
        ctx.clearRect(0, 0, img.width, img.height);
        ctx.save();
        if (flipType === 'horizontal') {
            ctx.scale(-1, 1);
            ctx.translate(-img.width, 0);
        } else {
            ctx.scale(1, -1);
            ctx.translate(0, -img.height);
        }
        ctx.drawImage(img, 0, 0);
        ctx.restore();
    }, [flipType]);

    useEffect(() => {
        let objectUrl: string | null = null;
        if (selectedLibraryImage) {
            objectUrl = URL.createObjectURL(selectedLibraryImage.blob);
            setOriginalImageSrc(objectUrl);
            setFileName(selectedLibraryImage.name);
            setProcessedImageSrc(null);
            setError('');
        } else {
            setOriginalImageSrc(null);
            setFileName(null);
        }
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [selectedLibraryImage, setOriginalImageSrc, setProcessedImageSrc, setFileName, setError]);

    useEffect(() => {
        if (selectedLibraryImage && originalImageSrc) {
            const triggerProcessing = async () => {
                const baseName = selectedLibraryImage.name.substring(0, selectedLibraryImage.name.lastIndexOf('.')) || selectedLibraryImage.name;
                const extension = selectedLibraryImage.name.substring(selectedLibraryImage.name.lastIndexOf('.') + 1) || 'png';
                const outputFileName = `flipped-${flipType}-${baseName}.${extension}`;
                const newImageId = await processImage(
                    selectedLibraryImage,
                    flip,
                    'auto',
                    outputFileName,
                    { flipType: flipType }
                );
                 setLastProcessedImageId(newImageId);
            };
            triggerProcessing();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLibraryImage, flipType, originalImageSrc]);

    const handleImageSelect = useCallback((image: LibraryImage) => {
        setIsLibraryModalOpen(false);
        setSelectedLibraryImage(image);
    }, []);

    const handleFlipTypeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setFlipType(event.target.value as 'horizontal' | 'vertical');
        setIsCopied(false);
    }, []);

    const handleClear = useCallback(() => {
        setOriginalImageSrc(null);
        setProcessedImageSrc(null);
        setFileName(null);
        setFlipType('horizontal');
        setError('');
        setIsLoading(false);
        setSelectedLibraryImage(null);
        setLastProcessedImageId(null);
        setIsCopied(false);
    }, [setOriginalImageSrc, setProcessedImageSrc, setFileName, setError, setIsLoading]);

    const handleDownload = useCallback(() => {
        if (!processedImageSrc || !fileName) {
             setError('No processed image available to download.'); // Use setError
            return;
        }
         setError(''); // Use setError
        const link = document.createElement('a');
        const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1) || 'png';
        link.download = `flipped-${flipType}-${baseName}.${extension}`;
        link.href = processedImageSrc;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [processedImageSrc, fileName, flipType, setError]); // Added setError

    const handleCopyToClipboard = useCallback(async () => {
         if (!lastProcessedImageId) {
             setError('No processed image ID available to copy.'); // Use setError
             return;
         }
        setIsCopied(false);
        setError(''); // Use setError

        try {
            const imageData = await getImage(lastProcessedImageId);
            if (!imageData || !imageData.blob) {
                throw new Error("Processed image data not found in library.");
            }
            if (!navigator.clipboard?.write) {
                throw new Error("Clipboard API (write) not available or not permitted.");
            }
            const clipboardItem = new ClipboardItem({ [imageData.blob.type]: imageData.blob });
            await navigator.clipboard.write([clipboardItem]);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy image to clipboard:', err);
            const message = err instanceof Error ? err.message : 'Unknown clipboard error';
            setError(`Copy failed: ${message}`); // Use setError
        }
    }, [lastProcessedImageId, getImage, setError]); // Added setError


    return (
        <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
            {/* Controls Section */}
            <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
                <button
                    type="button"
                    onClick={() => setIsLibraryModalOpen(true)}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {originalImageSrc ? 'Change Image' : 'Select from Library'}
                </button>

                <fieldset className="flex gap-x-4 gap-y-2 items-center">
                    <legend className="sr-only">Flip Direction</legend>
                    <div className="flex items-center">
                        <input type="radio" id="flip-h" name="flipType" value="horizontal" checked={flipType === 'horizontal'} onChange={handleFlipTypeChange} disabled={isLoading} className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))] disabled:opacity-50" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }} />
                        <label htmlFor="flip-h" className={`ml-2 block text-sm ${isLoading ? 'text-[rgb(var(--color-text-muted))] opacity-50' : 'text-[rgb(var(--color-text-base))]'} cursor-pointer`}>Horizontal</label>
                    </div>
                    <div className="flex items-center">
                        <input type="radio" id="flip-v" name="flipType" value="vertical" checked={flipType === 'vertical'} onChange={handleFlipTypeChange} disabled={isLoading} className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))] disabled:opacity-50" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }} />
                        <label htmlFor="flip-v" className={`ml-2 block text-sm ${isLoading ? 'text-[rgb(var(--color-text-muted))] opacity-50' : 'text-[rgb(var(--color-text-base))]'} cursor-pointer`}>Vertical</label>
                    </div>
                </fieldset>

                <div className="flex gap-3 ml-auto">
                    <button type="button" onClick={handleDownload} disabled={!processedImageSrc || isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-primary-text))] bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                        Download
                    </button>
                    <button type="button" onClick={handleCopyToClipboard} disabled={!processedImageSrc || isLoading} className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${isCopied ? 'bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] text-[rgb(var(--color-button-secondary-text))]' : 'bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] text-[rgb(var(--color-button-accent-text))]'}`}>
                        {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <button type="button" onClick={handleClear} disabled={!originalImageSrc && !processedImageSrc && !error && !isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                        Clear
                    </button>
                </div>
            </div>

            {error && (
                <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    <div><strong className="font-semibold">Error:</strong> {error}</div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
                        Original Image {fileName && <span className="font-normal text-xs text-[rgb(var(--color-text-muted))]">({fileName})</span>}
                    </label>
                    <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
                        {originalImageSrc ? (
                            <Image
                                src={originalImageSrc}
                                alt={fileName || "Original"}
                                width={500}
                                height={500}
                                className="max-w-full max-h-full object-contain"
                                unoptimized={true}
                            />
                        ) : (
                             <span className="text-sm text-[rgb(var(--color-input-placeholder))] italic">Select an image</span>
                         )}
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">Flipped Image</label>
                    <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
                        {isLoading && !processedImageSrc && (
                             <span className="text-sm text-[rgb(var(--color-text-link))] italic animate-pulse">Flipping...</span>
                         )}
                        {!isLoading && processedImageSrc ? (
                            <Image
                                src={processedImageSrc}
                                alt={fileName ? `Flipped ${fileName}` : "Flipped Image"}
                                width={500}
                                height={500}
                                className="max-w-full max-h-full object-contain"
                                unoptimized={true}
                            />
                        ) : !isLoading && (
                             <span className="text-sm text-[rgb(var(--color-input-placeholder))] italic">Output appears here</span>
                         )}
                    </div>
                </div>
            </div>

            <ImageSelectionModal
                isOpen={isLibraryModalOpen}
                onClose={() => setIsLibraryModalOpen(false)}
                onImageSelect={handleImageSelect}
                className="max-w-4xl"
            />
        </div>
    );
}