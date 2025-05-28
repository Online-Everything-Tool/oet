// FILE: app/tool/image-bitcoin-laser-eyes/_components/BitcoinLaserEyesClient.tsx
'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import Image from 'next/image';
import * as faceapi from 'face-api.js'; // For types, actual lib loaded by hook

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
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData } from '@/app/lib/itdeDataUtils';

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

export default function BitcoinLaserEyesClient({
  toolRoute,
}: BitcoinLaserEyesClientProps) {
  const {
    state: toolState,
    setState,
    saveStateNow,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<BitcoinLaserEyesToolState>(toolRoute, DEFAULT_TOOL_STATE);

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

  const { getFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } =
    useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const {
    isLoading: isProcessingImage,
    error: processingErrorHook,
    processImage,
    clearProcessingOutput: clearProcessingHookOutput,
  } = useImageProcessing();

  const faceApi = useFaceApiLoader();

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

  // Auto-load face-api.js models on component mount
  useEffect(() => {
    if (
      !faceApi.modelsLoaded &&
      !faceApi.isLoadingModels &&
      !faceApi.errorLoadingModels
    ) {
      faceApi.loadModels();
    }
  }, [faceApi]);

  const generateDefaultOutputFilename = useCallback(() => {
    const originalName = originalFilenameForDisplay || 'processed-image';
    const baseName =
      originalName.substring(0, originalName.lastIndexOf('.')) || originalName;

    let extension = 'png'; // Default to PNG for canvas output
    if (processedImageSrcForUI) {
      // Check processed if available first
      const match = processedImageSrcForUI.match(/data:image\/(\w+);base64,/);
      if (
        match &&
        (match[1] === 'jpeg' || match[1] === 'png' || match[1] === 'webp')
      )
        extension = match[1];
    } else if (processedStoredFileForItde?.type) {
      const typePart = processedStoredFileForItde.type.split('/')[1];
      if (typePart === 'jpeg' || typePart === 'png' || typePart === 'webp')
        extension = typePart;
    } else if (originalFilenameForDisplay) {
      // Fallback to original extension if known
      const originalExt = originalFilenameForDisplay
        .split('.')
        .pop()
        ?.toLowerCase();
      if (
        originalExt === 'jpg' ||
        originalExt === 'jpeg' ||
        originalExt === 'png' ||
        originalExt === 'webp'
      )
        extension = originalExt === 'jpg' ? 'jpeg' : originalExt;
    }
    return `laser-eyes-${baseName}.${extension}`;
  }, [
    originalFilenameForDisplay,
    processedImageSrcForUI,
    processedStoredFileForItde,
  ]);

  const drawLaserEyesFunction = useCallback(
    async (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
      ctx.drawImage(img, 0, 0, img.width, img.height); // Draw original image first

      if (!faceApi.modelsLoaded || !faceApi.detectFaces) {
        console.warn(
          'FaceAPI models not loaded or detectFaces not available. Outputting original image.'
        );

        return;
      }

      try {
        const detections = await faceApi.detectFaces(img); // This call comes from the hook
        if (detections && detections.length > 0) {
          setUiError(null); // Clear any "no faces" or model loading error from UI state
          detections.forEach((detection) => {
            const landmarks = detection.landmarks;
            if (!landmarks) {
              console.warn('No landmarks detected for a face.');
              return; // Skip this face if no landmarks
            }
            const leftEye = landmarks.getLeftEye(); // Array of Point
            const rightEye = landmarks.getRightEye(); // Array of Point

            const getEyeCenter = (eyePoints: faceapi.Point[]) => {
              if (!eyePoints || eyePoints.length === 0) return { x: 0, y: 0 }; // Should not happen with valid landmarks
              const x =
                eyePoints.reduce((sum, p) => sum + p.x, 0) / eyePoints.length;
              const y =
                eyePoints.reduce((sum, p) => sum + p.y, 0) / eyePoints.length;
              return { x, y };
            };

            const leftEyeCenter = getEyeCenter(leftEye);
            const rightEyeCenter = getEyeCenter(rightEye);

            // Simple Bitcoin-y color and style (very basic)
            const laserColor = '#F7931A'; // Bitcoin orange
            const glowColor = 'rgba(247, 147, 26, 0.5)'; // Lighter orange glow

            const drawLaser = (eyeCenter: { x: number; y: number }) => {
              if (eyeCenter.x === 0 && eyeCenter.y === 0) return; // Skip if eye center calculation failed

              // Outer glow
              ctx.strokeStyle = glowColor;
              ctx.lineWidth = Math.max(6, img.width * 0.03);
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(eyeCenter.x, eyeCenter.y);
              ctx.lineTo(
                img.width * 1.2,
                eyeCenter.y + (Math.random() - 0.5) * (img.height * 0.05)
              ); // Slight random angle
              ctx.stroke();

              // Main beam
              ctx.strokeStyle = laserColor;
              ctx.lineWidth = Math.max(2.5, img.width * 0.012);
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(eyeCenter.x, eyeCenter.y);
              ctx.lineTo(
                img.width * 1.2,
                eyeCenter.y + (Math.random() - 0.5) * (img.height * 0.05)
              ); // Same slight random angle
              ctx.stroke();
            };

            drawLaser(leftEyeCenter);
            drawLaser(rightEyeCenter);
          });
        } else {
          // Only set UI error if not already showing a model loading error
          if (!faceApi.isLoadingModels && !faceApi.errorLoadingModels) {
            setUiError(
              'No faces detected in the image. Outputting original image.'
            );
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
    [
      faceApi.modelsLoaded,
      faceApi.detectFaces,
      faceApi.isLoadingModels,
      faceApi.errorLoadingModels,
    ] // Added faceApi loading states
  );

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setUiError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setUiError('Metadata not found for source tool.');
        return;
      }
      const resolvedPayload = await resolveItdeData(
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
        (item): item is StoredFile => item.type?.startsWith('image/') && 'id' in item
      );
      if (firstItem) newSelectedFileId = firstItem.id;
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
        setUiError(null); // Clear UI error on new valid input
        const destatedIds = [oldSelectedId, oldProcessedId].filter(
          (id): id is string => !!(id && id !== newSelectedFileId)
        );
        if (destatedIds.length > 0) {
          cleanupOrphanedTemporaryFiles(destatedIds).catch((_e) =>
            console.error('[LaserEyes ITDE Accept] Cleanup call failed:', _e)
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
    targetToolDirective: metadata.directive,
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
  }, [isLoadingToolSettings, itdeTarget, userDeferredAutoPopup]);

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
              // File missing from DB after selection
              setState((prev) => ({
                ...prev,
                selectedFileId: null,
                processedFileId: null,
              }));
              setUiError(
                'Selected original image is no longer available. Please select another.'
              );
            }
          }
        } catch (_e) {
          console.error('Error loading original image preview:', _e);
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
              // Processed file missing, clear it from state
              setState((prev) => ({ ...prev, processedFileId: null }));
              setUiError('Previously processed image is no longer available.');
            }
          }
        } catch (_e) {
          console.error('Error loading processed image preview:', _e);
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
    setState, // Added setState
  ]);

  useEffect(() => {
    // Condition to trigger processing
    if (
      isLoadingToolSettings || // Still loading tool state
      !initialToolStateLoadCompleteRef.current || // Initial load not done
      !toolState.selectedFileId || // No image selected
      toolState.processedFileId || // Image already processed for current selectedFileId
      isProcessingImage || // Another processing action is already in progress
      !faceApi.modelsLoaded || // FaceAPI models aren't loaded yet
      faceApi.isLoadingModels // FaceAPI models are currently in the process of loading
    ) {
      return; // Conditions not met for processing
    }
    const triggerProcessing = async () => {
      setUiError(null);
      const inputFile = await getFile(toolState.selectedFileId!); // selectedFileId is known to be non-null here
      if (!inputFile?.blob) {
        setUiError('Original image data not found for processing.');
        setState((prev) => ({ ...prev, selectedFileId: null })); // Clear invalid selected file
        return;
      }
      const outputFileName = generateDefaultOutputFilename();
      const result = await processImage(
        inputFile,
        drawLaserEyesFunction, // This is our face-api enabled drawing function
        outputFileName,
        { outputFormat: 'image/png' }, // Ensure output is PNG to support transparency if lasers have it
        toolState.autoSaveProcessed
      );
      if (result.id) {
        setState((prev) => ({
          ...prev,
          processedFileId: result.id,
          lastUserGivenFilename: null, // Reset last filename on new processing
        }));
        setManualSaveSuccess(false); // Reset save success flag
        setDownloadAttempted(false); // Reset download success flag
      } else if (processingErrorHook) {
        // This hook's error is from processImage call itself
        setUiError(`Image processing failed: ${processingErrorHook}`);
      }
      // Note: Errors from within drawLaserEyesFunction (like no faces detected)
      // should set uiError directly from that function.
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
        // Check for id too
        const newSelectedId = files[0].id;
        const currentAutoSave = toolState.autoSaveProcessed;
        const newState: BitcoinLaserEyesToolState = {
          selectedFileId: newSelectedId,
          processedFileId: null, // Clear previous processed result on new image selection
          autoSaveProcessed: currentAutoSave,
          lastUserGivenFilename: null,
        };
        setState(newState);
        await saveStateNow(newState); // Persist this intermediate state
        clearProcessingHookOutput(); // Clear any errors from useImageProcessing hook
        setManualSaveSuccess(false);
        setDownloadAttempted(false);
        setUserDeferredAutoPopup(false); // Reset ITDE deferral

        const destatedIds = [oldSelectedId, oldProcessedId].filter(
          (id): id is string => !!(id && id !== newSelectedId)
        );
        if (destatedIds.length > 0)
          cleanupOrphanedTemporaryFiles(destatedIds).catch((_e) =>
            console.error('[LaserEyes New Selection] Cleanup failed:', _e)
          );
      } else if (files?.length) {
        setUiError(
          `Selected file "${files[0].filename}" is not a recognized image type or is missing ID.`
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
          // If auto-saving, use the generated default filename, unless user has already named it for this processed file
          const filenameToSaveWith =
            toolState.lastUserGivenFilename &&
            toolState.processedFileId === currentProcessedFileId
              ? toolState.lastUserGivenFilename
              : generateDefaultOutputFilename();

          const success = await makeFilePermanentAndUpdate(
            currentProcessedFileId,
            filenameToSaveWith
          );

          if (success) {
            setProcessedOutputPermanent(true);
            if (!toolState.lastUserGivenFilename) {
              // Only update lastUserGivenFilename if it wasn't already set for this exact processed image
              setState((prev) => ({
                ...prev,
                lastUserGivenFilename: filenameToSaveWith,
              }));
            }
          } else {
            throw new Error('File could not be made permanent via auto-save.');
          }
        } catch (err) {
          setUiError(
            `Auto-save to permanent failed: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
          setState((prev) => ({ ...prev, autoSaveProcessed: false })); // Revert UI on failure
        } finally {
          setIsManuallySaving(false);
        }
      }
      // Persist the autoSaveProcessed setting regardless of immediate save action
      await saveStateNow({
        ...toolState, // Get latest state
        autoSaveProcessed: newAutoSave, // Apply new autoSave value
        processedFileId: currentProcessedFileId, // Ensure this is passed through
        lastUserGivenFilename: toolState.lastUserGivenFilename, // Ensure this is passed
      });
    },
    [
      toolState, // Full toolState for saveStateNow
      processedOutputPermanent,
      isProcessingImage,
      isManuallySaving,
      makeFilePermanentAndUpdate,
      setState,
      saveStateNow,
      generateDefaultOutputFilename,
    ]
  );

  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;
    const currentAutoSave = toolState.autoSaveProcessed; // Preserve auto-save setting
    const clearedState: BitcoinLaserEyesToolState = {
      ...DEFAULT_TOOL_STATE, // Resets selectedFileId, processedFileId, lastUserGivenFilename
      autoSaveProcessed: currentAutoSave,
    };
    setState(clearedState);
    await saveStateNow(clearedState);

    clearProcessingHookOutput();
    setUiError(null);
    setManualSaveSuccess(false);
    setDownloadAttempted(false);
    setOriginalImageSrcForUI(null); // Clear previews
    setProcessedImageSrcForUI(null);
    setOriginalFilenameForDisplay(null);
    setProcessedStoredFileForItde(null);
    setProcessedOutputPermanent(false);

    const destatedIds: string[] = [oldSelectedId, oldProcessedId].filter(
      (id): id is string => !!id
    );
    if (destatedIds.length > 0)
      cleanupOrphanedTemporaryFiles(destatedIds).catch((_err) =>
        console.error(`[LaserEyes Clear] Cleanup call failed:`, _err)
      );
  }, [
    toolState.autoSaveProcessed, // Depends on this to preserve it
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
      setProcessedOutputPermanent(false); // If save failed, it's not permanent
      return false;
    } finally {
      setIsManuallySaving(false);
    }
  };

  const _internalPerformDownload = async (
    filename: string
  ): Promise<boolean> => {
    if (!processedImageSrcForUI) {
      // Check against UI source, which depends on processedFileId
      setUiError('No image data to download.');
      return false;
    }
    const link = document.createElement('a');
    link.download = filename;
    link.href = processedImageSrcForUI; // Use the blob URL for download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadAttempted(true);
    setTimeout(() => setDownloadAttempted(false), 2500);
    return true;
  };

  const initiateSave = async () => {
    if (
      !toolState.processedFileId ||
      isProcessingImage ||
      isManuallySaving ||
      !faceApi.modelsLoaded
    )
      return;

    // If already saved (permanent) and auto-save is off, and filename hasn't changed, consider it a "no-op success"
    if (
      processedOutputPermanent &&
      !toolState.autoSaveProcessed &&
      toolState.lastUserGivenFilename
    ) {
      const currentDefaultFilename = generateDefaultOutputFilename();
      if (
        toolState.lastUserGivenFilename === currentDefaultFilename ||
        (await getFile(toolState.processedFileId))?.filename ===
          toolState.lastUserGivenFilename
      ) {
        setManualSaveSuccess(true); // Show feedback
        setTimeout(() => setManualSaveSuccess(false), 1500);
        return;
      }
    }

    const filenameToUse =
      toolState.lastUserGivenFilename || generateDefaultOutputFilename();

    // If auto-save is off, or if it's on but file isn't permanent yet, or if user wants to rename
    if (
      !toolState.autoSaveProcessed ||
      !processedOutputPermanent ||
      !toolState.lastUserGivenFilename
    ) {
      setFilenamePromptInitialValue(filenameToUse);
      setFilenamePromptAction('save');
      setIsFilenamePromptOpen(true);
    } else if (toolState.autoSaveProcessed && processedOutputPermanent) {
      // It's auto-saved and permanent. If user clicks save again, maybe they want to rename?
      // Or treat as already saved. For now, let's assume they might want to rename if filename exists
      setFilenamePromptInitialValue(filenameToUse);
      setFilenamePromptAction('save');
      setIsFilenamePromptOpen(true);
    }
  };

  const initiateDownload = async () => {
    if (
      !processedImageSrcForUI ||
      isProcessingImage ||
      isManuallySaving ||
      !faceApi.modelsLoaded
    )
      return;
    const filenameToUse =
      toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    // Always prompt for download name if not set, or allow re-download with same/new name.
    setFilenamePromptInitialValue(filenameToUse);
    setFilenamePromptAction('download');
    setIsFilenamePromptOpen(true);
  };

  const handleConfirmFilename = async (confirmedFilename: string) => {
    setIsFilenamePromptOpen(false);
    setUiError(null);
    let success = false;
    const action = filenamePromptAction;
    setFilenamePromptAction(null); // Clear action type

    if (action === 'save') {
      success = await _internalPerformSave(confirmedFilename);
    } else if (action === 'download') {
      success = await _internalPerformDownload(confirmedFilename);
    }

    if (success) {
      const newState = {
        ...toolState, // ensure all previous state is kept
        lastUserGivenFilename: confirmedFilename,
      };
      setState(newState); // Update UI state
      await saveStateNow(newState); // Persist tool state
    }
  };

  const imageFilter = useMemo(() => ({ category: 'image' as const }), []);
  const displayError =
    processingErrorHook || uiError || faceApi.errorLoadingModels;

  const canPerformActions =
    !!processedImageSrcForUI &&
    !isProcessingImage &&
    !isManuallySaving &&
    faceApi.modelsLoaded;

  const canInitiateSaveCurrent =
    !!toolState.processedFileId && // Must have a processed file
    !isProcessingImage && // Not currently processing
    !isManuallySaving && // Not currently saving
    faceApi.modelsLoaded && // Models must be loaded
    (!toolState.autoSaveProcessed || !processedOutputPermanent); // EITHER auto-save is OFF OR it's ON but file is not yet permanent

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
            disabled={
              isProcessingImage || isManuallySaving || faceApi.isLoadingModels
            }
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
              iconLeft={<ExclamationTriangleIcon className="
