// FILE: app/t/image-flip/_components/ImageFlipClient.tsx
'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { useHistory, TriggerType } from '../../../context/HistoryContext';

interface ImageFlipClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function ImageFlipClient({ toolTitle, toolRoute }: ImageFlipClientProps) {
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [flippedImageSrc, setFlippedImageSrc] = useState<string | null>(null);
  const [flipType, setFlipType] = useState<'horizontal' | 'vertical'>('horizontal');
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
    setFlippedImageSrc(null);
    setIsCopied(false);
    setFileName(null);

    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result && typeof e.target.result === 'string') {
            setOriginalImageSrc(e.target.result);
            setFileName(file.name);
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


  const handleFlip = useCallback(async (trigger: TriggerType) => {
    if (!originalImageSrc || !originalImageRef.current) {
      return;
    }

    setError('');
    setFlippedImageSrc(null);
    setIsLoading(true);
    setIsCopied(false);

    let generatedDataUrl: string | null = null;
    let status: 'success' | 'error' = 'success';
    let historyOutput: string | Record<string, unknown> = 'Image flipped successfully';
    const inputDetails = { fileName: fileName, originalSrcLength: originalImageSrc?.length, flipType: flipType };

    try {
      const img = originalImageRef.current;
      if (!img.naturalWidth || !img.naturalHeight) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!img.naturalWidth || !img.naturalHeight) {
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

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      if (flipType === 'horizontal') {
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
      } else {
        ctx.scale(1, -1);
        ctx.translate(0, -canvas.height);
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      generatedDataUrl = canvas.toDataURL();
      setFlippedImageSrc(generatedDataUrl);
      historyOutput = `[Flipped Image DataURL, length: ${generatedDataUrl?.length}]`;

    } catch (err) {
      console.error("Flip Error:", err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred during flipping.';
      setError(`Error flipping image: ${message}`);
      setFlippedImageSrc(null);
      status = 'error';
      historyOutput = `Error: ${message}`;
      (inputDetails as Record<string, unknown>).error = message;
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
    }
  }, [originalImageSrc, flipType, fileName, addHistoryEntry, toolTitle, toolRoute]);

   const handleClear = useCallback(() => {
       setOriginalImageSrc(null);
       setFlippedImageSrc(null);
       setFileName(null);
       setFlipType('horizontal');
       setError('');
       setIsLoading(false);
       setIsCopied(false);
       const fileInput = document.getElementById('imageUpload') as HTMLInputElement;
       if (fileInput) fileInput.value = '';
       // No history log
   }, []);

   const handleDownload = useCallback(() => {
        if (!flippedImageSrc || !canvasRef.current || !fileName) {
            setError('No flipped image available to download.');
            return;
        }
        setError('');

        const canvas = canvasRef.current;
        try {
            const link = document.createElement('a');
            link.download = `flipped-${fileName}`;
            canvas.toBlob((blob) => {
                if (blob) {
                    link.href = URL.createObjectURL(blob);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                } else {
                    throw new Error("Canvas toBlob failed.");
                }
            }, 'image/png');

        } catch (err) {
            console.error("Download failed:", err);
            const message = err instanceof Error ? err.message : "Unknown download error";
            setError(`Download failed: ${message}`);
        }
        // No history log
    }, [flippedImageSrc, fileName]);

    const handleCopy = useCallback(async () => {
        if (!canvasRef.current) {
            setError('Cannot copy: Canvas not available.');
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
         // No history log
     }, []);

    // --- UPDATED useEffect dependencies ---
    useEffect(() => {
        if (originalImageSrc) {
            const timer = setTimeout(() => {
                 handleFlip('upload');
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [originalImageSrc, handleFlip]); // Added handleFlip

     useEffect(() => {
        if (originalImageSrc && !isLoading) {
            handleFlip('click');
        }
     // Added handleFlip to dependencies
     }, [flipType, originalImageSrc, isLoading, handleFlip]);
     // --- END UPDATE ---

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
        {/* Controls Section */}
        <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
             <label htmlFor="imageUpload" className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                 {isLoading ? 'Processing...' : (originalImageSrc ? 'Change Image' : 'Select Image')}
             </label>
             <input id="imageUpload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={isLoading}/>

             <fieldset className="flex gap-x-4 gap-y-2 items-center">
                 <legend className="sr-only">Flip Direction</legend>
                 <div className="flex items-center">
                     <input type="radio" id="flip-h" name="flipType" value="horizontal" checked={flipType === 'horizontal'} onChange={(e) => setFlipType(e.target.value as 'horizontal')} disabled={!originalImageSrc || isLoading} className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))] disabled:opacity-50" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }} />
                     <label htmlFor="flip-h" className={`ml-2 block text-sm ${!originalImageSrc || isLoading ? 'text-[rgb(var(--color-text-muted))] opacity-50' : 'text-[rgb(var(--color-text-base))]'} cursor-pointer`}>Horizontal</label>
                 </div>
                 <div className="flex items-center">
                     <input type="radio" id="flip-v" name="flipType" value="vertical" checked={flipType === 'vertical'} onChange={(e) => setFlipType(e.target.value as 'vertical')} disabled={!originalImageSrc || isLoading} className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))] disabled:opacity-50" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }} />
                     <label htmlFor="flip-v" className={`ml-2 block text-sm ${!originalImageSrc || isLoading ? 'text-[rgb(var(--color-text-muted))] opacity-50' : 'text-[rgb(var(--color-text-base))]'} cursor-pointer`}>Vertical</label>
                 </div>
             </fieldset>

              <div className="flex gap-3 ml-auto">
                    <button type="button" onClick={handleDownload} disabled={!flippedImageSrc || isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-primary-text))] bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                         Download
                     </button>
                     <button type="button" onClick={handleCopy} disabled={!flippedImageSrc || isLoading} className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${ isCopied ? 'bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] text-[rgb(var(--color-button-secondary-text))]' : 'bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] text-[rgb(var(--color-button-accent-text))]' } `}>
                         {isCopied ? 'Copied!' : 'Copy'}
                     </button>
                    <button type="button" onClick={handleClear} disabled={!originalImageSrc && !flippedImageSrc && !error} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
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
                    // eslint-disable-next-line @next/next/no-img-element -- Using data URLs, optimization not applicable/needed
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
                <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">Flipped Image</label>
                <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
                {isLoading && !flippedImageSrc && (
                    <span className="text-sm text-[rgb(var(--color-text-link))] italic animate-pulse">Flipping...</span>
                 )}
                {!isLoading && flippedImageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Using data URLs, optimization not applicable/needed
                    <img
                      src={flippedImageSrc}
                      alt={fileName ? `Flipped ${fileName}` : "Flipped Image"}
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