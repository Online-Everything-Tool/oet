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
import { useHistory } from '../../../context/HistoryContext';
import useToolState from '../../_hooks/useToolState';
import type { StoredFile } from '@/src/types/storage';
import FileSelectionModal from '@/app/tool/_components/file-storage/FileSelectionModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing';
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import type { ParamConfig } from '@/src/types/tools';
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

type FlipType = 'horizontal' | 'vertical';

interface ImageFlipToolSettings {
  flipType: FlipType;
  autoSaveProcessed: boolean;
}

const DEFAULT_FLIP_TOOL_SETTINGS: ImageFlipToolSettings = {
  flipType: 'horizontal',
  autoSaveProcessed: true,
};

interface ImageFlipClientProps {
  toolTitle: string;
  toolRoute: string;
  urlStateParams?: ParamConfig[];
}

export default function ImageFlipClient({
  toolTitle,
  toolRoute,
  urlStateParams,
}: ImageFlipClientProps) {
  const {
    state: toolSettings,
    setState: setToolSettings,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<ImageFlipToolSettings>(
    toolRoute,
    DEFAULT_FLIP_TOOL_SETTINGS
  );

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [processedFileIdForUI, setProcessedFileIdForUI] = useState<
    string | null
  >(null);
  const [isProcessedFilePermanent, setIsProcessedFilePermanent] =
    useState<boolean>(false);
  const [isManuallySaving, setIsManuallySaving] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const { addHistoryEntry } = useHistory();
  const { getImage, makeImagePermanent } = useImageLibrary();

  const {
    originalImageSrc,
    processedImageSrc,
    processedImageBlob,
    processedFileId: hookGeneratedFileId,
    fileName,
    isLoading: isProcessingImage,
    error: processingErrorHook,
    setOriginalImageSrc,
    processImage,
    clearProcessingOutput,
  } = useImageProcessing({ toolTitle, toolRoute });

  useEffect(() => {
    setProcessedFileIdForUI(hookGeneratedFileId);
    if (hookGeneratedFileId && toolSettings.autoSaveProcessed) {
      setIsProcessedFilePermanent(true);
    } else if (!hookGeneratedFileId) {
      setIsProcessedFilePermanent(false);
    }
  }, [hookGeneratedFileId, toolSettings.autoSaveProcessed]);

  useEffect(() => {
    if (
      !isLoadingToolSettings &&
      urlStateParams &&
      urlStateParams?.length > 0
    ) {
      const params = new URLSearchParams(window.location.search);
      const newSettings: Partial<ImageFlipToolSettings> = {};
      let changed = false;
      const typeFromUrl =
        (params.get('flip') as FlipType) ||
        (params.get('flipType') as FlipType);
      if (
        typeFromUrl &&
        ['horizontal', 'vertical'].includes(typeFromUrl) &&
        typeFromUrl !== toolSettings.flipType
      ) {
        newSettings.flipType = typeFromUrl;
        changed = true;
      }
      const autoSaveFromUrl = params.get('autoSave');
      if (autoSaveFromUrl !== null) {
        const autoSaveBool = autoSaveFromUrl.toLowerCase() === 'true';
        if (autoSaveBool !== toolSettings.autoSaveProcessed) {
          newSettings.autoSaveProcessed = autoSaveBool;
          changed = true;
        }
      }
      if (changed && Object.keys(newSettings).length > 0) {
        // Check if newSettings is not empty
        setToolSettings(newSettings);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingToolSettings, urlStateParams, setToolSettings]);

  const flipDrawFunction = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
      const { naturalWidth: w, naturalHeight: h } = img;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      if (toolSettings.flipType === 'horizontal') {
        ctx.scale(-1, 1);
        ctx.translate(-w, 0);
      } else {
        ctx.scale(1, -1);
        ctx.translate(0, -h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    },
    [toolSettings.flipType]
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
        setUiError('Could not create preview for selected image.');
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

  const processingKey = useMemo(() => {
    if (!selectedFile?.id) return null;
    return `${selectedFile.id}-${toolSettings.flipType}-${toolSettings.autoSaveProcessed}`;
  }, [selectedFile, toolSettings.flipType, toolSettings.autoSaveProcessed]);

  const prevProcessingKey = useRef<string | null>(null);

  useEffect(() => {
    if (
      !selectedFile?.blob ||
      !selectedFile.type?.startsWith('image/') ||
      isLoadingToolSettings
    ) {
      // If no valid file selected, or tool settings are still loading, don't process.
      // Also, clear previous processing key to allow re-processing if file is re-selected later.
      prevProcessingKey.current = null;
      return;
    }

    // Only re-process if key has changed OR if there's no processed image yet for the current key
    if (
      processingKey !== prevProcessingKey.current ||
      (!processedImageSrc && !isProcessingImage)
    ) {
      if (isProcessingImage && processingKey === prevProcessingKey.current)
        return; // Already processing this exact key

      prevProcessingKey.current = processingKey;
      const currentInputFileForAsync = selectedFile;
      const currentFlipType = toolSettings.flipType;
      const currentAutoSave = toolSettings.autoSaveProcessed;

      const triggerProcessing = async () => {
        const baseName =
          currentInputFileForAsync.name.substring(
            0,
            currentInputFileForAsync.name.lastIndexOf('.')
          ) || currentInputFileForAsync.name;
        const mimeTypeParts = currentInputFileForAsync.type?.split('/');
        const extension =
          mimeTypeParts && mimeTypeParts.length > 1 ? mimeTypeParts[1] : 'png';
        const outputFileName = `flipped-${currentFlipType}-${baseName}.${extension}`;

        await processImage(
          currentInputFileForAsync,
          flipDrawFunction,
          'auto',
          outputFileName,
          { flipType: currentFlipType },
          currentAutoSave
        );
      };
      triggerProcessing();
    }
  }, [
    processingKey,
    selectedFile,
    toolSettings.flipType,
    toolSettings.autoSaveProcessed,
    isLoadingToolSettings,
    isProcessingImage,
    processImage,
    flipDrawFunction,
    processedImageSrc,
  ]);

  const handleFilesSelectedFromModal = useCallback(
    (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      // prevProcessingKey.current = null; // Resetting here might cause re-process even if same file selected
      if (files && files.length > 0) {
        const firstFile = files[0];
        if (firstFile.type?.startsWith('image/') && firstFile.blob) {
          if (selectedFile?.id !== firstFile.id) {
            // Only reset if it's a truly new file
            prevProcessingKey.current = null;
            clearProcessingOutput();
            setIsProcessedFilePermanent(false);
          }
          setSelectedFile(firstFile);
        } else {
          setUiError('Invalid file selected. Please select an image.');
          setSelectedFile(null);
          clearProcessingOutput();
          setIsProcessedFilePermanent(false);
        }
      } else {
        // If no file selected (e.g. modal closed), and a file was previously selected, do nothing to current file
        // If no file was previously selected, ensure clean state
        if (!selectedFile) {
          setSelectedFile(null);
          clearProcessingOutput();
          setIsProcessedFilePermanent(false);
        }
      }
    },
    [setUiError, clearProcessingOutput, selectedFile] // Added selectedFile
  );

  const handleFlipTypeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newFlipType = event.target.value as FlipType;
      setToolSettings((prev) => ({ ...prev, flipType: newFlipType }));
      setIsCopied(false);
      // If a file is already selected, changing flip type will trigger re-processing via useEffect on processingKey
      // If no file selected, output remains clear.
      // No need to clearProcessingOutput() here as useEffect will handle it.
    },
    [setToolSettings]
  );

  const handleAutoSaveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAutoSaveState = e.target.checked;
      setToolSettings({ autoSaveProcessed: newAutoSaveState });
      setUiError(null);
      if (
        newAutoSaveState === true &&
        hookGeneratedFileId &&
        !isProcessedFilePermanent &&
        !isProcessingImage &&
        !isManuallySaving
      ) {
        setIsManuallySaving(true);
        try {
          await makeImagePermanent(hookGeneratedFileId);
          setIsProcessedFilePermanent(true);
          addHistoryEntry({
            toolName: toolTitle,
            toolRoute,
            trigger: 'auto',
            input: {
              processedFileId: hookGeneratedFileId,
              action: 'auto-save-on',
            },
            output: { message: `File ${hookGeneratedFileId} made permanent.` },
            outputFileIds: [hookGeneratedFileId],
            status: 'success',
            eventTimestamp: Date.now(),
          });
        } catch (err) {
          setUiError(
            `Auto-save failed: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        } finally {
          setIsManuallySaving(false);
        }
      }
    },
    [
      hookGeneratedFileId,
      isProcessedFilePermanent,
      makeImagePermanent,
      addHistoryEntry,
      toolTitle,
      toolRoute,
      isProcessingImage,
      isManuallySaving,
      setToolSettings,
      setUiError,
    ]
  );

  const handleClear = useCallback(() => {
    setOriginalImageSrc(null);
    clearProcessingOutput();
    setSelectedFile(null);
    setToolSettings(DEFAULT_FLIP_TOOL_SETTINGS); // Reset tool settings to default
    setUiError(null);
    setIsCopied(false);
    setIsProcessedFilePermanent(false);
    prevProcessingKey.current = null;
  }, [setOriginalImageSrc, clearProcessingOutput, setToolSettings, setUiError]);

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
    link.download = `flipped-${toolSettings.flipType}-${baseName}.${extension}`;
    link.href = processedImageSrc;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [processedImageSrc, fileName, toolSettings.flipType, setUiError]);

  const handleCopyToClipboard = useCallback(async () => {
    setIsCopied(false);
    setUiError(null);
    let blobToCopy: Blob | null = null;
    if (hookGeneratedFileId) {
      const fileData = await getImage(hookGeneratedFileId);
      if (fileData?.blob && fileData.type?.startsWith('image/')) {
        blobToCopy = fileData.blob;
      } else if (processedImageBlob) {
        blobToCopy = processedImageBlob;
      } else {
        setUiError('Processed image data not found for copy.');
        return;
      }
    } else if (processedImageBlob) {
      blobToCopy = processedImageBlob;
    } else {
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
  }, [
    hookGeneratedFileId,
    processedImageBlob,
    getImage,
    setUiError,
    setIsCopied,
  ]);

  const handleSaveProcessedToLibrary = useCallback(async () => {
    if (!hookGeneratedFileId || isProcessedFilePermanent) {
      if (!hookGeneratedFileId) setUiError('No processed image to save.');
      return;
    }
    setIsManuallySaving(true);
    setUiError(null);
    try {
      await makeImagePermanent(hookGeneratedFileId);
      setIsProcessedFilePermanent(true);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute,
        trigger: 'click',
        input: { processedFileId: hookGeneratedFileId, action: 'manual-save' },
        output: {
          message: `Processed image ${hookGeneratedFileId} saved permanently.`,
        },
        outputFileIds: [hookGeneratedFileId],
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
    hookGeneratedFileId,
    isProcessedFilePermanent,
    makeImagePermanent,
    addHistoryEntry,
    toolTitle,
    toolRoute,
    setUiError,
  ]);

  const imageFilter = useMemo(() => ({ category: 'image' }), []);
  const displayError = processingErrorHook || uiError;
  const canPerformActions =
    !!processedImageSrc && !isProcessingImage && !isManuallySaving;
  const showSaveButton =
    hookGeneratedFileId &&
    !toolSettings.autoSaveProcessed &&
    !isProcessedFilePermanent &&
    !isProcessingImage &&
    !isManuallySaving;

  if (isLoadingToolSettings && !selectedFile) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Image Flip Tool...
      </p>
    );
  }

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
          {/* Flip Direction Fieldset - Now always enabled unless processing */}
          <fieldset
            className="flex gap-x-4 gap-y-2 items-center"
            disabled={isProcessingImage || isManuallySaving}
          >
            <legend className="sr-only">Flip Direction</legend>
            {[
              {
                id: 'flip-h-radio-id',
                value: 'horizontal',
                label: 'Horizontal',
              }, // Ensured unique ID
              { id: 'flip-v-radio-id', value: 'vertical', label: 'Vertical' }, // Ensured unique ID
            ].map((opt) => (
              <div className="flex items-center" key={opt.id}>
                <input
                  type="radio"
                  id={opt.id}
                  name="flipTypeRadioGroup"
                  value={opt.value} // name should be same for a radio group
                  checked={toolSettings.flipType === opt.value}
                  onChange={handleFlipTypeChange}
                  disabled={isProcessingImage || isManuallySaving} // Only disabled during active processing
                  className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] accent-[rgb(var(--color-checkbox-accent))] focus:ring-offset-0 focus:ring-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <label
                  htmlFor={opt.id}
                  className={`ml-2 block text-sm ${isProcessingImage || isManuallySaving ? 'text-gray-400 cursor-not-allowed' : 'text-[rgb(var(--color-text-base))] cursor-pointer'}`}
                >
                  {opt.label}
                </label>
              </div>
            ))}
          </fieldset>
        </div>
        <div className="flex flex-wrap gap-4 items-center pt-3 border-t border-gray-200 mt-2">
          <Checkbox
            label="Auto-save flipped image to Library"
            checked={toolSettings.autoSaveProcessed}
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
          {' '}
          <XCircleIcon
            className="h-5 w-5 text-[rgb(var(--color-text-error))]"
            aria-hidden="true"
          />{' '}
          <div>
            <strong className="font-semibold">Error:</strong> {displayError}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Original Image{' '}
            {fileName && (
              <span className="font-normal text-xs text-[rgb(var(--color-text-muted))]">
                ({fileName})
              </span>
            )}
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
            {processedFileIdForUI && isProcessedFilePermanent && (
              <span className="text-xs text-green-600 ml-1 inline-flex items-center gap-1">
                <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" /> (Saved
                to Library)
              </span>
            )}
            {processedFileIdForUI &&
              !isProcessedFilePermanent &&
              !toolSettings.autoSaveProcessed && (
                <span className="text-xs text-orange-600 ml-1">
                  (Not Saved)
                </span>
              )}
            {processedFileIdForUI &&
              !isProcessedFilePermanent &&
              toolSettings.autoSaveProcessed && (
                <span className="text-xs text-blue-600 ml-1">
                  (Temporary in Library)
                </span>
              )}
          </label>
          <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {isProcessingImage && !processedImageSrc && (
              <div className="flex flex-col items-center text-sm text-[rgb(var(--color-text-link))] italic">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2 text-[rgb(var(--color-text-link))]" />
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
        showFilterAfterUploadCheckbox={false}
        accept="image/*"
        selectionMode="single"
        libraryFilter={imageFilter}
        className="max-w-4xl"
      />
    </div>
  );
}
