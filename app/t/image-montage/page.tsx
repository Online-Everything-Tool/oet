'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { useHistory } from '../../context/HistoryContext';
import ToolHeader from '../_components/ToolHeader'; // Import ToolHeader
import metadata from './metadata.json'; // Import local metadata

// Interface for storing image data and its properties
interface MontageImage {
  id: number;
  image: HTMLImageElement;
  alt: string;
  tilt: number;       // Degrees
  overlapPercent: number; // Overlap with the *previous* image (0-80ish)
}

// --- Constants ---
const POLAROID_WIDTH = 150;
const POLAROID_HEIGHT = 150;
const BORDER_PADDING = 10;
const BOTTOM_PADDING = 30;
const TOTAL_POLAROID_WIDTH = POLAROID_WIDTH + BORDER_PADDING * 2;
const TOTAL_POLAROID_HEIGHT = POLAROID_HEIGHT + BORDER_PADDING + BOTTOM_PADDING;
const MAX_TILT_DEG = 30;
const DEFAULT_OVERLAP_PERCENT = 20;
const MAX_OVERLAP_PERCENT = 80;

// --- Helper Functions ---
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
    const canvasPaddingValue = maxH * 0.2;
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
    const width = Math.ceil(maxX - minX);
    const height = Math.ceil(maxY - minY);
    if (width <= 0 || height <= 0) return null;
    return { minX: Math.floor(minX), minY: Math.floor(minY), maxX: Math.ceil(maxX), maxY: Math.ceil(maxY), width, height };
};

// --- END OF CONSTANTS AND HELPERS SECTION ---


export default function ImageMontagePage() {
  const [montageImages, setMontageImages] = useState<MontageImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClipboardCopied, setIsClipboardCopied] = useState(false); // Keep for button text change
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { addHistoryEntry } = useHistory();

  // --- File Loading Handler ---
  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsLoading(true);
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
                  image: img, alt: file.name, tilt: getRandomTilt(),
                  overlapPercent: (currentImageCount + index) === 0 ? 0 : DEFAULT_OVERLAP_PERCENT,
                });
              };
              img.onerror = () => reject(new Error(`Failed to load image data for ${file.name}`));
              img.src = e.target.result;
            } else { reject(new Error(`Failed to read file ${file.name} as data URL.`)); }
          };
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
        });
        filePromises.push(promise);
      } else { console.warn(`Skipping non-image file: ${file.name}`); }
    });

    Promise.all(filePromises)
      .then((newImages) => {
        const updatedImageList = [...montageImages, ...newImages];
        setMontageImages(updatedImageList);
        addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/image-montage',
          action: `add-${newImages.length}-images`,
          input: addedFileNames.join(', ').substring(0, 500),
          output: `Montage updated, total: ${updatedImageList.length} images`,
          status: 'success',
        });
      })
      .catch((error) => {
         console.error("Error loading one or more images:", error);
         addHistoryEntry({
            toolName: metadata.title,
            toolRoute: '/t/image-montage',
            action: `add-images-failed`,
            input: addedFileNames.join(', ').substring(0, 500),
            output: `Error: ${error instanceof Error ? error.message : 'Failed to process files'}`,
            status: 'error',
          });
      })
      .finally(() => {
        setIsLoading(false);
        if (event.target) event.target.value = '';
      });
  }, [addHistoryEntry, montageImages]);

  // --- Canvas Drawing Logic (useEffect) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
     if (montageImages.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height); return;
    }
    console.log("Redrawing canvas..."); // Keep console log for debugging draw trigger

    // --- FIX: Get computed style once for reuse ---
    const computedStyle = getComputedStyle(document.documentElement);
    const subtleBgColor = computedStyle.getPropertyValue('--color-bg-subtle').trim();
    const componentBgColor = computedStyle.getPropertyValue('--color-bg-component').trim();
    const borderBaseColor = computedStyle.getPropertyValue('--color-border-base').trim();

    const { maxH } = calculateMaxBounds(TOTAL_POLAROID_WIDTH, TOTAL_POLAROID_HEIGHT);
    const canvasPadding = maxH * 0.2;
    const canvasHeight = Math.ceil(maxH + canvasPadding * 2);
    let totalContentWidth = TOTAL_POLAROID_WIDTH;
    for (let i = 1; i < montageImages.length; i++) {
        const currentOverlapPercent = Math.max(0, Math.min(MAX_OVERLAP_PERCENT, montageImages[i].overlapPercent));
        const overlapPixels = TOTAL_POLAROID_WIDTH * (currentOverlapPercent / 100);
        totalContentWidth += (TOTAL_POLAROID_WIDTH - overlapPixels);
    }
    const canvasWidth = Math.ceil(totalContentWidth + canvasPadding * 2);
    canvas.width = canvasWidth; canvas.height = canvasHeight;

    // Clear canvas with subtle background
    ctx.fillStyle = `rgb(${subtleBgColor})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    let nextImageStartX = canvasPadding;
    montageImages.forEach((imgData, index) => {
        const { image, tilt } = imgData;
        const tiltRad = tilt * (Math.PI / 180);
        const centerX = nextImageStartX + TOTAL_POLAROID_WIDTH / 2;
        const centerY = canvasHeight / 2;
        ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(tiltRad);
        const polaroidX = -TOTAL_POLAROID_WIDTH / 2; const polaroidY = -TOTAL_POLAROID_HEIGHT / 2;

        // Polaroid background and shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 4;
        // --- FIX: Set fillStyle to component background (white) BEFORE filling the polaroid rect ---
        ctx.fillStyle = `rgb(${componentBgColor})`;
        ctx.fillRect(polaroidX, polaroidY, TOTAL_POLAROID_WIDTH, TOTAL_POLAROID_HEIGHT);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

        // Image placement
        const imageX = polaroidX + BORDER_PADDING; const imageY = polaroidY + BORDER_PADDING;
        ctx.drawImage(image, imageX, imageY, POLAROID_WIDTH, POLAROID_HEIGHT);

        // Subtle border around image inside polaroid
        ctx.strokeStyle = `rgba(${borderBaseColor}, 0.5)`; // Use rgba with the fetched RGB values
        ctx.lineWidth = 1; ctx.strokeRect(imageX, imageY, POLAROID_WIDTH, POLAROID_HEIGHT);
        ctx.restore();

        // Calculate next position based on overlap
        if (index < montageImages.length - 1) {
            const nextOverlapPercent = Math.max(0, Math.min(MAX_OVERLAP_PERCENT, montageImages[index + 1].overlapPercent));
            const nextOverlapPixels = TOTAL_POLAROID_WIDTH * (nextOverlapPercent / 100);
            const stepX = TOTAL_POLAROID_WIDTH - nextOverlapPixels;
            nextImageStartX += stepX;
        }
    });
  }, [montageImages]); // Dependency remains the same


  // --- Action Handlers ---

  // Clear Montage Handler
  const handleClearMontage = useCallback(() => {
    const imageCount = montageImages.length;
    setMontageImages([]);
    if (imageCount > 0) {
        addHistoryEntry({
             toolName: metadata.title,
             toolRoute: '/t/image-montage',
             action: 'clear-montage', input: `${imageCount} images present`,
             output: 'Montage cleared', status: 'success',
        });
    }
  }, [addHistoryEntry, montageImages.length]);

  // Download Handler (with clipping)
  const handleDownload = useCallback(() => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas || montageImages.length === 0) return;
    const bounds = calculateRenderedBounds(montageImages, mainCanvas.height);

    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      console.error("Could not calculate valid bounds for download.");
       addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/image-montage', action: 'download-failed',
          input: `${montageImages.length} images`, output: 'Error calculating bounds', status: 'error',
      });
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bounds.width; tempCanvas.height = bounds.height;
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      console.error("Failed to get context for temporary canvas.");
       addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/image-montage', action: 'download-failed',
          input: `${montageImages.length} images`, output: 'Error creating temp canvas context', status: 'error',
      });
      return;
    }
    // Draw component background color on temp canvas before drawing main content
    const computedStyle = getComputedStyle(document.documentElement);
    const componentBgColor = computedStyle.getPropertyValue('--color-bg-component').trim();
    tempCtx.fillStyle = `rgb(${componentBgColor})`; // Ensure background matches component bg
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    tempCtx.drawImage( mainCanvas, bounds.minX, bounds.minY, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height );

    tempCanvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `oet-montage-clipped-${Date.now()}.png`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addHistoryEntry({
             toolName: metadata.title,
             toolRoute: '/t/image-montage', action: 'download-montage-clipped',
             input: `${montageImages.length} images`, output: link.download, status: 'success',
        });
      } else {
        console.error("Failed to create blob from temporary canvas.");
        addHistoryEntry({
            toolName: metadata.title,
            toolRoute: '/t/image-montage', action: 'download-clipped-failed',
            input: `${montageImages.length} images`, output: 'Error creating blob from temp canvas', status: 'error',
        });
      }
    }, 'image/png');
  }, [montageImages, addHistoryEntry]);

   // Copy to Clipboard Handler
   const handleCopyToClipboard = useCallback(async () => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas || montageImages.length === 0) return;
    setIsClipboardCopied(false);

    const bounds = calculateRenderedBounds(montageImages, mainCanvas.height);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      console.error("Could not calculate valid bounds for clipboard.");
      addHistoryEntry({
        toolName: metadata.title,
        toolRoute: '/t/image-montage', action: 'copy-failed',
        input: `${montageImages.length} images`, output: 'Error calculating bounds', status: 'error',
      });
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bounds.width; tempCanvas.height = bounds.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
         console.error("Failed to get context for temporary canvas (clipboard).");
         addHistoryEntry({
            toolName: metadata.title,
            toolRoute: '/t/image-montage', action: 'copy-failed',
            input: `${montageImages.length} images`, output: 'Error creating temp canvas context', status: 'error',
         });
        return;
     }
    // Draw component background color on temp canvas before drawing main content
    const computedStyle = getComputedStyle(document.documentElement);
    const componentBgColor = computedStyle.getPropertyValue('--color-bg-component').trim();
    tempCtx.fillStyle = `rgb(${componentBgColor})`; // Ensure background matches component bg
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    tempCtx.drawImage(mainCanvas, bounds.minX, bounds.minY, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);

    try {
      if (!navigator.clipboard?.write) { throw new Error("Clipboard API (write) not available."); }

      tempCanvas.toBlob(async (blob) => {
        if (!blob) { throw new Error("Failed to create blob from canvas for clipboard."); }
        try {
            const clipboardItem = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([clipboardItem]);
            console.log("Image copied to clipboard successfully.");
            setIsClipboardCopied(true);
            addHistoryEntry({
                 toolName: metadata.title,
                 toolRoute: '/t/image-montage', action: 'copy-to-clipboard',
                 input: `${montageImages.length} images`, output: 'Image copied successfully', status: 'success',
            });
            setTimeout(() => setIsClipboardCopied(false), 2000);
        } catch (err) {
             console.error('Failed to copy image to clipboard:', err);
             const message = err instanceof Error ? err.message : 'Unknown clipboard error';
             addHistoryEntry({
                toolName: metadata.title,
                toolRoute: '/t/image-montage', action: 'copy-failed',
                input: `${montageImages.length} images`, output: `Clipboard Error: ${message}`, status: 'error',
             });
             // Consider a less intrusive error notification than alert if possible
             alert(`Failed to copy image: ${message}\n\nEnsure permissions are granted and the page is focused.`);
        }
      }, 'image/png');
    } catch (err) {
        console.error('Clipboard API access error:', err);
        const message = err instanceof Error ? err.message : 'Unknown clipboard error';
        addHistoryEntry({
            toolName: metadata.title,
            toolRoute: '/t/image-montage', action: 'copy-failed',
            input: `${montageImages.length} images`, output: `Clipboard API Error: ${message}`, status: 'error',
        });
         // Consider a less intrusive error notification than alert if possible
         alert(`Failed to access clipboard: ${message}`);
    }

  }, [montageImages, addHistoryEntry]);

  // Tilt Change Handler
  const handleTiltChange = useCallback((imageId: number, newTilt: number) => {
    setMontageImages((prevImages) => prevImages.map((img) => img.id === imageId ? { ...img, tilt: newTilt } : img ));
  }, []);

  // Overlap Change Handler
   const handleImageOverlapChange = useCallback((imageId: number, newOverlap: number) => {
    setMontageImages((prevImages) => prevImages.map((img) => img.id === imageId ? { ...img, overlapPercent: Math.max(0, Math.min(MAX_OVERLAP_PERCENT, newOverlap)) } : img ));
  }, []);

  // --- JSX Structure ---
  return (
    // Main container relies on parent layout for padding, uses flex-col and gap
    <div className="flex flex-col gap-6">
        <ToolHeader
            title={metadata.title}
            description={metadata.description}
        />

       {/* Inner content container */}
       <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">

         {/* Top Controls Area */}
         <div className="flex-shrink-0 pb-4 border-b border-[rgb(var(--color-border-base))] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                 {/* Button Group */}
                 <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                     {/* Add Images Button (Accent2 - Orange) */}
                     <label htmlFor="imageUpload" className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                         {isLoading ? 'Processing...' : 'Add Images'}
                     </label>
                     <input id="imageUpload" type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" disabled={isLoading}/>

                     {/* Clear Button (Neutral) */}
                     <button type="button" onClick={handleClearMontage} disabled={montageImages.length === 0 || isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                         Clear
                     </button>

                     {/* Download Button (Primary - Blue) */}
                     <button type="button" onClick={handleDownload} disabled={montageImages.length === 0 || isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-primary-text))] bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                         Download
                     </button>

                     {/* Copy Button (Secondary - Green) */}
                      <button type="button" onClick={handleCopyToClipboard} disabled={montageImages.length === 0 || isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-secondary-text))] bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                         {isClipboardCopied ? 'Copied!' : 'Copy'}
                      </button>
                 </div>
            </div>
         </div>

          {/* Individual Image Controls Area */}
          {montageImages.length > 0 && (
            <div className="flex-shrink-0 pb-4 border-b border-[rgb(var(--color-border-base))]">
               <h2 className="text-lg font-semibold mb-2 text-[rgb(var(--color-text-base))]">Adjust Images</h2>
               {/* Horizontal scroll container */}
               <div className="flex space-x-4 overflow-x-auto py-2">
                   {montageImages.map((img, index) => (
                       <div key={img.id} className="flex-shrink-0 flex flex-col items-center space-y-3 p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-component))] shadow-sm w-[180px]">
                           {/* Image Name */}
                           <p className="text-xs font-medium text-[rgb(var(--color-text-muted))] truncate w-full text-center" title={img.alt}>{index + 1}. {img.alt}</p>
                           {/* Tilt Control */}
                           <div className="w-full">
                               <label htmlFor={`tilt-${img.id}`} className="text-xs text-[rgb(var(--color-text-muted))] block text-center mb-1">Tilt ({img.tilt}°)</label>
                               <input
                                   id={`tilt-${img.id}`}
                                   type="range"
                                   min={-MAX_TILT_DEG}
                                   max={MAX_TILT_DEG}
                                   step="1"
                                   value={img.tilt}
                                   onChange={(e) => handleTiltChange(img.id, Number(e.target.value))}
                                   // Style range input for better cross-browser appearance if needed, using accent color for thumb
                                   className="w-full h-2 bg-[rgba(var(--color-border-base)/0.5)] rounded-lg appearance-none cursor-pointer accent-[rgb(var(--color-button-accent2-bg))]"
                                   disabled={isLoading}
                               />
                           </div>
                           {/* Overlap Control */}
                           {index > 0 && (
                               <div className="w-full">
                                   <label htmlFor={`overlap-${img.id}`} className="text-xs text-[rgb(var(--color-text-muted))] block text-center mb-1">Overlap ({img.overlapPercent}%)</label>
                                   <input
                                       id={`overlap-${img.id}`}
                                       type="range"
                                       min="0"
                                       max={MAX_OVERLAP_PERCENT}
                                       step="1"
                                       value={img.overlapPercent}
                                       onChange={(e) => handleImageOverlapChange(img.id, Number(e.target.value))}
                                       // Style range input for better cross-browser appearance if needed, using accent color for thumb
                                       className="w-full h-2 bg-[rgba(var(--color-border-base)/0.5)] rounded-lg appearance-none cursor-pointer accent-[rgb(var(--color-button-accent2-bg))]"
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
         <div className="flex-grow overflow-auto border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] p-2 min-h-[300px] flex items-center justify-start relative">
           <canvas ref={canvasRef} className="block">Your browser does not support the canvas element.</canvas>
           {/* Placeholder text */}
           {montageImages.length === 0 && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center text-[rgb(var(--color-text-muted))] text-center p-4 pointer-events-none">
                    Upload images using the ‘Add Images’ button above to start creating your montage.
                </div>
            )}
         </div>
       </div> {/* End inner flex container */}
    </div> // End main container
  );
}