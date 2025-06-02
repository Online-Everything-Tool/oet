'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useToolState from '../../_hooks/useToolState';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import useImageResizerCore, { ResizeOptions, ResizeResult } from '../_hooks/useImageResizerCore';
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import Input from '@/app/tool/_components/form/Input';
import RadioGroup from '../../_components/form/RadioGroup';
import Range from '../../_components/form/Range';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import importedMetadata from '../metadata.json';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import { PhotoIcon, XCircleIcon, ArrowPathIcon, ArrowsPointingOutIcon } from '@heroicons/react/20/solid';
import { formatBytes } from '@/app/lib/utils';

type OutputFormat = 'png' | 'jpeg' | 'webp' | 'original';

interface ImageResizerToolState {
  selectedFileId: string | null;
  processedFileId: string | null;
  targetWidth: string;
  targetHeight: string;
  maintainAspectRatio: boolean;
  outputFormat: OutputFormat;
  jpegQuality: number; // Stored as 0-100 for UI
  autoSaveProcessed: boolean;
  lastUserGivenFilename: string | null;
}

const DEFAULT_STATE: ImageResizerToolState = {
  selectedFileId: null,
  processedFileId: null,
  targetWidth: '',
  targetHeight: '',
  maintainAspectRatio: true,
  outputFormat: 'original',
  jpegQuality: 90,
  autoSaveProcessed: false,
  lastUserGivenFilename: null,
};

const metadata = importedMetadata as ToolMetadata;

interface ImageResizerClientProps {
  toolRoute: string;
}

export default function ImageResizerClient({ toolRoute }: ImageResizerClientProps) {
  const {
    state: toolState,
    setState,
    saveStateNow,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<ImageResizerToolState>(toolRoute, DEFAULT_STATE);

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [isManuallySaving, setIsManuallySaving] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const [originalImagePreviewUrl, setOriginalImagePreviewUrl] = useState<string | null>(null);
  const [originalImageInfo, setOriginalImageInfo] = useState<{ name: string; type: string; size: number; width: number; height: number } | null>(null);
  const [processedImagePreviewUrl, setProcessedImagePreviewUrl] = useState<string | null>(null);
  const [processedImageInfo, setProcessedImageInfo] = useState<{ name: string; type: string; size: number; width: number; height: number } | null>(null);
  
  const [processedOutputPermanent, setProcessedOutputPermanent] = useState<boolean>(false);
  const [manualSaveSuccess, setManualSaveSuccess] = useState<boolean>(false);
  const [downloadAttempted, setDownloadAttempted] = useState<boolean>(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState<boolean>(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<'save' | 'download' | null>(null);
  const [filenamePromptInitialValue, setFilenamePromptInitialValue] = useState<string>('');

  const directiveName = metadata.directive;
  const { getFile, addFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const { resizeImage, isLoading: isResizing, error: resizingErrorHook } = useImageResizerCore();

  const [processedStoredFileForItde, setProcessedStoredFileForItde] = useState<StoredFile | null>(null);

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

  const itdeSendableItems = useMemo(() => {
    return processedStoredFileForItde ? [processedStoredFileForItde] : [];
  }, [processedStoredFileForItde]);

  const clearPreviewsAndInfo = (type: 'original' | 'processed' | 'all') => {
    if (type === 'original' || type === 'all') {
      if (originalImagePreviewUrl) URL.revokeObjectURL(originalImagePreviewUrl);
      setOriginalImagePreviewUrl(null);
      setOriginalImageInfo(null);
    }
    if (type === 'processed' || type === 'all') {
      if (processedImagePreviewUrl) URL.revokeObjectURL(processedImagePreviewUrl);
      setProcessedImagePreviewUrl(null);
      setProcessedImageInfo(null);
    }
  };
  
  useEffect(() => {
    return () => { // Cleanup on unmount
      clearPreviewsAndInfo('all');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const loadOriginalImage = useCallback(async (fileId: string) => {
    clearPreviewsAndInfo('original');
    try {
      const file = await getFile(fileId);
      if (file?.blob) {
        const url = URL.createObjectURL(file.blob);
        setOriginalImagePreviewUrl(url);
        
        const img = new Image();
        img.onload = () => {
          setOriginalImageInfo({ name: file.filename, type: file.type, size: file.size, width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
          setUiError(`Failed to load dimensions for ${file.filename}.`);
          setOriginalImageInfo({ name: file.filename, type: file.type, size: file.size, width: 0, height: 0 }); // Still set some info
        };
        img.src = url; // Assign src after onload/onerror are set
      } else {
        setUiError('Selected file not found or has no content.');
      }
    } catch (err) {
      setUiError(`Error loading original image: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [getFile]);

  const loadProcessedImage = useCallback(async (fileId: string) => {
    clearPreviewsAndInfo('processed');
    try {
      const file = await getFile(fileId);
      if (file?.blob) {
        const url = URL.createObjectURL(file.blob);
        setProcessedImagePreviewUrl(url);

        const img = new Image();
        img.onload = () => {
           setProcessedImageInfo({ name: file.filename, type: file.type, size: file.size, width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
          setUiError(`Failed to load dimensions for processed image ${file.filename}.`);
          setProcessedImageInfo({ name: file.filename, type: file.type, size: file.size, width: 0, height: 0 });
        };
        img.src = url;
      }
    } catch (err) {
      setUiError(`Error loading processed image: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [getFile]);


  useEffect(() => {
    if (!isLoadingToolSettings && initialToolStateLoadCompleteRef.current) {
      if (toolState.selectedFileId) {
        loadOriginalImage(toolState.selectedFileId);
      } else {
        clearPreviewsAndInfo('original');
      }
      if (toolState.processedFileId) {
        loadProcessedImage(toolState.processedFileId);
      } else {
        clearPreviewsAndInfo('processed');
      }
    }
  }, [toolState.selectedFileId, toolState.processedFileId, isLoadingToolSettings, loadOriginalImage, loadProcessedImage]);


  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
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
    const firstItem = resolvedPayload.data.find(item => item.type?.startsWith('image/') && 'id' in item);
    if (!firstItem) {
      setUiError('No valid image item found in received ITDE data.');
      return;
    }
    const newSelectedFileId = (firstItem as StoredFile).id;

    if (newSelectedFileId) {
      const oldSelectedId = toolState.selectedFileId;
      const oldProcessedId = toolState.processedFileId;
      const newState: ImageResizerToolState = {
        ...DEFAULT_STATE, // Reset most params on new image
        selectedFileId: newSelectedFileId,
        autoSaveProcessed: toolState.autoSaveProcessed, // Keep this user preference
      };
      setState(newState);
      await saveStateNow(newState);
      
      clearPreviewsAndInfo('processed');
      setManualSaveSuccess(false);
      setDownloadAttempted(false);
      setUserDeferredAutoPopup(false);

      const destatedIds = [oldSelectedId, oldProcessedId].filter((id): id is string => !!(id && id !== newSelectedFileId));
      if (destatedIds.length > 0) {
        cleanupOrphanedTemporaryFiles(destatedIds).catch(e => console.error('[ImageResizer ITDE Accept] Cleanup call failed:', e));
      }
    }
  }, [getToolMetadata, toolState.selectedFileId, toolState.processedFileId, toolState.autoSaveProcessed, setState, saveStateNow, cleanupOrphanedTemporaryFiles]);

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

  const handleFilesSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsLibraryModalOpen(false);
    setUiError(null);
    if (files?.[0]?.type?.startsWith('image/') && files[0].blob) {
      const newSelectedId = files[0].id;
      const oldSelectedId = toolState.selectedFileId;
      const oldProcessedId = toolState.processedFileId;

      const newState: ImageResizerToolState = {
        ...DEFAULT_STATE, // Reset most params on new image
        selectedFileId: newSelectedId,
        autoSaveProcessed: toolState.autoSaveProcessed, // Keep this user preference
      };
      setState(newState);
      await saveStateNow(newState);

      clearPreviewsAndInfo('processed');
      setManualSaveSuccess(false);
      setDownloadAttempted(false);
      
      const destatedIds = [oldSelectedId, oldProcessedId].filter((id): id is string => !!(id && id !== newSelectedId));
      if (destatedIds.length > 0) {
        cleanupOrphanedTemporaryFiles(destatedIds).catch(e => console.error('[ImageResizer New Selection] Cleanup failed:', e));
      }
    } else if (files?.length) {
      setUiError(`Selected file "${files[0].filename}" is not a recognized image type.`);
    }
  }, [toolState.selectedFileId, toolState.processedFileId, toolState.autoSaveProcessed, setState, saveStateNow, cleanupOrphanedTemporaryFiles]);

  const handleResizeImage = async () => {
    if (!toolState.selectedFileId || !originalImageInfo || isResizing) return;
    setUiError(null);
    clearPreviewsAndInfo('processed');

    const inputFile = await getFile(toolState.selectedFileId);
    if (!inputFile?.blob) {
      setUiError('Original image data not found for processing.');
      return;
    }

    const parsedWidth = toolState.targetWidth ? parseInt(toolState.targetWidth, 10) : null;
    const parsedHeight = toolState.targetHeight ? parseInt(toolState.targetHeight, 10) : null;

    if ((parsedWidth !== null && (isNaN(parsedWidth) || parsedWidth <= 0)) || 
        (parsedHeight !== null && (isNaN(parsedHeight) || parsedHeight <= 0))) {
      setUiError('Invalid width or height. Please enter positive numbers.');
      return;
    }
    
    const resizeOpts: ResizeOptions = {
      targetWidth: parsedWidth,
      targetHeight: parsedHeight,
      maintainAspectRatio: toolState.maintainAspectRatio,
      outputFormat: toolState.outputFormat,
      jpegQuality: toolState.jpegQuality / 100,
      originalMimeType: inputFile.type,
    };

    const result: ResizeResult | null = await resizeImage(inputFile.blob, resizeOpts);

    if (result) {
      const outputBaseName = originalImageInfo.name.substring(0, originalImageInfo.name.lastIndexOf('.')) || originalImageInfo.name;
      const outputExtension = result.mimeType.split('/')[1] || 'png';
      const outputFileName = `resized-${outputBaseName}.${outputExtension}`;

      const newFileId = await addFile(result.blob, outputFileName, result.mimeType, !toolState.autoSaveProcessed);
      
      setState(prev => ({ ...prev, processedFileId: newFileId, lastUserGivenFilename: null }));
      setProcessedImagePreviewUrl(URL.createObjectURL(result.blob)); // Use the new blob for preview
      setProcessedImageInfo({ name: outputFileName, type: result.mimeType, size: result.blob.size, width: result.width, height: result.height });
      setManualSaveSuccess(false);
      setDownloadAttempted(false);
      
      // Auto-save logic is handled by the `isTemporary` flag in `addFile`
      // and `processedOutputPermanent` state will update via useEffect on `toolState.processedFileId`.

    } else if (resizingErrorHook) {
      setUiError(`Resizing failed: ${resizingErrorHook}`);
    }
  };
  
  const handleAutoSaveChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAutoSave = e.target.checked;
    const currentProcessedFileId = toolState.processedFileId;
    setState(prev => ({ ...prev, autoSaveProcessed: newAutoSave }));
    setUiError(null);
    setManualSaveSuccess(false);

    if (newAutoSave && currentProcessedFileId && !processedOutputPermanent && !isResizing && !isManuallySaving) {
      setIsManuallySaving(true);
      try {
        const success = await makeFilePermanentAndUpdate(currentProcessedFileId);
        if (success) setProcessedOutputPermanent(true);
        else throw new Error('File could not be made permanent.');
      } catch (err) {
        setUiError(`Auto-save to permanent failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setState(prev => ({ ...prev, autoSaveProcessed: false })); // Revert on error
      } finally {
        setIsManuallySaving(false);
      }
    }
    // Save the tool state with the new autoSaveProcessed value
    await saveStateNow({ ...toolState, autoSaveProcessed: newAutoSave, processedFileId: currentProcessedFileId });
  }, [toolState, processedOutputPermanent, isResizing, isManuallySaving, makeFilePermanentAndUpdate, setState, saveStateNow]);


  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;

    const clearedState: ImageResizerToolState = {
      ...DEFAULT_STATE,
      autoSaveProcessed: toolState.autoSaveProcessed, // Keep this preference
    };
    setState(clearedState);
    await saveStateNow(clearedState);
    
    clearPreviewsAndInfo('all');
    setUiError(null);
    setManualSaveSuccess(false);
    setDownloadAttempted(false);

    const destatedIds: string[] = [oldSelectedId, oldProcessedId].filter((id): id is string => !!id);
    if (destatedIds.length > 0) {
      cleanupOrphanedTemporaryFiles(destatedIds).catch(err => console.error(`[ImageResizer Clear] Cleanup call failed:`, err));
    }
  }, [toolState.autoSaveProcessed, toolState.selectedFileId, toolState.processedFileId, setState, saveStateNow, cleanupOrphanedTemporaryFiles]);

  const generateDefaultOutputFilename = useCallback(() => {
    const originalName = originalImageInfo?.name || 'image';
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    let extension = toolState.outputFormat === 'original' 
      ? (originalImageInfo?.type.split('/')[1] || 'png') 
      : toolState.outputFormat;
    if (extension === 'jpeg') extension = 'jpg'; // Common practice
    if (toolState.outputFormat === 'original' && !['png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
        extension = 'png'; // Fallback for unsupported original types
    }
    return `resized-${baseName}.${extension}`;
  }, [originalImageInfo, toolState.outputFormat]);

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
        // Update processedImageInfo filename
        if(processedImageInfo) setProcessedImageInfo(prev => prev ? {...prev, name: filename} : null);
        return true;
      } else {
        throw new Error('File could not be made permanent.');
      }
    } catch (err) {
      setUiError(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsManuallySaving(false);
    }
  };

  const _internalPerformDownload = async (filename: string): Promise<boolean> => {
    if (!processedImagePreviewUrl) { // Use preview URL which should be from the blob
      setUiError('No image data to download.');
      return false;
    }
    const link = document.createElement('a');
    link.download = filename;
    link.href = processedImagePreviewUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadAttempted(true);
    setTimeout(() => setDownloadAttempted(false), 2500);
    return true;
  };

  const initiateSave = async () => {
    if (!toolState.processedFileId || isResizing || isManuallySaving) return;
    const filenameToUse = toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    if (toolState.lastUserGivenFilename && !canInitiateSaveCurrent) { // Already saved with this name
      setManualSaveSuccess(true); setTimeout(() => setManualSaveSuccess(false), 1500); return;
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
    if (!processedImagePreviewUrl || isResizing || isManuallySaving) return;
    const filenameToUse = toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    if (toolState.lastUserGivenFilename) { // If already named, just download
      const success = await _internalPerformDownload(filenameToUse);
      // No need to save state again if only downloading with existing name
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
      const newState = { ...toolState, lastUserGivenFilename: confirmedFilename };
      setState(newState); // Update local state immediately
      await saveStateNow(newState); // Persist
    }
  };
  
  const imageFilter = useMemo(() => ({ type: 'image/*' as const }), []);
  const displayError = resizingErrorHook || uiError;
  const isLoadingOverall = isLoadingToolSettings || isResizing || isManuallySaving;

  const canPerformActions = !!processedImagePreviewUrl && !isResizing && !isManuallySaving;
  const canInitiateSaveCurrent = !!toolState.processedFileId && !toolState.autoSaveProcessed && !processedOutputPermanent && !isResizing && !isManuallySaving;

  const handleModalDeferAll = () => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); };
  const handleModalIgnoreAll = () => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); };
  const handleModalAccept = (sourceDirective: string) => { itdeTarget.acceptSignal(sourceDirective); };
  const handleModalIgnore = (sourceDirective: string) => {
    itdeTarget.ignoreSignal(sourceDirective);
    if (itdeTarget.pendingSignals.filter(s => s.sourceDirective !== sourceDirective).length === 0) setUserDeferredAutoPopup(false);
  };

  if (isLoadingToolSettings && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-gray-500 animate-pulse">Loading Image Resizer...</p>;
  }

  const outputFormatOptions: { value: OutputFormat, label: string }[] = [
    { value: 'original', label: 'Original (or PNG)' },
    { value: 'png', label: 'PNG' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'webp', label: 'WEBP' },
  ];

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      {/* Controls Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        {/* Column 1: File & Dimensions */}
        <div className="space-y-3">
          <Button
            variant="accent2"
            iconLeft={<PhotoIcon className="h-5 w-5" />}
            onClick={() => setIsLibraryModalOpen(true)}
            disabled={isLoadingOverall}
            fullWidth
          >
            {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
          </Button>
          <Input
            label="Target Width (px)"
            type="number"
            placeholder="e.g., 1920"
            value={toolState.targetWidth}
            onChange={(e) => setState(prev => ({ ...prev, targetWidth: e.target.value, processedFileId: null, lastUserGivenFilename: null }))}
            min="1"
            disabled={isLoadingOverall || !toolState.selectedFileId}
          />
          <Input
            label="Target Height (px)"
            type="number"
            placeholder="e.g., 1080"
            value={toolState.targetHeight}
            onChange={(e) => setState(prev => ({ ...prev, targetHeight: e.target.value, processedFileId: null, lastUserGivenFilename: null }))}
            min="1"
            disabled={isLoadingOverall || !toolState.selectedFileId}
          />
        </div>

        {/* Column 2: Options */}
        <div className="space-y-3">
          <Checkbox
            label="Maintain Aspect Ratio"
            checked={toolState.maintainAspectRatio}
            onChange={(e) => setState(prev => ({ ...prev, maintainAspectRatio: e.target.checked, processedFileId: null, lastUserGivenFilename: null }))}
            disabled={isLoadingOverall || !toolState.selectedFileId}
            id="maintainAspectRatio"
          />
          <RadioGroup
            legend="Output Format:"
            name="outputFormat"
            options={outputFormatOptions}
            selectedValue={toolState.outputFormat}
            onChange={(val) => setState(prev => ({ ...prev, outputFormat: val as OutputFormat, processedFileId: null, lastUserGivenFilename: null }))}
            layout="vertical"
            disabled={isLoadingOverall || !toolState.selectedFileId}
          />
          {toolState.outputFormat === 'jpeg' && (
            <Range
              label="JPEG Quality"
              min={0} max={100} step={1}
              value={toolState.jpegQuality}
              onChange={(e) => setState(prev => ({ ...prev, jpegQuality: parseInt(e.target.value,10), processedFileId: null, lastUserGivenFilename: null }))}
              disabled={isLoadingOverall || !toolState.selectedFileId}
              showValue={true}
            />
          )}
        </div>
        
        {/* Column 3: Actions */}
        <div className="space-y-3 md:flex md:flex-col md:justify-between">
            <div> {/* Top aligned actions */}
                <Button
                    variant="primary"
                    iconLeft={<ArrowsPointingOutIcon className="h-5 w-5" />}
                    onClick={handleResizeImage}
                    disabled={isLoadingOverall || !toolState.selectedFileId || (!toolState.targetWidth && !toolState.targetHeight)}
                    isLoading={isResizing}
                    loadingText="Resizing..."
                    fullWidth
                >
                    Resize Image
                </Button>
                <Checkbox
                    label="Auto-save to Library"
                    checked={toolState.autoSaveProcessed}
                    onChange={handleAutoSaveChange}
                    disabled={isLoadingOverall}
                    id="autoSaveResizedImage"
                    className="mt-3"
                />
            </div>
            <div className="flex flex-col gap-2 items-center"> {/* Bottom aligned actions */}
                <ReceiveItdeDataTrigger
                    hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
                    pendingSignalCount={itdeTarget.pendingSignals.length}
                    onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
                />
                <div className="flex flex-wrap gap-2 justify-center w-full">
                    <OutputActionButtons
                        canPerform={canPerformActions}
                        isSaveSuccess={manualSaveSuccess || (toolState.autoSaveProcessed && processedOutputPermanent)}
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
      </div>

      {displayError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <XCircleIcon className="h-5 w-5 text-[rgb(var(--color-text-error))]" aria-hidden="true" />
          <div><strong className="font-semibold">Error:</strong> {displayError}</div>
        </div>
      )}

      {/* Previews Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">Original Image</label>
          {originalImageInfo && <p className="text-xs text-gray-500">{originalImageInfo.name} ({formatBytes(originalImageInfo.size)}) - {originalImageInfo.width}x{originalImageInfo.height}px</p>}
          <div className="w-full aspect-video border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden relative">
            {originalImagePreviewUrl ? (
              <Image src={originalImagePreviewUrl} alt={originalImageInfo?.name || 'Original'} layout="fill" objectFit="contain" unoptimized={true} />
            ) : (<span className="text-sm italic text-gray-500">Select an image</span>)}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">Resized Image</label>
          {processedImageInfo && <p className="text-xs text-gray-500">{processedImageInfo.name} ({formatBytes(processedImageInfo.size)}) - {processedImageInfo.width}x{processedImageInfo.height}px</p>}
          <div className="w-full aspect-video border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden relative">
            {isResizing && !processedImagePreviewUrl ? (
              <div className="flex flex-col items-center text-sm italic text-gray-500">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2" /> Resizing...
              </div>
            ) : processedImagePreviewUrl ? (
              <Image src={processedImagePreviewUrl} alt={processedImageInfo?.name || 'Resized'} layout="fill" objectFit="contain" unoptimized={true} />
            ) : (<span className="text-sm italic text-gray-500">Output appears here</span>)}
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