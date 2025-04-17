// FILE: app/tool/image-flip/_components/ImageFlipClient.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
// Import StoredFile instead of LibraryImage
import type { StoredFile } from '@/src/types/storage';
// Import the generic FileSelectionModal
import FileSelectionModal from '@/app/tool/_components/FileSelectionModal'; // Updated path
import useImageProcessing from "@/app/tool/_hooks/useImageProcessing";

interface ImageFlipClientProps {
    toolTitle: string;
    toolRoute: string;
}

export default function ImageFlipClient({ toolTitle, toolRoute }: ImageFlipClientProps) {
    const [flipType, setFlipType] = useState<'horizontal' | 'vertical'>('horizontal');
    const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
    // Update state to hold StoredFile | null
    const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);
    const [isCopied, setIsCopied] = useState<boolean>(false);
    const [lastProcessedImageId, setLastProcessedImageId] = useState<string | null>(null);

    const {
        originalImageSrc,
        processedImageSrc,
        fileName, // Original filename from hook
        isLoading,
        error,
        setOriginalImageSrc,
        setProcessedImageSrc,
        setFileName,
        setError,
        setIsLoading,
        processImage,
    } = useImageProcessing({ toolTitle, toolRoute });

    const { getImage } = useImageLibrary();

    // flip function remains the same
    const flip = useCallback((ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
        const { naturalWidth: w, naturalHeight: h } = img; // Use natural dimensions
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        if (flipType === 'horizontal') {
            ctx.scale(-1, 1);
            ctx.translate(-w, 0);
        } else { // vertical
            ctx.scale(1, -1);
            ctx.translate(0, -h);
        }
        ctx.drawImage(img, 0, 0, w, h); // Draw with original dimensions
        ctx.restore();
    }, [flipType]);

    // Effect to create/revoke Object URL for the *original* selected image preview
    useEffect(() => {
        let objectUrl: string | null = null;
        if (selectedFile?.blob) { // Use selectedFile state
            try {
                objectUrl = URL.createObjectURL(selectedFile.blob);
                setOriginalImageSrc(objectUrl);
                setFileName(selectedFile.name); // Set filename from selected file
                // Clear previous results when a new image is selected
                setProcessedImageSrc(null);
                setError(null); // Use setError hook
                setLastProcessedImageId(null);
                setIsCopied(false);
            } catch (e) {
                console.error("Error creating object URL:", e);
                setError("Could not create preview for selected image.");
                setOriginalImageSrc(null);
                setFileName(null);
            }
        } else {
            // Clear if no file is selected
            setOriginalImageSrc(null);
            setFileName(null);
        }
        // Cleanup function
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
                // console.log("Revoked original image object URL"); // Debug log
            }
        };
        // Re-run when selectedFile changes
    }, [selectedFile, setOriginalImageSrc, setProcessedImageSrc, setFileName, setError]);

    // Effect to trigger processing when selection or flip type changes
    useEffect(() => {
        // Only process if we have a selected file and its preview URL is set
        if (selectedFile && originalImageSrc) {
            const triggerProcessing = async () => {
                // Generate output filename based on original name and flip type
                const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
                const extension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.') + 1) || 'png'; // Default to png if no ext
                const outputFileName = `flipped-${flipType}-${baseName}.${extension}`;

                // Call the processImage hook function, passing the StoredFile object
                const newImageId = await processImage(
                    selectedFile, // Pass the StoredFile object
                    flip,         // Pass the canvas drawing function
                    'auto',       // Trigger type (could be 'click' if tied to a button)
                    outputFileName,
                    { flipType: flipType } // Pass options relevant to history/processing
                );
                 setLastProcessedImageId(newImageId); // Store the ID of the *newly created* flipped image
            };
            triggerProcessing();
        }
        // Intentionally disable exhaustive-deps for this effect.
        // We *only* want this to re-run when selectedFile (the input) or flipType (the option) changes.
        // Adding processImage, flip, etc., would cause unnecessary re-runs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFile, flipType, originalImageSrc]); // Rerun processing if input or flip type changes


    // Callback for the new FileSelectionModal
    const handleFilesSelected = useCallback((files: StoredFile[], source: 'library' | 'upload') => {
        setIsLibraryModalOpen(false);
        if (files && files.length > 0) {
            console.log(`[ImageFlip] File selected from ${source}:`, files[0].name);
            // This tool likely only processes one image, take the first one
            if (files[0].category === 'image' && files[0].blob) {
                setSelectedFile(files[0]);
            } else {
                setError("Invalid file selected. Please select an image.");
                setSelectedFile(null);
            }
        } else {
             setSelectedFile(null); // Clear selection if modal closed without selection
        }
    }, [setError]); // Add setError dependency


    const handleFlipTypeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setFlipType(event.target.value as 'horizontal' | 'vertical');
        setIsCopied(false); // Reset copy status on change
    }, []);

    const handleClear = useCallback(() => {
        setOriginalImageSrc(null);
        setProcessedImageSrc(null);
        setFileName(null);
        setFlipType('horizontal');
        setError(null); // Use setError
        setIsLoading(false); // Reset loading state if needed
        setSelectedFile(null); // Clear selected file state
        setLastProcessedImageId(null);
        setIsCopied(false);
    }, [setOriginalImageSrc, setProcessedImageSrc, setFileName, setError, setIsLoading]); // Add setError, setIsLoading dependencies

    const handleDownload = useCallback(() => {
        if (!processedImageSrc || !fileName) {
            setError('No processed image available to download.');
            return;
        }
        setError(null);
        const link = document.createElement('a');
        const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1) || 'png';
        link.download = `flipped-${flipType}-${baseName}.${extension}`;
        link.href = processedImageSrc; // Assume processedImageSrc is a usable URL (DataURL or ObjectURL)
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Note: If processedImageSrc is an ObjectURL, it should ideally be revoked later
    }, [processedImageSrc, fileName, flipType, setError]);

    const handleCopyToClipboard = useCallback(async () => {
        if (!lastProcessedImageId) { // Use the ID of the processed image in the library
            setError('No processed image available to copy.');
            return;
        }
        setIsCopied(false);
        setError(null);

        try {
            // Fetch the processed image blob using its ID
            const imageData = await getImage(lastProcessedImageId);
            if (!imageData?.blob) { // Check for blob existence
                throw new Error("Processed image data or blob not found in library.");
            }
            if (!navigator.clipboard?.write) {
                throw new Error("Clipboard API (write) not available or not permitted.");
            }
            const clipboardItem = new ClipboardItem({ [imageData.blob.type]: imageData.blob });
            await navigator.clipboard.write([clipboardItem]);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000); // Reset feedback
        } catch (err) {
            console.error('Failed to copy image to clipboard:', err);
            const message = err instanceof Error ? err.message : 'Unknown clipboard error';
            setError(`Copy failed: ${message}`);
        }
    }, [lastProcessedImageId, getImage, setError]); // Depends on processed image ID and getImage func


    return (
        <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
            {/* Controls Section */}
            <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
                <button
                    type="button"
                    onClick={() => setIsLibraryModalOpen(true)}
                    disabled={isLoading} // Disable while processing
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {originalImageSrc ? 'Change Image' : 'Select from Library'}
                </button>

                <fieldset className="flex gap-x-4 gap-y-2 items-center" disabled={isLoading || !originalImageSrc}> {/* Disable if no image or loading */}
                    <legend className="sr-only">Flip Direction</legend>
                    <div className="flex items-center">
                        <input type="radio" id="flip-h" name="flipType" value="horizontal" checked={flipType === 'horizontal'} onChange={handleFlipTypeChange} disabled={isLoading || !originalImageSrc} className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:ring-[rgb(var(--color-input-focus-border))] disabled:opacity-50 disabled:cursor-not-allowed accent-[rgb(var(--color-checkbox-accent))]" />
                        <label htmlFor="flip-h" className={`ml-2 block text-sm ${isLoading || !originalImageSrc ? 'text-gray-400 cursor-not-allowed' : 'text-[rgb(var(--color-text-base))] cursor-pointer'}`}>Horizontal</label>
                    </div>
                    <div className="flex items-center">
                        <input type="radio" id="flip-v" name="flipType" value="vertical" checked={flipType === 'vertical'} onChange={handleFlipTypeChange} disabled={isLoading || !originalImageSrc} className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:ring-[rgb(var(--color-input-focus-border))] disabled:opacity-50 disabled:cursor-not-allowed accent-[rgb(var(--color-checkbox-accent))]" />
                        <label htmlFor="flip-v" className={`ml-2 block text-sm ${isLoading || !originalImageSrc ? 'text-gray-400 cursor-not-allowed' : 'text-[rgb(var(--color-text-base))] cursor-pointer'}`}>Vertical</label>
                    </div>
                </fieldset>

                <div className="flex gap-3 ml-auto">
                    <button type="button" onClick={handleDownload} disabled={!processedImageSrc || isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-primary-text))] bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                        Download
                    </button>
                    <button type="button" onClick={handleCopyToClipboard} disabled={!processedImageSrc || isLoading} className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${isCopied ? 'bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] text-[rgb(var(--color-button-secondary-text))]' : 'bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] text-[rgb(var(--color-button-accent-text))]'}`}>
                        {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <button type="button" onClick={handleClear} disabled={!originalImageSrc && !processedImageSrc && !error} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                        Clear
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    <div><strong className="font-semibold">Error:</strong> {error}</div>
                </div>
            )}

            {/* Image Previews */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Original Image Preview */}
                 <div className="space-y-1">
                    <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
                        Original Image {fileName && <span className="font-normal text-xs text-[rgb(var(--color-text-muted))]">({fileName})</span>}
                    </label>
                    <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
                        {originalImageSrc ? ( <Image src={originalImageSrc} alt={fileName || "Original"} width={500} height={500} className="max-w-full max-h-full object-contain" unoptimized={true} /> )
                         : (<span className="text-sm text-[rgb(var(--color-input-placeholder))] italic">Select an image from library</span>)}
                    </div>
                </div>

                {/* Processed Image Preview */}
                 <div className="space-y-1">
                    <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">Flipped Image</label>
                    <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
                        {isLoading && !processedImageSrc && (<span className="text-sm text-[rgb(var(--color-text-link))] italic animate-pulse">Flipping...</span>)}
                        {!isLoading && processedImageSrc ? (<Image src={processedImageSrc} alt={fileName ? `Flipped ${fileName}` : "Flipped Image"} width={500} height={500} className="max-w-full max-h-full object-contain" unoptimized={true} />)
                         : !isLoading && (<span className="text-sm text-[rgb(var(--color-input-placeholder))] italic">Output appears here</span>)}
                    </div>
                </div>
            </div>

            {/* Use the new FileSelectionModal */}
            <FileSelectionModal
                isOpen={isLibraryModalOpen}
                onClose={() => setIsLibraryModalOpen(false)}
                // Pass the new callback function
                onFilesSelected={handleFilesSelected}
                // Filter to show only images in the library tab
                libraryFilter={{ category: 'image' }}
                // This tool likely only handles one image
                selectionMode="single"
                // Optional: Specify accepted image types for upload tab
                accept="image/*"
                className="max-w-4xl" // Example custom class
            />
        </div>
    );
}