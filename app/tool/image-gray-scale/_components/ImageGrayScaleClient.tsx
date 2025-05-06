// FILE: app/tool/image-gray-scale/_components/ImageGrayScaleClient.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import type { StoredFile } from '@/src/types/storage'; // Uses updated type
import FileSelectionModal from '@/app/tool/_components/FileSelectionModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing'; // Uses updated hook

interface ImageGrayScaleClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function ImageGrayScaleClient({
  toolTitle,
  toolRoute,
}: ImageGrayScaleClientProps) {
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [lastProcessedImageId, setLastProcessedImageId] = useState<
    string | null
  >(null);

  const {
    originalImageSrc,
    processedImageSrc,
    fileName,
    isLoading,
    error,
    setOriginalImageSrc,
    setProcessedImageSrc,
    setFileName,
    setError,
    setIsLoading,
    processImage,
  } = useImageProcessing({ toolTitle, toolRoute }); // Use updated hook

  const { getImage } = useImageLibrary(); // Use updated hook

  // convertToGrayScale function remains the same
  const convertToGrayScale = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
      const { naturalWidth: w, naturalHeight: h } = img;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const luminance =
          data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = luminance;
        data[i + 1] = luminance;
        data[i + 2] = luminance;
      }
      ctx.putImageData(imageData, 0, 0);
    },
    []
  );

  // useEffect for original preview (remains the same)
  useEffect(() => {
    let objectUrl: string | null = null;
    if (selectedFile?.blob) {
      try {
        objectUrl = URL.createObjectURL(selectedFile.blob);
        setOriginalImageSrc(objectUrl);
        setFileName(selectedFile.name);
        setProcessedImageSrc(null);
        setError(null);
        setLastProcessedImageId(null);
        setIsCopied(false);
      } catch (e) {
        console.error('Error creating object URL:', e);
        setError('Could not create preview.');
        setOriginalImageSrc(null);
        setFileName(null);
      }
    } else {
      setOriginalImageSrc(null);
      setFileName(null);
    }
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    selectedFile,
    setOriginalImageSrc,
    setProcessedImageSrc,
    setFileName,
    setError,
  ]);

  // useEffect for processing (remains the same)
  useEffect(() => {
    if (selectedFile && originalImageSrc) {
      const triggerProcessing = async () => {
        const baseName =
          selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) ||
          selectedFile.name;
        const extension =
          selectedFile.name.substring(selectedFile.name.lastIndexOf('.') + 1) ||
          'png';
        const outputFileName = `grayscale-${baseName}.${extension}`;
        const newImageId = await processImage(
          selectedFile,
          convertToGrayScale,
          'auto',
          outputFileName
        );
        setLastProcessedImageId(newImageId);
      };
      triggerProcessing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, originalImageSrc]);

  // handleFilesSelected: Check type instead of category
  const handleFilesSelected = useCallback(
    (files: StoredFile[], source: 'library' | 'upload') => {
      setIsLibraryModalOpen(false);
      if (files && files.length > 0) {
        console.log(
          `[ImageGrayScale] File selected from ${source}:`,
          files[0].name
        );
        // *** Check type prefix instead of category ***
        if (files[0].type?.startsWith('image/') && files[0].blob) {
          setSelectedFile(files[0]);
        } else {
          setError('Invalid file selected. Please select an image.');
          setSelectedFile(null);
        }
      } else {
        setSelectedFile(null);
      }
    },
    [setError]
  ); // Dependency remains setError

  // Other handlers remain the same
  const handleClear = useCallback(() => {
    setOriginalImageSrc(null);
    setProcessedImageSrc(null);
    setFileName(null);
    setError(null);
    setIsLoading(false);
    setSelectedFile(null);
    setLastProcessedImageId(null);
    setIsCopied(false);
  }, [
    setOriginalImageSrc,
    setProcessedImageSrc,
    setFileName,
    setError,
    setIsLoading,
  ]);
  const handleDownload = useCallback(() => {
    if (!processedImageSrc || !fileName) {
      setError('No processed image available to download.');
      return;
    }
    setError(null);
    const link = document.createElement('a');
    const baseName =
      fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    const extension =
      fileName.substring(fileName.lastIndexOf('.') + 1) || 'png';
    link.download = `grayscale-${baseName}.${extension}`;
    link.href = processedImageSrc;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [processedImageSrc, fileName, setError]);
  const handleCopyToClipboard = useCallback(async () => {
    if (!lastProcessedImageId) {
      setError('No processed image ID to copy.');
      return;
    }
    setIsCopied(false);
    setError(null);
    try {
      const imageData = await getImage(lastProcessedImageId);
      if (!imageData?.blob) throw new Error('Processed image blob not found.');
      if (!navigator.clipboard?.write)
        throw new Error('Clipboard API not available.');
      const clipboardItem = new ClipboardItem({
        [imageData.blob.type]: imageData.blob,
      });
      await navigator.clipboard.write([clipboardItem]);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy image:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Copy failed: ${message}`);
    }
  }, [lastProcessedImageId, getImage, setError]);

  // JSX Render logic remains the same
  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      {/* Controls Section */}
      <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <button
          type="button"
          onClick={() => setIsLibraryModalOpen(true)}
          disabled={isLoading}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {' '}
          {originalImageSrc ? 'Change Image' : 'Select from Library'}{' '}
        </button>
        <div className="flex gap-3 ml-auto">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!processedImageSrc || isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-primary-text))] bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {' '}
            Download{' '}
          </button>
          <button
            type="button"
            onClick={handleCopyToClipboard}
            disabled={!processedImageSrc || isLoading}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${isCopied ? 'bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] text-[rgb(var(--color-button-secondary-text))]' : 'bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] text-[rgb(var(--color-button-accent-text))]'}`}
          >
            {' '}
            {isCopied ? 'Copied!' : 'Copy'}{' '}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!originalImageSrc && !processedImageSrc && !error}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {' '}
            Clear{' '}
          </button>
        </div>
      </div>
      {/* Error Display */}
      {error && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          {' '}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 flex-shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>{' '}
          <div>
            <strong className="font-semibold">Error:</strong> {error}
          </div>{' '}
        </div>
      )}
      {/* Image Previews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            {' '}
            Original Image{' '}
            {fileName && (
              <span className="font-normal text-xs text-[rgb(var(--color-text-muted))]">
                ({fileName})
              </span>
            )}{' '}
          </label>
          <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {' '}
            {originalImageSrc ? (
              <Image
                src={originalImageSrc}
                alt={fileName || 'Original'}
                width={500}
                height={500}
                className="max-w-full max-h-full object-contain"
                unoptimized={true}
              />
            ) : (
              <span className="text-sm text-[rgb(var(--color-input-placeholder))] italic">
                Select an image from library
              </span>
            )}{' '}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Grayscale Image
          </label>
          <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {' '}
            {isLoading && !processedImageSrc && (
              <span className="text-sm text-[rgb(var(--color-text-link))] italic animate-pulse">
                Converting...
              </span>
            )}{' '}
            {!isLoading && processedImageSrc ? (
              <Image
                src={processedImageSrc}
                alt={fileName ? `Grayscale ${fileName}` : 'Grayscale Image'}
                width={500}
                height={500}
                className="max-w-full max-h-full object-contain"
                unoptimized={true}
              />
            ) : (
              !isLoading && (
                <span className="text-sm text-[rgb(var(--color-input-placeholder))] italic">
                  Output appears here
                </span>
              )
            )}{' '}
          </div>
        </div>
      </div>
      {/* File Selection Modal */}
      <FileSelectionModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        onFilesSelected={handleFilesSelected}
        libraryFilter={{ category: 'image' }}
        selectionMode="single"
        accept="image/*"
        className="max-w-4xl"
      />
    </div>
  );
}
