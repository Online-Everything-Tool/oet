// FILE: app/tool/image-flip/_components/ImageFlipClient.tsx
'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import Image from 'next/image';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import { useHistory, TriggerType } from '../../../context/HistoryContext';
import type { StoredFile } from '@/src/types/storage';
import FileSelectionModal from '@/app/tool/_components/FileSelectionModal';
import useImageProcessing, {
  ProcessImageResult,
} from '@/app/tool/_hooks/useImageProcessing';
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import {
  PhotoIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  XCircleIcon,
  CheckIcon,
  ArrowPathIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/20/solid';

interface ImageFlipClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function ImageFlipClient({
  toolTitle,
  toolRoute,
}: ImageFlipClientProps) {
  const [flipType, setFlipType] = useState<'horizontal' | 'vertical'>(
    'horizontal'
  );
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);

  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [lastProcessedImageId, setLastProcessedImageId] = useState<
    string | null
  >(null);
  const [autoSaveProcessed, setAutoSaveProcessed] = useState<boolean>(true);
  const [isManuallySaving, setIsManuallySaving] = useState<boolean>(false);

  const [uiError, setUiError] = useState<string | null>(null);

  const { addHistoryEntry } = useHistory();
  const { addImage, getImage } = useImageLibrary();

  const {
    originalImageSrc,
    processedImageSrc,
    processedImageBlob,
    fileName,
    isLoading: isProcessingImage,
    error: processingErrorHook,
    setOriginalImageSrc,
    processImage,
    clearProcessingOutput,
  } = useImageProcessing({ toolTitle, toolRoute });

  const flipDrawFunction = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
      const { naturalWidth: w, naturalHeight: h } = img;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      if (flipType === 'horizontal') {
        ctx.scale(-1, 1);
        ctx.translate(-w, 0);
      } else {
        ctx.scale(1, -1);
        ctx.translate(0, -h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    },
    [flipType]
  );

  useEffect(() => {
    let objectUrl: string | null = null;
    if (selectedFile?.blob && selectedFile.type?.startsWith('image/')) {
      try {
        clearProcessingOutput();
        setLastProcessedImageId(null);
        setIsCopied(false);
        setUiError(null);
        objectUrl = URL.createObjectURL(selectedFile.blob);
        setOriginalImageSrc(objectUrl);
      } catch (e) {
        setUiError('Could not create preview for selected image.');
        setOriginalImageSrc(null);
      }
    } else {
      setOriginalImageSrc(null);
      clearProcessingOutput();
      if (selectedFile) {
        setUiError('Invalid file type. Please select an image.');
      }
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile, setOriginalImageSrc, clearProcessingOutput, setUiError]);

  const processingEffectRunCount = useRef(0);
  const processingKey = useMemo(() => {
    if (!selectedFile?.id) return null;
    // Key now only depends on file and flip type. Auto-save is just a flag for the operation.
    return `${selectedFile.id}-${flipType}`;
  }, [selectedFile, flipType]);
  const prevProcessingKey = useRef<string | null>(null);

  useEffect(() => {
    processingEffectRunCount.current += 1;
    const runId = processingEffectRunCount.current;
    console.log(
      `[ImageFlipClient] PROC_EFFECT (#${runId}) Eval. Key: ${processingKey}, PrevKey: ${prevProcessingKey.current}, isProcessing: ${isProcessingImage}, AutoSave: ${autoSaveProcessed}`
    );

    if (!selectedFile?.blob || !selectedFile.type?.startsWith('image/')) {
      console.log(
        `  (#${runId}) No valid selectedFile for processing. ID: ${selectedFile?.id}`
      );
      prevProcessingKey.current = processingKey;
      return;
    }

    if (processingKey === prevProcessingKey.current && !isProcessingImage) {
      // If key is same, and we just finished processing, no need to re-run unless forced by user action that changes the key
      console.log(
        `  (#${runId}) Key ${processingKey} is same as previous and not processing. Skipping re-processing.`
      );
      return;
    }

    if (isProcessingImage) {
      console.log(
        `  (#${runId}) isProcessingImage is TRUE. Skipping duplicate process call for key ${processingKey}.`
      );
      return;
    }

    console.log(
      `  (#${runId}) New processing task or re-processing due to key change. Key: ${processingKey}, Prev: ${prevProcessingKey.current}`
    );
    prevProcessingKey.current = processingKey;

    const currentInputFileForAsync = selectedFile;

    const triggerProcessing = async () => {
      const baseName =
        currentInputFileForAsync.name.substring(
          0,
          currentInputFileForAsync.name.lastIndexOf('.')
        ) || currentInputFileForAsync.name;
      const mimeTypeParts = currentInputFileForAsync.type?.split('/');
      const extension =
        mimeTypeParts && mimeTypeParts.length > 1 ? mimeTypeParts[1] : 'png';
      const outputFileName = `flipped-${flipType}-${baseName}.${extension}`;

      console.log(
        `    (#${runId}) Calling processImage for ${outputFileName} (AutoSave: ${autoSaveProcessed}) (Input ID: ${currentInputFileForAsync.id})`
      );
      const result: ProcessImageResult = await processImage(
        currentInputFileForAsync,
        flipDrawFunction,
        'auto',
        outputFileName,
        { flipType },
        autoSaveProcessed
      );
      console.log(
        `    (#${runId}) processImage returned. Result ID: ${result.id}, Input ID: ${currentInputFileForAsync.id}`
      );

      if (selectedFile && selectedFile.id === currentInputFileForAsync.id) {
        setLastProcessedImageId(result.id);
        console.log(
          `    (#${runId}) Set lastProcessedImageId to: ${result.id}`
        );
      } else {
        console.warn(
          `    (#${runId}) Race condition: selectedFile changed. Not setting ID.`
        );
      }
    };

    triggerProcessing();
  }, [
    processingKey,
    isProcessingImage,
    selectedFile,
    processImage,
    flipDrawFunction,
    autoSaveProcessed,
  ]);

  const handleFilesSelectedFromModal = useCallback(
    (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      prevProcessingKey.current = null; // Force re-process for new file
      if (files && files.length > 0) {
        const firstFile = files[0];
        if (firstFile.type?.startsWith('image/') && firstFile.blob) {
          setSelectedFile(firstFile);
        } else {
          setUiError('Invalid file selected. Please select an image.');
          setSelectedFile(null);
        }
      } else {
        setSelectedFile(null);
      }
    },
    [setUiError]
  );

  const handleFlipTypeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      prevProcessingKey.current = null; // Force re-process for new flip type
      setFlipType(event.target.value as 'horizontal' | 'vertical');
      setIsCopied(false);
    },
    []
  );

  // Handler for Auto-Save Checkbox
  const handleAutoSaveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAutoSaveState = e.target.checked;
      setAutoSaveProcessed(newAutoSaveState);
      setUiError(null);

      // If changing from OFF to ON, and there's an unsaved processed image, save it.
      if (
        newAutoSaveState === true &&
        processedImageBlob &&
        !lastProcessedImageId &&
        !isProcessingImage &&
        !isManuallySaving
      ) {
        console.log(
          '[ImageFlipClient] Auto-save toggled ON. Attempting to save current processed image.'
        );
        // Call the manual save function
        setIsManuallySaving(true); // Indicate manual save process starting
        const baseName = fileName || 'flipped-image';
        const mimeType = processedImageBlob.type || 'image/png';
        const extension = mimeType.split('/')[1] || 'png';
        const outputFileName = `flipped-${flipType}-${baseName}.${extension}`;
        try {
          const newImageId = await addImage(
            processedImageBlob,
            outputFileName,
            mimeType
          );
          setLastProcessedImageId(newImageId);
          addHistoryEntry({
            /* ... history entry for this save ... */
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Failed to auto-save image.';
          setUiError(`Auto-save failed: ${message}`);
        } finally {
          setIsManuallySaving(false);
        }
      }
      // If changing from ON to OFF, no immediate action on existing processed image is needed.
      // The processingKey logic will handle future processing based on selectedFile & flipType.
    },
    [
      processedImageBlob,
      lastProcessedImageId,
      fileName,
      flipType,
      addImage,
      addHistoryEntry,
      toolTitle,
      toolRoute,
      isProcessingImage,
      isManuallySaving,
      setUiError,
    ]
  );

  const handleClear = useCallback(() => {
    setOriginalImageSrc(null);
    clearProcessingOutput();
    setFlipType('horizontal');
    setUiError(null);
    setSelectedFile(null);
    prevProcessingKey.current = null;
    setLastProcessedImageId(null);
    setIsCopied(false);
    setAutoSaveProcessed(true);
  }, [setOriginalImageSrc, clearProcessingOutput, setUiError]);

  const handleDownload = useCallback(() => {
    if (!processedImageSrc || !fileName) {
      setUiError('No image to download.');
      return;
    }
    setUiError(null); /* ... download logic ... */
    const link = document.createElement('a');
    const baseName =
      fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    const mimeType =
      processedImageSrc.match(/data:(image\/\w+);base64,/)?.[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    link.download = `flipped-${flipType}-${baseName}.${extension}`;
    link.href = processedImageSrc;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [processedImageSrc, fileName, flipType, setUiError]);

  const handleCopyToClipboard = useCallback(async () => {
    setIsCopied(false);
    setUiError(null);
    let blobToCopy: Blob | null = null;
    if (lastProcessedImageId) {
      const imgD = await getImage(lastProcessedImageId);
      if (imgD?.blob && imgD.type?.startsWith('image/')) {
        blobToCopy = imgD.blob;
      } else {
        setUiError('Saved image for copy invalid.');
        return;
      }
    } else if (processedImageBlob) {
      blobToCopy = processedImageBlob;
    } else {
      setUiError('No image to copy.');
      return;
    }
    if (!blobToCopy) {
      setUiError('Blob missing for copy.');
      return;
    }
    try {
      if (!navigator.clipboard?.write) {
        throw new Error('Clipboard API not available.');
      }
      await navigator.clipboard.write([
        new ClipboardItem({ [blobToCopy.type || 'image/png']: blobToCopy }),
      ]);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      setUiError(
        `Copy failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }, [lastProcessedImageId, processedImageBlob, getImage, setUiError]);

  const handleSaveProcessedToLibrary = useCallback(async () => {
    if (!processedImageBlob || !fileName) {
      setUiError('No image to save.');
      return;
    }
    if (lastProcessedImageId) return; // Already saved or save in progress
    setIsManuallySaving(true);
    setUiError(null);
    try {
      const baseName =
        fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      const mimeType = processedImageBlob.type || 'image/png';
      const extension = mimeType.split('/')[1] || 'png';
      const outputFileName = `flipped-${flipType}-${baseName}.${extension}`;
      const newImageId = await addImage(
        processedImageBlob,
        outputFileName,
        mimeType
      );
      setLastProcessedImageId(newImageId);
      addHistoryEntry({
        /* ... history ... */
      });
    } catch (err) {
      setUiError(
        `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsManuallySaving(false);
    }
  }, [
    processedImageBlob,
    fileName,
    flipType,
    addImage,
    addHistoryEntry,
    toolTitle,
    toolRoute,
    lastProcessedImageId,
    setUiError,
  ]);

  const imageFilter = useMemo(() => ({ category: 'image' }), []);
  const displayError = processingErrorHook || uiError;
  const canPerformActions =
    !!processedImageSrc && !isProcessingImage && !isManuallySaving;
  const showSaveButton =
    !autoSaveProcessed &&
    processedImageBlob &&
    !lastProcessedImageId &&
    !isProcessingImage &&
    !isManuallySaving;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="flex flex-wrap gap-4 items-center">
          <Button
            variant="accent2"
            iconLeft={<PhotoIcon className="h-5 w-5" />}
            onClick={() => setIsLibraryModalOpen(true)}
            disabled={isProcessingImage || isManuallySaving}
          >
            {originalImageSrc ? 'Change Image' : 'Select Image'}
          </Button>
          <fieldset
            className="flex gap-x-4 gap-y-2 items-center"
            disabled={isProcessingImage || isManuallySaving}
          >
            {' '}
            {/* Enabled by default now */}
            <legend className="sr-only">Flip Direction</legend>
            <div className="flex items-center">
              <input
                type="radio"
                id="flip-h"
                name="flipType"
                value="horizontal"
                checked={flipType === 'horizontal'}
                onChange={handleFlipTypeChange}
                disabled={isProcessingImage || isManuallySaving}
                className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] accent-[rgb(var(--color-checkbox-accent))] focus:ring-offset-0 focus:ring-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="flip-h"
                className={`ml-2 block text-sm ${isProcessingImage || isManuallySaving ? 'text-gray-400 cursor-not-allowed' : 'text-[rgb(var(--color-text-base))] cursor-pointer'}`}
              >
                Horizontal
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id="flip-v"
                name="flipType"
                value="vertical"
                checked={flipType === 'vertical'}
                onChange={handleFlipTypeChange}
                disabled={isProcessingImage || isManuallySaving}
                className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] accent-[rgb(var(--color-checkbox-accent))] focus:ring-offset-0 focus:ring-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="flip-v"
                className={`ml-2 block text-sm ${isProcessingImage || isManuallySaving ? 'text-gray-400 cursor-not-allowed' : 'text-[rgb(var(--color-text-base))] cursor-pointer'}`}
              >
                Vertical
              </label>
            </div>
          </fieldset>
        </div>
        <div className="flex flex-wrap gap-4 items-center pt-3 border-t border-gray-200 mt-2">
          <Checkbox
            label="Auto-save flipped image to Library"
            checked={autoSaveProcessed}
            onChange={handleAutoSaveChange}
            disabled={isProcessingImage || isManuallySaving}
            id="autoSaveFlippedImage"
          />
          <div className="flex gap-3 ml-auto">
            {showSaveButton && (
              <Button
                variant="secondary"
                iconLeft={<ArchiveBoxArrowDownIcon className="h-5 w-5" />}
                onClick={handleSaveProcessedToLibrary}
                disabled={isManuallySaving || isProcessingImage}
                isLoading={isManuallySaving}
                loadingText="Saving..."
              >
                Save to Library
              </Button>
            )}
            <Button
              variant="primary"
              iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
              onClick={handleDownload}
              disabled={!canPerformActions}
            >
              Download
            </Button>
            <Button
              variant={isCopied ? 'secondary' : 'accent'}
              iconLeft={
                isCopied ? (
                  <CheckIcon className="h-5 w-5" />
                ) : (
                  <ClipboardDocumentIcon className="h-5 w-5" />
                )
              }
              onClick={handleCopyToClipboard}
              disabled={!canPerformActions}
            >
              {isCopied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              variant="neutral"
              iconLeft={<XCircleIcon className="h-5 w-5" />}
              onClick={handleClear}
              disabled={
                !originalImageSrc &&
                !processedImageSrc &&
                !processingErrorHook &&
                !uiError &&
                !isProcessingImage &&
                !isManuallySaving
              }
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {displayError && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <XCircleIcon
            className="h-5 w-5 text-[rgb(var(--color-text-error))] "
            aria-hidden="true"
          />
          <div>
            {' '}
            <strong className="font-semibold">Error:</strong>{' '}
            {displayError}{' '}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            {' '}
            Original Image{' '}
            {fileName && (
              <span className="font-normal text-xs">({fileName})</span>
            )}{' '}
          </label>
          <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
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
                Select an image
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Flipped Image
            {lastProcessedImageId && (
              <span className="text-xs text-green-600 ml-1">
                (Saved to Library)
              </span>
            )}
            {!autoSaveProcessed &&
              processedImageBlob &&
              !lastProcessedImageId && (
                <span className="text-xs text-orange-600 ml-1">
                  (Not Saved)
                </span>
              )}
          </label>
          <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {isProcessingImage && !processedImageSrc && (
              <div className="flex flex-col items-center text-sm text-[rgb(var(--color-text-link))] italic">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2 text-[rgb(var(--color-text-link))]" />{' '}
                Flipping...
              </div>
            )}
            {!isProcessingImage && processedImageSrc ? (
              <Image
                src={processedImageSrc}
                alt={fileName ? `Flipped ${fileName}` : 'Flipped Image'}
                width={500}
                height={500}
                className="max-w-full max-h-full object-contain"
                unoptimized={true}
              />
            ) : (
              !isProcessingImage && (
                <span className="text-sm text-[rgb(var(--color-input-placeholder))] italic">
                  Output appears here
                </span>
              )
            )}
          </div>
        </div>
      </div>

      <FileSelectionModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        onFilesSelected={handleFilesSelectedFromModal}
        mode="selectExistingOrUploadNew"
        initialTab="library"
        accept="image/*"
        selectionMode="single"
        libraryFilter={imageFilter}
        className="max-w-4xl"
      />
    </div>
  );
}
