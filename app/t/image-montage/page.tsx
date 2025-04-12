// /app/t/image-montage/page.tsx
'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { useHistory } from '../../context/HistoryContext'; // Import HistoryEntry type too

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
  const [isClipboardCopied, setIsClipboardCopied] = useState(false);
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
        // *** FIXED: History entry for success ***
        addHistoryEntry({
          toolName: 'Image Montage',
          toolRoute: '/t/image-montage',
          action: `add-${newImages.length}-images`,
          input: addedFileNames.join(', ').substring(0, 500),
          output: `Montage updated, total: ${updatedImageList.length} images`,
          status: 'success',
        });
      })
      .catch((error) => {
         console.error("Error loading one or more images:", error);
         // *** FIXED: History entry for error ***
         addHistoryEntry({
            toolName: 'Image Montage',
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

  // --- Canvas Drawing Logic (useEffect) --- (Keep as before)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
     if (montageImages.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height); return;
    }
    console.log("Redrawing canvas...");
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
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    let nextImageStartX = canvasPadding;
    montageImages.forEach((imgData, index) => {
        const { image, tilt } = imgData;
        const tiltRad = tilt * (Math.PI / 180);
        const centerX = nextImageStartX + TOTAL_POLAROID_WIDTH / 2;
        const centerY = canvasHeight / 2;
        ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(tiltRad);
        const polaroidX = -TOTAL_POLAROID_WIDTH / 2; const polaroidY = -TOTAL_POLAROID_HEIGHT / 2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(polaroidX, polaroidY, TOTAL_POLAROID_WIDTH, TOTAL_POLAROID_HEIGHT);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        const imageX = polaroidX + BORDER_PADDING; const imageY = polaroidY + BORDER_PADDING;
        ctx.drawImage(image, imageX, imageY, POLAROID_WIDTH, POLAROID_HEIGHT);
        ctx.strokeStyle = '#EEEEEE'; ctx.lineWidth = 1; ctx.strokeRect(imageX, imageY, POLAROID_WIDTH, POLAROID_HEIGHT);
        ctx.restore();
        if (index < montageImages.length - 1) {
            const nextOverlapPercent = Math.max(0, Math.min(MAX_OVERLAP_PERCENT, montageImages[index + 1].overlapPercent));
            const nextOverlapPixels = TOTAL_POLAROID_WIDTH * (nextOverlapPercent / 100);
            const stepX = TOTAL_POLAROID_WIDTH - nextOverlapPixels;
            nextImageStartX += stepX;
        }
    });
  }, [montageImages]);

  // --- Action Handlers ---

  // Clear Montage Handler
  const handleClearMontage = useCallback(() => {
    const imageCount = montageImages.length;
    setMontageImages([]);
    if (imageCount > 0) {
        // *** FIXED: History entry for clear ***
        addHistoryEntry({
             toolName: 'Image Montage', toolRoute: '/t/image-montage',
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
      // *** FIXED: History entry for bounds error ***
       addHistoryEntry({
          toolName: 'Image Montage', toolRoute: '/t/image-montage', action: 'download-failed',
          input: `${montageImages.length} images`, output: 'Error calculating bounds', status: 'error',
      });
      return;
    }

    console.log("Calculated download bounds:", bounds);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bounds.width; tempCanvas.height = bounds.height;
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      console.error("Failed to get context for temporary canvas.");
      // *** FIXED: History entry for context error ***
       addHistoryEntry({
          toolName: 'Image Montage', toolRoute: '/t/image-montage', action: 'download-failed',
          input: `${montageImages.length} images`, output: 'Error creating temp canvas context', status: 'error',
      });
      return;
    }

    tempCtx.drawImage( mainCanvas, bounds.minX, bounds.minY, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height );

    tempCanvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `oet-montage-clipped-${Date.now()}.png`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        URL.revokeObjectURL(url);
        // *** FIXED: History entry for download success ***
        addHistoryEntry({
             toolName: 'Image Montage', toolRoute: '/t/image-montage', action: 'download-montage-clipped',
             input: `${montageImages.length} images`, output: link.download, status: 'success',
        });
      } else {
        console.error("Failed to create blob from temporary canvas.");
        // *** FIXED: History entry for blob error ***
        addHistoryEntry({
            toolName: 'Image Montage', toolRoute: '/t/image-montage', action: 'download-clipped-failed',
            input: `${montageImages.length} images`, output: 'Error creating blob from temp canvas', status: 'error',
        });
      }
    }, 'image/png');
  }, [montageImages, addHistoryEntry]);

   // Copy to Clipboard Handler
   const handleCopyToClipboard = useCallback(async () => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas || montageImages.length === 0) return;
    // const imageCount = montageImages.length; // Use length directly below
    setIsClipboardCopied(false);

    const bounds = calculateRenderedBounds(montageImages, mainCanvas.height);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      console.error("Could not calculate valid bounds for clipboard.");
       // *** FIXED: History entry for bounds error ***
      addHistoryEntry({
        toolName: 'Image Montage', toolRoute: '/t/image-montage', action: 'copy-failed',
        input: `${montageImages.length} images`, output: 'Error calculating bounds', status: 'error',
      });
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bounds.width; tempCanvas.height = bounds.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
         console.error("Failed to get context for temporary canvas (clipboard).");
         // *** FIXED: History entry for context error ***
         addHistoryEntry({
            toolName: 'Image Montage', toolRoute: '/t/image-montage', action: 'copy-failed',
            input: `${montageImages.length} images`, output: 'Error creating temp canvas context', status: 'error',
         });
        return;
     }

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
            // *** FIXED: History entry for copy success ***
            addHistoryEntry({
                 toolName: 'Image Montage', toolRoute: '/t/image-montage', action: 'copy-to-clipboard',
                 input: `${montageImages.length} images`, output: 'Image copied successfully', status: 'success',
            });
            setTimeout(() => setIsClipboardCopied(false), 2000);
        } catch (err) {
             console.error('Failed to copy image to clipboard:', err);
             const message = err instanceof Error ? err.message : 'Unknown clipboard error';
             // *** FIXED: History entry for copy error ***
             addHistoryEntry({
                toolName: 'Image Montage', toolRoute: '/t/image-montage', action: 'copy-failed',
                input: `${montageImages.length} images`, output: `Clipboard Error: ${message}`, status: 'error',
             });
             alert(`Failed to copy image: ${message}\n\nEnsure permissions are granted and the page is focused.`);
        }
      }, 'image/png');
    } catch (err) {
        console.error('Clipboard API access error:', err);
        const message = err instanceof Error ? err.message : 'Unknown clipboard error';
        // *** FIXED: History entry for API access error ***
        addHistoryEntry({
            toolName: 'Image Montage', toolRoute: '/t/image-montage', action: 'copy-failed',
            input: `${montageImages.length} images`, output: `Clipboard API Error: ${message}`, status: 'error',
        });
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
    <div className="max-w-full mx-auto p-4 flex flex-col h-[calc(100vh-80px)] overflow-hidden"> {/* Adjust height calc if needed */}
      {/* Top Controls Area */}
      <div className="flex-shrink-0 mb-4 pb-4 border-b border-gray-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
             <h1 className="text-2xl font-bold text-gray-800">Image Montage</h1>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                   <label htmlFor="imageUpload" className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#900027] hover:bg-[#7a0021] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#900027] transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {isLoading ? 'Processing...' : 'Add Images'}
                    </label>
                   <input id="imageUpload" type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" disabled={isLoading}/>
                   <button type="button" onClick={handleClearMontage} disabled={montageImages.length === 0 || isLoading} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#900027] disabled:opacity-50 disabled:cursor-not-allowed">
                        Clear
                    </button>
                    <button type="button" onClick={handleDownload} disabled={montageImages.length === 0 || isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                        Download
                    </button>
                     <button type="button" onClick={handleCopyToClipboard} disabled={montageImages.length === 0 || isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isClipboardCopied ? 'Copied!' : 'Copy'}
                     </button>
              </div>
        </div>
      </div>

       {/* Individual Image Controls Area */}
       {montageImages.length > 0 && (
         <div className="flex-shrink-0 mb-4 pb-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-2 text-gray-700">Adjust Images</h2>
            <div className="flex space-x-6 overflow-x-auto py-2">
                {montageImages.map((img, index) => (
                    <div key={img.id} className="flex-shrink-0 flex flex-col items-center space-y-2 p-3 border rounded bg-white shadow-sm w-[180px]">
                        <p className="text-xs font-medium text-gray-600 truncate w-full text-center" title={img.alt}>{index + 1}. {img.alt}</p>
                        {/* Tilt Control */}
                        <div className="w-full">
                            <label htmlFor={`tilt-${img.id}`} className="text-xs text-gray-500 block text-center mb-1">Tilt ({img.tilt}°)</label>
                            <input id={`tilt-${img.id}`} type="range" min={-MAX_TILT_DEG} max={MAX_TILT_DEG} step="1" value={img.tilt} onChange={(e) => handleTiltChange(img.id, Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-[#900027]" disabled={isLoading} />
                        </div>
                        {/* Overlap Control */}
                        {index > 0 && ( <div className="w-full"> <label htmlFor={`overlap-${img.id}`} className="text-xs text-gray-500 block text-center mb-1">Overlap ({img.overlapPercent}%)</label> <input id={`overlap-${img.id}`} type="range" min="0" max={MAX_OVERLAP_PERCENT} step="1" value={img.overlapPercent} onChange={(e) => handleImageOverlapChange(img.id, Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-[#900027]" disabled={isLoading} /> </div> )}
                    </div>
                ))}
            </div>
         </div>
       )}

      {/* Canvas Display Area */}
      <div className="flex-grow overflow-auto border border-gray-300 rounded-md bg-gray-50 p-2 min-h-[200px] flex items-center justify-start">
        <canvas ref={canvasRef} className="block">Your browser does not support the canvas element.</canvas>
        {montageImages.length === 0 && !isLoading && ( <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-center p-4 pointer-events-none">Upload images using the &lsquo;Add Images&rsquo; button...</div> )}
      </div>
    </div>
  );
}