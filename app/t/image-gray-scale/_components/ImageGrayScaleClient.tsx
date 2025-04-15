// FILE: app/t/image-gray-scale/_components/ImageGrayScaleClient.tsx
'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
// Import TriggerType
import { useHistory, TriggerType } from '../../../context/HistoryContext';

interface ImageGrayScaleClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function ImageGrayScaleClient({ toolTitle, toolRoute }: ImageGrayScaleClientProps) {
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [grayScaleImageSrc, setGrayScaleImageSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const originalImageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { addHistoryEntry } = useHistory();

  const handleImageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError('');
    setGrayScaleImageSrc(null);
    setFileName(null);
    setIsCopied(false);
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result && typeof e.target.result === 'string') {
            setOriginalImageSrc(e.target.result);
            setFileName(file.name);
            // History logged in handleGrayScale triggered by useEffect
          } else {
            setError('Failed to read file.');
            setOriginalImageSrc(null);
          }
        };
        reader.onerror = () => {
          setError('Error reading file.');
          setOriginalImageSrc(null);
        };
        reader.readAsDataURL(file);
      } else {
        setError('Invalid file type. Please select an image.');
        setOriginalImageSrc(null);
        if (event.target) event.target.value = '';
      }
    } else {
        setOriginalImageSrc(null);
    }
  }, []);

  // --- UPDATED handleGrayScale to accept trigger and log only once ---
  const handleGrayScale = useCallback(async (trigger: TriggerType) => {
    if (!originalImageSrc || !originalImageRef.current) {
      return;
    }
    setIsLoading(true);
    setError('');
    setGrayScaleImageSrc(null);
    setIsCopied(false);

    // --- REMOVED initial "start" log ---

    let generatedDataUrl: string | null = null;
    let status: 'success' | 'error' = 'success';
    let historyOutput: string | Record<string, unknown> = 'Image converted to grayscale successfully';
    const inputDetails = { fileName: fileName, originalSrcLength: originalImageSrc?.length };

    try {
        await new Promise(resolve => setTimeout(resolve, 50)); // Short delay

        const img = originalImageRef.current;
        if (!img || !img.naturalWidth || !img.naturalHeight) {
            await new Promise(resolve => setTimeout(resolve, 150)); // Longer delay
            if (!img || !img.naturalWidth || !img.naturalHeight) {
              throw new Error("Image dimensions not available. Please try re-uploading.");
            }
        }

      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas context.');
      }

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = avg; data[i + 1] = avg; data[i + 2] = avg;
      }
      ctx.putImageData(imageData, 0, 0);
      generatedDataUrl = canvas.toDataURL();
      setGrayScaleImageSrc(generatedDataUrl);
      historyOutput = `[Grayscale Image DataURL, length: ${generatedDataUrl?.length}]`; // More specific success output

    } catch (err) {
      console.error("GrayScale Error:", err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Error converting to grayscale: ${message}`);
      setGrayScaleImageSrc(null);
      status = 'error';
      historyOutput = `Error: ${message}`;
      (inputDetails as Record<string, unknown>).error = message; // Add error to input details
    } finally {
      setIsLoading(false);
      // --- UPDATED Log completion status only ---
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: trigger, // Use the trigger passed in ('upload')
        input: inputDetails,
        output: historyOutput, // Output is either success dataURL length or error
        status: status,
      });
      // --- END UPDATE ---
    }
  }, [originalImageSrc, fileName, addHistoryEntry, toolTitle, toolRoute]);
  // --- END UPDATE ---

  useEffect(() => {
    if (originalImageSrc) {
       const timer = setTimeout(() => {
            handleGrayScale('upload'); // Pass 'upload' trigger
       }, 100);
       return () => clearTimeout(timer);
    } else {
      setGrayScaleImageSrc(null);
      setFileName(null);
    }
    // Updated dependencies to include handleGrayScale
  }, [originalImageSrc, handleGrayScale]);

  // --- UPDATED handleClear to REMOVE history logging ---
  const handleClear = useCallback(() => {
    setOriginalImageSrc(null);
    setGrayScaleImageSrc(null);
    setFileName(null);
    setError('');
    setIsLoading(false);
    setIsCopied(false);
    const fileInput = document.getElementById('imageUpload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    // History logging removed
  }, []); // Dependencies updated
  // --- END UPDATE ---

   // --- UPDATED handleDownload to REMOVE history logging ---
   const handleDownload = useCallback(() => {
        if (!grayScaleImageSrc || !canvasRef.current || !fileName) {
            setError('No grayscale image available to download.');
            return;
        }
        setError('');

        const canvas = canvasRef.current;
        try {
            const link = document.createElement('a');
            link.download = `grayscale-${fileName}`;
            canvas.toBlob((blob) => {
                if (blob) {
                    link.href = URL.createObjectURL(blob);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                } else {
                    throw new Error("Canvas toBlob failed to generate blob.");
                }
            }, 'image/png');

        } catch (err) {
            console.error("Download failed:", err);
            const message = err instanceof Error ? err.message : "Unknown download error";
            setError(`Download failed: ${message}`);
        }
        // History logging removed
    }, [grayScaleImageSrc, fileName]); // Dependencies updated
    // --- END UPDATE ---

    // --- UPDATED handleCopy to REMOVE history logging ---
    const handleCopy = useCallback(async () => {
        if (!canvasRef.current) {
            setError('Cannot copy: Canvas is not ready.');
            return;
        }
        setIsCopied(false);
        setError('');

        try {
             if (!navigator.clipboard?.write) { throw new Error("Clipboard API (write) not available or not permitted."); }

             const canvas = canvasRef.current;
             const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

             if (!blob) { throw new Error("Failed to create blob from canvas for clipboard."); }

             const clipboardItem = new ClipboardItem({ 'image/png': blob });
             await navigator.clipboard.write([clipboardItem]);
             setIsCopied(true);
             setTimeout(() => setIsCopied(false), 2000);

         } catch (err) {
             console.error('Failed to copy image to clipboard:', err);
             const message = err instanceof Error ? err.message : 'Unknown clipboard error';
             setError(`Copy failed: ${message}`);
         }
         // History logging removed
     }, []); // Dependencies updated
     // --- END UPDATE ---


  return (
    // --- JSX Unchanged ---
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <label htmlFor="imageUpload" className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {isLoading ? 'Processing...' : (originalImageSrc ? 'Change Image' : 'Select Image')}
        </label>
        <input id="imageUpload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={isLoading} />

        <div className="flex flex-wrap gap-3 ml-auto">
             <button type="button" onClick={handleDownload} disabled={!grayScaleImageSrc || isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-primary-text))] bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                 Download
             </button>
             <button type="button" onClick={handleCopy} disabled={!grayScaleImageSrc || isLoading} className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${ isCopied ? 'bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] text-[rgb(var(--color-button-secondary-text))]' : 'bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] text-[rgb(var(--color-button-accent-text))]' } `}>
                 {isCopied ? 'Copied!' : 'Copy'}
             </button>
            <button type="button" onClick={handleClear} disabled={!originalImageSrc && !grayScaleImageSrc && !error && !isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
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
              <img
                ref={originalImageRef}
                src={originalImageSrc}
                alt={fileName || "Original"}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <span className="text-sm text-[rgb(var(--color-input-placeholder))] italic">Select an image</span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">Grayscale Image</label>
          <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {isLoading && !grayScaleImageSrc && (
              <span className="text-sm text-[rgb(var(--color-text-link))] italic animate-pulse">Converting...</span>
            )}
            {!isLoading && grayScaleImageSrc ? (
              <img
                src={grayScaleImageSrc}
                alt={fileName ? `Grayscale ${fileName}` : "Grayscale Image"}
                className="max-w-full max-h-full object-contain"
              />
            ) : !isLoading && (
              <span className="text-sm text-[rgb(var(--color-input-placeholder))] italic">Output appears here</span>
            )}
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
}