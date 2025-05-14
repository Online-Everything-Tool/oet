// --- FILE: app/tool/image-flip/_components/ImageFlipClient.tsx ---
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
import useToolState from '../../_hooks/useToolState';
import type { StoredFile } from '@/src/types/storage';
import FileSelectionModal from '@/app/tool/_components/file-storage/FileSelectionModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing';
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import RadioGroup from '../../_components/form/RadioGroup';
import {
  PhotoIcon,
  ArrowDownTrayIcon,
  XCircleIcon,
  ArrowPathIcon,
  ArchiveBoxArrowDownIcon,
  CheckBadgeIcon,
} from '@heroicons/react/20/solid';

type FlipType = 'horizontal' | 'vertical';

interface ImageFlipToolState {
  flipType: FlipType;
  autoSaveProcessed: boolean;
  selectedFileId: string | null;
  processedFileId: string | null;
}

const DEFAULT_FLIP_TOOL_STATE: ImageFlipToolState = {
  flipType: 'horizontal',
  autoSaveProcessed: false,
  selectedFileId: null,
  processedFileId: null,
};

interface ImageFlipClientProps {
  toolRoute: string;
}

export default function ImageFlipClient({ toolRoute }: ImageFlipClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<ImageFlipToolState>(toolRoute, DEFAULT_FLIP_TOOL_STATE);

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [isManuallySaving, setIsManuallySaving] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [originalFilenameForDisplay, setOriginalFilenameForDisplay] = useState<
    string | null
  >(null);

  const [originalImageSrcForUI, setOriginalImageSrcForUI] = useState<
    string | null
  >(null);
  const [processedImageSrcForUI, setProcessedImageSrcForUI] = useState<
    string | null
  >(null);
  const [wasLastProcessedOutputPermanent, setWasLastProcessedOutputPermanent] =
    useState<boolean>(false);
  const [manualSaveSuccess, setManualSaveSuccess] = useState<boolean>(false);

  const initialSetupRanRef = useRef(false);

  const { getImage, makeImagePermanent } = useImageLibrary();
  const {
    isLoading: isProcessingImage,
    error: processingErrorHook,
    processImage,
    clearProcessingOutput: clearProcessingHookOutput,
  } = useImageProcessing({ toolRoute });

  useEffect(() => {
    let origObjUrl: string | null = null;
    let procObjUrl: string | null = null;
    let mounted = true;

    const loadPreviews = async () => {
      if (!mounted) return;

      if (toolState.selectedFileId) {
        try {
          const file = await getImage(toolState.selectedFileId);
          if (!mounted) return;
          if (file?.blob) {
            origObjUrl = URL.createObjectURL(file.blob);
            setOriginalImageSrcForUI(origObjUrl);
            setOriginalFilenameForDisplay(file.name);
            console.log(
              `[ImageFlip PreviewEffect] Original preview set for ${toolState.selectedFileId}`
            );
          } else {
            setOriginalImageSrcForUI(null);
            setOriginalFilenameForDisplay(null);
          }
        } catch (e) {
          console.error(
            '[ImageFlip PreviewEffect] Error loading original image:',
            e
          );
          if (mounted) {
            setOriginalImageSrcForUI(null);
            setOriginalFilenameForDisplay(null);
          }
        }
      } else {
        setOriginalImageSrcForUI(null);
        setOriginalFilenameForDisplay(null);
      }

      if (toolState.processedFileId) {
        try {
          const file = await getImage(toolState.processedFileId);
          if (!mounted) return;
          if (file?.blob) {
            procObjUrl = URL.createObjectURL(file.blob);
            setProcessedImageSrcForUI(procObjUrl);
            setWasLastProcessedOutputPermanent(file.isTemporary === false);
            console.log(
              `[ImageFlip PreviewEffect] Processed preview set for ${toolState.processedFileId}. Permanent: ${file.isTemporary === false}`
            );
          } else {
            setProcessedImageSrcForUI(null);
            setWasLastProcessedOutputPermanent(false);
          }
        } catch (e) {
          console.error(
            '[ImageFlip PreviewEffect] Error loading processed image:',
            e
          );
          if (mounted) {
            setProcessedImageSrcForUI(null);
            setWasLastProcessedOutputPermanent(false);
          }
        }
      } else {
        setProcessedImageSrcForUI(null);
        setWasLastProcessedOutputPermanent(false);
      }
    };

    if (!isLoadingToolSettings && initialSetupRanRef.current) {
      loadPreviews();
    }

    return () => {
      mounted = false;
      if (origObjUrl) URL.revokeObjectURL(origObjUrl);
      if (procObjUrl) URL.revokeObjectURL(procObjUrl);
    };
  }, [
    toolState.selectedFileId,
    toolState.processedFileId,
    getImage,
    isLoadingToolSettings,
  ]);

  const flipDrawFunction = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
      const { naturalWidth: w, naturalHeight: h } = img;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      if (toolState.flipType === 'horizontal') {
        ctx.scale(-1, 1);
        ctx.translate(-w, 0);
      } else {
        ctx.scale(1, -1);
        ctx.translate(0, -h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    },
    [toolState.flipType]
  );

  useEffect(() => {
    console.log(
      `[ImageFlip ProcessingEffect] Running. selectedFileId: ${toolState.selectedFileId}, processedFileId: ${toolState.processedFileId}, flipType: ${toolState.flipType}, isLoadingSettings: ${isLoadingToolSettings}, initialSetupDone: ${initialSetupRanRef.current}`
    );
    if (
      isLoadingToolSettings ||
      !initialSetupRanRef.current ||
      !toolState.selectedFileId ||
      toolState.processedFileId ||
      isProcessingImage
    ) {
      return;
    }

    const triggerProcessing = async () => {
      console.log(
        `[ImageFlip triggerProcessing] For fileId: ${toolState.selectedFileId}, Type: ${toolState.flipType}, AutoSave: ${toolState.autoSaveProcessed}`
      );
      const inputFile = await getImage(toolState.selectedFileId!);
      if (!inputFile || !inputFile.blob) {
        setUiError('Original image data not found for processing.');
        console.error(
          `[ImageFlip triggerProcessing] Original file ${toolState.selectedFileId} not found or no blob.`
        );
        return;
      }

      const baseName =
        inputFile.name?.substring(0, inputFile.name.lastIndexOf('.')) ||
        inputFile.name ||
        `image-${toolState.selectedFileId?.substring(0, 8)}`;
      const mimeTypeParts = inputFile.type?.split('/');
      const extension =
        mimeTypeParts && mimeTypeParts.length > 1 ? mimeTypeParts[1] : 'png';
      const outputFileName = `flipped-${toolState.flipType}-${baseName}.${extension}`;

      const result = await processImage(
        inputFile,
        flipDrawFunction,
        outputFileName,
        {},
        toolState.autoSaveProcessed
      );

      if (result.id) {
        console.log(
          `[ImageFlip triggerProcessing] Processed successfully. New processedFileId: ${result.id}. AutoSaved as permanent: ${toolState.autoSaveProcessed}`
        );
        setToolState({ processedFileId: result.id });
        setWasLastProcessedOutputPermanent(toolState.autoSaveProcessed);
        setManualSaveSuccess(false);
      } else if (processingErrorHook) {
        setUiError(`Processing failed: ${processingErrorHook}`);
        console.error(
          `[ImageFlip triggerProcessing] Processing error reported by hook: ${processingErrorHook}`
        );
      }
    };

    triggerProcessing();
  }, [
    toolState.selectedFileId,
    toolState.flipType,
    toolState.processedFileId,
    toolState.autoSaveProcessed,
    isLoadingToolSettings,
    isProcessingImage,
    processImage,
    flipDrawFunction,
    getImage,
    setToolState,
    processingErrorHook,
  ]);

  const handleFilesSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      if (files && files.length > 0) {
        const firstFile = files[0];
        if (firstFile.type?.startsWith('image/') && firstFile.blob) {
          console.log(
            `[ImageFlip] New file selected via modal: ${firstFile.name} (ID: ${firstFile.id})`
          );
          setToolState({
            selectedFileId: firstFile.id,
            processedFileId: null,
          });

          clearProcessingHookOutput();
          setManualSaveSuccess(false);
        } else {
          setUiError('Invalid file selected. Please select an image.');
          setToolState({ selectedFileId: null, processedFileId: null });
          clearProcessingHookOutput();
        }
      }
    },
    [setToolState, clearProcessingHookOutput]
  );

  const handleFlipTypeChange = useCallback(
    (newFlipType: FlipType) => {
      console.log(`[ImageFlip] User changed flipType to: ${newFlipType}`);
      setToolState((prev) => ({
        ...prev,
        flipType: newFlipType,
        processedFileId: null,
      }));
      setManualSaveSuccess(false);
    },
    [setToolState]
  );

  const handleAutoSaveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAutoSaveState = e.target.checked;
      console.log(
        `[ImageFlip] User changed autoSaveProcessed to: ${newAutoSaveState}`
      );
      setToolState({ autoSaveProcessed: newAutoSaveState });
      setUiError(null);
      setManualSaveSuccess(false);

      const currentProcessedId = toolState.processedFileId;
      if (
        newAutoSaveState === true &&
        currentProcessedId &&
        !wasLastProcessedOutputPermanent &&
        !isProcessingImage &&
        !isManuallySaving
      ) {
        console.log(
          `[ImageFlip] Auto-save ON. Attempting to make temporary ${currentProcessedId} permanent.`
        );
        setIsManuallySaving(true);
        try {
          await makeImagePermanent(currentProcessedId);
          setWasLastProcessedOutputPermanent(true);
          console.log(
            `[ImageFlip] Made ${currentProcessedId} permanent due to auto-save ON.`
          );
        } catch (err) {
          const errorMsg = `Auto-save failed to make file permanent: ${err instanceof Error ? err.message : 'Unknown error'}`;
          setUiError(errorMsg);
          console.error('[ImageFlip] Auto-save makeImagePermanent error:', err);
        } finally {
          setIsManuallySaving(false);
        }
      } else if (
        newAutoSaveState === false &&
        currentProcessedId &&
        wasLastProcessedOutputPermanent
      ) {
        console.log(
          `[ImageFlip] Auto-save OFF. Future processed images will be temporary. Current permanent file ${currentProcessedId} remains permanent.`
        );
      }
    },
    [
      toolState.processedFileId,
      wasLastProcessedOutputPermanent,
      isProcessingImage,
      isManuallySaving,
      makeImagePermanent,
      setToolState,
    ]
  );

  const handleClear = useCallback(async () => {
    console.log(`[ImageFlip] handleClear called.`);
    setToolState(DEFAULT_FLIP_TOOL_STATE);
    clearProcessingHookOutput();
    setOriginalImageSrcForUI(null);
    setOriginalFilenameForDisplay(null);
    setProcessedImageSrcForUI(null);
    setUiError(null);
    setWasLastProcessedOutputPermanent(false);
    setManualSaveSuccess(false);
    initialSetupRanRef.current = false;
  }, [setToolState, clearProcessingHookOutput]);

  const handleDownload = useCallback(async () => {
    if (!processedImageSrcForUI || !originalFilenameForDisplay) {
      setUiError('No image to download.');
      return;
    }
    setUiError(null);
    const link = document.createElement('a');
    const baseName =
      originalFilenameForDisplay.substring(
        0,
        originalFilenameForDisplay.lastIndexOf('.')
      ) || originalFilenameForDisplay;
    const mimeType =
      processedImageSrcForUI.match(/data:(image\/\w+);base64,/)?.[1] ||
      'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    link.download = `flipped-${toolState.flipType}-${baseName}.${extension}`;
    link.href = processedImageSrcForUI;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [processedImageSrcForUI, originalFilenameForDisplay, toolState.flipType]);

  const handleSaveProcessedToLibrary = useCallback(async () => {
    const currentProcessedId = toolState.processedFileId;
    if (
      !currentProcessedId ||
      wasLastProcessedOutputPermanent ||
      manualSaveSuccess
    ) {
      if (!currentProcessedId) setUiError('No processed image to save.');
      else if (wasLastProcessedOutputPermanent || manualSaveSuccess)
        console.log(
          '[ImageFlip] Image already permanent/saved, save button clicked but no action taken.'
        );
      return;
    }
    setIsManuallySaving(true);
    setUiError(null);
    console.log(
      `[ImageFlip] Manually saving ${currentProcessedId} to library.`
    );
    try {
      await makeImagePermanent(currentProcessedId);
      setWasLastProcessedOutputPermanent(true);
      setManualSaveSuccess(true);
      setTimeout(() => setManualSaveSuccess(false), 2500);
      console.log(
        `[ImageFlip] Successfully made ${currentProcessedId} permanent.`
      );
    } catch (err) {
      const errorMsg = `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setUiError(errorMsg);
      console.error('[ImageFlip] makeImagePermanent error:', err);
    } finally {
      setIsManuallySaving(false);
    }
  }, [
    toolState.processedFileId,
    wasLastProcessedOutputPermanent,
    manualSaveSuccess,
    makeImagePermanent,
  ]);

  const imageFilter = useMemo(() => ({ category: 'image' }), []);
  const displayError = processingErrorHook || uiError;
  const canPerformOutputActions =
    !!processedImageSrcForUI && !isProcessingImage && !isManuallySaving;

  const showSaveButton =
    toolState.processedFileId &&
    !toolState.autoSaveProcessed &&
    !wasLastProcessedOutputPermanent &&
    !manualSaveSuccess &&
    !isProcessingImage &&
    !isManuallySaving;

  if (isLoadingToolSettings && !initialSetupRanRef.current) {
    console.log(
      '[ImageFlip] Rendering loading state (tool settings or initial setup not complete).'
    );
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Image Flip Tool...
      </p>
    );
  }

  const isOutputSaved =
    toolState.processedFileId &&
    (toolState.autoSaveProcessed ||
      wasLastProcessedOutputPermanent ||
      manualSaveSuccess);

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
            {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
          </Button>
          <RadioGroup
            name="flipTypeRadioGroup"
            legend="Flip Direction:"
            options={[
              { value: 'horizontal', label: 'Horizontal' },
              { value: 'vertical', label: 'Vertical' },
            ]}
            selectedValue={toolState.flipType}
            onChange={(newVal: string) =>
              handleFlipTypeChange(newVal as FlipType)
            }
            layout="horizontal"
            disabled={isProcessingImage || isManuallySaving}
            radioClassName="text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-4 items-center pt-3 border-t border-gray-200 mt-2">
          <Checkbox
            label="Auto-save flipped image to Library"
            checked={toolState.autoSaveProcessed}
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
            {(manualSaveSuccess ||
              (toolState.autoSaveProcessed &&
                toolState.processedFileId &&
                wasLastProcessedOutputPermanent)) &&
              !showSaveButton && (
                <Button
                  variant="secondary"
                  iconLeft={<CheckBadgeIcon className="h-5 w-5" />}
                  disabled={true}
                  className="!opacity-100 !cursor-default"
                >
                  Saved to Library
                </Button>
              )}
            <Button
              variant="primary"
              iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
              onClick={handleDownload}
              disabled={!canPerformOutputActions}
            >
              Download
            </Button>
            <Button
              variant="neutral"
              iconLeft={<XCircleIcon className="h-5 w-5" />}
              onClick={handleClear}
              disabled={
                !toolState.selectedFileId &&
                !toolState.processedFileId &&
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

      {displayError && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <XCircleIcon
            className="h-5 w-5 text-[rgb(var(--color-text-error))]"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {displayError}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Original Image{' '}
            {originalFilenameForDisplay && (
              <span className="font-normal text-xs text-[rgb(var(--color-text-muted))]">
                ({originalFilenameForDisplay})
              </span>
            )}
          </label>
          <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {originalImageSrcForUI ? (
              <Image
                src={originalImageSrcForUI}
                alt={originalFilenameForDisplay || 'Original'}
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
            {isOutputSaved && (
              <span className="text-xs text-green-600 ml-1 inline-flex items-center gap-1">
                <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" /> (Saved
                to Library)
              </span>
            )}
            {toolState.processedFileId && !isOutputSaved && (
              <span className="text-xs text-orange-600 ml-1">
                (Not saved to Library)
              </span>
            )}
          </label>
          <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {isProcessingImage && !processedImageSrcForUI && (
              <div className="flex flex-col items-center text-sm text-[rgb(var(--color-text-link))] italic">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2 text-[rgb(var(--color-text-link))]" />
                Flipping...
              </div>
            )}
            {!isProcessingImage && processedImageSrcForUI ? (
              <Image
                src={processedImageSrcForUI}
                alt={
                  originalFilenameForDisplay
                    ? `Flipped ${originalFilenameForDisplay}`
                    : 'Flipped Image'
                }
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
