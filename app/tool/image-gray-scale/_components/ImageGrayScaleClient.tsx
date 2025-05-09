// FILE: app/tool/image-gray-scale/_components/ImageGrayScaleClient.tsx
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
import { useHistory } from '../../../context/HistoryContext';
import type { StoredFile } from '@/src/types/storage';
import FileSelectionModal from '@/app/tool/_components/file-storage/FileSelectionModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing';
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
  CheckBadgeIcon,
} from '@heroicons/react/20/solid';

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

  const [processedFileId, setProcessedFileId] = useState<string | null>(null);
  const [isProcessedFilePermanent, setIsProcessedFilePermanent] =
    useState<boolean>(false);

  const [autoSaveProcessed, setAutoSaveProcessed] = useState<boolean>(true);
  const [isManuallySaving, setIsManuallySaving] = useState<boolean>(false);

  const [uiError, setUiError] = useState<string | null>(null);

  const { addHistoryEntry } = useHistory();

  const { getImage, makeImagePermanent } = useImageLibrary();

  const {
    originalImageSrc,
    processedImageSrc,
    processedImageBlob,
    processedFileId: hookProcessedFileId,
    fileName,
    isLoading: isProcessingImage,
    error: processingErrorHook,
    setOriginalImageSrc,
    processImage,
    clearProcessingOutput,
  } = useImageProcessing({ toolTitle, toolRoute });

  useEffect(() => {
    setProcessedFileId(hookProcessedFileId);
    if (hookProcessedFileId && autoSaveProcessed) {
      setIsProcessedFilePermanent(true);
    } else if (!hookProcessedFileId) {
      setIsProcessedFilePermanent(false);
    }
  }, [hookProcessedFileId, autoSaveProcessed]);

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

  useEffect(() => {
    let objectUrl: string | null = null;
    if (selectedFile?.blob && selectedFile.type?.startsWith('image/')) {
      try {
        clearProcessingOutput();
        setIsProcessedFilePermanent(false);
        setIsCopied(false);
        setUiError(null);
        objectUrl = URL.createObjectURL(selectedFile.blob);
        setOriginalImageSrc(objectUrl);
      } catch (e) {
        setUiError(
          `Could not create preview for selected image: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        setOriginalImageSrc(null);
      }
    } else {
      setOriginalImageSrc(null);
      clearProcessingOutput();
      setIsProcessedFilePermanent(false);
      if (selectedFile)
        setUiError('Invalid file type. Please select an image.');
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile, setOriginalImageSrc, clearProcessingOutput, setUiError]);

  const processingEffectRunCount = useRef(0);
  const processingKey = useMemo(() => selectedFile?.id || null, [selectedFile]);
  const prevProcessingKey = useRef<string | null>(null);

  useEffect(() => {
    processingEffectRunCount.current += 1;
    if (!selectedFile?.blob || !selectedFile.type?.startsWith('image/')) {
      prevProcessingKey.current = processingKey;
      return;
    }
    if (processingKey === prevProcessingKey.current && !isProcessingImage)
      return;
    if (isProcessingImage && processingKey === prevProcessingKey.current)
      return;

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
      const outputFileName = `grayscale-${baseName}.${extension}`;

      await processImage(
        currentInputFileForAsync,
        convertToGrayScale,
        'auto',
        outputFileName,
        {},
        autoSaveProcessed
      );
    };
    triggerProcessing();
  }, [
    processingKey,
    isProcessingImage,
    selectedFile,
    processImage,
    convertToGrayScale,
    autoSaveProcessed,
  ]);

  const handleFilesSelectedFromModal = useCallback(
    (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      prevProcessingKey.current = null;
      if (files && files.length > 0) {
        const firstFile = files[0];
        if (firstFile.type?.startsWith('image/') && firstFile.blob) {
          setSelectedFile(firstFile);
          clearProcessingOutput();
          setIsProcessedFilePermanent(false);
        } else {
          setUiError('Invalid file selected. Please select an image.');
          setSelectedFile(null);
          clearProcessingOutput();
          setIsProcessedFilePermanent(false);
        }
      } else {
        setSelectedFile(null);
        clearProcessingOutput();
        setIsProcessedFilePermanent(false);
      }
    },
    [setUiError, clearProcessingOutput]
  );

  const handleAutoSaveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAutoSaveState = e.target.checked;
      setAutoSaveProcessed(newAutoSaveState);
      setUiError(null);

      if (
        newAutoSaveState === true &&
        processedFileId &&
        !isProcessedFilePermanent &&
        !isProcessingImage &&
        !isManuallySaving
      ) {
        console.log(
          '[ImageGrayScaleClient] Auto-save ON. Making current image permanent.'
        );
        setIsManuallySaving(true);
        try {
          await makeImagePermanent(processedFileId);
          setIsProcessedFilePermanent(true);
          addHistoryEntry({
            toolName: toolTitle,
            toolRoute,
            trigger: 'auto',
            input: {
              originalFile: selectedFile?.name,
              processedFileId: processedFileId,
              operation: 'auto-save toggled on',
            },
            output: { message: `File ${processedFileId} made permanent.` },
            outputFileIds: [processedFileId],
            status: 'success',
            eventTimestamp: Date.now(),
          });
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to make image permanent.';
          setUiError(`Auto-save failed: ${message}`);
        } finally {
          setIsManuallySaving(false);
        }
      }
    },
    [
      processedFileId,
      isProcessedFilePermanent,
      makeImagePermanent,
      addHistoryEntry,
      toolTitle,
      toolRoute,
      selectedFile?.name,
      isProcessingImage,
      isManuallySaving,
      setUiError,
    ]
  );

  const handleClear = useCallback(() => {
    setOriginalImageSrc(null);
    clearProcessingOutput();
    setUiError(null);
    setSelectedFile(null);
    prevProcessingKey.current = null;

    setIsCopied(false);
    setAutoSaveProcessed(true);
    setIsProcessedFilePermanent(false);
  }, [setOriginalImageSrc, clearProcessingOutput, setUiError]);

  const handleDownload = useCallback(() => {
    if (!processedImageSrc || !fileName) {
      setUiError('No image to download.');
      return;
    }
    setUiError(null);
    const link = document.createElement('a');
    const baseName =
      fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    const mimeType =
      processedImageSrc.match(/data:(image\/\w+);base64,/)?.[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    link.download = `grayscale-${baseName}.${extension}`;
    link.href = processedImageSrc;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [processedImageSrc, fileName, setUiError]);

  const handleCopyToClipboard = useCallback(async () => {
    setIsCopied(false);
    setUiError(null);
    let blobToCopy: Blob | null = null;
    if (processedFileId) {
      const fileData = await getImage(processedFileId);
      if (fileData?.blob && fileData.type?.startsWith('image/'))
        blobToCopy = fileData.blob;
      else {
        if (processedImageBlob) blobToCopy = processedImageBlob;
        else {
          setUiError('Processed image data not found for copy.');
          return;
        }
      }
    } else if (processedImageBlob) blobToCopy = processedImageBlob;
    else {
      setUiError('No image data available to copy.');
      return;
    }
    if (!blobToCopy) {
      setUiError('Blob data missing for copy.');
      return;
    }
    try {
      if (!navigator.clipboard?.write)
        throw new Error('Clipboard API not available.');
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
  }, [processedFileId, processedImageBlob, getImage, setUiError]);

  const handleSaveProcessedToLibrary = useCallback(async () => {
    if (!processedFileId || isProcessedFilePermanent) {
      if (!processedFileId) setUiError('No processed image available to save.');
      return;
    }
    setIsManuallySaving(true);
    setUiError(null);
    try {
      await makeImagePermanent(processedFileId);
      setIsProcessedFilePermanent(true);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute,
        trigger: 'click',
        input: {
          originalFile: selectedFile?.name,
          processedFileId: processedFileId,
          operation: 'manual save',
        },
        output: {
          message: `Made processed image ${processedFileId} permanent.`,
        },
        outputFileIds: [processedFileId],
        status: 'success',
        eventTimestamp: Date.now(),
      });
    } catch (err) {
      setUiError(
        `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsManuallySaving(false);
    }
  }, [
    processedFileId,
    isProcessedFilePermanent,
    makeImagePermanent,
    addHistoryEntry,
    toolTitle,
    toolRoute,
    selectedFile?.name,
    setUiError,
  ]);

  const imageFilter = useMemo(() => ({ category: 'image' }), []);
  const displayError = processingErrorHook || uiError;
  const canPerformActions =
    !!processedImageSrc && !isProcessingImage && !isManuallySaving;

  const showSaveButton =
    processedImageBlob &&
    !autoSaveProcessed &&
    !isProcessedFilePermanent &&
    !isProcessingImage &&
    !isManuallySaving;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      {/* Controls Section */}
      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        {/* Row 1: File selection */}
        <div className="flex flex-wrap gap-4 items-center">
          <Button
            variant="accent2"
            iconLeft={<PhotoIcon className="h-5 w-5" />}
            onClick={() => setIsLibraryModalOpen(true)}
            disabled={isProcessingImage || isManuallySaving}
          >
            {originalImageSrc ? 'Change Image' : 'Select Image'}
          </Button>
        </div>
        {/* Row 2: Auto-save and action buttons */}
        <div className="flex flex-wrap gap-4 items-center pt-3 border-t border-gray-200 mt-2">
          <Checkbox
            label="Auto-save grayscale image to Library"
            checked={autoSaveProcessed}
            onChange={handleAutoSaveChange}
            disabled={isProcessingImage || isManuallySaving}
            id="autoSaveGrayscaleImage"
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
                !displayError &&
                !isProcessingImage &&
                !isManuallySaving
              }
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Error Display */}
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

      {/* Image Previews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Original Image */}
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
        {/* Grayscale Image */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Grayscale Image
            {/* Updated Status Indicator */}
            {processedFileId && isProcessedFilePermanent && (
              <span className="text-xs text-green-600 ml-1 inline-flex items-center gap-1">
                <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" /> (Saved
                to Library)
              </span>
            )}
            {processedFileId &&
              !isProcessedFilePermanent &&
              !autoSaveProcessed && (
                <span className="text-xs text-orange-600 ml-1">
                  (Not Saved)
                </span>
              )}
          </label>
          <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {isProcessingImage && !processedImageSrc && (
              <div className="flex flex-col items-center text-sm text-[rgb(var(--color-text-link))] italic">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2 text-[rgb(var(--color-text-link))]" />{' '}
                Grayscaling...
              </div>
            )}
            {!isProcessingImage && processedImageSrc ? (
              <Image
                src={processedImageSrc}
                alt={fileName ? `Grayscale ${fileName}` : 'Grayscale Image'}
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

      {/* Modal */}
      <FileSelectionModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        onFilesSelected={handleFilesSelectedFromModal}
        mode="selectExistingOrUploadNew"
        initialTab="library"
        showFilterAfterUploadCheckbox={false}
        accept="image/*"
        selectionMode="single"
        libraryFilter={imageFilter}
        className="max-w-4xl"
      />
    </div>
  );
}
