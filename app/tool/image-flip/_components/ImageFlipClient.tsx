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
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useToolState from '../../_hooks/useToolState';
import type { StoredFile as AppStoredFile } from '@/src/types/storage';
import type { ToolMetadata, OutputConfig } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing';
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import RadioGroup from '../../_components/form/RadioGroup';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import importedMetadata from '../metadata.json';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData } from '@/app/lib/itdeDataUtils';

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

const metadata: ToolMetadata = importedMetadata as ToolMetadata;

interface ImageFlipClientProps {
  toolRoute: string;
}

export default function ImageFlipClient({ toolRoute }: ImageFlipClientProps) {
  const {
    state: toolState,
    setState,
    saveStateNow,
    clearStateAndPersist,
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
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);

  const initialToolStateLoadCompleteRef = useRef(false);
  const directiveName = useMemo(
    () => toolRoute.split('/').pop() || 'image-flip',
    [toolRoute]
  );

  const { getFile, makeFilePermanent, cleanupOrphanedTemporaryFiles } =
    useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const {
    isLoading: isProcessingImage,
    error: processingErrorHook,
    processImage,
    clearProcessingOutput: clearProcessingHookOutput,
  } = useImageProcessing();

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[ImageFlip ITDE Accept] Processing signal from: ${signal.sourceDirective}`
      );
      setUiError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        /* ... error handling ... */ setUiError(
          'Metadata not found for source.'
        );
        return;
      }

      const resolvedPayload = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );
      if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none') {
        setUiError(
          resolvedPayload.errorMessage || 'No transferable data from source.'
        );
        return;
      }

      let newSelectedFileId: string | null = null;
      if (resolvedPayload.type === 'fileReference' && resolvedPayload.data) {
        const receivedFile = resolvedPayload.data as AppStoredFile;
        if (receivedFile.type?.startsWith('image/'))
          newSelectedFileId = receivedFile.id;
        else
          setUiError(`Received file '${receivedFile.name}' is not an image.`);
      } else if (
        resolvedPayload.type === 'selectionReferenceList' &&
        Array.isArray(resolvedPayload.data)
      ) {
        const firstImageFile = (resolvedPayload.data as AppStoredFile[]).find(
          (f) => f.type?.startsWith('image/')
        );
        if (firstImageFile) newSelectedFileId = firstImageFile.id;
        else
          setUiError(
            `Received list from ${signal.sourceToolTitle} contained no images.`
          );
      } else {
        setUiError(`Received unhandled data type '${resolvedPayload.type}'.`);
      }

      if (newSelectedFileId) {
        const oldSelectedId = toolState.selectedFileId;
        const oldProcessedId = toolState.processedFileId;

        const newState = {
          ...toolState,
          selectedFileId: newSelectedFileId,
          processedFileId: null,
        };
        setState(newState);
        await saveStateNow(newState);

        setUserDeferredAutoPopup(false);

        const destatedIds = [oldSelectedId, oldProcessedId].filter(
          (id) => id && id !== newSelectedFileId
        ) as string[];
        if (destatedIds.length > 0) {
          cleanupOrphanedTemporaryFiles(destatedIds).catch((e) =>
            console.error('[ImageFlip ITDE Accept] Cleanup call failed:', e)
          );
        }
      }
    },
    [
      getToolMetadata,
      toolState,
      setState,
      saveStateNow,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingToolSettings) {
      if (!initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = true;
        console.log(
          `[ImageFlip] initialToolStateLoadCompleteRef has been set to TRUE because isLoadingToolSettings is now false.`
        );
      }
    } else {
      if (initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = false;
        console.log(
          `[ImageFlip] initialToolStateLoadCompleteRef has been set to FALSE because isLoadingToolSettings is now true.`
        );
      }
    }
  }, [isLoadingToolSettings]);

  useEffect(() => {
    const canProceed = !isLoadingToolSettings;
    if (
      canProceed &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingToolSettings, itdeTarget, userDeferredAutoPopup, directiveName]);

  useEffect(() => {
    let mounted = true;
    let localOrigObjUrl: string | null = null;
    let localProcObjUrl: string | null = null;
    const loadPreviews = async () => {
      if (!mounted) return;
      setOriginalImageSrcForUI((prevUrl) => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return null;
      });
      setProcessedImageSrcForUI((prevUrl) => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return null;
      });
      setOriginalFilenameForDisplay(null);
      setWasLastProcessedOutputPermanent(false);
      if (toolState.selectedFileId) {
        try {
          const file = await getFile(toolState.selectedFileId);
          if (mounted && file?.blob) {
            localOrigObjUrl = URL.createObjectURL(file.blob);
            setOriginalImageSrcForUI(localOrigObjUrl);
            setOriginalFilenameForDisplay(file.name);
          }
        } catch (_e) {
          /* Handled by UI */
        }
      }
      if (toolState.processedFileId) {
        try {
          const file = await getFile(toolState.processedFileId);
          if (mounted && file?.blob) {
            localProcObjUrl = URL.createObjectURL(file.blob);
            setProcessedImageSrcForUI(localProcObjUrl);
            setWasLastProcessedOutputPermanent(file.isTemporary === false);
          }
        } catch (_e) {
          /* Handled by UI */
        }
      }
    };
    if (!isLoadingToolSettings) loadPreviews();
    return () => {
      mounted = false;
      if (localOrigObjUrl) URL.revokeObjectURL(localOrigObjUrl);
      if (localProcObjUrl) URL.revokeObjectURL(localProcObjUrl);
    };
  }, [
    toolState.selectedFileId,
    toolState.processedFileId,
    getFile,
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
    const currentSelectedId = toolState.selectedFileId;
    const currentProcessedId = toolState.processedFileId;
    console.log(
      `[ImageFlip triggerProcessing] Effect run. Current selectedFileId: ${currentSelectedId}, Current processedFileId: ${currentProcessedId}`
    );
    console.log(`[ImageFlip triggerProcessing] Conditions check:
      isLoadingToolSettings: ${isLoadingToolSettings},
      initialToolStateLoadCompleteRef.current: ${initialToolStateLoadCompleteRef.current},
      !toolState.selectedFileId (is it null/empty?): ${!currentSelectedId},
      toolState.processedFileId (is it truthy?): ${!!currentProcessedId},
      isProcessingImage: ${isProcessingImage}`);
    if (
      isLoadingToolSettings ||
      !initialToolStateLoadCompleteRef.current ||
      !toolState.selectedFileId ||
      toolState.processedFileId ||
      isProcessingImage
    ) {
      console.log(
        `[ImageFlip triggerProcessing] Conditions NOT MET, returning. One of the above was true (or selectedId was false).`
      );
      return;
    }
    console.log(
      `[ImageFlip triggerProcessing] Conditions MET, proceeding to process image ID: ${currentSelectedId}`
    );
    const triggerProcessing = async () => {
      const inputFile = await getFile(toolState.selectedFileId!);
      if (!inputFile || !inputFile.blob) {
        setUiError('Original image data not found for processing.');
        return;
      }
      const baseName =
        inputFile.name?.substring(0, inputFile.name.lastIndexOf('.')) ||
        inputFile.name ||
        `image-${toolState.selectedFileId?.substring(0, 8)}`;
      const ext = inputFile.type?.split('/')[1] || 'png';
      const outputFileName = `flipped-${toolState.flipType}-${baseName}.${ext}`;
      console.log(
        `[ImageFlip triggerProcessing] Calling processImage for ${currentSelectedId}`
      );
      const result = await processImage(
        inputFile,
        flipDrawFunction,
        outputFileName,
        {},
        toolState.autoSaveProcessed
      );
      if (result.id) {
        setState((prev) => ({ ...prev, processedFileId: result.id }));
        setWasLastProcessedOutputPermanent(toolState.autoSaveProcessed);
        setManualSaveSuccess(false);
      } else if (processingErrorHook) {
        setUiError(`Processing failed: ${processingErrorHook}`);
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
    getFile,
    setState,
    processingErrorHook,
  ]);

  const handleFilesSelectedFromModal = useCallback(
    async (files: AppStoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      const oldSelectedId = toolState.selectedFileId;
      const oldProcessedId = toolState.processedFileId;

      if (files?.[0]?.type?.startsWith('image/') && files[0].blob) {
        const newSelectedId = files[0].id;
        const newState = {
          ...toolState,
          selectedFileId: newSelectedId,
          processedFileId: null,
        };
        setState(newState);
        await saveStateNow(newState);

        clearProcessingHookOutput();
        setManualSaveSuccess(false);
        setUserDeferredAutoPopup(false);

        const destatedIds = [oldSelectedId, oldProcessedId].filter(
          (id) => id && id !== newSelectedId
        ) as string[];
        if (destatedIds.length > 0) {
          cleanupOrphanedTemporaryFiles(destatedIds).catch((e) =>
            console.error('[ImageFlip New Selection] Cleanup call failed:', e)
          );
        }
      } else if (files?.length) {
        /* ... */
      }
    },
    [
      toolState,
      setState,
      saveStateNow,
      clearProcessingHookOutput,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  const handleFlipTypeChange = useCallback(
    async (newFlipType: FlipType) => {
      const oldProcessedId = toolState.processedFileId;
      const newState = {
        ...toolState,
        flipType: newFlipType,
        processedFileId: null,
      };

      setState(newState);
      await saveStateNow(newState);

      setManualSaveSuccess(false);
      if (oldProcessedId) {
        cleanupOrphanedTemporaryFiles([oldProcessedId]).catch((e) =>
          console.error('[ImageFlip FlipTypeChange] Cleanup call failed:', e)
        );
      }
    },
    [toolState, setState, saveStateNow, cleanupOrphanedTemporaryFiles]
  );

  const handleAutoSaveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAutoSave = e.target.checked;
      const currentState = toolState;
      const newState = { ...currentState, autoSaveProcessed: newAutoSave };

      setState(newState);
      await saveStateNow(newState);

      setUiError(null);
      setManualSaveSuccess(false);

      if (
        newAutoSave &&
        currentState.processedFileId &&
        !wasLastProcessedOutputPermanent &&
        !isProcessingImage &&
        !isManuallySaving
      ) {
        setIsManuallySaving(true);
        try {
          await makeFilePermanent(currentState.processedFileId);
          setWasLastProcessedOutputPermanent(true);
        } catch (err) {
          setUiError(
            `Auto-save failed: ${err instanceof Error ? err.message : 'Unknown'}`
          );
        } finally {
          setIsManuallySaving(false);
        }
      }
    },
    [
      toolState,
      wasLastProcessedOutputPermanent,
      isProcessingImage,
      isManuallySaving,
      makeFilePermanent,
      setState,
      saveStateNow,
    ]
  );

  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;

    await clearStateAndPersist();

    clearProcessingHookOutput();
    setUiError(null);
    setWasLastProcessedOutputPermanent(false);
    setManualSaveSuccess(false);
    setUserDeferredAutoPopup(false);

    const destatedIds: string[] = [oldSelectedId, oldProcessedId].filter(
      (id) => id
    ) as string[];
    if (destatedIds.length > 0) {
      cleanupOrphanedTemporaryFiles(destatedIds)
        .then((result) =>
          console.log(
            `[ImageFlip Clear] Cleanup result: ${result.deletedCount} deleted.`
          )
        )
        .catch((err) =>
          console.error(`[ImageFlip Clear] Cleanup call failed:`, err)
        );
    }
  }, [
    toolState.selectedFileId,
    toolState.processedFileId,
    clearStateAndPersist,
    cleanupOrphanedTemporaryFiles,
    clearProcessingHookOutput,
  ]);

  const handleDownload = useCallback(async () => {
    if (!processedImageSrcForUI || !originalFilenameForDisplay) {
      setUiError('No image to download.');
      return;
    }
    setUiError(null);
    const link = document.createElement('a');
    const base =
      originalFilenameForDisplay.substring(
        0,
        originalFilenameForDisplay.lastIndexOf('.')
      ) || originalFilenameForDisplay;
    const ext =
      processedImageSrcForUI.match(/data:image\/(\w+);base64,/)?.[1] || 'png';
    link.download = `flipped-${toolState.flipType}-${base}.${ext}`;
    link.href = processedImageSrcForUI;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [processedImageSrcForUI, originalFilenameForDisplay, toolState.flipType]);

  const handleSaveProcessedToLibrary = useCallback(async () => {
    if (
      !toolState.processedFileId ||
      wasLastProcessedOutputPermanent ||
      manualSaveSuccess
    ) {
      if (!toolState.processedFileId) setUiError('No processed image to save.');
      return;
    }
    setIsManuallySaving(true);
    setUiError(null);
    try {
      await makeFilePermanent(toolState.processedFileId);
      setWasLastProcessedOutputPermanent(true);
      setManualSaveSuccess(true);
      setTimeout(() => setManualSaveSuccess(false), 2500);
    } catch (err) {
      setUiError(
        `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsManuallySaving(false);
    }
  }, [
    toolState.processedFileId,
    wasLastProcessedOutputPermanent,
    manualSaveSuccess,
    makeFilePermanent,
  ]);

  const imageFilter = useMemo(() => ({ category: 'image' as const }), []);
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
  const isOutputSaved =
    toolState.processedFileId &&
    (toolState.autoSaveProcessed ||
      wasLastProcessedOutputPermanent ||
      manualSaveSuccess);

  const handleModalDeferAll = () => {
    setUserDeferredAutoPopup(true);
    itdeTarget.closeModal();
  };
  const handleModalIgnoreAll = () => {
    setUserDeferredAutoPopup(false);
    itdeTarget.ignoreAllSignals();
  };
  const handleModalAccept = (sourceDirective: string) => {
    itdeTarget.acceptSignal(sourceDirective);
  };
  const handleModalIgnore = (sourceDirective: string) => {
    itdeTarget.ignoreSignal(sourceDirective);
    const remainingSignalsAfterIgnore = itdeTarget.pendingSignals.filter(
      (s) => s.sourceDirective !== sourceDirective
    );
    if (remainingSignalsAfterIgnore.length === 0) {
      setUserDeferredAutoPopup(false);
    }
  };

  if (isLoadingToolSettings && !initialToolStateLoadCompleteRef.current) {
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
        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-gray-200 mt-2">
          <Checkbox
            label="Auto-save flipped image to Library"
            checked={toolState.autoSaveProcessed}
            onChange={handleAutoSaveChange}
            disabled={isProcessingImage || isManuallySaving}
            id="autoSaveFlippedImage"
          />
          <div className="flex gap-2 ml-auto items-center">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={
                itdeTarget.pendingSignals.length > 0 &&
                userDeferredAutoPopup &&
                !itdeTarget.isModalOpen
              }
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            {toolState.processedFileId && (
              <SendToToolButton
                currentToolDirective={directiveName}
                currentToolOutputConfig={metadata.outputConfig as OutputConfig}
              />
            )}
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
            {isOutputSaved && !showSaveButton && (
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
              <span className="font-normal text-xs">
                ({originalFilenameForDisplay})
              </span>
            )}
          </label>
          <div className="w-full aspect-square border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
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
              <span className="text-sm italic">Select an image</span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Flipped Image{' '}
            {isOutputSaved && (
              <span className="text-xs text-green-600 ml-1 inline-flex items-center gap-1">
                <CheckBadgeIcon className="h-4 w-4" /> (Saved)
              </span>
            )}{' '}
            {toolState.processedFileId && !isOutputSaved && (
              <span className="text-xs text-orange-600 ml-1">(Not saved)</span>
            )}
          </label>
          <div className="w-full aspect-square border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {isProcessingImage && !processedImageSrcForUI ? (
              <div className="flex flex-col items-center text-sm italic">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2" />
                Flipping...
              </div>
            ) : !isProcessingImage && processedImageSrcForUI ? (
              <Image
                src={processedImageSrcForUI}
                alt={
                  originalFilenameForDisplay
                    ? `Flipped ${originalFilenameForDisplay}`
                    : 'Flipped'
                }
                width={500}
                height={500}
                className="max-w-full max-h-full object-contain"
                unoptimized={true}
              />
            ) : (
              !isProcessingImage && (
                <span className="text-sm italic">Output appears here</span>
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

      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={handleModalAccept}
        onIgnore={handleModalIgnore}
        onDeferAll={handleModalDeferAll}
        onIgnoreAll={handleModalIgnoreAll}
      />
    </div>
  );
}
