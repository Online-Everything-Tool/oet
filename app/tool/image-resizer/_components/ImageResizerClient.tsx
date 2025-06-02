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
import useToolUrlState from '../../_hooks/useToolUrlState';
import type { StoredFile } from '@/src/types/storage';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing';
import Button from '@/app/tool/_components/form/Button';
import Input from '@/app/tool/_components/form/Input';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import { useDebouncedCallback } from 'use-debounce';

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
  selectedFileId: string | null;
  processedFileId: string | null;
  targetWidth: string; // string to allow empty input
  targetHeight: string; // string to allow empty input
  maintainAspectRatio: boolean;
  autoSaveProcessed: boolean;
  lastUserGivenFilename: string | null;
}

const DEFAULT_IMAGE_RESIZER_TOOL_STATE: ImageResizerToolState = {
  selectedFileId: null,
  processedFileId: null,
  targetWidth: '',
  targetHeight: '',
  maintainAspectRatio: true,
  autoSaveProcessed: false,
  lastUserGivenFilename: null,
};

const metadata = importedMetadata as ToolMetadata;
const AUTO_PROCESS_DEBOUNCE_MS = 750;

interface ImageResizerClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function ImageResizerClient({
  urlStateParams,
  toolRoute,
}: ImageResizerClientProps) {
  const {
    state: toolState,
    setState,
    saveStateNow,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<ImageResizerToolState>(
    toolRoute,
    DEFAULT_IMAGE_RESIZER_TOOL_STATE
  );

  const { urlState, isLoadingUrlState, urlProvidedAnyValue } =
    useToolUrlState(urlStateParams);
  const initialUrlLoadProcessedRef = useRef(false);

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
    const originalName = originalFilenameForDisplay || 'resized-image';
    const baseName =
      originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    let extension = 'png'; // Default, might be overridden by processed image type
    if (processedImageSrcForUI) {
      const match = processedImageSrcForUI.match(/data:image\/(\w+);base64,/);
      if (match) extension = match[1];
    } else if (processedStoredFileForItde?.type) {
      extension = processedStoredFileForItde.type.split('/')[1] || extension;
    } else if (originalFilenameForDisplay) {
      extension = originalFilenameForDisplay.split('.').pop() || extension;
    }
    return `${baseName}-resized-${toolState.targetWidth || 'auto'}x${toolState.targetHeight || 'auto'}.${extension}`;
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
        setUiError('No valid image item found in received ITDE data.');
        return;
      }

      if (newSelectedFileId) {
        const oldSelectedId = toolState.selectedFileId;
        const oldProcessedId = toolState.processedFileId;
        const newState: Partial<ImageResizerToolState> = {
          selectedFileId: newSelectedFileId,
          processedFileId: null,
          lastUserGivenFilename: null,
        };
        setState(newState);
        await saveStateNow({ ...toolState, ...newState });
        clearProcessingHookOutput();
        setManualSaveSuccess(false);
        setDownloadAttempted(false);
        setUserDeferredAutoPopup(false);
        const destatedIds = [oldSelectedId, oldProcessedId].filter(
          (id): id is string => !!(id && id !== newSelectedFileId)
        );
        if (destatedIds.length > 0) {
          cleanupOrphanedTemporaryFiles(destatedIds).catch((e) =>
            console.error('[ImageResizer ITDE Accept] Cleanup call failed:', e)
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
    if (
      !isLoadingUrlState &&
      urlProvidedAnyValue &&
      !initialUrlLoadProcessedRef.current &&
      initialToolStateLoadCompleteRef.current // Ensure tool state is loaded before applying URL state
    ) {
      const updatesFromUrl: Partial<ImageResizerToolState> = {};
      if (urlState.width !== undefined && String(urlState.width).trim() !== '')
        updatesFromUrl.targetWidth = String(urlState.width);
      if (urlState.height !== undefined && String(urlState.height).trim() !== '')
        updatesFromUrl.targetHeight = String(urlState.height);
      if (urlState.aspect !== undefined)
        updatesFromUrl.maintainAspectRatio = Boolean(urlState.aspect);

      if (Object.keys(updatesFromUrl).length > 0) {
        setState((prev) => ({
          ...prev,
          ...updatesFromUrl,
          processedFileId: null,
          lastUserGivenFilename: null,
        }));
        // No saveStateNow here, setState triggers debounced save.
        // This will also trigger debouncedProcess if selectedFileId is present.
      }
      initialUrlLoadProcessedRef.current = true;
    }
  }, [
    isLoadingUrlState,
    urlProvidedAnyValue,
    urlState,
    setState,
    isLoadingToolSettings,
  ]);

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
            setProcessedImageSrcForUI(null);
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

  const resizeDrawFunction = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      img: HTMLImageElement,
      options?: Record<string, unknown>
    ) => {
      const canvas = ctx.canvas;
      let targetWidthOpt = Number(options?.targetWidth);
      let targetHeightOpt = Number(options?.targetHeight);
      const maintainAspectRatioOpt = Boolean(options?.maintainAspectRatio);

      if (
        (isNaN(targetWidthOpt) || targetWidthOpt <= 0) &&
        (isNaN(targetHeightOpt) || targetHeightOpt <= 0)
      ) {
        // No valid dimensions specified, draw original size
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        return;
      }
      // Ensure at least one dimension is positive if provided
      if (isNaN(targetWidthOpt) || targetWidthOpt <= 0) targetWidthOpt = 0;
      if (isNaN(targetHeightOpt) || targetHeightOpt <= 0) targetHeightOpt = 0;

      let newWidth = img.naturalWidth;
      let newHeight = img.naturalHeight;
      const aspectRatio = img.naturalWidth / img.naturalHeight;

      if (maintainAspectRatioOpt) {
        if (targetWidthOpt > 0 && targetHeightOpt > 0) {
          if (targetWidthOpt / targetHeightOpt > aspectRatio) {
            newHeight = targetHeightOpt;
            newWidth = newHeight * aspectRatio;
          } else {
            newWidth = targetWidthOpt;
            newHeight = newWidth / aspectRatio;
          }
        } else if (targetWidthOpt > 0) {
          newWidth = targetWidthOpt;
          newHeight = newWidth / aspectRatio;
        } else if (targetHeightOpt > 0) {
          newHeight = targetHeightOpt;
          newWidth = newHeight * aspectRatio;
        }
      } else {
        if (targetWidthOpt > 0) newWidth = targetWidthOpt;
        if (targetHeightOpt > 0) newHeight = targetHeightOpt;
      }

      newWidth = Math.max(1, Math.round(newWidth));
      newHeight = Math.max(1, Math.round(newHeight));

      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.clearRect(0, 0, newWidth, newHeight); // Clear canvas before drawing
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
    },
    []
  );

  const debouncedProcessImage = useDebouncedCallback(async () => {
    if (
      isLoadingToolSettings ||
      !initialToolStateLoadCompleteRef.current ||
      !toolState.selectedFileId ||
      isProcessingImage
    ) {
      return;
    }

    const { targetWidth, targetHeight, maintainAspectRatio, autoSaveProcessed } =
      toolState;
    if (
      (String(targetWidth).trim() === '' || Number(targetWidth) <= 0) &&
      (String(targetHeight).trim() === '' || Number(targetHeight) <= 0)
    ) {
      setUiError('Please specify a valid width or height.');
      // Clear previous processed image if dimensions are invalid
      if (toolState.processedFileId) {
        const oldProcessedId = toolState.processedFileId;
        setState((prev) => ({
          ...prev,
          processedFileId: null,
          lastUserGivenFilename: null,
        }));
        await saveStateNow({
          ...toolState,
          processedFileId: null,
          lastUserGivenFilename: null,
        });
        cleanupOrphanedTemporaryFiles([oldProcessedId]).catch((e) =>
          console.error('[ImageResizer Debounce] Cleanup failed:', e)
        );
      }
      return;
    }
    setUiError(null); // Clear previous errors if dimensions are now valid

    const inputFile = await getFile(toolState.selectedFileId);
    if (!inputFile?.blob) {
      setUiError('Original image data not found for processing.');
      return;
    }

    const outputFileName = generateDefaultOutputFilename();
    const result = await processImage(
      inputFile,
      resizeDrawFunction,
      outputFileName,
      { targetWidth, targetHeight, maintainAspectRatio },
      autoSaveProcessed
    );

    if (result.id) {
      const oldProcessedId = toolState.processedFileId;
      const newState: Partial<ImageResizerToolState> = {
        processedFileId: result.id,
        lastUserGivenFilename: null, // Reset filename as params changed
      };
      setState(newState);
      await saveStateNow({ ...toolState, ...newState });
      setManualSaveSuccess(false);
      setDownloadAttempted(false);
      if (oldProcessedId && oldProcessedId !== result.id) {
        cleanupOrphanedTemporaryFiles([oldProcessedId]).catch((e) =>
          console.error('[ImageResizer Debounce] Cleanup failed:', e)
        );
      }
    } else if (processingErrorHook) {
      setUiError(`Processing failed: ${processingErrorHook}`);
    }
  }, AUTO_PROCESS_DEBOUNCE_MS);

  useEffect(() => {
    // Trigger processing if inputs change and an image is selected
    if (toolState.selectedFileId) {
      debouncedProcessImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    toolState.selectedFileId,
    toolState.targetWidth,
    toolState.targetHeight,
    toolState.maintainAspectRatio,
    debouncedProcessImage,
  ]); // Dependencies include debouncedProcessImage itself

  const handleFilesSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      const oldSelectedId = toolState.selectedFileId;
      const oldProcessedId = toolState.processedFileId;

      if (files?.[0]?.type?.startsWith('image/') && files[0].blob) {
        const newSelectedId = files[0].id;
        const newState: Partial<ImageResizerToolState> = {
          selectedFileId: newSelectedId,
          processedFileId: null, // Clear processed on new image
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
        // debouncedProcessImage will be triggered by useEffect watching selectedFileId
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

  const handleDimensionChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    dimension: 'width' | 'height'
  ) => {
    const value = e.target.value;
    const oldProcessedId = toolState.processedFileId;
    const newState: Partial<ImageResizerToolState> =
      dimension === 'width'
        ? { targetWidth: value, processedFileId: null, lastUserGivenFilename: null }
        : { targetHeight: value, processedFileId: null, lastUserGivenFilename: null };
    setState(newState);
    // No saveStateNow here, setState triggers debounced save.
    // debouncedProcessImage will be triggered by useEffect.
    if (oldProcessedId) {
      cleanupOrphanedTemporaryFiles([oldProcessedId]).catch((e) =>
        console.error('[ImageResizer DimensionChange] Cleanup failed:', e)
      );
    }
    setManualSaveSuccess(false);
    setDownloadAttempted(false);
  };

  const handleAspectRatioChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const oldProcessedId = toolState.processedFileId;
    const newState: Partial<ImageResizerToolState> = {
      maintainAspectRatio: e.target.checked,
      processedFileId: null,
      lastUserGivenFilename: null,
    };
    setState(newState);
    // No saveStateNow here, setState triggers debounced save.
    // debouncedProcessImage will be triggered by useEffect.
    if (oldProcessedId) {
      cleanupOrphanedTemporaryFiles([oldProcessedId]).catch((e) =>
        console.error('[ImageResizer AspectRatioChange] Cleanup failed:', e)
      );
    }
    setManualSaveSuccess(false);
    setDownloadAttempted(false);
  };

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
    const clearedState: ImageResizerToolState = {
      ...DEFAULT_IMAGE_RESIZER_TOOL_STATE,
      // Keep user preferences for controls
      targetWidth: toolState.targetWidth,
      targetHeight: toolState.targetHeight,
      maintainAspectRatio: toolState.maintainAspectRatio,
      autoSaveProcessed: toolState.autoSaveProcessed,
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
        console.error(`[ImageResizer Clear] Cleanup call failed:`, err)
      );
  }, [
    toolState,
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

    const filenameToUse =
      toolState.lastUserGivenFilename || generateDefaultOutputFilename();

    if (toolState.lastUserGivenFilename && !canInitiateSaveCurrent) {
      setManualSaveSuccess(true);
      setTimeout(() => setManualSaveSuccess(false), 1500);
      return;
    }

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
        Loading Image Resizer Tool...
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
          <Input
            type="number"
            label="Width (px)"
            id="targetWidth"
            value={toolState.targetWidth}
            onChange={(e) => handleDimensionChange(e, 'width')}
            min="1"
            placeholder="Auto"
            iconLeft={<ArrowsRightLeftIcon className="h-4 w-4" />}
            containerClassName="w-full sm:w-auto sm:min-w-[150px]"
            inputClassName="text-sm"
            disabled={isProcessingImage || isManuallySaving}
          />
          <Input
            type="number"
            label="Height (px)"
            id="targetHeight"
            value={toolState.targetHeight}
            onChange={(e) => handleDimensionChange(e, 'height')}
            min="1"
            placeholder="Auto"
            iconLeft={<ArrowsUpDownIcon className="h-4 w-4" />}
            containerClassName="w-full sm:w-auto sm:min-w-[150px]"
            inputClassName="text-sm"
            disabled={isProcessingImage || isManuallySaving}
          />
          <Checkbox
            label="Maintain Aspect Ratio"
            id="maintainAspectRatio"
            checked={toolState.maintainAspectRatio}
            onChange={handleAspectRatioChange}
            disabled={isProcessingImage || isManuallySaving}
          />
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
            Resized Image{' '}
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
                Resizing...
              </div>
            ) : !isProcessingImage && processedImageSrcForUI ? (
              <Image
                src={processedImageSrcForUI}
                alt={
                  originalFilenameForDisplay
                    ? `Resized ${originalFilenameForDisplay}`
                    : 'Resized'
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
            ? 'Save Resized Image to Library'
            : 'Download Resized Image'
        }
        confirmButtonText={
          filenamePromptAction === 'save' ? 'Save to Library' : 'Download'
        }
        filenameAction={filenamePromptAction || undefined}
      />
    </div>
  );
}