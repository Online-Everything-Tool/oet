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
import type { StoredFile } from '@/src/types/storage';
import type {
  ToolMetadata,
  } from '@/src/types/tools';
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
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';

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

const metadata = importedMetadata as ToolMetadata;

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

  const directiveName = metadata.directive;

  const { getFile, makeFilePermanent, cleanupOrphanedTemporaryFiles, addFile } =
    useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const {
    isLoading: isProcessingImage,
    error: processingErrorHook,
    processImage,
    clearProcessingOutput: clearProcessingHookOutput,
  } = useImageProcessing();

  const [processedStoredFileForItde, setProcessedStoredFileForItde] =
    useState<StoredFile | null>(null);

  useEffect(() => {
    if (toolState.processedFileId) {
      getFile(toolState.processedFileId).then((file) => {
        setProcessedStoredFileForItde(file || null);
      });
    } else {
      setProcessedStoredFileForItde(null);
    }
  }, [toolState.processedFileId, getFile]);

  const itdeSendableItems = useMemo(() => {
    return processedStoredFileForItde ? [processedStoredFileForItde] : [];
  }, [processedStoredFileForItde]);

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setUiError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setUiError('Metadata not found for source tool.');
        return;
      }

      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );

      if (
        resolvedPayload.type === 'error' ||
        resolvedPayload.type === 'none' ||
        !resolvedPayload.data ||
        resolvedPayload.data.length === 0
      ) {
        setUiError(
          resolvedPayload.errorMessage ||
            'No transferable data received from source.'
        );
        return;
      }

      let newSelectedFileId: string | null = null;
      const firstItem = resolvedPayload.data[0];

      if (firstItem && firstItem.type?.startsWith('image/')) {
        if ('id' in firstItem) {
          newSelectedFileId = (firstItem as StoredFile).id;
        } else {
          try {
            const tempName = `itde-received-${Date.now()}.${firstItem.type.split('/')[1] || 'png'}`;
            newSelectedFileId = await addFile(
              firstItem.blob,
              tempName,
              firstItem.type,
              true
            );
          } catch (e) {
            const errorMsgText = e instanceof Error ? e.message : String(e);
            setUiError(
              `Failed to process (save) incoming image data: ${errorMsgText}`
            );
            return;
          }
        }
      } else if (firstItem) {
        setUiError(
          `Received data is not an image (type: ${firstItem.type}). Cannot process.`
        );
        return;
      } else {
        setUiError('No valid item found in received ITDE data.');
        return;
      }

      if (newSelectedFileId) {
        const oldSelectedId = toolState.selectedFileId;
        const oldProcessedId = toolState.processedFileId;
        const currentFlipType = toolState.flipType;
        const currentAutoSave = toolState.autoSaveProcessed;

        const newState: ImageFlipToolState = {
          selectedFileId: newSelectedFileId,
          processedFileId: null,
          flipType: currentFlipType,
          autoSaveProcessed: currentAutoSave,
        };
        setState(newState);
        await saveStateNow(newState);

        clearProcessingHookOutput();
        setManualSaveSuccess(false);
        setUserDeferredAutoPopup(false);

        const destatedIds = [oldSelectedId, oldProcessedId].filter(
          (id): id is string => !!(id && id !== newSelectedFileId)
        );
        if (destatedIds.length > 0) {
          cleanupOrphanedTemporaryFiles(destatedIds).catch((e) =>
            console.error('[ImageFlip ITDE Accept] Cleanup call failed:', e)
          );
        }
      }
    },
    [
      getToolMetadata,
      toolState.selectedFileId,
      toolState.processedFileId,
      toolState.flipType,
      toolState.autoSaveProcessed,
      setState,
      saveStateNow,
      cleanupOrphanedTemporaryFiles,
      addFile,
      clearProcessingHookOutput,
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
      }
    } else {
      if (initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = false;
      }
    }
  }, [isLoadingToolSettings]);
  useEffect(() => {
    const canProceed =
      !isLoadingToolSettings && initialToolStateLoadCompleteRef.current;
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

      if (originalImageSrcForUI) URL.revokeObjectURL(originalImageSrcForUI);
      setOriginalImageSrcForUI(null);
      if (processedImageSrcForUI) URL.revokeObjectURL(processedImageSrcForUI);
      setProcessedImageSrcForUI(null);

      setOriginalFilenameForDisplay(null);
      setWasLastProcessedOutputPermanent(false);

      if (toolState.selectedFileId) {
        try {
          const file = await getFile(toolState.selectedFileId);
          if (mounted && file?.blob) {
            localOrigObjUrl = URL.createObjectURL(file.blob);
            setOriginalImageSrcForUI(localOrigObjUrl);
            setOriginalFilenameForDisplay(file.name);
          } else if (mounted) {

            setOriginalImageSrcForUI(null);
            setOriginalFilenameForDisplay(null);
          }
        } catch (_e) {
          if (mounted) {
            setOriginalImageSrcForUI(null);
            setOriginalFilenameForDisplay(null);
          }
        }
      }
      if (toolState.processedFileId) {
        try {
          const file = await getFile(toolState.processedFileId);
          if (mounted && file?.blob) {
            localProcObjUrl = URL.createObjectURL(file.blob);
            setProcessedImageSrcForUI(localProcObjUrl);
            setWasLastProcessedOutputPermanent(file.isTemporary === false);
          } else if (mounted) {
            setProcessedImageSrcForUI(null);
            setWasLastProcessedOutputPermanent(false);
          }
        } catch (_e) {
          if (mounted) {
            setProcessedImageSrcForUI(null);
            setWasLastProcessedOutputPermanent(false);
          }
        }
      }
    };

    if (!isLoadingToolSettings && initialToolStateLoadCompleteRef.current) {
      loadPreviews();
    }
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
    originalImageSrcForUI,
    processedImageSrcForUI
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
    if (
      isLoadingToolSettings ||
      !initialToolStateLoadCompleteRef.current ||
      !toolState.selectedFileId ||
      toolState.processedFileId ||
      isProcessingImage
    ) {
      return;
    }
    const triggerProcessing = async () => {
      const inputFile = await getFile(toolState.selectedFileId!);
      if (!inputFile?.blob) {
        setUiError('Original image data not found for processing.');
        return;
      }
      const baseName =
        inputFile.name?.substring(0, inputFile.name.lastIndexOf('.')) ||
        inputFile.name ||
        `image-${toolState.selectedFileId?.substring(0, 8)}`;
      const ext = inputFile.type?.split('/')[1] || 'png';
      const outputFileName = `flipped-${toolState.flipType}-${baseName}.${ext}`;

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
    async (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      const oldSelectedId = toolState.selectedFileId;
      const oldProcessedId = toolState.processedFileId;

      if (files?.[0]?.type?.startsWith('image/') && files[0].blob) {
        const newSelectedId = files[0].id;

        const newState: ImageFlipToolState = {
          selectedFileId: newSelectedId,
          processedFileId: null,
          flipType: toolState.flipType,
          autoSaveProcessed: toolState.autoSaveProcessed,
        };
        setState(newState);
        await saveStateNow(newState);

        clearProcessingHookOutput();
        setManualSaveSuccess(false);
        setUserDeferredAutoPopup(false);

        const destatedIds = [oldSelectedId, oldProcessedId].filter(
          (id): id is string => !!(id && id !== newSelectedId)
        );
        if (destatedIds.length > 0) {
          cleanupOrphanedTemporaryFiles(destatedIds).catch((e) =>
            console.error('[ImageFlip New Selection] Cleanup call failed:', e)
          );
        }
      } else if (files?.length) {
        setUiError(
          `Selected file "${files[0].name}" is not a recognized image type.`
        );
      }
    },
    [
      toolState.flipType,
      toolState.autoSaveProcessed,
      toolState.selectedFileId,
      toolState.processedFileId,
      setState,
      saveStateNow,
      clearProcessingHookOutput,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  const handleFlipTypeChange = useCallback(
    async (newFlipType: FlipType) => {
      const oldProcessedId = toolState.processedFileId;
      const newState: Partial<ImageFlipToolState> = {
        flipType: newFlipType,
        processedFileId: null,
      };
      setState(newState);
      await saveStateNow({ ...toolState, ...newState });

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

      const currentStateSnapshot = {
        ...toolState,
        autoSaveProcessed: newAutoSave,
      };

      setState({ autoSaveProcessed: newAutoSave });
      await saveStateNow(currentStateSnapshot);

      setUiError(null);
      setManualSaveSuccess(false);

      if (
        newAutoSave &&
        currentStateSnapshot.processedFileId &&
        !wasLastProcessedOutputPermanent &&
        !isProcessingImage &&
        !isManuallySaving
      ) {
        setIsManuallySaving(true);
        try {
          await makeFilePermanent(currentStateSnapshot.processedFileId);
          setWasLastProcessedOutputPermanent(true);
        } catch (err) {
          setUiError(
            `Auto-save to permanent failed: ${err instanceof Error ? err.message : 'Unknown error'}`
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
      (id): id is string => !!id
    );
    if (destatedIds.length > 0) {
      cleanupOrphanedTemporaryFiles(destatedIds).catch((err) =>
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

    const match = processedImageSrcForUI.match(/data:image\/(\w+);base64,/);
    const ext = match
      ? match[1]
      : originalFilenameForDisplay.split('.').pop() || 'png';
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
    const remaining = itdeTarget.pendingSignals.filter(
      (s) => s.sourceDirective !== sourceDirective
    );
    if (remaining.length === 0) setUserDeferredAutoPopup(false);
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
                currentToolOutputConfig={metadata.outputConfig}
                selectedOutputItems={itdeSendableItems}
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
          {' '}
          <XCircleIcon
            className="h-5 w-5 text-[rgb(var(--color-text-error))]"
            aria-hidden="true"
          />{' '}
          <div>
            {' '}
            <strong className="font-semibold">Error:</strong>{' '}
            {displayError}{' '}
          </div>{' '}
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
