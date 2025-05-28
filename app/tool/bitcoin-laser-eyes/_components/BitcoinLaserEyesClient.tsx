'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import * as faceapi from 'face-api.js';

import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useToolState from '../../_hooks/useToolState';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing';
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import useFaceApiLoader from '../_hooks/useFaceApiLoader';

import importedMetadata from '../metadata.json';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';

import {
  PhotoIcon,
  XCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/20/solid';

interface BitcoinLaserEyesToolState {
  autoSaveProcessed: boolean;
  selectedFileId: string | null;
  processedFileId: string | null;
  lastUserGivenFilename: string | null;
}

const DEFAULT_TOOL_STATE: BitcoinLaserEyesToolState = {
  autoSaveProcessed: false,
  selectedFileId: null,
  processedFileId: null,
  lastUserGivenFilename: null,
};

const metadata = importedMetadata as ToolMetadata;

interface BitcoinLaserEyesClientProps {
  toolRoute: string;
}

export default function BitcoinLaserEyesClient({ toolRoute }: BitcoinLaserEyesClientProps) {
  const {
    state: toolState,
    setState,
    saveStateNow,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<BitcoinLaserEyesToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [isManuallySaving, setIsManuallySaving] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const [originalFilenameForDisplay, setOriginalFilenameForDisplay] = useState<string | null>(null);
  const [originalImageSrcForUI, setOriginalImageSrcForUI] = useState<string | null>(null);
  const [processedImageSrcForUI, setProcessedImageSrcForUI] = useState<string | null>(null);
  const [processedOutputPermanent, setProcessedOutputPermanent] = useState<boolean>(false);
  const [manualSaveSuccess, setManualSaveSuccess] = useState<boolean>(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const [downloadAttempted, setDownloadAttempted] = useState<boolean>(false);

  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState<boolean>(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<'save' | 'download' | null>(null);
  const [filenamePromptInitialValue, setFilenamePromptInitialValue] = useState<string>('');

  const directiveName = metadata.directive;

  const { getFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const {
    isLoading: isProcessingImage,
    error: processingErrorHook,
    processImage,
    clearProcessingOutput: clearProcessingHookOutput,
  } = useImageProcessing();

  const faceApi = useFaceApiLoader();

  const [processedStoredFileForItde, setProcessedStoredFileForItde] = useState<StoredFile | null>(null);

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

  useEffect(() => {
    if (!faceApi.modelsLoaded && !faceApi.isLoadingModels && !faceApi.errorLoadingModels) {
      faceApi.loadModels();
    }
  }, [faceApi]);

  const generateDefaultOutputFilename = useCallback(() => {
    const originalName = originalFilenameForDisplay || 'processed-image';
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;

    let extension = 'png';
    if (processedImageSrcForUI) {
      const match = processedImageSrcForUI.match(/data:image\/(\w+);base64,/);
      if (match && (match[1] === 'jpeg' || match[1] === 'png' || match[1] === 'webp')) extension = match[1];
    } else if (processedStoredFileForItde?.type) {
      const typePart = processedStoredFileForItde.type.split('/')[1];
      if (typePart === 'jpeg' || typePart === 'png' || typePart === 'webp') extension = typePart;
    } else if (originalFilenameForDisplay) {
      const originalExt = originalFilenameForDisplay.split('.').pop()?.toLowerCase();
      if (originalExt === 'jpg' || originalExt === 'jpeg' || originalExt === 'png' || originalExt === 'webp') extension = originalExt === 'jpg' ? 'jpeg' : originalExt;
    }
    return `laser-eyes-${baseName}.${extension}`;
  }, [originalFilenameForDisplay, processedImageSrcForUI, processedStoredFileForItde]);

  const drawLaserEyesFunction = useCallback(
    async (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
      ctx.drawImage(img, 0, 0, img.width, img.height);

      if (!faceApi.modelsLoaded || !faceApi.detectFaces) {
        console.warn('FaceAPI models not loaded or detectFaces not available. Outputting original image.');
        return;
      }

      try {
        const detections = await faceApi.detectFaces(img);
        if (detections && detections.length > 0) {
          setUiError(null);
          detections.forEach((detection) => {
            const landmarks = detection.landmarks;
            if (!landmarks) {
              console.warn('No landmarks detected for a face.');
              return;
            }
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();

            const getEyeCenter = (eyePoints: faceapi.Point[]) => {
              if (!eyePoints || eyePoints.length === 0) return { x: 0, y: 0 };
              const x = eyePoints.reduce((sum, p) => sum + p.x, 0) / eyePoints.length;
              const y = eyePoints.reduce((sum, p) => sum + p.y, 0) / eyePoints.length;
              return { x, y };
            };

            const leftEyeCenter = getEyeCenter(leftEye);
            const rightEyeCenter = getEyeCenter(rightEye);

            const laserColor = '#F7931A';
            const glowColor = 'rgba(247, 147, 26, 0.5)';

            const drawLaser = (eyeCenter: { x: number; y: number }) => {
              if (eyeCenter.x === 0 && eyeCenter.y === 0) return;

              ctx.strokeStyle = glowColor;
              ctx.lineWidth = Math.max(6, img.width * 0.03);
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(eyeCenter.x, eyeCenter.y);
              ctx.lineTo(
                img.width * 1.2,
                eyeCenter.y + (Math.random() - 0.5) * (img.height * 0.05)
              );
              ctx.stroke();

              ctx.strokeStyle = laserColor;
              ctx.lineWidth = Math.max(2.5, img.width * 0.012);
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(eyeCenter.x, eyeCenter.y);
              ctx.lineTo(
                img.width * 1.2,
                eyeCenter.y + (Math.random() - 0.5) * (img.height * 0.05)
              );
              ctx.stroke();
            };

            drawLaser(leftEyeCenter);
            drawLaser(rightEyeCenter);
          });
        } else {
          if (!faceApi.isLoadingModels && !faceApi.errorLoadingModels) {
            setUiError('No faces detected in the image. Outputting original image.');
          }
        }
      } catch (error) {
        console.error('Error during face detection or drawing lasers:', error);
        setUiError(
          `Face detection failed: ${error instanceof Error ? error.message : String(error)}. Outputting original image.`
        );
      } finally {
        ctx.lineWidth = 1;
        ctx.lineCap = 'butt';
      }
    },
    [faceApi.modelsLoaded, faceApi.detectFaces, faceApi.isLoadingModels, faceApi.errorLoadingModels]
  );

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setUiError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setUiError('Metadata not found for source tool.');
        return;
      }
      const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
      if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
        setUiError(resolvedPayload.errorMessage || 'No transferable data received from source.');
        return;
      }
      let newSelectedFileId: string | null = null;
      const firstItem = resolvedPayload.data.find((item) => item.type?.startsWith('image/') && 'id' in item);
      if (firstItem) newSelectedFileId = (firstItem as StoredFile).id;
      else {
        setUiError('No valid image item found in received ITDE data.');
        return;
      }

      if (newSelectedFileId) {
        const oldSelectedId = toolState.selectedFileId;
        const oldProcessedId = toolState.processedFileId;
        const currentAutoSave = toolState.autoSaveProcessed;
        const newState: BitcoinLaserEyesToolState = {
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
        setUiError(null);
        const destatedIds = [oldSelectedId, oldProcessedId].filter((id): id is string => !!(id && id !== newSelectedFileId));
        if (destatedIds.length > 0) {
          cleanupOrphanedTemporaryFiles(destatedIds).catch((e) => console.error('[LaserEyes ITDE Accept] Cleanup call failed:', e));
        }
      }
    },
    [getToolMetadata, toolState.autoSaveProcessed, toolState.selectedFileId, toolState.processedFileId, setState, saveStateNow, cleanupOrphanedTemporaryFiles, clearProcessingHookOutput]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingToolSettings) {
      if (!initialToolStateLoadCompleteRef.current) initialToolStateLoadCompleteRef.current = true;
    } else {
      if (initialToolStateLoadCompleteRef.current) initialToolStateLoadCompleteRef.current = false;
    }
  }, [isLoadingToolSettings]);

  useEffect(() => {
    const canProceed = !isLoadingToolSettings && initialToolStateLoadCompleteRef.current;
    if (canProceed && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
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
            if (!file) {
              setState((prev) => ({ ...prev, selectedFileId: null, processedFileId: null }));
              setUiError('Selected original image is no longer available. Please select another.');
            }
          }
        } catch (e) {
          console.error('Error loading original image preview:', e);
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
            if (!file) {
              setState((prev) => ({ ...prev, processedFileId: null }));
              setUiError('Previously processed image is no longer available.');
            }
          }
        } catch (e) {
          console.error('Error loading processed image preview:', e);
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
  }, [toolState.selectedFileId, toolState.processedFileId, getFile, isLoadingToolSettings, setState]);

  useEffect(() => {
    if (
      isLoadingToolSettings ||
      !initialToolStateLoadCompleteRef.current ||
      !toolState.selectedFileId ||
      toolState.processedFileId ||
      isProcessingImage ||
      !faceApi.modelsLoaded ||
      faceApi.isLoadingModels
    ) {
      return;
    }
    const triggerProcessing = async () => {
      setUiError(null);
      const inputFile = await getFile(toolState.selectedFileId);
      if (!inputFile?.blob) {
        setUiError('Original image data not found for processing.');
        setState((prev) => ({ ...prev, selectedFileId: null }));
        return;
      }
      const outputFileName = generateDefaultOutputFilename();
      const result = await processImage(
        inputFile,
        drawLaserEyesFunction,
        outputFileName,
        { outputFormat: 'image/png' },
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
        setUiError(`Image processing failed: ${processingErrorHook}`);
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
    drawLaserEyesFunction,
    getFile,
    setState,
    processingErrorHook,
    faceApi.modelsLoaded,
    faceApi.isLoadingModels,
    generateDefaultOutputFilename,
  ]);

  const handleFilesSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      const oldSelectedId = toolState.selectedFileId;
      const oldProcessedId = toolState.processedFileId;

      if (files?.[0]?.type?.startsWith('image/') && files[0].id) {
        const newSelectedId = files[0].id;
        const currentAutoSave = toolState.autoSaveProcessed;
        const newState: BitcoinLaserEyesToolState = {
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
        setUserDeferredAutoPopup(false);

        const destatedIds = [oldSelectedId, oldProcessedId].filter((id): id is string => !!(id && id !== newSelectedId));
        if (destatedIds.length > 0)
          cleanupOrphanedTemporaryFiles(destatedIds).catch((e) => console.error('[LaserEyes New Selection] Cleanup failed:', e));
      } else if (files?.length) {
        setUiError(`Selected file "${files[0].filename}" is not a recognized image type or is missing ID.`);
      }
    },
    [toolState.autoSaveProcessed, toolState.selectedFileId, toolState.processedFileId, setState, saveStateNow, clearProcessingHookOutput, cleanupOrphanedTemporaryFiles]
  );

  const handleAutoSaveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAutoSave = e.target.checked;
      const currentProcessedFileId = toolState.processedFileId;
      setState((prev) => ({ ...prev, autoSaveProcessed: newAutoSave }));
      setUiError(null);
      setManualSaveSuccess(false);
      if (newAutoSave && currentProcessedFileId && !processedOutputPermanent && !isProcessingImage && !isManuallySaving) {
        setIsManuallySaving(true);
        try {
          const filenameToSaveWith =
            toolState.lastUserGivenFilename && toolState.processedFileId === currentProcessedFileId
              ? toolState.lastUserGivenFilename
              : generateDefaultOutputFilename();

          const success = await makeFilePermanentAndUpdate(currentProcessedFileId, filenameToSaveWith);

          if (success) {
            setProcessedOutputPermanent(true);
            if (!toolState.lastUserGivenFilename) {
              setState((prev) => ({ ...prev, lastUserGivenFilename: filenameToSaveWith }));
            }
          } else {
            throw new Error('File could not be made permanent via auto-save.');
          }
        } catch (err) {
          setUiError(`Auto-save to permanent failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setState((prev) => ({ ...prev, autoSaveProcessed: false }));
        } finally {
          setIsManuallySaving(false);
        }
      }
      await saveStateNow({ ...toolState, autoSaveProcessed: newAutoSave, processedFileId: currentProcessedFileId, lastUserGivenFilename: toolState.lastUserGivenFilename });
    },
    [toolState, processedOutputPermanent, isProcessingImage, isManuallySaving, makeFilePermanentAndUpdate, setState, saveStateNow, generateDefaultOutputFilename]
  );

  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;
    const currentAutoSave = toolState.autoSaveProcessed;
    const clearedState: BitcoinLaserEyesToolState = { ...DEFAULT_TOOL_STATE, autoSaveProcessed: currentAutoSave };
    setState(clearedState);
    await saveStateNow(clearedState);

    clearProcessingHookOutput();
    setUiError(null);
    setManualSaveSuccess(false);
    setDownloadAttempted(false);
    setOriginalImageSrcForUI(null);
    setProcessedImageSrcForUI(null);
    setOriginalFilenameForDisplay(null);
    setProcessedStoredFileForItde(null);
    setProcessedOutputPermanent(false);

    const destatedIds: string[] = [oldSelectedId, oldProcessedId].filter((id): id is string => !!id);
    if (destatedIds.length > 0)
      cleanupOrphanedTemporaryFiles(destatedIds).catch((err) => console.error(`[LaserEyes Clear] Cleanup call failed:`, err));
  }, [toolState.autoSaveProcessed, toolState.selectedFileId, toolState.processedFileId, setState, saveStateNow, cleanupOrphanedTemporaryFiles, clearProcessingHookOutput]);

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
      } else {
        throw new Error('File could not be made permanent.');
      }
    } catch (err) {
      setUiError(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setProcessedOutputPermanent(false);
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
    if (!toolState.processedFileId || isProcessingImage || isManuallySaving || !faceApi.modelsLoaded) return;

    if (processedOutputPermanent && !toolState.autoSaveProcessed && toolState.lastUserGivenFilename) {
      const currentDefaultFilename = generateDefaultOutputFilename();
      if (toolState.lastUserGivenFilename === currentDefaultFilename || (await getFile(toolState.processedFileId))?.filename === toolState.lastUserGivenFilename) {
        setManualSaveSuccess(true);
        setTimeout(() => setManualSaveSuccess(false), 1500);
        return;
      }
    }

    const filenameToUse = toolState.lastUserGivenFilename || generateDefaultOutputFilename();

    if (!toolState.autoSaveProcessed || !processedOutputPermanent || !toolState.lastUserGivenFilename) {
      setFilenamePromptInitialValue(filenameToUse);
      setFilenamePromptAction('save');
      setIsFilenamePromptOpen(true);
    } else if (toolState.autoSaveProcessed && processedOutputPermanent) {
      setFilenamePromptInitialValue(filenameToUse);
      setFilenamePromptAction('save');
      setIsFilenamePromptOpen(true);
    }
  };

  const initiateDownload = async () => {
    if (!processedImageSrcForUI || isProcessingImage || isManuallySaving || !faceApi.modelsLoaded) return;
    const filenameToUse = toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filenameToUse);
    setFilenamePromptAction('download');
    setIsFilenamePromptOpen(true);
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
      const newState = { ...toolState, lastUserGivenFilename: confirmedFilename };
      setState(newState);
      await saveStateNow(newState);
    }
  };

  const imageFilter = useMemo(() => ({ category: 'image' as const }), []);
  const displayError = processingErrorHook || uiError || faceApi.errorLoadingModels;

  const canPerformActions = !!processedImageSrcForUI && !isProcessingImage && !isManuallySaving && faceApi.modelsLoaded;

  const canInitiateSaveCurrent =
    !!toolState.processedFileId &&
    !isProcessingImage &&
    !isManuallySaving &&
    faceApi.modelsLoaded &&
    (!toolState.autoSaveProcessed || !processedOutputPermanent);

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
    const remaining = itdeTarget.pendingSignals.filter((s) => s.sourceDirective !== sourceDirective);
    if (remaining.length === 0) setUserDeferredAutoPopup(false);
  };

  if (isLoadingToolSettings && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading Tool...
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
            disabled={isProcessingImage || isManuallySaving || faceApi.isLoadingModels}
            title={
              faceApi.isLoadingModels
                ? 'Face models loading...'
                : faceApi.errorLoadingModels
                  ? 'Face models failed to load'
                  : 'Select or upload an image'
            }
          >
            {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
          </Button>
          {faceApi.isLoadingModels && (
            <div className="flex items-center text-sm text-[rgb(var(--color-text-muted))]">
              <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
              Loading face detection models...
            </div>
          )}
          {faceApi.errorLoadingModels && !faceApi.isLoadingModels && (
            <Button
              variant="danger-outline"
              size="sm"
              onClick={() => faceApi.loadModels()}
              iconLeft={<ExclamationTriangleIcon className="h-4 w-4" />}
              title="Attempt to reload face detection models"
            >
              Retry Loading Models
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-gray-200 mt-2">
          <Checkbox
            label="Auto-save processed image to Library"
            checked={toolState.autoSaveProcessed}
            onChange={handleAutoSaveChange}
            disabled={isProcessingImage || isManuallySaving || faceApi.isLoadingModels}
            id="autoSaveProcessedImage"
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
              <span className="text-sm italic text-[rgb(var(--color-text-muted))]">
                Select an image
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Laser Eyes Image{' '}
            {processedOutputPermanent && processedStoredFileForItde?.filename && (
              <span className="font-normal text-xs">
                ({processedStoredFileForItde.filename})
              </span>
            )}
          </label>
          <div className="w-full aspect-square border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {(isProcessingImage || faceApi.isLoadingModels) && !processedImageSrcForUI ? (
              <div className="flex flex-col items-center text-sm italic text-[rgb(var(--color-text-muted))]">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2" />
                {faceApi.isLoadingModels ? 'Loading models...' : 'Processing...'}
              </div>
            ) : !isProcessingImage && processedImageSrcForUI ? (
              <Image
                src={processedImageSrcForUI}
                alt={originalFilenameForDisplay ? `Laser Eyes ${originalFilenameForDisplay}` : 'Laser Eyes'}
                width={500}
                height={500}
                className="max-w-full max-h-full object-contain"
                unoptimized={true}
              />
            ) : (
              !isProcessingImage && (
                <span className="text-sm italic text-[rgb(var(--color-text-muted))]">
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
