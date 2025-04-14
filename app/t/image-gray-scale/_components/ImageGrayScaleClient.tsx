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
  const originalImageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { addHistoryEntry } = useHistory();

  const handleImageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError('');
    setGrayScaleImageSrc(null);
    setFileName(null);
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result && typeof e.target.result === 'string') {
            setOriginalImageSrc(e.target.result);
            setFileName(file.name);
            addHistoryEntry({
              toolName: toolTitle,
              toolRoute: toolRoute,
              action: 'load-image',
              input: { fileName: file.name, fileSize: file.size, fileType: file.type },
              output: 'Image loaded for processing',
              status: 'success',
            });
          } else {
            setError('Failed to read file.');
          }
        };
        reader.onerror = () => {
          setError('Error reading file.');
        };
        reader.readAsDataURL(file);
      } else {
        setError('Invalid file type. Please select an image.');
        if (event.target) event.target.value = '';
      }
    }
  }, [addHistoryEntry, toolTitle, toolRoute]);

  const handleGrayScale = useCallback(async () => {
    if (!originalImageSrc || !originalImageRef.current) {
      return;
    }
    setIsLoading(true);
    setError('');
    setGrayScaleImageSrc(null);
    let generatedDataUrl: string | null = null;
    let status: 'success' | 'error' = 'success';
    let historyOutput: string = 'Image converted to grayscale successfully';
    try {
      const img = originalImageRef.current;
      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context.');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg; // red
        data[i + 1] = avg; // green
        data[i + 2] = avg; // blue
      }
      ctx.putImageData(imageData, 0, 0);
      generatedDataUrl = canvas.toDataURL();
      setGrayScaleImageSrc(generatedDataUrl);
    } catch (err) {
      console.error("GrayScale Error:", err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Error converting to grayscale: ${message}`);
      setGrayScaleImageSrc(null);
      status = 'error';
      historyOutput = `Error: ${message}`;
    } finally {
      setIsLoading(false);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        action: `grayscale-${status}`,
        input: { fileName: fileName, originalSrcLength: originalImageSrc?.length },
        output: status === 'success' ? `[Grayscale Image DataURL, length: ${generatedDataUrl?.length}]` : historyOutput,
        status: status,
      });
    }
  }, [originalImageSrc, fileName, addHistoryEntry, toolTitle, toolRoute]);

  useEffect(() => {
    if (originalImageSrc) {
      handleGrayScale();
    }
  }, [originalImageSrc, handleGrayScale]);

  const handleClear = useCallback(() => {
    setOriginalImageSrc(null);
    setGrayScaleImageSrc(null);
    setFileName(null);
    setError('');
    setIsLoading(false);
    const fileInput = document.getElementById('imageUpload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    addHistoryEntry({
      toolName: toolTitle,
      toolRoute: toolRoute,
      action: 'clear',
      input: {},
      output: 'Inputs and outputs cleared',
      status: 'success',
    });
  }, [addHistoryEntry, toolTitle, toolRoute]);

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <label htmlFor="imageUpload" className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {isLoading ? 'Processing...' : (originalImageSrc ? 'Change Image' : 'Select Image')}
        </label>
        <input id="imageUpload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={isLoading} />
        <button type="button" onClick={handleClear} disabled={!originalImageSrc && !grayScaleImageSrc && !error} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
          Clear
        </button>
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