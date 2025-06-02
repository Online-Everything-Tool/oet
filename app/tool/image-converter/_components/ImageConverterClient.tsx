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
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import Select from '@/app/tool/_components/form/Select';
import Range from '@/app/tool/_components/form/Range';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import useClientSideImageConverter, { ConvertedImageData } from '../_hooks/useClientSideImageConverter';

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
} from '@heroicons/react/20/solid';
import { useDebouncedCallback } from 'use-debounce';

interface ImageConverterToolState {
  selectedFileId: string | null;
  outputMimeType: string; // e.g., 'image/png', 'image/jpeg'
  quality: number; // 0-100, used for JPEG/WEBP
  processedFileId: string | null;
  autoSaveProcessed: boolean;
  lastUserGivenFilename: string | null;
}

const DEFAULT_CONVERTER_TOOL_STATE: ImageConverterToolState = {
  selectedFileId: null,
  outputMimeType: 'image/png',
  quality: 90,
  processedFileId: null,
  autoSaveProcessed: false,
  lastUserGivenFilename: null,
};

const metadata = importedMetadata as ToolMetadata;
const AUTO_PROCESS_DEBOUNCE_MS = 500;

interface ImageConverterClientProps {
  toolRoute: string;
}

const outputFormatOptions = [
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/webp', label: 'WEBP' },
];

export default function ImageConverterClient({
  toolRoute,
}: ImageConverterClientProps) {
  const {
    state: toolState,
    setState,
    saveStateNow,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<ImageConverterToolState>(
    toolRoute,
    DEFAULT_CONVERTER_TOOL_STATE
  );

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [isManuallySaving, setIsManuallySaving] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const [originalFilenameForDisplay, setOriginalFilenameForDisplay] = useState<string | null>(null);
  const [originalImageSrcForUI, setOriginalImageSrcForUI] = useState<string | null>(null);
  const [convertedImageSrcForUI, setConvertedImageSrcForUI] = useState<string | null>(null);
  
  const [processedOutputPermanent, setProcessedOutputPermanent] = useState<boolean>(false);
  const [manualSaveSuccess, setManualSaveSuccess] = useState<boolean>(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const [downloadAttempted, setDownloadAttempted] = useState<boolean>(false);

  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState<boolean>(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<'save' | 'download' | null>(null);
  const [filenamePromptInitialValue, setFilenamePromptInitialValue] = useState<string>('');

  const directiveName = metadata.directive;

  const { getFile, addFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const {
    isConverting,
    conversionError: converterHookError,
    convertedData,
    performConversion,
    clearConvertedData,
  } = useClientSideImageConverter();

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
    const originalName = originalFilenameForDisplay || 'converted-image';
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const selectedFormat = outputFormatOptions.find(opt => opt.value === toolState.outputMimeType);
    const extension = selectedFormat ? selectedFormat.label.toLowerCase() : toolState.outputMimeType.split('/')[1] || 'bin';
    return `${baseName}.${extension}`;
  }, [originalFilenameForDisplay, toolState.outputMimeType]);

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
      const firstItem = resolvedPayload.data.find(item => item.type?.startsWith('image/') && 'id' in item);
      if (firstItem) newSelectedFileId = (firstItem as StoredFile).id;
      else {
        setUiError('No valid image item found in received ITDE data.');
        return;
      }

      if (newSelectedFileId) {
        const oldSelectedId = toolState.selectedFileId;
        const oldProcessedId = toolState.processedFileId;
        const newState: Partial<ImageConverterToolState> = {
          selectedFileId: newSelectedFileId,
          processedFileId: null, 
          lastUserGivenFilename: null,
        };
        setState(newState);
        await saveStateNow({ ...toolState, ...newState });
        clearConvertedData();
        setConvertedImageSrcForUI(null);
        setManualSaveSuccess(false);
        setDownloadAttempted(false);
        setUserDeferredAutoPopup(false);
        const destatedIds = [oldSelectedId, oldProcessedId].filter((id): id is string => !!(id && id !== newSelectedFileId));
        if (destatedIds.length > 0) {
          cleanupOrphanedTemporaryFiles(destatedIds).catch(e => console.error('[ImageConverter ITDE Accept] Cleanup call failed:', e));
        }
      }
    },
    [getToolMetadata, toolState, setState, saveStateNow, clearConvertedData, cleanupOrphanedTemporaryFiles]
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

  // Load original image preview
  useEffect(() => {
    let mounted = true;
    let localOrigObjUrl: string | null = null;
    
    const loadOriginalPreview = async () => {
      if (!mounted || !toolState.selectedFileId) {
        if (originalImageSrcForUI) URL.revokeObjectURL(originalImageSrcForUI);
        setOriginalImageSrcForUI(null);
        setOriginalFilenameForDisplay(null);
        return;
      }
      try {
        const file = await getFile(toolState.selectedFileId);
        if (mounted && file?.blob) {
          if (originalImageSrcForUI) URL.revokeObjectURL(originalImageSrcForUI);
          localOrigObjUrl = URL.createObjectURL(file.blob);
          setOriginalImageSrcForUI(localOrigObjUrl);
          setOriginalFilenameForDisplay(file.filename);
        } else if (mounted) {
          if (originalImageSrcForUI) URL.revokeObjectURL(originalImageSrcForUI);
          setOriginalImageSrcForUI(null);
          setOriginalFilenameForDisplay(null);
        }
      } catch (e) {
        console.error("Error loading original image preview:", e);
        if (mounted) {
          if (originalImageSrcForUI) URL.revokeObjectURL(originalImageSrcForUI);
          setOriginalImageSrcForUI(null);
          setOriginalFilenameForDisplay(null);
        }
      }
    };

    if (!isLoadingToolSettings && initialToolStateLoadCompleteRef.current) {
      loadOriginalPreview();
    }
    
    return () => {
      mounted = false;
      if (localOrigObjUrl) URL.revokeObjectURL(localOrigObjUrl);
    };
  }, [toolState.selectedFileId, getFile, isLoadingToolSettings]);


  // Trigger conversion
  const debouncedTriggerConversion = useDebouncedCallback(async () => {
    if (isLoadingToolSettings || !initialToolStateLoadCompleteRef.current || !toolState.selectedFileId || isConverting) return;

    const inputFile = await getFile(toolState.selectedFileId);
    if (!inputFile?.blob) {
      setUiError('Original image data not found for conversion.');
      return;
    }
    
    const qualityForExport = (toolState.outputMimeType === 'image/jpeg' || toolState.outputMimeType === 'image/webp') 
      ? toolState.quality / 100 
      : undefined;

    await performConversion(inputFile, toolState.outputMimeType, qualityForExport);
  }, AUTO_PROCESS_DEBOUNCE_MS);

  useEffect(() => {
    if (toolState.selectedFileId) {
      debouncedTriggerConversion();
    } else {
      clearConvertedData();
      setConvertedImageSrcForUI(null);
      if (toolState.processedFileId) { // If no input, clear processed output from state
        setState({ processedFileId: null, lastUserGivenFilename: null });
      }
    }
  }, [toolState.selectedFileId, toolState.outputMimeType, toolState.quality, debouncedTriggerConversion, clearConvertedData, setState, toolState.processedFileId]);

  // Handle converted data from hook
  useEffect(() => {
    if (convertedData) {
      setConvertedImageSrcForUI(convertedData.dataUrl);
      setUiError(null); // Clear previous UI errors on new successful conversion
      if (toolState.autoSaveProcessed) {
        const saveConverted = async () => {
          setIsManuallySaving(true);
          try {
            const filename = toolState.lastUserGivenFilename || generateDefaultOutputFilename();
            const newFileId = await addFile(convertedData.blob, filename, convertedData.mimeType, false, toolRoute);
            setState({ processedFileId: newFileId, lastUserGivenFilename: filename });
            setProcessedOutputPermanent(true);
            setManualSaveSuccess(true);
            setTimeout(() => setManualSaveSuccess(false), 2000);
          } catch (err) {
            setUiError(`Auto-save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
          } finally {
            setIsManuallySaving(false);
          }
        };
        saveConverted();
      } else if (toolState.processedFileId) { // If not auto-saving, but there was a processedFileId, it's now stale
         const oldProcessedId = toolState.processedFileId;
         setState({ processedFileId: null, lastUserGivenFilename: null }); // Clear it
         getFile(oldProcessedId).then(file => {
           if (file && file.isTemporary) {
             cleanupOrphanedTemporaryFiles([oldProcessedId]);
           }
         });
      }
    } else {
       // If convertedData is null (e.g. after clearConvertedData or error), ensure UI reflects this
       // setConvertedImageSrcForUI(null); // This might cause flicker if error occurs during conversion
    }
    if (converterHookError) {
      setUiError(converterHookError);
      setConvertedImageSrcForUI(null); // Clear preview on error
    }
  }, [convertedData, converterHookError, toolState.autoSaveProcessed, toolState.lastUserGivenFilename, generateDefaultOutputFilename, addFile, setState, toolRoute, getFile, cleanupOrphanedTemporaryFiles, toolState.processedFileId]);


  const handleFilesSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsLibraryModalOpen(false);
    setUiError(null);
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;

    if (files?.[0]?.type?.startsWith('image/') && files[0].blob) {
      const newSelectedId = files[0].id;
      const newState: Partial<ImageConverterToolState> = {
        selectedFileId: newSelectedId,
        processedFileId: null, // New input means old output is invalid
        lastUserGivenFilename: null,
      };
      setState(newState);
      await saveStateNow({ ...toolState, ...newState });
      clearConvertedData();
      setConvertedImageSrcForUI(null);
      setManualSaveSuccess(false);
      setDownloadAttempted(false);
      
      const destatedIds = [oldSelectedId, oldProcessedId].filter((id): id is string => !!(id && id !== newSelectedId));
      if (destatedIds.length > 0) {
        cleanupOrphanedTemporaryFiles(destatedIds).catch(e => console.error('[ImageConverter New Selection] Cleanup failed:', e));
      }
    } else if (files?.length) {
      setUiError(`Selected file "${files[0].filename}" is not a recognized image type.`);
    }
  }, [toolState, setState, saveStateNow, clearConvertedData, cleanupOrphanedTemporaryFiles]);

  const handleOutputFormatChange = useCallback(async (newMimeType: string) => {
    const oldProcessedId = toolState.processedFileId;
    const newState: Partial<ImageConverterToolState> = {
      outputMimeType: newMimeType,
      processedFileId: null, // Format change invalidates old output
      lastUserGivenFilename: null,
    };
    setState(newState);
    await saveStateNow({ ...toolState, ...newState });
    clearConvertedData(); // Clear data from hook
    setConvertedImageSrcForUI(null); // Clear UI preview
    setManualSaveSuccess(false);
    setDownloadAttempted(false);
    if (oldProcessedId) {
       getFile(oldProcessedId).then(file => {
         if (file && file.isTemporary) {
           cleanupOrphanedTemporaryFiles([oldProcessedId]);
         }
       });
    }
  }, [toolState, setState, saveStateNow, clearConvertedData, getFile, cleanupOrphanedTemporaryFiles]);

  const handleQualityChange = useCallback(async (newQuality: number) => {
    const oldProcessedId = toolState.processedFileId;
    const newState: Partial<ImageConverterToolState> = {
      quality: newQuality,
      processedFileId: null, // Quality change invalidates old output
      lastUserGivenFilename: null,
    };
    setState(newState);
    await saveStateNow({ ...toolState, ...newState });
    clearConvertedData();
    setConvertedImageSrcForUI(null);
    setManualSaveSuccess(false);
    setDownloadAttempted(false);
    if (oldProcessedId) {
       getFile(oldProcessedId).then(file => {
         if (file && file.isTemporary) {
           cleanupOrphanedTemporaryFiles([oldProcessedId]);
         }
       });
    }
  }, [toolState, setState, saveStateNow, clearConvertedData, getFile, cleanupOrphanedTemporaryFiles]);
  
  const debouncedQualityChange = useDebouncedCallback(handleQualityChange, 300);


  const handleAutoSaveChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAutoSave = e.target.checked;
    setState({ autoSaveProcessed: newAutoSave });
    setUiError(null);
    setManualSaveSuccess(false);

    if (newAutoSave && convertedData && !toolState.processedFileId) { // If auto-save is enabled and we have converted data but no processedFileId
      setIsManuallySaving(true);
      try {
        const filename = toolState.lastUserGivenFilename || generateDefaultOutputFilename();
        const newFileId = await addFile(convertedData.blob, filename, convertedData.mimeType, false, toolRoute); // Save as permanent
        setState({ processedFileId: newFileId, lastUserGivenFilename: filename });
        setProcessedOutputPermanent(true);
      } catch (err) {
        setUiError(`Auto-save to permanent failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setState({ autoSaveProcessed: false }); // Revert if save fails
      } finally {
        setIsManuallySaving(false);
      }
    } else if (newAutoSave && toolState.processedFileId && !processedOutputPermanent) { // If auto-save enabled, and there is a temp processed file
        setIsManuallySaving(true);
        try {
            const success = await makeFilePermanentAndUpdate(toolState.processedFileId, toolState.lastUserGivenFilename || undefined);
            if (success) setProcessedOutputPermanent(true);
            else throw new Error('File could not be made permanent.');
        } catch (err) {
            setUiError(`Auto-save to permanent failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setState({ autoSaveProcessed: false });
        } finally {
            setIsManuallySaving(false);
        }
    }
    await saveStateNow({ ...toolState, autoSaveProcessed: newAutoSave });
  }, [toolState, convertedData, processedOutputPermanent, generateDefaultOutputFilename, addFile, makeFilePermanentAndUpdate, setState, saveStateNow, toolRoute]);

  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;
    
    const currentOutputMimeType = toolState.outputMimeType;
    const currentQuality = toolState.quality;
    const currentAutoSave = toolState.autoSaveProcessed;

    const clearedState: ImageConverterToolState = {
      ...DEFAULT_CONVERTER_TOOL_STATE,
      outputMimeType: currentOutputMimeType,
      quality: currentQuality,
      autoSaveProcessed: currentAutoSave,
    };
    setState(clearedState);
    await saveStateNow(clearedState);
    
    clearConvertedData();
    setOriginalImageSrcForUI(null);
    setOriginalFilenameForDisplay(null);
    setConvertedImageSrcForUI(null);
    setUiError(null);
    setManualSaveSuccess(false);
    setDownloadAttempted(false);

    const destatedIds: string[] = [oldSelectedId, oldProcessedId].filter((id): id is string => !!id);
    if (destatedIds.length > 0) {
      const tempFilesToClean = [];
      for (const id of destatedIds) {
        const file = await getFile(id);
        if (file && file.isTemporary) tempFilesToClean.push(id);
      }
      if (tempFilesToClean.length > 0) {
        cleanupOrphanedTemporaryFiles(tempFilesToClean).catch(err => console.error(`[ImageConverter Clear] Cleanup call failed:`, err));
      }
    }
  }, [toolState, setState, saveStateNow, clearConvertedData, getFile, cleanupOrphanedTemporaryFiles]);

  const _internalPerformSave = async (filename: string): Promise<boolean> => {
    if (!convertedData) {
      setUiError('No converted image to save.');
      return false;
    }
    setIsManuallySaving(true);
    setUiError(null);
    try {
      let fileIdToUpdate = toolState.processedFileId;
      let existingFileIsTemporary = false;
      if (fileIdToUpdate) {
          const existingFile = await getFile(fileIdToUpdate);
          if (existingFile) existingFileIsTemporary = existingFile.isTemporary === true;
          else fileIdToUpdate = null; // If file not found, treat as new add
      }

      let newFileId;
      if (fileIdToUpdate && existingFileIsTemporary) {
          // If there's an existing temporary file, update it and make it permanent
          await updateFileBlob(fileIdToUpdate, convertedData.blob, true);
          const success = await makeFilePermanentAndUpdate(fileIdToUpdate, filename);
          if (!success) throw new Error('Failed to make existing temporary file permanent.');
          newFileId = fileIdToUpdate;
      } else {
          // Otherwise, add as a new permanent file
          newFileId = await addFile(convertedData.blob, filename, convertedData.mimeType, false, toolRoute);
      }
      
      setState({ processedFileId: newFileId, lastUserGivenFilename: filename });
      setProcessedOutputPermanent(true);
      setManualSaveSuccess(true);
      setTimeout(() => setManualSaveSuccess(false), 2000);
      return true;
    } catch (err) {
      setUiError(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsManuallySaving(false);
    }
  };

  const _internalPerformDownload = async (filename: string): Promise<boolean> => {
    if (!convertedData) {
      setUiError('No image data to download.');
      return false;
    }
    const link = document.createElement('a');
    link.download = filename;
    link.href = convertedData.dataUrl; // Use dataUrl from convertedData
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadAttempted(true);
    setTimeout(() => setDownloadAttempted(false), 2000);
    return true;
  };

  const initiateSave = async () => {
    if (!convertedData || isConverting || isManuallySaving) return;
    if (toolState.autoSaveProcessed && processedOutputPermanent) { // Already auto-saved and permanent
      setManualSaveSuccess(true); // Just show success
      setTimeout(() => setManualSaveSuccess(false), 1500);
      return;
    }
    const filenameToUse = toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filenameToUse);
    setFilenamePromptAction('save');
    setIsFilenamePromptOpen(true);
  };

  const initiateDownload = async () => {
    if (!convertedData || isConverting || isManuallySaving) return;
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

    if (success) { // Persist filename only if action was successful
      const newState = { ...toolState, lastUserGivenFilename: confirmedFilename };
      setState(newState); // Update local state immediately
      await saveStateNow(newState); // Persist to Dexie
    }
  };

  const imageFilter = useMemo(() => ({ category: 'image' as const }), []);
  const displayError = converterHookError || uiError;
  const isLoadingOverall = isConverting || isManuallySaving || isLoadingToolSettings;

  const canPerformActions = !!convertedData && !isConverting && !isManuallySaving;
  const canInitiateSaveCurrent = !!convertedData && !toolState.autoSaveProcessed && !processedOutputPermanent && !isConverting && !isManuallySaving;

  const handleModalDeferAll = () => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); };
  const handleModalIgnoreAll = () => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); };
  const handleModalAccept = (sourceDirective: string) => { itdeTarget.acceptSignal(sourceDirective); };
  const handleModalIgnore = (sourceDirective: string) => {
    itdeTarget.ignoreSignal(sourceDirective);
    const remaining = itdeTarget.pendingSignals.filter(s => s.sourceDirective !== sourceDirective);
    if (remaining.length === 0) setUserDeferredAutoPopup(false);
  };

  if (isLoadingToolSettings && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-gray-500 animate-pulse">Loading Image Converter...</p>;
  }

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Button
            variant="accent2"
            iconLeft={<PhotoIcon className="h-5 w-5" />}
            onClick={() => setIsLibraryModalOpen(true)}
            disabled={isLoadingOverall}
            className="md:col-span-1"
          >
            {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
          </Button>
          <Select
            label="Output Format:"
            options={outputFormatOptions}
            value={toolState.outputMimeType}
            onChange={(e) => handleOutputFormatChange(e.target.value)}
            disabled={isLoadingOverall}
            containerClassName="md:col-span-1"
          />
          {(toolState.outputMimeType === 'image/jpeg' || toolState.outputMimeType === 'image/webp') && (
            <Range
              label={`Quality (${toolState.quality})`}
              min={0}
              max={100}
              step={1}
              value={toolState.quality}
              onChange={(e) => debouncedQualityChange(Number(e.target.value))}
              disabled={isLoadingOverall}
              containerClassName="md:col-span-1"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-gray-200 mt-2">
          <Checkbox
            label="Auto-save converted image to Library"
            checked={toolState.autoSaveProcessed}
            onChange={handleAutoSaveChange}
            disabled={isLoadingOverall}
            id="autoSaveConvertedImage"
          />
          <div className="flex gap-2 ml-auto items-center">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
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
            ) : (<span className="text-sm italic">Select an image</span>)}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Converted Image {processedOutputPermanent && processedStoredFileForItde?.filename && <span className="font-normal text-xs">({processedStoredFileForItde.filename})</span>}
          </label>
          <div className="w-full aspect-square border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {isConverting && !convertedImageSrcForUI ? (
              <div className="flex flex-col items-center text-sm italic">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2" /> Converting...
              </div>
            ) : !isConverting && convertedImageSrcForUI ? (
              <Image src={convertedImageSrcForUI} alt={originalFilenameForDisplay ? `Converted ${originalFilenameForDisplay}` : 'Converted'} width={500} height={500} className="max-w-full max-h-full object-contain" unoptimized={true} />
            ) : (!isConverting && <span className="text-sm italic">Output appears here</span>)}
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
        onClose={() => { setIsFilenamePromptOpen(false); setFilenamePromptAction(null); }}
        onConfirm={handleConfirmFilename}
        initialFilename={filenamePromptInitialValue}
        title={filenamePromptAction === 'save' ? 'Save Converted Image to Library' : 'Download Converted Image'}
        confirmButtonText={filenamePromptAction === 'save' ? 'Save to Library' : 'Download'}
        filenameAction={filenamePromptAction || undefined}
      />
    </div>
  );
}