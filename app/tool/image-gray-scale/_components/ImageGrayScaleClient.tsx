// --- FILE: app/tool/image-gray-scale/_components/ImageGrayScaleClient.tsx ---
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
import type { ToolMetadata, OutputConfig } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/file-storage/FileSelectionModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing';
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import importedMetadata from '../metadata.json';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';

import {
  PhotoIcon,
  ArrowDownTrayIcon,
  XCircleIcon,
  ArrowPathIcon,
  ArchiveBoxArrowDownIcon,
  CheckBadgeIcon,
  InboxArrowDownIcon,
} from '@heroicons/react/20/solid';

interface ImageGrayScaleToolState {
  autoSaveProcessed: boolean;
  selectedFileId: string | null;
  processedFileId: string | null;
}

const DEFAULT_GRAYSCALE_TOOL_STATE: ImageGrayScaleToolState = {
  autoSaveProcessed: false,
  selectedFileId: null,
  processedFileId: null,
};

const metadata: ToolMetadata = importedMetadata as ToolMetadata;

interface ImageGrayScaleClientProps {
  toolRoute: string;
}

export default function ImageGrayScaleClient({
  toolRoute,
}: ImageGrayScaleClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<ImageGrayScaleToolState>(
    toolRoute,
    DEFAULT_GRAYSCALE_TOOL_STATE
  );

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

  const initialSetupRanRef = useRef(false);
  const directiveName = useMemo(
    () => toolRoute.split('/').pop() || 'image-gray-scale',
    [toolRoute]
  );

  const { getImage, makeImagePermanent } = useImageLibrary();
  const {
    isLoading: isProcessingImage,
    error: processingErrorHook,
    processImage,
    clearProcessingOutput: clearProcessingHookOutput,
  } = useImageProcessing({ toolRoute });

  const handleProcessIncomingSignal = useCallback((signal: IncomingSignal) => {
    console.log(
      `[ImageGrayScale] User accepted data from: ${signal.sourceDirective} (${signal.sourceToolTitle})`
    );
    alert(
      `Accepted data from ${signal.sourceToolTitle}. Phase 1: Signal cleared. Data loading in Phase 2.`
    );
    setUserDeferredAutoPopup(false);
  }, []);

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (
      !isLoadingToolSettings &&
      initialSetupRanRef.current &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [
    isLoadingToolSettings,
    itdeTarget.pendingSignals,
    itdeTarget.isModalOpen,
    itdeTarget.openModalIfSignalsExist,
    userDeferredAutoPopup,
    initialSetupRanRef,
  ]);

  useEffect(() => {
    if (isLoadingToolSettings || initialSetupRanRef.current) return;
    initialSetupRanRef.current = true;
  }, [isLoadingToolSettings]);

  useEffect(() => {
    let origObjUrl: string | null = null;
    let procObjUrl: string | null = null;
    let mounted = true;
    const loadPreviews = async () => {
      if (!mounted) return;
      setOriginalImageSrcForUI(null);
      setProcessedImageSrcForUI(null);

      if (toolState.selectedFileId) {
        try {
          const file = await getImage(toolState.selectedFileId);
          if (!mounted || !file?.blob) {
            setOriginalFilenameForDisplay(null);
            return;
          }
          origObjUrl = URL.createObjectURL(file.blob);
          setOriginalImageSrcForUI(origObjUrl);
          setOriginalFilenameForDisplay(file.name);
        } catch (_e) {
          if (mounted) setOriginalFilenameForDisplay(null);
        }
      } else {
        setOriginalFilenameForDisplay(null);
      }

      if (toolState.processedFileId) {
        try {
          const file = await getImage(toolState.processedFileId);
          if (!mounted || !file?.blob) {
            setWasLastProcessedOutputPermanent(false);
            return;
          }
          procObjUrl = URL.createObjectURL(file.blob);
          setProcessedImageSrcForUI(procObjUrl);
          setWasLastProcessedOutputPermanent(file.isTemporary === false);
        } catch (_e) {
          if (mounted) setWasLastProcessedOutputPermanent(false);
        }
      } else {
        setWasLastProcessedOutputPermanent(false);
      }
    };
    if (!isLoadingToolSettings && initialSetupRanRef.current) loadPreviews();
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
    initialSetupRanRef,
  ]);

  const convertToGrayScaleCallback = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
      const { naturalWidth: w, naturalHeight: h } = img;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = data[i + 1] = data[i + 2] = lum;
      }
      ctx.putImageData(imageData, 0, 0);
    },
    []
  );

  useEffect(() => {
    if (
      isLoadingToolSettings ||
      !initialSetupRanRef.current ||
      !toolState.selectedFileId ||
      toolState.processedFileId ||
      isProcessingImage
    )
      return;
    const triggerProcessing = async () => {
      const inputFile = await getImage(toolState.selectedFileId!);
      if (!inputFile || !inputFile.blob) {
        setUiError('Original image data not found for processing.');
        return;
      }
      const baseName =
        inputFile.name?.substring(0, inputFile.name.lastIndexOf('.')) ||
        inputFile.name ||
        `image-${toolState.selectedFileId?.substring(0, 8)}`;
      const ext = inputFile.type?.split('/')[1] || 'png';
      const outputFileName = `grayscale-${baseName}.${ext}`;
      const result = await processImage(
        inputFile,
        convertToGrayScaleCallback,
        outputFileName,
        {},
        toolState.autoSaveProcessed
      );
      if (result.id) {
        setToolState({ processedFileId: result.id });
        setWasLastProcessedOutputPermanent(toolState.autoSaveProcessed);
        setManualSaveSuccess(false);
      } else if (processingErrorHook) {
        setUiError(`Processing failed: ${processingErrorHook}`);
      }
    };
    triggerProcessing();
  }, [
    toolState.selectedFileId,
    toolState.processedFileId,
    toolState.autoSaveProcessed,
    isLoadingToolSettings,
    isProcessingImage,
    processImage,
    convertToGrayScaleCallback,
    getImage,
    setToolState,
    processingErrorHook,
    initialSetupRanRef,
  ]);

  const handleFilesSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      if (files?.[0]?.type?.startsWith('image/') && files[0].blob) {
        setToolState({ selectedFileId: files[0].id, processedFileId: null });
        clearProcessingHookOutput();
        setManualSaveSuccess(false);
        setUserDeferredAutoPopup(false);
      } else if (files?.length) {
        setUiError('Invalid file selected. Please select an image.');
        setToolState({ selectedFileId: null, processedFileId: null });
        clearProcessingHookOutput();
      }
    },
    [setToolState, clearProcessingHookOutput]
  );

  const handleAutoSaveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAutoSave = e.target.checked;
      setToolState({ autoSaveProcessed: newAutoSave });
      setUiError(null);
      setManualSaveSuccess(false);
      if (
        newAutoSave &&
        toolState.processedFileId &&
        !wasLastProcessedOutputPermanent &&
        !isProcessingImage &&
        !isManuallySaving
      ) {
        setIsManuallySaving(true);
        try {
          await makeImagePermanent(toolState.processedFileId);
          setWasLastProcessedOutputPermanent(true);
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
      toolState.processedFileId,
      wasLastProcessedOutputPermanent,
      isProcessingImage,
      isManuallySaving,
      makeImagePermanent,
      setToolState,
    ]
  );

  const handleClear = useCallback(async () => {
    setToolState(DEFAULT_GRAYSCALE_TOOL_STATE);
    clearProcessingHookOutput();
    setOriginalImageSrcForUI(null);
    setOriginalFilenameForDisplay(null);
    setProcessedImageSrcForUI(null);
    setUiError(null);
    setWasLastProcessedOutputPermanent(false);
    setManualSaveSuccess(false);
    initialSetupRanRef.current = false;
    setUserDeferredAutoPopup(false);
    itdeTarget.ignoreAllSignals();
  }, [setToolState, clearProcessingHookOutput, itdeTarget]);

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
    link.download = `grayscale-${base}.${ext}`;
    link.href = processedImageSrcForUI;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [processedImageSrcForUI, originalFilenameForDisplay]);

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
      await makeImagePermanent(toolState.processedFileId);
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
    setUserDeferredAutoPopup(false);
  };
  const handleModalIgnore = (sourceDirective: string) => {
    itdeTarget.ignoreSignal(sourceDirective);
    // If ignoring the last signal, reset defer. Otherwise, keep defer state if user explicitly deferred.
    const remainingSignalsAfterIgnore = itdeTarget.pendingSignals.filter(
      (s) => s.sourceDirective !== sourceDirective
    );
    if (remainingSignalsAfterIgnore.length === 0) {
      setUserDeferredAutoPopup(false);
    }
  };

  if (isLoadingToolSettings && !initialSetupRanRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Grayscale Tool...
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
        </div>
        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-gray-200 mt-2">
          <Checkbox
            label="Auto-save grayscale image to Library"
            checked={toolState.autoSaveProcessed}
            onChange={handleAutoSaveChange}
            disabled={isProcessingImage || isManuallySaving}
            id="autoSaveGrayscaleImage"
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
            Grayscale Image{' '}
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
                Grayscaling...
              </div>
            ) : !isProcessingImage && processedImageSrcForUI ? (
              <Image
                src={processedImageSrcForUI}
                alt={
                  originalFilenameForDisplay
                    ? `Grayscale ${originalFilenameForDisplay}`
                    : 'Grayscale'
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
