'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import Image from 'next/image';
import { useDebouncedCallback } from 'use-debounce';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useToolState from '../../_hooks/useToolState';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing';
import Button from '@/app/tool/_components/form/Button';
import Input from '@/app/tool/_components/form/Input';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';

import importedMetadata from '../metadata.json';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';

import {
  PhotoIcon,
  XCircleIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  ArrowsUpDownIcon,
} from '@heroicons/react/20/solid';

interface ImageResizerToolState {
  targetWidth: number | null;
  targetHeight: number | null;
  maintainAspectRatio: boolean;
  selectedFileId: string | null;
  processedFileId: string | null;
  lastUserGivenFilename: string | null;
  autoSaveProcessed: boolean;
}

const DEFAULT_RESIZER_TOOL_STATE: ImageResizerToolState = {
  targetWidth: null,
  targetHeight: null,
  maintainAspectRatio: true,
  selectedFileId: null,
  processedFileId: null,
  lastUserGivenFilename: null,
  autoSaveProcessed: false,
};

const metadata = importedMetadata as ToolMetadata;

interface ImageResizerClientProps {
  toolRoute: string;
}

export default function ImageResizerClient({
  toolRoute,
}: ImageResizerClientProps) {
  const {
    state: toolState,
    setState,
    saveStateNow,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<ImageResizerToolState>(
    toolRoute,
    DEFAULT_RESIZER_TOOL_STATE
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
  const [originalImageDimensions, setOriginalImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
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
        setProcessedOutputPermanent(file?.isTemporary === false);
      });
    } else {
      setProcessedStoredFileForItde(null);
      setProcessedOutputPermanent(false);
    }
  }, [toolState.processedFileId, getFile]);

  const itdeSendableItems = useMemo(
    () => (processedStoredFileForItde ? [processedStoredFileForItde] : []),
    [processedStoredFileForItde]
  );

  const generateDefaultOutputFilename = useCallback(() => {
    const originalName = originalFilenameForDisplay || 'resized-image';
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
    return `${baseName}-resized-${toolState.targetWidth || 'w'}x${toolState.targetHeight || 'h'}.${extension}`;
  }, [
    originalFilenameForDisplay,
    processedImageSrcForUI,
    processedStoredFileForItde,
    toolState.targetWidth,
    toolState.targetHeight,
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
        !resolvedPayload.data ||
        resolvedPayload.data.length === 0
      ) {
        setUiError(
          resolvedPayload.errorMessage ||
            'No transferable data received from source.'
        );
        return;
      }
      const firstItem = resolvedPayload.data.find(
        (item) => item.type?.startsWith('image/') && 'id' in item
      ) as StoredFile | undefined;

      if (firstItem?.id) {
        const oldSelectedId = toolState.selectedFileId;
        const oldProcessedId = toolState.processedFileId;
        const newState: Partial<ImageResizerToolState> = {
          selectedFileId: firstItem.id,
          processedFileId: null, // Force reprocess
          lastUserGivenFilename: null,
        };
        setState(newState);
        await saveStateNow({ ...toolState, ...newState });
        clearProcessingHookOutput();
        setManualSaveSuccess(false);
        setDownloadAttempted(false);
        setUserDeferredAutoPopup(false);
        const destatedIds = [oldSelectedId, oldProcessedId].filter(
          (id): id is string => !!(id && id !== firstItem.id)
        );
        if (destatedIds.length > 0) {
          cleanupOrphanedTemporaryFiles(destatedIds).catch((e) =>
            console.error('[ImageResizer ITDE Accept] Cleanup failed:', e)
          );
        }
      } else {
        setUiError('No valid image file found in received ITDE data.');
      }
    },
    [
      getToolMetadata,
      toolState,
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
    initialToolStateLoadCompleteRef.current = !isLoadingToolSettings;
  }, [isLoadingToolSettings]);

  useEffect(() => {
    if (
      initialToolStateLoadCompleteRef.current &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [
    initialToolStateLoadCompleteRef,
    itdeTarget,
    userDeferredAutoPopup,
    directiveName,
  ]);

  useEffect(() => {
    let mounted = true;
    let localOrigObjUrl: string | null = null;
    let localProcObjUrl: string | null = null;

    const loadPreviewsAndDimensions = async () => {
      if (!mounted) return;

      // Revoke previous URLs if they exist
      if (originalImageSrcForUI) URL.revokeObjectURL(originalImageSrcForUI);
      setOriginalImageSrcForUI(null);
      if (processedImageSrcForUI) URL.revokeObjectURL(processedImageSrcForUI);
      setProcessedImageSrcForUI(null);

      setOriginalFilenameForDisplay(null);
      setOriginalImageDimensions(null);

      if (toolState.selectedFileId) {
        try {
          const file = await getFile(toolState.selectedFileId);
          if (mounted && file?.blob) {
            localOrigObjUrl = URL.createObjectURL(file.blob);
            setOriginalImageSrcForUI(localOrigObjUrl);
            setOriginalFilenameForDisplay(file.filename);

            const img = new window.Image();
            img.onload = () => {
              if (mounted)
                setOriginalImageDimensions({
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                });
            };
            img.onerror = () => {
              if (mounted) {
                setOriginalImageDimensions(null);
                setUiError('Failed to load original image dimensions.');
              }
            };
            img.src = localOrigObjUrl; // Must be after onload/onerror
          }
        } catch (e) {
          if (mounted)
            setUiError(
              `Error loading original image: ${e instanceof Error ? e.message : String(e)}`
            );
        }
      }

      if (toolState.processedFileId) {
        try {
          const file = await getFile(toolState.processedFileId);
          if (mounted && file?.blob) {
            localProcObjUrl = URL.createObjectURL(file.blob);
            setProcessedImageSrcForUI(localProcObjUrl);
          }
        } catch (e) {
          if (mounted)
            setUiError(
              `Error loading processed image: ${e instanceof Error ? e.message : String(e)}`
            );
        }
      }
    };

    if (initialToolStateLoadCompleteRef.current) {
      loadPreviewsAndDimensions();
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
    initialToolStateLoadCompleteRef,
  ]);

  const resizeAndDrawFunction = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      img: HTMLImageElement,
      options?: { targetWidth?: number; targetHeight?: number }
    ) => {
      if (
        !options ||
        !options.targetWidth ||
        !options.targetHeight ||
        options.targetWidth <= 0 ||
        options.targetHeight <= 0
      ) {
        ctx.canvas.width = img.naturalWidth;
        ctx.canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
        console.warn('Resize function called with invalid dimensions, drawing original.');
        return;
      }
      ctx.canvas.width = options.targetWidth;
      ctx.canvas.height = options.targetHeight;
      ctx.clearRect(0, 0, options.targetWidth, options.targetHeight);
      ctx.drawImage(img, 0, 0, options.targetWidth, options.targetHeight);
    },
    []
  );

  const handleDimensionChange = useCallback(
    (dimension: 'width' | 'height', value: string) => {
      const numValue = parseInt(value, 10);
      const newDimensionValue =
        !isNaN(numValue) && numValue > 0 ? numValue : null;

      setState((prev) => {
        let newWidth = dimension === 'width' ? newDimensionValue : prev.targetWidth;
        let newHeight = dimension === 'height' ? newDimensionValue : prev.targetHeight;

        if (prev.maintainAspectRatio && originalImageDimensions) {
          if (dimension === 'width' && newWidth && originalImageDimensions.width > 0) {
            newHeight = Math.round(originalImageDimensions.height * (newWidth / originalImageDimensions.width));
            if (newHeight <= 0) newHeight = null;
          } else if (dimension === 'height' && newHeight && originalImageDimensions.height > 0) {
            newWidth = Math.round(originalImageDimensions.width * (newHeight / originalImageDimensions.height));
            if (newWidth <= 0) newWidth = null;
          }
        }
        return { ...prev, targetWidth: newWidth, targetHeight: newHeight, processedFileId: null, lastUserGivenFilename: null };
      });
    },
    [originalImageDimensions, setState]
  );

  const handleMaintainAspectRatioChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMaintainAspectRatio = e.target.checked;
      setState((prev) => {
        let newWidth = prev.targetWidth;
        let newHeight = prev.targetHeight;

        if (newMaintainAspectRatio && originalImageDimensions && (newWidth || newHeight)) {
          if (newWidth && originalImageDimensions.width > 0) { // Prioritize width
            newHeight = Math.round(originalImageDimensions.height * (newWidth / originalImageDimensions.width));
            if (newHeight <= 0) newHeight = null;
          } else if (newHeight && originalImageDimensions.height > 0) { // Fallback to height if width not set
            newWidth = Math.round(originalImageDimensions.width * (newHeight / originalImageDimensions.height));
            if (newWidth <= 0) newWidth = null;
          }
        }
        return { ...prev, maintainAspectRatio: newMaintainAspectRatio, targetWidth: newWidth, targetHeight: newHeight, processedFileId: null, lastUserGivenFilename: null };
      });
    },
    [originalImageDimensions, setState]
  );

  const debouncedProcess = useDebouncedCallback(async () => {
    if (
      !toolState.selectedFileId ||
      !toolState.targetWidth ||
      !toolState.targetHeight ||
      toolState.targetWidth <= 0 ||
      toolState.targetHeight <= 0 ||
      isProcessingImage
    ) {
      return;
    }

    const inputFile = await getFile(toolState.selectedFileId);
    if (!inputFile?.blob) {
      setUiError('Original image data not found for processing.');
      return;
    }

    const outputFileName = generateDefaultOutputFilename();
    const result = await processImage(
      inputFile,
      resizeAndDrawFunction,
      outputFileName,
      {
        targetWidth: toolState.targetWidth,
        targetHeight: toolState.targetHeight,
      },
      toolState.autoSaveProcessed
    );

    if (result.id) {
      const oldProcessedId = toolState.processedFileId;
      setState((prev) => ({ ...prev, processedFileId: result.id, lastUserGivenFilename: null }));
      setManualSaveSuccess(false);
      setDownloadAttempted(false);
      if (oldProcessedId && oldProcessedId !== result.id) {
        cleanupOrphanedTemporaryFiles([oldProcessedId]);
      }
    } else if (processingErrorHook) {
      setUiError(`Processing failed: ${processingErrorHook}`);
    }
  }, 500);

  useEffect(() => {
    if (
      isLoadingToolSettings ||
      !initialToolStateLoadCompleteRef.current ||
      isProcessingImage
    )
      return;

    if (
      toolState.selectedFileId &&
      toolState.targetWidth &&
      toolState.targetWidth > 0 &&
      toolState.targetHeight &&
      toolState.targetHeight > 0
    ) {
      if (!toolState.processedFileId) { // Only process if not already processed for current params
        debouncedProcess();
      }
    } else if (toolState.processedFileId) { // Params became invalid, clear old processed image
        const oldProcessedId = toolState.processedFileId;
        setState(prev => ({...prev, processedFileId: null, lastUserGivenFilename: null}));
        saveStateNow({...toolState, processedFileId: null, lastUserGivenFilename: null}).then(() => { // Ensure state is saved before cleanup
            if (oldProcessedId) cleanupOrphanedTemporaryFiles([oldProcessedId]);
        });
    }
    return () => debouncedProcess.cancel();
  }, [
    toolState.selectedFileId,
    toolState.targetWidth,
    toolState.targetHeight,
    toolState.processedFileId, // Re-evaluate if it was cleared
    isLoadingToolSettings,
    isProcessingImage,
    debouncedProcess,
    setState,
    saveStateNow,
    cleanupOrphanedTemporaryFiles
  ]);

  const handleFilesSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      if (files?.[0]?.type?.startsWith('image/') && files[0].blob) {
        const oldSelectedId = toolState.selectedFileId;
        const oldProcessedId = toolState.processedFileId;
        const newSelectedId = files[0].id;

        const newState: Partial<ImageResizerToolState> = {
          selectedFileId: newSelectedId,
          processedFileId: null, // Force reprocess
          lastUserGivenFilename: null,
        };
        setState(newState);
        await saveStateNow({ ...toolState, ...newState });
        clearProcessingHookOutput();
        setManualSaveSuccess(false);
        setDownloadAttempted(false);

        const destatedIds = [oldSelectedId, oldProcessedId].filter(
          (id): id is string => !!(id && id !== newSelectedId)
        );
        if (destatedIds.length > 0)
          cleanupOrphanedTemporaryFiles(destatedIds).catch((e) =>
            console.error('[ImageResizer New Selection] Cleanup failed:', e)
          );
      } else if (files?.length) {
        setUiError(
          `Selected file "${files[0].filename}" is not a recognized image type.`
        );
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
          const success = await makeFilePermanentAndUpdate(currentProcessedFileId);
          if (success) setProcessedOutputPermanent(true);
          else throw new Error('File could not be made permanent.');
        } catch (err) {
          setUiError(`Auto-save to permanent failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setState((prev) => ({ ...prev, autoSaveProcessed: false })); // Revert on error
        } finally {
          setIsManuallySaving(false);
        }
      }
      // Save tool state regardless of auto-save operation success
      await saveStateNow({ ...toolState, autoSaveProcessed: newAutoSave, processedFileId: currentProcessedFileId });
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
    const currentAutoSave = toolState.autoSaveProcessed; // Preserve auto-save setting

    const clearedState: ImageResizerToolState = {
      ...DEFAULT_RESIZER_TOOL_STATE,
      autoSaveProcessed: currentAutoSave,
    };
    setState(clearedState);
    await saveStateNow(clearedState);

    clearProcessingHookOutput();
    setOriginalImageDimensions(null); // Clear original dimensions
    setUiError(null);
    setManualSaveSuccess(false);
    setDownloadAttempted(false);

    const destatedIds: string[] = [oldSelectedId, oldProcessedId].filter(
      (id): id is string => !!id
    );
    if (destatedIds.length > 0)
      cleanupOrphanedTemporaryFiles(destatedIds).catch((err) =>
        console.error(`[ImageResizer Clear] Cleanup failed:`, err)
      );
  }, [
    toolState.selectedFileId,
    toolState.processedFileId,
    toolState.autoSaveProcessed,
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
      const success = await makeFilePermanentAndUpdate(toolState.processedFileId, filename);
      if (success) {
        setProcessedOutputPermanent(true);
        setManualSaveSuccess(true);
        setTimeout(() => setManualSaveSuccess(false), 2500);
        return true;
      }
      throw new Error('File could not be made permanent.');
    } catch (err) {
      setUiError(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsManuallySaving(false);
    }
  };

  const _internalPerformDownload = async (filename: string): Promise<boolean> => {
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
    if (!toolState.processedFileId || isProcessingImage || isManuallySaving) return;
    const filenameToUse = toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    if (toolState.lastUserGivenFilename && !canInitiateSaveCurrent) {
      setManualSaveSuccess(true); // Already saved with this name
      setTimeout(() => setManualSaveSuccess(false), 1500);
      return;
    }
    if (toolState.lastUserGivenFilename) {
      const success = await _internalPerformSave(filenameToUse);
      if (success) await saveStateNow({ ...toolState, lastUserGivenFilename: filenameToUse });
    } else {
      setFilenamePromptInitialValue(filenameToUse);
      setFilenamePromptAction('save');
      setIsFilenamePromptOpen(true);
    }
  };

  const initiateDownload = async () => {
    if (!processedImageSrcForUI || isProcessingImage || isManuallySaving) return;
    const filenameToUse = toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    if (toolState.lastUserGivenFilename) {
      const success = await _internalPerformDownload(filenameToUse);
      if (success) await saveStateNow({ ...toolState, lastUserGivenFilename: filenameToUse });
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

    if (action === 'save') success = await _internalPerformSave(confirmedFilename);
    else if (action === 'download') success = await _internalPerformDownload(confirmedFilename);

    if (success) {
      const newState = { ...toolState, lastUserGivenFilename: confirmedFilename };
      setState(newState); // Update local state immediately
      await saveStateNow(newState); // Persist
    }
  };

  const imageFilter = useMemo(() => ({ category: 'image' as const }), []);
  const displayError = processingErrorHook || uiError;
  const canPerformActions = !!processedImageSrcForUI && !isProcessingImage && !isManuallySaving;
  const canInitiateSaveCurrent = !!toolState.processedFileId && !toolState.autoSaveProcessed && !processedOutputPermanent && !isProcessingImage && !isManuallySaving;

  const handleModalDeferAll = () => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); };
  const handleModalIgnoreAll = () => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); };
  const handleModalAccept = (sourceDirective: string) => itdeTarget.acceptSignal(sourceDirective);
  const handleModalIgnore = (sourceDirective: string) => {
    itdeTarget.ignoreSignal(sourceDirective);
    if (itdeTarget.pendingSignals.filter(s => s.sourceDirective !== sourceDirective).length === 0) setUserDeferredAutoPopup(false);
  };

  if (isLoadingToolSettings && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-gray-500 animate-pulse">Loading Image Resizer...</p>;
  }

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          <Button
            variant="accent2"
            iconLeft={<PhotoIcon className="h-5 w-5" />}
            onClick={() => setIsLibraryModalOpen(true)}
            disabled={isProcessingImage || isManuallySaving}
            fullWidth
          >
            {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
          </Button>
          <Input
            label="Target Width (px)"
            type="number"
            id="targetWidth"
            value={toolState.targetWidth === null ? '' : toolState.targetWidth}
            onChange={(e) => handleDimensionChange('width', e.target.value)}
            min="1"
            disabled={!toolState.selectedFileId || isProcessingImage || isManuallySaving}
            iconLeft={<ArrowsRightLeftIcon className="h-4 w-4" />}
          />
          <Input
            label="Target Height (px)"
            type="number"
            id="targetHeight"
            value={toolState.targetHeight === null ? '' : toolState.targetHeight}
            onChange={(e) => handleDimensionChange('height', e.target.value)}
            min="1"
            disabled={!toolState.selectedFileId || isProcessingImage || isManuallySaving}
            iconLeft={<ArrowsUpDownIcon className="h-4 w-4" />}
          />
          <div className="pt-7"> {/* Align with labeled inputs */}
            <Checkbox
              label="Maintain Aspect Ratio"
              id="maintainAspectRatio"
              checked={toolState.maintainAspectRatio}
              onChange={handleMaintainAspectRatioChange}
              disabled={!toolState.selectedFileId || isProcessingImage || isManuallySaving}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-gray-200 mt-2">
          <Checkbox
            label="Auto-save resized image to Library"
            checked={toolState.autoSaveProcessed}
            onChange={handleAutoSaveChange}
            disabled={isProcessingImage || isManuallySaving}
            id="autoSaveResizedImage"
          />
          <div className="flex gap-2 ml-auto items-center">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
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
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <XCircleIcon className="h-5 w-5 text-[rgb(var(--color-text-error))]" aria-hidden="true" />
          <div><strong className="font-semibold">Error:</strong> {displayError}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Original Image {originalFilenameForDisplay && <span className="font-normal text-xs">({originalFilenameForDisplay})</span>}
            {originalImageDimensions && <span className="font-normal text-xs ml-1">({originalImageDimensions.width}x{originalImageDimensions.height})</span>}
          </label>
          <div className="w-full aspect-square border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {originalImageSrcForUI ? (
              <Image src={originalImageSrcForUI} alt={originalFilenameForDisplay || 'Original'} width={500} height={500} className="max-w-full max-h-full object-contain" unoptimized={true} />
            ) : (<span className="text-sm italic">Select an image</span>)}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Resized Image {processedOutputPermanent && processedStoredFileForItde?.filename && <span className="font-normal text-xs">({processedStoredFileForItde.filename})</span>}
            {toolState.targetWidth && toolState.targetHeight && <span className="font-normal text-xs ml-1">({toolState.targetWidth}x{toolState.targetHeight})</span>}
          </label>
          <div className="w-full aspect-square border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {isProcessingImage && !processedImageSrcForUI ? (
              <div className="flex flex-col items-center text-sm italic"><ArrowPathIcon className="animate-spin h-8 w-8 mb-2" />Resizing...</div>
            ) : !isProcessingImage && processedImageSrcForUI ? (
              <Image src={processedImageSrcForUI} alt={originalFilenameForDisplay ? `Resized ${originalFilenameForDisplay}` : 'Resized'} width={500} height={500} className="max-w-full max-h-full object-contain" unoptimized={true} />
            ) : (!isProcessingImage && <span className="text-sm italic">Output appears here</span>)}
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
        onClose={() => { setIsFilenamePromptOpen(false); setFilenamePromptAction(null); }}
        onConfirm={handleConfirmFilename}
        initialFilename={filenamePromptInitialValue}
        title={filenamePromptAction === 'save' ? 'Save Resized Image to Library' : 'Download Resized Image'}
        confirmButtonText={filenamePromptAction === 'save' ? 'Save to Library' : 'Download'}
        filenameAction={filenamePromptAction || undefined}
      />
    </div>
  );
}