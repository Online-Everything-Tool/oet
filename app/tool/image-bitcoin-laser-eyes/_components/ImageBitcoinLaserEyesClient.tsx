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
import type { ToolMetadata } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing';
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import { useBitcoinLaserEyes } from '../_hooks/useBitcoinLaserEyes';

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
  ExclamationTriangleIcon,
} from '@heroicons/react/20/solid';

interface ImageBitcoinLaserEyesToolState {
  autoSaveProcessed: boolean;
  selectedFileId: string | null;
  processedFileId: string | null;
  lastUserGivenFilename: string | null;
}

const DEFAULT_TOOL_STATE: ImageBitcoinLaserEyesToolState = {
  autoSaveProcessed: false,
  selectedFileId: null,
  processedFileId: null,
  lastUserGivenFilename: null,
};

const metadata = importedMetadata as ToolMetadata;
const MODEL_PATH = '/data/image-bitcoin-laser-eyes/models';
const LASER_ASSET_PATH = '/data/image-bitcoin-laser-eyes/assets/laser-beam.png';

interface ImageBitcoinLaserEyesClientProps {
  toolRoute: string;
}

export default function ImageBitcoinLaserEyesClient({ toolRoute }: ImageBitcoinLaserEyesClientProps) {
  const {
    state: toolState,
    setState,
    saveStateNow,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<ImageBitcoinLaserEyesToolState>(
    toolRoute,
    DEFAULT_TOOL_STATE
  );

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
    isLoading: isProcessingImageHook,
    error: processingErrorHook,
    processImage,
    clearProcessingOutput: clearProcessingHookOutput,
  } = useImageProcessing();

  const { 
    applyLaserEyes, 
    isLoadingResources: isLoadingFaceApiResources, 
    resourcesError: faceApiError 
  } = useBitcoinLaserEyes({ modelPath: MODEL_PATH, laserBeamAssetPath: LASER_ASSET_PATH });

  const [processedStoredFileForItde, setProcessedStoredFileForItde] = useState<StoredFile | null>(null);

  useEffect(() => {
    if (toolState.processedFileId) {
      getFile(toolState.processedFileId).then((file) => {
        setProcessedStoredFileForItde(file || null);
        setProcessedOutputPermanent(file ? file.isTemporary === false : false);
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
    const originalName = originalFilenameForDisplay || 'image';
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    let extension = 'png';
    if (processedImageSrcForUI) {
      const match = processedImageSrcForUI.match(/data:image\/(\w+);base64,/);
      if (match) extension = match[1];
    } else if (processedStoredFileForItde?.type) {
      extension = processedStoredFileForItde.type.split('/')[1] || extension;
    } else if (originalFilenameForDisplay) {
      extension = originalFilenameForDisplay.split('.').pop() || extension;
    }
    return `laser-eyes-${baseName}.${extension}`;
  }, [originalFilenameForDisplay, processedImageSrcForUI, processedStoredFileForItde]);

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setUiError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setUiError('Metadata not found for source tool.');
        return;
      }

      const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig, signal.data);

      if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
        setUiError(resolvedPayload.errorMessage || 'No transferable data received from source.');
        return;
      }
      const firstItem = resolvedPayload.data.find(item => item.type?.startsWith('image/') && 'id' in item);
      const newSelectedFileId = firstItem ? (firstItem as StoredFile).id : null;

      if (newSelectedFileId) {
        const oldSelectedId = toolState.selectedFileId;
        const oldProcessedId = toolState.processedFileId;
        const newState: ImageBitcoinLaserEyesToolState = {
          ...DEFAULT_TOOL_STATE,
          autoSaveProcessed: toolState.autoSaveProcessed,
          selectedFileId: newSelectedFileId,
        };
        setState(newState);
        await saveStateNow(newState);
        clearProcessingHookOutput();
        setManualSaveSuccess(false);
        setDownloadAttempted(false);
        setUserDeferredAutoPopup(false);
        const destatedIds = [oldSelectedId, oldProcessedId].filter((id): id is string => !!(id && id !== newSelectedFileId));
        if (destatedIds.length > 0) {
          cleanupOrphanedTemporaryFiles(destatedIds).catch(_err => console.error('[LaserEyes ITDE Accept] Cleanup failed:', _err));
        }
      } else {
        setUiError('No valid image item found in received ITDE data.');
      }
    },
    [getToolMetadata, toolState.autoSaveProcessed, setState, saveStateNow, cleanupOrphanedTemporaryFiles, clearProcessingHookOutput]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    initialToolStateLoadCompleteRef.current = !isLoadingToolSettings;
  }, [isLoadingToolSettings]);

  useEffect(() => {
    if (initialToolStateLoadCompleteRef.current && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [initialToolStateLoadCompleteRef, itdeTarget, userDeferredAutoPopup]);

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
          }
        } catch (_err) { /* ignore */ }
      }
      if (toolState.processedFileId) {
        try {
          const file = await getFile(toolState.processedFileId);
          if (mounted && file?.blob) {
            localProcObjUrl = URL.createObjectURL(file.blob);
            setProcessedImageSrcForUI(localProcObjUrl);
          }
        } catch (_err) { /* ignore */ }
      }
    };

    if (initialToolStateLoadCompleteRef.current) {
      loadPreviews();
    }
    return () => {
      mounted = false;
      if (localOrigObjUrl) URL.revokeObjectURL(localOrigObjUrl);
      if (localProcObjUrl) URL.revokeObjectURL(localProcObjUrl);
    };
  }, [toolState.selectedFileId, toolState.processedFileId, getFile, isLoadingToolSettings]);

  useEffect(() => {
    if (!initialToolStateLoadCompleteRef.current || !toolState.selectedFileId || toolState.processedFileId || isProcessingImageHook || isLoadingFaceApiResources) {
      return;
    }
    if (faceApiError) {
      setUiError(`Face API Error: ${faceApiError}. Cannot process image.`);
      return;
    }

    const triggerProcessing = async () => {
      const inputFile = await getFile(toolState.selectedFileId!);
      if (!inputFile?.blob) {
        setUiError('Original image data not found for processing.');
        return;
      }
      const outputFileName = generateDefaultOutputFilename();
      const result = await processImage(
        inputFile,
        applyLaserEyes,
        outputFileName,
        {},
        toolState.autoSaveProcessed
      );
      if (result.id) {
        setState(prev => ({ ...prev, processedFileId: result.id, lastUserGivenFilename: null }));
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
    isProcessingImageHook,
    isLoadingFaceApiResources,
    faceApiError,
    processImage,
    applyLaserEyes,
    getFile,
    setState,
    processingErrorHook,
    generateDefaultOutputFilename,
  ]);

  const handleFilesSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      const oldSelectedId = toolState.selectedFileId;
      const oldProcessedId = toolState.processedFileId;

      if (files?.[0]?.type?.startsWith('image/') && files[0].blob) {
        const newSelectedId = files[0].id;
        const newState: ImageBitcoinLaserEyesToolState = {
          ...DEFAULT_TOOL_STATE,
          autoSaveProcessed: toolState.autoSaveProcessed,
          selectedFileId: newSelectedId,
        };
        setState(newState);
        await saveStateNow(newState);
        clearProcessingHookOutput();
        setManualSaveSuccess(false);
        setDownloadAttempted(false);
        const destatedIds = [oldSelectedId, oldProcessedId].filter((id): id is string => !!(id && id !== newSelectedId));
        if (destatedIds.length > 0) cleanupOrphanedTemporaryFiles(destatedIds).catch(_err => console.error('[LaserEyes New Selection] Cleanup failed:', _err));
      } else if (files?.length) {
        setUiError(`Selected file "${files[0].filename}" is not a recognized image type.`);
      }
    },
    [toolState.autoSaveProcessed, setState, saveStateNow, clearProcessingHookOutput, cleanupOrphanedTemporaryFiles]
  );

  const handleAutoSaveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAutoSave = e.target.checked;
      const currentProcessedFileId = toolState.processedFileId;
      setState(prev => ({ ...prev, autoSaveProcessed: newAutoSave }));
      setUiError(null);
      setManualSaveSuccess(false);

      if (newAutoSave && currentProcessedFileId && !processedOutputPermanent && !isProcessingImageHook && !isManuallySaving) {
        setIsManuallySaving(true);
        try {
          const success = await makeFilePermanentAndUpdate(currentProcessedFileId);
          if (success) setProcessedOutputPermanent(true);
          else throw new Error('File could not be made permanent.');
        } catch (err) {
          setUiError(`Auto-save to permanent failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setState(prev => ({ ...prev, autoSaveProcessed: false }));
        } finally {
          setIsManuallySaving(false);
        }
      }

      await saveStateNow({ ...toolState, autoSaveProcessed: newAutoSave, processedFileId: currentProcessedFileId });
    },
    [toolState, processedOutputPermanent, isProcessingImageHook, isManuallySaving, makeFilePermanentAndUpdate, setState, saveStateNow]
  );

  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;
    const clearedState: ImageBitcoinLaserEyesToolState = {
      ...DEFAULT_TOOL_STATE,
      autoSaveProcessed: toolState.autoSaveProcessed,
    };
    setState(clearedState);
    await saveStateNow(clearedState);
    clearProcessingHookOutput();
    setUiError(null);
    setManualSaveSuccess(false);
    setDownloadAttempted(false);
    const destatedIds: string[] = [oldSelectedId, oldProcessedId].filter((id): id is string => !!id);
    if (destatedIds.length > 0) cleanupOrphanedTemporaryFiles(destatedIds).catch(_err => console.error(`[LaserEyes Clear] Cleanup failed:`, _err));
  }, [toolState.autoSaveProcessed, setState, saveStateNow, cleanupOrphanedTemporaryFiles, clearProcessingHookOutput]);

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
    if (!toolState.processedFileId || isProcessingImageHook || isManuallySaving || isLoadingFaceApiResources) return;
    const filenameToUse = toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    if (toolState.lastUserGivenFilename && !canInitiateSaveCurrent) {
      setManualSaveSuccess(true); setTimeout(() => setManualSaveSuccess(false), 1500);
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
    if (!processedImageSrcForUI || isProcessingImageHook || isManuallySaving || isLoadingFaceApiResources) return;
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
      setState(newState);
      await saveStateNow(newState);
    }
  };

  const imageFilter = useMemo(() => ({ category: 'image' as const }), []);
  
  const isProcessing = isProcessingImageHook || isLoadingFaceApiResources;
  const displayError = processingErrorHook || uiError || faceApiError;

  const canPerformActions = !!processedImageSrcForUI && !isProcessing && !isManuallySaving;
  const canInitiateSaveCurrent = !!toolState.processedFileId && !toolState.autoSaveProcessed && !processedOutputPermanent && !isProcessing && !isManuallySaving;

  const handleModalDeferAll = () => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); };
  const handleModalIgnoreAll = () => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); };
  const handleModalAccept = (sourceDirective: string) => itdeTarget.acceptSignal(sourceDirective);
  const handleModalIgnore = (sourceDirective: string) => {
    itdeTarget.ignoreSignal(sourceDirective);
    if (itdeTarget.pendingSignals.filter(s => s.sourceDirective !== sourceDirective).length === 0) setUserDeferredAutoPopup(false);
  };

  if (isLoadingToolSettings && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Tool...</p>;
  }

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="flex flex-wrap gap-4 items-center">
          <Button
            variant="accent2"
            iconLeft={<PhotoIcon className="h-5 w-5" />}
            onClick={() => setIsLibraryModalOpen(true)}
            disabled={isProcessing || isManuallySaving}
          >
            {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
          </Button>
          {isLoadingFaceApiResources && (
            <div className="flex items-center text-sm text-[rgb(var(--color-text-muted))]">
              <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
              Loading face models...
            </div>
          )}
          {faceApiError && !isLoadingFaceApiResources && (
             <div className="flex items-center text-sm text-[rgb(var(--color-text-error))]">
              <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
              Model load error!
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-gray-200 mt-2">
          <Checkbox
            label="Auto-save processed image to Library"
            checked={toolState.autoSaveProcessed}
            onChange={handleAutoSaveChange}
            disabled={isProcessing || isManuallySaving}
            id="autoSaveLaserEyesImage"
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
          </label>
          <div className="w-full aspect-square border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {originalImageSrcForUI ? (
              <Image src={originalImageSrcForUI} alt={originalFilenameForDisplay || 'Original'} width={500} height={500} className="max-w-full max-h-full object-contain" unoptimized={true} />
            ) : (
              <span className="text-sm italic text-[rgb(var(--color-text-muted))]">Select an image</span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Laser Eyes Image {processedOutputPermanent && processedStoredFileForItde?.filename && <span className="font-normal text-xs">({processedStoredFileForItde.filename})</span>}
          </label>
          <div className="w-full aspect-square border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {isProcessing && !processedImageSrcForUI ? (
              <div className="flex flex-col items-center text-sm italic text-[rgb(var(--color-text-muted))]">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2" />
                Processing...
              </div>
            ) : !isProcessing && processedImageSrcForUI ? (
              <Image src={processedImageSrcForUI} alt={originalFilenameForDisplay ? `Laser Eyes ${originalFilenameForDisplay}` : 'Laser Eyes'} width={500} height={500} className="max-w-full max-h-full object-contain" unoptimized={true} />
            ) : (
              !isProcessing && <span className="text-sm italic text-[rgb(var(--color-text-muted))]">Output appears here</span>
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
        title={filenamePromptAction === 'save' ? 'Save Laser Eyes Image to Library' : 'Download Laser Eyes Image'}
        confirmButtonText={filenamePromptAction === 'save' ? 'Save to Library' : 'Download'}
        filenameAction={filenamePromptAction || undefined}
      />
    </div>
  );
}
