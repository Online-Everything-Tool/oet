'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '@/app/tool/_hooks/useToolState';
import type { StoredFile } from '@/src/types/storage';
import { useMetadata } from '@/app/context/MetadataContext';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import Button from '@/app/tool/_components/form/Button';
import Input from '@/app/tool/_components/form/Input';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import {
  PhotoIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/20/solid';
import useItdeTargetHandler, { IncomingSignal, } from '@/app/tool/_hooks/useItdeTargetHandler';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import importedMetadata from '../metadata.json';
import type { ToolMetadata } from '@/src/types/tools';


const metadata = importedMetadata as ToolMetadata;

interface ImageResizerToolState {
  selectedFileId: string | null;
  processedFileId: string | null;
  width: number;
  height: number;
  maintainAspectRatio: boolean;
  autoSaveProcessed: boolean;
  lastUserGivenFilename: string | null;
}

const DEFAULT_TOOL_STATE: ImageResizerToolState = {
  selectedFileId: null,
  processedFileId: null,
  width: 500,
  height: 500,
  maintainAspectRatio: true,
  autoSaveProcessed: false,
  lastUserGivenFilename: null,
};


interface ImageResizerClientProps {
  toolRoute: string;
}

export default function ImageResizerClient({ toolRoute }: ImageResizerClientProps) {
  const {
    state: toolState,
    setState,
    isLoadingState,
    clearStateAndPersist,
    saveStateNow
  } = useToolState<ImageResizerToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [originalFilenameForDisplay, setOriginalFilenameForDisplay] = useState<string | null>(null);
  const [originalImageSrcForUI, setOriginalImageSrcForUI] = useState<string | null>(null);
  const [processedImageSrcForUI, setProcessedImageSrcForUI] = useState<string | null>(null);

  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<'save' | 'download' | null>(null);
  const [filenamePromptInitialValue, setFilenamePromptInitialValue] = useState('');
  const [processedOutputPermanent, setProcessedOutputPermanent] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [manualSaveSuccess, setManualSaveSuccess] = useState<boolean>(false);
  const [downloadAttempted, setDownloadAttempted] = useState<boolean>(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const directiveName = metadata.directive;
  const { getFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const { processImage, clearProcessingOutput } = useImageProcessing();

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


  const generateDefaultOutputFilename = useCallback(() => {
    const originalName = originalFilenameForDisplay || '';
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

    return `${baseName}-resized-${toolState.width}x${toolState.height}.${extension}`;
  }, [originalFilenameForDisplay, processedImageSrcForUI, toolState.width, toolState.height, processedStoredFileForItde]);


  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
      setProcessingError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setProcessingError('Metadata not found for source tool.');
        return;
      }
      const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
      if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
        setProcessingError(resolvedPayload.errorMessage || 'No transferable data received from source.');
        return;
      }
      let newSelectedFileId: string | null = null;
      const firstItem = resolvedPayload.data.find(item => item.type?.startsWith('image/') && 'id' in item);
      if (firstItem) newSelectedFileId = (firstItem as StoredFile).id;
      else {
          setProcessingError('No valid item found in received ITDE data.');
          return;
      }

      if (newSelectedFileId) {
          const oldSelectedId = toolState.selectedFileId;
          const oldProcessedId = toolState.processedFileId;

          const newState: ImageResizerToolState = {
              ...toolState,
              selectedFileId: newSelectedFileId,
              processedFileId: null,
              lastUserGivenFilename: null
          };
          setState(newState);
          await saveStateNow(newState);
          clearProcessingOutput();
          setManualSaveSuccess(false);
          setDownloadAttempted(false);
          setUserDeferredAutoPopup(false);
          const destatedIds = [oldSelectedId, oldProcessedId].filter((id): id is string => !!(id && id !== newSelectedFileId));
          if (destatedIds.length > 0) {
              cleanupOrphanedTemporaryFiles(destatedIds).catch(e => console.error('[ImageResizer ITDE Accept] Cleanup call failed:', e));
          }
      }
  }, [getToolMetadata, toolState, setState, saveStateNow, clearProcessingOutput, cleanupOrphanedTemporaryFiles]);


  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal
  });

  useEffect(() => {
    if (!isLoadingState) {
      if (!initialToolStateLoadCompleteRef.current) initialToolStateLoadCompleteRef.current = true;
    } else {
      if (initialToolStateLoadCompleteRef.current) initialToolStateLoadCompleteRef.current = false;
    }
  }, [isLoadingState]);

  useEffect(() => {
    const canProceed = !isLoadingState && initialToolStateLoadCompleteRef.current;
    if (canProceed && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup, directiveName]);


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


    if (!isLoadingState && initialToolStateLoadCompleteRef.current) {
      loadPreviews();
    }

    return () => {
      mounted = false;
      if (localOrigObjUrl) URL.revokeObjectURL(localOrigObjUrl);
      if (localProcObjUrl) URL.revokeObjectURL(localProcObjUrl);
    };
  }, [toolState.selectedFileId, toolState.processedFileId, getFile, isLoadingState]);


  const resizeImage = useCallback(async () => {
    if (!toolState.selectedFileId || !originalImageSrcForUI) return;

    setIsProcessing(true);
    setProcessingError(null);
    clearProcessingOutput();

    try {
      const file = await getFile(toolState.selectedFileId);
      if (!file) {
        throw new Error('File not found.');
      }

      const img = new Image();
      img.src = originalImageSrcForUI;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      let targetWidth = toolState.width;
      let targetHeight = toolState.height;

      if (toolState.maintainAspectRatio) {
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        if (targetWidth && !targetHeight) {
          targetHeight = Math.round(targetWidth / aspectRatio);
        } else if (!targetWidth && targetHeight) {
          targetWidth = Math.round(targetHeight * aspectRatio);
        } else if (targetWidth && targetHeight) {
          const targetAspectRatio = targetWidth / targetHeight;
          if (aspectRatio > targetAspectRatio) {
            targetHeight = Math.round(targetWidth / aspectRatio);
          } else {
            targetWidth = Math.round(targetHeight * aspectRatio);
          }
        }
      }
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context.');
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const outputFileName = generateDefaultOutputFilename();
      const result = await processImage(file, (ctx, img) => ctx.drawImage(img, 0, 0, targetWidth, targetHeight), outputFileName, {}, toolState.autoSaveProcessed);

      if (result.id) {
        setState(prev => ({ ...prev, processedFileId: result.id, lastUserGivenFilename: null }));
        setManualSaveSuccess(false);
        setDownloadAttempted(false);
      }
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'Resizing failed.');
    } finally {
      setIsProcessing(false);
    }
  }, [toolState.selectedFileId, toolState.width, toolState.height, toolState.maintainAspectRatio, originalImageSrcForUI, getFile, generateDefaultOutputFilename, processImage, toolState.autoSaveProcessed, clearProcessingOutput, setState]);


  useEffect(() => {
    if (!isLoadingState && toolState.selectedFileId && originalImageSrcForUI) {
      resizeImage();
    }
  }, [isLoadingState, toolState.selectedFileId, toolState.width, toolState.height, toolState.maintainAspectRatio, originalImageSrcForUI, resizeImage]);


  const handleFilesSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsLibraryModalOpen(false);
    setProcessingError(null);
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;

    if (files?.[0]?.type?.startsWith('image/')) {
      const newState: Partial<ImageResizerToolState> = {
        selectedFileId: files[0].id,
        processedFileId: null,
        lastUserGivenFilename: null
      };
      setState(newState);
      await saveStateNow({ ...toolState, ...newState });
      clearProcessingOutput();
      setManualSaveSuccess(false);
      setDownloadAttempted(false);
      const destatedIds = [oldSelectedId, oldProcessedId].filter((id): id is string => !!(id && id !== files[0].id));
      if (destatedIds.length > 0) cleanupOrphanedTemporaryFiles(destatedIds).catch(e => console.error('[ImageResizer New Selection] Cleanup failed:', e));

    } else if (files?.length) {
      setProcessingError(`Selected file "${files[0].filename}" is not a recognized image type.`);
    }
  }, [toolState, setState, saveStateNow, clearProcessingOutput, cleanupOrphanedTemporaryFiles]);


  const handleWidthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setState({ width: parseInt(e.target.value, 10) || 0 }), [setState]);
  const handleHeightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setState({ height: parseInt(e.target.value, 10) || 0 }), [setState]);
  const handleMaintainAspectRatioChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setState({ maintainAspectRatio: e.target.checked }), [setState]);
  const handleAutoSaveChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAutoSave = e.target.checked;
    const currentProcessedFileId = toolState.processedFileId;
    setState(prev => ({ ...prev, autoSaveProcessed: newAutoSave }));
    setProcessingError(null);
    setManualSaveSuccess(false);

    if (newAutoSave && currentProcessedFileId && !processedOutputPermanent && !isProcessing) {
      try {
        const success = await makeFilePermanentAndUpdate(currentProcessedFileId);
        if (success) setProcessedOutputPermanent(true);
        else throw new Error('File could not be made permanent.');
      } catch (err) {
        setProcessingError(`Auto-save to permanent failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setState(prev => ({ ...prev, autoSaveProcessed: false }));
      }
    }
    await saveStateNow({ ...toolState, autoSaveProcessed: newAutoSave, processedFileId: currentProcessedFileId });
  }, [toolState, processedOutputPermanent, isProcessing, makeFilePermanentAndUpdate, setState, saveStateNow]);


  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;
    await clearStateAndPersist();
    setOriginalFilenameForDisplay(null);
    setOriginalImageSrcForUI(null);
    setProcessedImageSrcForUI(null);
    setProcessingError(null);
    setManualSaveSuccess(false);
    setDownloadAttempted(false);
    clearProcessingOutput();

    const destatedIds: string[] = [oldSelectedId, oldProcessedId].filter((id): id is string => !!id);
    if (destatedIds.length > 0) cleanupOrphanedTemporaryFiles(destatedIds).catch(err => console.error(`[ImageResizer Clear] Cleanup call failed:`, err));

  }, [toolState.selectedFileId, toolState.processedFileId, clearStateAndPersist, clearProcessingOutput, cleanupOrphanedTemporaryFiles]);


  const _internalPerformSave = async (filename: string): Promise<boolean> => {
    if (!toolState.processedFileId) {
      setProcessingError('No processed image to save.');
      return false;
    }
    setProcessingError(null);
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
      setProcessingError(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    }
  };


  const _internalPerformDownload = async (filename: string): Promise<boolean> => {
    if (!processedImageSrcForUI) {
      setProcessingError('No image data to download.');
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
    if (!toolState.processedFileId || isProcessing) return;

    const filenameToUse = toolState.lastUserGivenFilename || generateDefaultOutputFilename();

    if (toolState.lastUserGivenFilename && !canInitiateSaveCurrent) {
      setManualSaveSuccess(true);
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
    if (!processedImageSrcForUI || isProcessing) return;

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
    setProcessingError(null);

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
  const displayError = processingError;

  const canPerformActions = !!processedImageSrcForUI && !isProcessing;
  const canInitiateSaveCurrent = !!toolState.processedFileId && !toolState.autoSaveProcessed && !processedOutputPermanent && !isProcessing;

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
    const remaining = itdeTarget.pendingSignals.filter(s => s.sourceDirective !== sourceDirective);
    if (remaining.length === 0) setUserDeferredAutoPopup(false);
  };


  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading Image Resizer...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="flex flex-wrap gap-4 items-center">
          <Button variant="accent2" iconLeft={<PhotoIcon className="h-5 w-5" />} onClick={() => setIsLibraryModalOpen(true)} disabled={isProcessing}>
            {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
          </Button>

          <Input
            label="Width (px)"
            type="number"
            value={toolState.width}
            onChange={handleWidthChange}
            disabled={isProcessing}
            min={0}
          />
          <Input
            label="Height (px)"
            type="number"
            value={toolState.height}
            onChange={handleHeightChange}
            disabled={isProcessing}
            min={0}
          />
          <Checkbox
            label="Maintain Aspect Ratio"
            checked={toolState.maintainAspectRatio}
            onChange={handleMaintainAspectRatioChange}
            disabled={isProcessing}
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-[rgb(var(--color-border-base))] mt-2">
          <Checkbox
            label="Auto-save resized image to Library"
            checked={toolState.autoSaveProcessed}
            onChange={handleAutoSaveChange}
            disabled={isProcessing}
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
          <div>
            <strong className="font-semibold">Error:</strong> {displayError}
          </div>
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
              <span className="text-sm italic">Select an image</span>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Resized Image {processedOutputPermanent && processedStoredFileForItde?.filename && <span className="font-normal text-xs">({processedStoredFileForItde.filename})</span>}
          </label>
          <div className="w-full aspect-square border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {isProcessing && !processedImageSrcForUI ? (
              <div className="flex flex-col items-center text-sm italic">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2" />
                Resizing...
              </div>
            ) : !isProcessing && processedImageSrcForUI ? (
              <Image
                src={processedImageSrcForUI}
                alt={originalFilenameForDisplay ? `Resized ${originalFilenameForDisplay}` : 'Resized'}
                width={500}
                height={500}
                className="max-w-full max-h-full object-contain"
                unoptimized={true}
              />
            ) : (
              !isProcessing && <span className="text-sm italic">Output appears here</span>
            )}
          </div>
        </div>
      </div>

      <FileSelectionModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        onFilesSelected={handleFilesSelectedFromModal}
        mode="selectExistingOrUploadNew"
        initialTab="upload"
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