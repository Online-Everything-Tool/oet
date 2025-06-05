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
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useToolState from '@/app/tool/_hooks/useToolState';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing';
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';

import importedMetadata from '../metadata.json';
import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';

import {
  PhotoIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/20/solid';

interface ImageGrayScaleToolState {
  autoSaveProcessed: boolean;
  selectedFileId: string | null;
  processedFileId: string | null;
  lastUserGivenFilename: string | null;
}

const DEFAULT_GRAYSCALE_TOOL_STATE: ImageGrayScaleToolState = {
  autoSaveProcessed: false,
  selectedFileId: null,
  processedFileId: null,
  lastUserGivenFilename: null,
};

const metadata = importedMetadata as ToolMetadata;

interface ImageGrayScaleClientProps {
  toolRoute: string;
}

export default function ImageGrayScaleClient({
  toolRoute,
}: ImageGrayScaleClientProps) {
  const {
    state: toolState,
    setState,
    saveStateNow,
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
  const [processedOutputPermanent, setProcessedOutputPermanent] =
    useState<boolean>(false);
  const [manualSaveSuccess, setManualSaveSuccess] = useState<boolean>(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const [downloadAttempted, setDownloadAttempted] = useState<boolean>(false);

  const [isFilenamePromptOpen, setIsFilenamePromptOpen] =
    useState<boolean>(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<
    'save' | 'download' | null
  >(null);
  const [filenamePromptInitialValue, setFilenamePromptInitialValue] =
    useState<string>('');

  const directiveName = metadata.directive;

  const { getFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } =
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
        if (file) {
          setProcessedOutputPermanent(file.isTemporary === false);
        } else {
          setProcessedOutputPermanent(false);
        }
      });
    } else {
      setProcessedStoredFileForItde(null);
      setProcessedOutputPermanent(false);
    }
  }, [toolState.processedFileId, getFile]);

  const itdeSendableItems = useMemo(() => {
    return processedStoredFileForItde ? [processedStoredFileForItde] : [];
  }, [processedStoredFileForItde]);

  const generateDefaultOutputFilename = useCallback(() => {
    const originalName = originalFilenameForDisplay || 'processed-image';
    const baseName =
      originalName.substring(0, originalName.lastIndexOf('.')) || originalName;

    let extension = 'png';
    if (processedImageSrcForUI) {
      const match = processedImageSrcForUI.match(/data:image\/(\w+);base64,/);
      if (match) extension = match[1];
    } else if (processedStoredFileForItde?.type) {
      extension = processedStoredFileForItde.type.split('/')[1] || extension;
    } else if (originalFilenameForDisplay) {
      extension = originalFilenameForDisplay.split('.').pop() || extension;
    }
    return `grayscale-${baseName}.${extension}`;
  }, [
    originalFilenameForDisplay,
    processedImageSrcForUI,
    processedStoredFileForItde,
  ]);

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
      const firstItem = resolvedPayload.data.find(
        (item) => item.type?.startsWith('image/') && 'id' in item
      );
      if (firstItem) newSelectedFileId = (firstItem as StoredFile).id;
      else {
        setUiError('No valid item found in received ITDE data.');
        return;
      }

      if (newSelectedFileId) {
        const oldSelectedId = toolState.selectedFileId;
        const oldProcessedId = toolState.processedFileId;
        const currentAutoSave = toolState.autoSaveProcessed;
        const newState: ImageGrayScaleToolState = {
          selectedFileId: newSelectedFileId,
          processedFileId: null,
          autoSaveProcessed: currentAutoSave,
          lastUserGivenFilename: null,
        };
        setState(newState);
        await saveStateNow(newState);
        clearProcessingHookOutput();
        setManualSaveSuccess(false);
        setDownloadAttempted(false);
        setUserDeferredAutoPopup(false);
        const destatedIds = [oldSelectedId, oldProcessedId].filter(
          (id): id is string => !!(id && id !== newSelectedFileId)
        );
        if (destatedIds.length > 0) {
          cleanupOrphanedTemporaryFiles(destatedIds).catch((e) =>
            console.error(
              '[ImageGrayScale ITDE Accept] Cleanup call failed:',
              e
            )
          );
        }
      }
    },
    [
      getToolMetadata,
      toolState.autoSaveProcessed,
      toolState.selectedFileId,
      toolState.processedFileId,
      setState,
      saveStateNow,
      cleanupOrphanedTemporaryFiles,
      clearProcessingHookOutput,
    ]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingToolSettings) {
      if (!initialToolStateLoadCompleteRef.current)
        initialToolStateLoadCompleteRef.current = true;
    } else {
      if (initialToolStateLoadCompleteRef.current)
        initialToolStateLoadCompleteRef.current = false;
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

      if (toolState.selectedFileId) {
        try {
          const file = await getFile(toolState.selectedFileId);
          if (mounted && file?.blob) {
            localOrigObjUrl = URL.createObjectURL(file.blob);
            setOriginalImageSrcForUI(localOrigObjUrl);
            setOriginalFilenameForDisplay(file.filename);
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
          } else if (mounted) {
            setProcessedImageSrcForUI(null);
          }
        } catch (_e) {
          if (mounted) {
            setProcessedImageSrcForUI(
              null
            ); /* setProcessedOutputPermanent(false); */
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
      !initialToolStateLoadCompleteRef.current ||
      !toolState.selectedFileId ||
      toolState.processedFileId ||
      isProcessingImage
    )
      return;
    const triggerProcessing = async () => {
      const inputFile = await getFile(toolState.selectedFileId!);
      if (!inputFile?.blob) {
        setUiError('Original image data not found for processing.');
        return;
      }
      const baseName =
        inputFile.filename?.substring(0, inputFile.filename.lastIndexOf('.')) ||
        inputFile.filename ||
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
        setState((prev) => ({
          ...prev,
          processedFileId: result.id,
          lastUserGivenFilename: null,
        }));

        setManualSaveSuccess(false);
        setDownloadAttempted(false);
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
        const currentAutoSave = toolState.autoSaveProcessed;
        const newState: ImageGrayScaleToolState = {
          selectedFileId: newSelectedId,
          processedFileId: null,
          autoSaveProcessed: currentAutoSave,
          lastUserGivenFilename: null,
        };
        setState(newState);
        await saveStateNow(newState);
        clearProcessingHookOutput();
        setManualSaveSuccess(false);
        setDownloadAttempted(false);
        const destatedIds = [oldSelectedId, oldProcessedId].filter(
          (id): id is string => !!(id && id !== newSelectedId)
        );
        if (destatedIds.length > 0)
          cleanupOrphanedTemporaryFiles(destatedIds).catch((e) =>
            console.error('[ImageGrayScale New Selection] Cleanup failed:', e)
          );
      } else if (files?.length) {
        setUiError(
          `Selected file "${files[0].filename}" is not a recognized image type.`
        );
      }
    },
    [
      toolState.autoSaveProcessed,
      toolState.selectedFileId,
      toolState.processedFileId,
      setState,
      saveStateNow,
      clearProcessingHookOutput,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  const handleAutoSaveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAutoSave = e.target.checked;
      const currentProcessedFileId = toolState.processedFileId;
      setState((prev) => ({ ...prev, autoSaveProcessed: newAutoSave }));
      setUiError(null);
      setManualSaveSuccess(false);
      if (
        newAutoSave &&
        currentProcessedFileId &&
        !processedOutputPermanent &&
        !isProcessingImage &&
        !isManuallySaving
      ) {
        setIsManuallySaving(true);
        try {
          const success = await makeFilePermanentAndUpdate(
            currentProcessedFileId
          );
          if (success) setProcessedOutputPermanent(true);
          else throw new Error('File could not be made permanent.');
        } catch (err) {
          setUiError(
            `Auto-save to permanent failed: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
          setState((prev) => ({ ...prev, autoSaveProcessed: false }));
        } finally {
          setIsManuallySaving(false);
        }
      }
      await saveStateNow({
        ...toolState,
        autoSaveProcessed: newAutoSave,
        processedFileId: currentProcessedFileId,
      });
    },
    [
      toolState,
      processedOutputPermanent,
      isProcessingImage,
      isManuallySaving,
      makeFilePermanentAndUpdate,
      setState,
      saveStateNow,
    ]
  );

  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;
    const currentAutoSave = toolState.autoSaveProcessed;
    const clearedState: ImageGrayScaleToolState = {
      ...DEFAULT_GRAYSCALE_TOOL_STATE,
      autoSaveProcessed: currentAutoSave,
      lastUserGivenFilename: null,
    };
    setState(clearedState);
    await saveStateNow(clearedState);
    clearProcessingHookOutput();
    setUiError(null);

    setManualSaveSuccess(false);
    setDownloadAttempted(false);
    const destatedIds: string[] = [oldSelectedId, oldProcessedId].filter(
      (id): id is string => !!id
    );
    if (destatedIds.length > 0)
      cleanupOrphanedTemporaryFiles(destatedIds).catch((err) =>
        console.error(`[ImageGrayScale Clear] Cleanup call failed:`, err)
      );
  }, [
    toolState.autoSaveProcessed,
    toolState.selectedFileId,
    toolState.processedFileId,
    setState,
    saveStateNow,
    cleanupOrphanedTemporaryFiles,
    clearProcessingHookOutput,
  ]);

  const _internalPerformSave = async (filename: string): Promise<boolean> => {
    if (!toolState.processedFileId) {
      setUiError('No processed image to save.');
      return false;
    }
    setIsManuallySaving(true);
    setUiError(null);
    try {
      const success = await makeFilePermanentAndUpdate(
        toolState.processedFileId,
        filename
      );
      if (success) {
        setProcessedOutputPermanent(true);
        setManualSaveSuccess(true);
        setTimeout(() => setManualSaveSuccess(false), 2500);
        return true;
      } else {
        throw new Error('File could not be made permanent.');
      }
    } catch (err) {
      setUiError(
        `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      return false;
    } finally {
      setIsManuallySaving(false);
    }
  };

  const _internalPerformDownload = async (
    filename: string
  ): Promise<boolean> => {
    if (!processedImageSrcForUI) {
      setUiError('No image data to download.');
      return false;
    }
    const link = document.createElement('a');
    link.download = filename;
    link.href = processedImageSrcForUI;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadAttempted(true);
    setTimeout(() => setDownloadAttempted(false), 2500);
    return true;
  };

  const initiateSave = async () => {
    if (!toolState.processedFileId || isProcessingImage || isManuallySaving)
      return;
    if (
      toolState.lastUserGivenFilename &&
      !toolState.autoSaveProcessed &&
      processedOutputPermanent
    ) {
      setManualSaveSuccess(true);
      setTimeout(() => setManualSaveSuccess(false), 1500);
      return;
    }
    const filenameToUse =
      toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    if (toolState.lastUserGivenFilename) {
      const success = await _internalPerformSave(filenameToUse);
      if (success)
        await saveStateNow({
          ...toolState,
          lastUserGivenFilename: filenameToUse,
        });
    } else {
      setFilenamePromptInitialValue(filenameToUse);
      setFilenamePromptAction('save');
      setIsFilenamePromptOpen(true);
    }
  };

  const initiateDownload = async () => {
    if (!processedImageSrcForUI || isProcessingImage || isManuallySaving)
      return;
    const filenameToUse =
      toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    if (toolState.lastUserGivenFilename) {
      const success = await _internalPerformDownload(filenameToUse);
      if (success)
        await saveStateNow({
          ...toolState,
          lastUserGivenFilename: filenameToUse,
        });
    } else {
      setFilenamePromptInitialValue(filenameToUse);
      setFilenamePromptAction('download');
      setIsFilenamePromptOpen(true);
    }
  };

  const handleConfirmFilename = async (confirmedFilename: string) => {
    setIsFilenamePromptOpen(false);
    setUiError(null);
    let success = false;
    const action = filenamePromptAction;
    setFilenamePromptAction(null);

    if (action === 'save') {
      success = await _internalPerformSave(confirmedFilename);
    } else if (action === 'download') {
      success = await _internalPerformDownload(confirmedFilename);
    }

    if (success) {
      const newState = {
        ...toolState,
        lastUserGivenFilename: confirmedFilename,
      };
      setState(newState);
      await saveStateNow(newState);
    }
  };

  const imageFilter = useMemo(() => ({ category: 'image' as const }), []);
  const displayError = processingErrorHook || uiError;

  const canPerformActions =
    !!processedImageSrcForUI && !isProcessingImage && !isManuallySaving;
  const canInitiateSaveCurrent =
    !!toolState.processedFileId &&
    !toolState.autoSaveProcessed &&
    !processedOutputPermanent &&
    !isProcessingImage &&
    !isManuallySaving;

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
            <OutputActionButtons
              canPerform={canPerformActions}
              isSaveSuccess={manualSaveSuccess}
              isDownloadSuccess={downloadAttempted}
              canInitiateSave={canInitiateSaveCurrent}
              onInitiateSave={initiateSave}
              onInitiateDownload={initiateDownload}
              onClear={handleClear}
              directiveName={directiveName}
              outputConfig={metadata.outputConfig}
              selectedOutputItems={itdeSendableItems}
            />
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
            {processedOutputPermanent &&
              processedStoredFileForItde?.filename && (
                <span className="font-normal text-xs">
                  ({processedStoredFileForItde.filename})
                </span>
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
      <FilenamePromptModal
        isOpen={isFilenamePromptOpen}
        onClose={() => {
          setIsFilenamePromptOpen(false);
          setFilenamePromptAction(null);
        }}
        onConfirm={handleConfirmFilename}
        initialFilename={filenamePromptInitialValue}
        title={
          filenamePromptAction === 'save'
            ? 'Save Grayscale Image to Library'
            : 'Download Grayscale Image'
        }
        confirmButtonText={
          filenamePromptAction === 'save' ? 'Save to Library' : 'Download'
        }
        filenameAction={filenamePromptAction || undefined}
      />
    </div>
  );
}
