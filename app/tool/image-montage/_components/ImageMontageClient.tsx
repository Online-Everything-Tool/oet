// FILE: app/tool/image-montage/_components/ImageMontageClient.tsx
'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { useHistory } from '../../../context/HistoryContext';

interface MontageImage {
    id: number;
    image: HTMLImageElement;
    alt: string;
    tilt: number;
    overlapPercent: number;
}

const POLAROID_WIDTH = 150;
const POLAROID_HEIGHT = 150;
const BORDER_PADDING = 10;
const BOTTOM_PADDING = 30;
const TOTAL_POLAROID_WIDTH = POLAROID_WIDTH + BORDER_PADDING * 2;
const TOTAL_POLAROID_HEIGHT = POLAROID_HEIGHT + BORDER_PADDING + BOTTOM_PADDING;
const MAX_TILT_DEG = 25;
const DEFAULT_OVERLAP_PERCENT = 20;
const MAX_OVERLAP_PERCENT = 80;

const getRandomTilt = (): number => {
    const deg = Math.floor(Math.random() * (MAX_TILT_DEG + 1));
    const sign = Math.random() < 0.5 ? -1 : 1;
    return deg === 0 ? 0 : deg * sign;
};

const calculateMaxBounds = (width: number, height: number): { maxW: number; maxH: number } => {
    const diagonal = Math.sqrt(width * width + height * height);
    return { maxW: diagonal, maxH: diagonal };
};

const calculateRenderedBounds = (
    images: MontageImage[],
    mainCanvasHeight: number
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } | null => {
    if (images.length === 0) return null;
    const { maxW, maxH } = calculateMaxBounds(TOTAL_POLAROID_WIDTH, TOTAL_POLAROID_HEIGHT);
    const canvasPaddingValue = maxH * 0.3;
    let totalContentWidth = TOTAL_POLAROID_WIDTH;
    for (let i = 1; i < images.length; i++) {
        const currentOverlapPercent = Math.max(0, Math.min(MAX_OVERLAP_PERCENT, images[i].overlapPercent));
        const overlapPixels = TOTAL_POLAROID_WIDTH * (currentOverlapPercent / 100);
        totalContentWidth += (TOTAL_POLAROID_WIDTH - overlapPixels);
    }
    const finalCanvasWidth = Math.ceil(totalContentWidth + canvasPaddingValue * 2);
    const horizontalBuffer = (maxW - TOTAL_POLAROID_WIDTH) / 2;
    const verticalBuffer = (maxH - TOTAL_POLAROID_HEIGHT) / 2;
    const minX = Math.max(0, canvasPaddingValue - horizontalBuffer);
    const maxX = Math.min(finalCanvasWidth, canvasPaddingValue + totalContentWidth + horizontalBuffer);
    const centerY = mainCanvasHeight / 2;
    const minY = Math.max(0, centerY - TOTAL_POLAROID_HEIGHT / 2 - verticalBuffer);
    const maxY = Math.min(mainCanvasHeight, centerY + TOTAL_POLAROID_HEIGHT / 2 + verticalBuffer);
    const width = Math.max(1, Math.ceil(maxX - minX));
    const height = Math.max(1, Math.ceil(maxY - minY));
    return { minX: Math.floor(minX), minY: Math.floor(minY), maxX: Math.ceil(maxX), maxY: Math.ceil(maxY), width, height };
};

interface ImageMontageClientProps {
    toolTitle: string;
    toolRoute: string;
}

export default function ImageMontageClient({ toolTitle, toolRoute }: ImageMontageClientProps) {
    const [montageImages, setMontageImages] = useState<MontageImage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { addHistoryEntry } = useHistory();
    // Removed unused addImage destructuring
    // const { addImage } = useImageLibrary();

    const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
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
                            img.onload = () => {
                                resolve({
                                    id: Date.now() + Math.random(),
                                    image: img,
                                    alt: file.name,
                                    tilt: getRandomTilt(),
                                    overlapPercent: (currentImageCount + index) === 0 ? 0 : DEFAULT_OVERLAP_PERCENT,
                                });
                            };
                            img.onerror = () => reject(new Error(`Failed to load image data for ${file.name}`));
                            img.src = e.target.result;
                        } else {
                            reject(new Error(`Failed to read file ${file.name} as data URL.`));
                        }
                    };
                    reader.onerror = (error) => reject(error);
                    reader.readAsDataURL(file);
                });
                filePromises.push(promise);
            } else {
                console.warn(`Skipping non-image file: ${file.name}`);
            }
        });

        Promise.all(filePromises)
            .then((newImages) => {
                if (newImages.length === 0 && addedFileNames.length > 0) {
                     throw new Error("No valid image files were processed successfully.");
                 }
                const updatedImageList = [...montageImages, ...newImages];
                setMontageImages(updatedImageList);
                addHistoryEntry({
                    toolName: toolTitle,
                    toolRoute: toolRoute,
                    trigger: 'upload',
                    input: { fileNames: addedFileNames.join(', ').substring(0, 500), addedCount: newImages.length },
                    output: { message: `Added ${newImages.length} image(s). Total: ${updatedImageList.length}.` },
                    status: 'success',
                });
            })
            .catch((error) => {
                console.error("Error loading one or more images:", error);
                const errorMsg = `Error processing files: ${error instanceof Error ? error.message : 'Unknown error'}`;
                setError(errorMsg);
                addHistoryEntry({
                    toolName: toolTitle,
                    toolRoute: toolRoute,
                    trigger: 'upload',
                    input: { fileNames: addedFileNames.join(', ').substring(0, 500), error: errorMsg },
                    output: { message: errorMsg },
                    status: 'error',
                });
            })
            .finally(() => {
                setIsLoading(false);
                if (event.target) event.target.value = '';
            });
    }, [addHistoryEntry, montageImages, toolTitle, toolRoute]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) { console.error("Failed to get 2D context"); return; }

        if (montageImages.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const computedStyle = getComputedStyle(document.documentElement);
        const subtleBgColor = computedStyle.getPropertyValue('--color-bg-subtle').trim() || '244 244 245';
        const componentBgColor = computedStyle.getPropertyValue('--color-bg-component').trim() || '255 255 255';
        const borderBaseColor = computedStyle.getPropertyValue('--color-border-base').trim() || '212 212 216';

        const { maxH } = calculateMaxBounds(TOTAL_POLAROID_WIDTH, TOTAL_POLAROID_HEIGHT);
        const canvasPadding = maxH * 0.3;
        const canvasHeight = Math.ceil(maxH + canvasPadding * 2);
        let totalContentWidth = TOTAL_POLAROID_WIDTH;
        for (let i = 1; i < montageImages.length; i++) {
            const currentOverlapPercent = Math.max(0, Math.min(MAX_OVERLAP_PERCENT, montageImages[i].overlapPercent));
            const overlapPixels = TOTAL_POLAROID_WIDTH * (currentOverlapPercent / 100);
            totalContentWidth += (TOTAL_POLAROID_WIDTH - overlapPixels);
        }
        const canvasWidth = Math.ceil(totalContentWidth + canvasPadding * 2);

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        ctx.fillStyle = `rgb(${subtleBgColor})`;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        let nextImageStartX = canvasPadding;
        montageImages.forEach((imgData, index) => {
            const { image, tilt } = imgData;
            const tiltRad = tilt * (Math.PI / 180);
            const centerX = nextImageStartX + TOTAL_POLAROID_WIDTH / 2;
            const centerY = canvasHeight / 2;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(tiltRad);

            const polaroidX = -TOTAL_POLAROID_WIDTH / 2;
            const polaroidY = -TOTAL_POLAROID_HEIGHT / 2;

            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 3;

            ctx.fillStyle = `rgb(${componentBgColor})`;
            ctx.fillRect(polaroidX, polaroidY, TOTAL_POLAROID_WIDTH, TOTAL_POLAROID_HEIGHT);

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            const imageX = polaroidX + BORDER_PADDING;
            const imageY = polaroidY + BORDER_PADDING;
            ctx.drawImage(image, imageX, imageY, POLAROID_WIDTH, POLAROID_HEIGHT);

            ctx.strokeStyle = `rgba(${borderBaseColor}, 0.3)`;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(imageX - 0.5, imageY - 0.5, POLAROID_WIDTH + 1, POLAROID_HEIGHT + 1);

            ctx.restore();

            if (index < montageImages.length - 1) {
                const nextOverlapPercent = Math.max(0, Math.min(MAX_OVERLAP_PERCENT, montageImages[index + 1].overlapPercent));
                const nextOverlapPixels = TOTAL_POLAROID_WIDTH * (nextOverlapPercent / 100);
                const stepX = TOTAL_POLAROID_WIDTH - nextOverlapPixels;
                nextImageStartX += stepX;
            }
        });
    }, [montageImages]);

    const handleClearMontage = useCallback(() => {
        const previousCount = montageImages.length;
        setMontageImages([]);
        setError(null);
        setIsCopied(false);
        if (previousCount > 0) {
             addHistoryEntry({
                 toolName: toolTitle, toolRoute: toolRoute, trigger: 'click',
                 input: { action: 'clear', previousCount: previousCount },
                 output: { message: `Cleared ${previousCount} image(s).` },
                 status: 'success',
             });
        }
    }, [montageImages.length, addHistoryEntry, toolTitle, toolRoute]);

    const handleDownload = useCallback(() => {
        const mainCanvas = canvasRef.current;
        if (!mainCanvas || montageImages.length === 0) {
             setError("No montage available to download.");
             return;
         }
        setError(null);

        const bounds = calculateRenderedBounds(montageImages, mainCanvas.height);
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
            console.error("Could not calculate valid bounds for download.");
            setError("Failed to calculate image bounds for download.");
            return;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = bounds.width;
        tempCanvas.height = bounds.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
            console.error("Failed to get context for temporary download canvas.");
             setError("Failed to prepare image for download.");
            return;
        }

        const computedStyle = getComputedStyle(document.documentElement);
        const bgColor = computedStyle.getPropertyValue('--color-bg-subtle').trim() || '244 244 245';
        tempCtx.fillStyle = `rgb(${bgColor})`;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        tempCtx.drawImage(
            mainCanvas,
            bounds.minX, bounds.minY, bounds.width, bounds.height,
            0, 0, bounds.width, bounds.height
        );

        tempCanvas.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `oet-montage-${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                 addHistoryEntry({
                     toolName: toolTitle, toolRoute: toolRoute, trigger: 'click',
                     input: { action: 'download', imageCount: montageImages.length },
                     output: { message: `Downloaded montage (${montageImages.length} images).` },
                     status: 'success',
                 });
            } else {
                console.error("Failed to create blob from temporary canvas for download.");
                setError("Failed to generate image blob for download.");
            }
        }, 'image/png', 0.95);
    }, [montageImages, addHistoryEntry, toolTitle, toolRoute]);

    const handleCopyToClipboard = useCallback(async () => {
        const mainCanvas = canvasRef.current;
        if (!mainCanvas || montageImages.length === 0) {
             setError("No montage available to copy.");
             return;
         }
        setIsCopied(false);
        setError(null);

        const bounds = calculateRenderedBounds(montageImages, mainCanvas.height);
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
            console.error("Could not calculate valid bounds for clipboard copy.");
            setError("Failed to calculate image bounds for copy.");
            return;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = bounds.width;
        tempCanvas.height = bounds.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
             console.error("Failed to get context for temporary copy canvas.");
             setError("Failed to prepare image for copy.");
            return;
         }

         const computedStyle = getComputedStyle(document.documentElement);
         const bgColor = computedStyle.getPropertyValue('--color-bg-subtle').trim() || '244 244 245';
         tempCtx.fillStyle = `rgb(${bgColor})`;
         tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

         tempCtx.drawImage(
            mainCanvas,
            bounds.minX, bounds.minY, bounds.width, bounds.height,
            0, 0, bounds.width, bounds.height
        );

        try {
            if (!navigator.clipboard?.write) { throw new Error("Clipboard API (write) not available or not permitted."); }

            tempCanvas.toBlob(async (blob) => {
                if (!blob) { throw new Error("Failed to create blob from canvas for clipboard."); }
                try {
                    const clipboardItem = new ClipboardItem({ 'image/png': blob });
                    await navigator.clipboard.write([clipboardItem]);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                     addHistoryEntry({
                         toolName: toolTitle, toolRoute: toolRoute, trigger: 'click',
                         input: { action: 'copy', imageCount: montageImages.length },
                         output: { message: `Copied montage (${montageImages.length} images).` },
                         status: 'success',
                     });
                } catch (err) {
                    console.error('Failed to write image to clipboard:', err);
                    setError(`Copy failed: ${err instanceof Error ? err.message : 'Unknown clipboard error'}`);
                }
            }, 'image/png');
        } catch (err) {
            console.error('Clipboard API access error:', err);
            setError(`Copy failed: ${err instanceof Error ? err.message : 'Clipboard access denied?'}`);
        }
    }, [montageImages, addHistoryEntry, toolTitle, toolRoute]);

    const handleTiltChange = useCallback((imageId: number, newTilt: number) => {
        setMontageImages((prevImages) => prevImages.map((img) => img.id === imageId ? { ...img, tilt: newTilt } : img));
    }, []);

    const handleImageOverlapChange = useCallback((imageId: number, newOverlap: number) => {
        setMontageImages((prevImages) => prevImages.map((img) => img.id === imageId ? { ...img, overlapPercent: Math.max(0, Math.min(MAX_OVERLAP_PERCENT, newOverlap)) } : img));
    }, []);

    return (
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
            {/* Controls Area */}
            <div className="flex-shrink-0 pb-4 border-b border-[rgb(var(--color-border-base))] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                        <label htmlFor="imageUpload" className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {isLoading ? 'Processing...' : 'Add Images'}
                        </label>
                        <input id="imageUpload" type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" disabled={isLoading} />

                        <button type="button" onClick={handleClearMontage} disabled={montageImages.length === 0 || isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                            Clear
                        </button>

                        <button type="button" onClick={handleDownload} disabled={montageImages.length === 0 || isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-primary-text))] bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                            Download
                        </button>

                        <button type="button" onClick={handleCopyToClipboard} disabled={montageImages.length === 0 || isLoading} className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${isCopied ? 'bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] text-[rgb(var(--color-button-secondary-text))]' : 'bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] text-[rgb(var(--color-button-accent-text))]'}`}>
                            {isCopied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>
            </div>

             {/* Error Display */}
             {error && (
                 <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                     <div><strong className="font-semibold">Error:</strong> {error}</div>
                 </div>
             )}

            {/* Image Adjustment Area */}
            {montageImages.length > 0 && (
                <div className="flex-shrink-0 pb-4 border-b border-[rgb(var(--color-border-base))]">
                    <h2 className="text-base font-semibold mb-2 text-[rgb(var(--color-text-muted))]">Adjust Images ({montageImages.length})</h2>
                    <div className="flex space-x-4 overflow-x-auto py-2 px-1">
                        {montageImages.map((img, index) => (
                            <div key={img.id} className="flex-shrink-0 flex flex-col items-center space-y-2 p-3 border border-gray-200 rounded-lg bg-white shadow-sm w-[170px]">
                                <p className="text-xs font-medium text-gray-600 truncate w-full text-center" title={img.alt}>{index + 1}. {img.alt}</p>
                                {/* Tilt Control */}
                                <div className="w-full">
                                    <label htmlFor={`tilt-${img.id}`} className="text-[10px] text-gray-500 block text-center mb-0.5">Tilt ({img.tilt}°)</label>
                                    <input
                                        id={`tilt-${img.id}`} type="range" min={-MAX_TILT_DEG} max={MAX_TILT_DEG} step="1" value={img.tilt}
                                        onChange={(e) => handleTiltChange(img.id, Number(e.target.value))}
                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer range-sm accent-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                        disabled={isLoading}
                                    />
                                </div>
                                {/* Overlap Control (for images after the first) */}
                                {index > 0 && (
                                    <div className="w-full">
                                        <label htmlFor={`overlap-${img.id}`} className="text-[10px] text-gray-500 block text-center mb-0.5">Overlap ({img.overlapPercent}%)</label>
                                        <input
                                            id={`overlap-${img.id}`} type="range" min="0" max={MAX_OVERLAP_PERCENT} step="1" value={img.overlapPercent}
                                            onChange={(e) => handleImageOverlapChange(img.id, Number(e.target.value))}
                                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer range-sm accent-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                            disabled={isLoading}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Canvas Display Area */}
            <div className="flex-grow overflow-auto border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] p-2 min-h-[300px] flex items-start justify-start relative">
                <canvas ref={canvasRef} className="block max-w-full max-h-full">
                    Your browser does not support the canvas element.
                </canvas>
                {montageImages.length === 0 && !isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center text-[rgb(var(--color-text-muted))] text-center p-4 pointer-events-none text-sm italic">
                        Add images to create your montage.
                    </div>
                )}
            </div>
        </div>
    );
}