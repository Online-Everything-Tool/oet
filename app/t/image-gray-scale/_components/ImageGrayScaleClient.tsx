// FILE: app/t/image-gray-scale/_components/ImageGrayScaleClient.tsx
'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { useHistory } from '../../../context/HistoryContext';

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
  const [isCopied, setIsCopied] = useState<boolean>(false); // Added state for copy button
  const originalImageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Canvas ref now used for output
  const { addHistoryEntry } = useHistory();

  const handleImageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError('');
    setGrayScaleImageSrc(null);
    setFileName(null);
    setIsCopied(false); // Reset copy state on new image
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result && typeof e.target.result === 'string') {
            setOriginalImageSrc(e.target.result);
            setFileName(file.name);
            // No history log here, wait for processing
          } else {
            setError('Failed to read file.');
            setOriginalImageSrc(null); // Clear original src on read failure
          }
        };
        reader.onerror = () => {
          setError('Error reading file.');
          setOriginalImageSrc(null); // Clear original src on read error
        };
        reader.readAsDataURL(file);
      } else {
        setError('Invalid file type. Please select an image.');
        setOriginalImageSrc(null);
        if (event.target) event.target.value = '';
      }
    } else {
        setOriginalImageSrc(null); // Clear if no file selected
    }
  }, []); // Removed history dependencies, log on process start/end


  const handleGrayScale = useCallback(async () => {
    if (!originalImageSrc || !originalImageRef.current) {
      // Avoid error spam if called automatically before image ready
      return;
    }
    setIsLoading(true);
    setError('');
    setGrayScaleImageSrc(null); // Clear previous result before starting
    setIsCopied(false); // Reset copy state

    // Log start of processing
     addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        action: 'grayscale-start',
        input: { fileName: fileName, originalSrcLength: originalImageSrc?.length },
        output: 'Starting grayscale conversion',
        status: 'success', // Indicates the start was successful, not the whole process yet
      });


    let generatedDataUrl: string | null = null;
    let status: 'success' | 'error' = 'success';
    let historyOutput: string | Record<string, unknown> = 'Image converted to grayscale successfully';

    try {
        // Slight delay to allow the image element to update if src just changed
        await new Promise(resolve => setTimeout(resolve, 50));

        const img = originalImageRef.current;
        if (!img || !img.naturalWidth || !img.naturalHeight) {
            // Check again after delay
            await new Promise(resolve => setTimeout(resolve, 150)); // Longer delay
            if (!img || !img.naturalWidth || !img.naturalHeight) {
              throw new Error("Image dimensions not available. Please try re-uploading.");
            }
        }


      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvasRef.current = canvas; // Ensure ref is set for download/copy
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
        // Using luminosity weights for potentially better grayscale
        const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = avg; // red
        data[i + 1] = avg; // green
        data[i + 2] = avg; // blue
        // Alpha (data[i + 3]) remains unchanged
      }
      ctx.putImageData(imageData, 0, 0);
      generatedDataUrl = canvas.toDataURL(); // Get base64 data URL
      setGrayScaleImageSrc(generatedDataUrl);

    } catch (err) {
      console.error("GrayScale Error:", err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Error converting to grayscale: ${message}`);
      setGrayScaleImageSrc(null); // Clear output on error
      status = 'error';
      historyOutput = `Error: ${message}`;
    } finally {
      setIsLoading(false);
      // Log completion status
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        action: `grayscale-${status === 'success' ? 'complete' : 'failed'}`,
        input: { fileName: fileName, originalSrcLength: originalImageSrc?.length }, // Keep input simple for completion log
        output: status === 'success' ? `[Grayscale Image DataURL, length: ${generatedDataUrl?.length}]` : historyOutput,
        status: status,
      });
    }
  }, [originalImageSrc, fileName, addHistoryEntry, toolTitle, toolRoute]);

  useEffect(() => {
    if (originalImageSrc) {
      // Debounce or use a timeout to avoid rapid calls if originalImageSrc updates quickly
       const timer = setTimeout(() => {
            handleGrayScale();
       }, 100); // Adjust delay as needed
       return () => clearTimeout(timer);
    } else {
      // Clear output if original image is removed
      setGrayScaleImageSrc(null);
      setFileName(null); // Also clear filename
    }
  }, [originalImageSrc, handleGrayScale]);

  const handleClear = useCallback(() => {
    const hadImage = !!originalImageSrc;
    setOriginalImageSrc(null);
    // Output and filename are cleared by the useEffect hook when originalImageSrc becomes null
    setError('');
    setIsLoading(false);
    setIsCopied(false);
    const fileInput = document.getElementById('imageUpload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';

    if (hadImage) { // Only log clear if there was something to clear
        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            action: 'clear',
            input: { previousFileName: fileName }, // Log the name of the cleared file
            output: 'Inputs and outputs cleared',
            status: 'success',
        });
    }
  }, [addHistoryEntry, fileName, originalImageSrc, toolTitle, toolRoute]);

   // --- ADDED: handleDownload Function ---
   const handleDownload = useCallback(() => {
        if (!grayScaleImageSrc || !canvasRef.current || !fileName) {
            setError('No grayscale image available to download.');
            return;
        }
        setError(''); // Clear previous errors

        const canvas = canvasRef.current;
        let historyStatus: 'success' | 'error' = 'success';
        let historyOutput = 'Download initiated';

        try {
            const link = document.createElement('a');
            link.download = `grayscale-${fileName}`; // Add prefix
            canvas.toBlob((blob) => {
                if (blob) {
                    link.href = URL.createObjectURL(blob);
                    document.body.appendChild(link); // Append link to body
                    link.click();
                    document.body.removeChild(link); // Clean up link
                    URL.revokeObjectURL(link.href); // Clean up blob URL
                    historyOutput = `Downloaded ${link.download}`;
                     addHistoryEntry({
                        toolName: toolTitle, toolRoute: toolRoute,
                        action: 'download', input: {fileName: fileName},
                        output: historyOutput, status: historyStatus
                    });
                } else {
                    throw new Error("Canvas toBlob failed to generate blob.");
                }
            }, 'image/png'); // Specify mime type

        } catch (err) {
            console.error("Download failed:", err);
            const message = err instanceof Error ? err.message : "Unknown download error";
            setError(`Download failed: ${message}`);
            historyStatus = 'error';
            historyOutput = `Error: ${message}`;
             addHistoryEntry({
                toolName: toolTitle, toolRoute: toolRoute,
                action: 'download-failed', input: {fileName: fileName, error: message},
                output: historyOutput, status: historyStatus
            });
        }
    }, [grayScaleImageSrc, fileName, addHistoryEntry, toolTitle, toolRoute]);

    // --- ADDED: handleCopy Function ---
    const handleCopy = useCallback(async () => {
        if (!canvasRef.current) {
            setError('Cannot copy: Canvas is not ready.');
            return;
        }
        setIsCopied(false);
        setError('');
        let historyStatus: 'success' | 'error' = 'success';
        let historyOutput = 'Image copied to clipboard';

        try {
             if (!navigator.clipboard?.write) { throw new Error("Clipboard API (write) not available or not permitted."); }

             const canvas = canvasRef.current;
             // Use Promise wrapper for toBlob for async/await
             const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

             if (!blob) { throw new Error("Failed to create blob from canvas for clipboard."); }

             const clipboardItem = new ClipboardItem({ 'image/png': blob });
             await navigator.clipboard.write([clipboardItem]);
             setIsCopied(true);
             setTimeout(() => setIsCopied(false), 2000); // Reset after 2s

         } catch (err) {
             console.error('Failed to copy image to clipboard:', err);
             const message = err instanceof Error ? err.message : 'Unknown clipboard error';
             setError(`Copy failed: ${message}`);
             historyStatus = 'error';
             historyOutput = `Error: ${message}`;
         } finally {
             addHistoryEntry({
                 toolName: toolTitle, toolRoute: toolRoute,
                 action: `copy${historyStatus === 'error' ? '-failed': ''}`,
                 input: {fileName: fileName},
                 output: historyOutput, status: historyStatus
             });
         }
     }, [fileName, addHistoryEntry, toolTitle, toolRoute]);


  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      {/* --- MODIFIED CONTROLS SECTION --- */}
      <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <label htmlFor="imageUpload" className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {isLoading ? 'Processing...' : (originalImageSrc ? 'Change Image' : 'Select Image')}
        </label>
        <input id="imageUpload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={isLoading} />

        {/* Action Buttons Group */}
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
      {/* --- END MODIFIED CONTROLS --- */}

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
               // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={originalImageRef}
                src={originalImageSrc}
                alt={fileName || "Original"}
                className="max-w-full max-h-full object-contain"
                // Add crossOrigin if loading from external sources and need canvas access
                // crossOrigin="anonymous"
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
               // eslint-disable-next-line @next/next/no-img-element
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
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
}