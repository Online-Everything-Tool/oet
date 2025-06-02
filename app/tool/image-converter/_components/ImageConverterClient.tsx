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
import { useImageConversion, ValidOutputFormat, FORMAT_TO_MIMETYPE } from '../_hooks/useImageConversion';

import importedMetadata from '../metadata.json';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';

import { PhotoIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/20/solid';

interface ImageConverterToolState {
  selectedFileId: string | null;
  processedFileId: string | null;
  outputFormat: ValidOutputFormat;
  outputQuality: number; // Stored as 0-100 for UI
  autoSaveProcessed: boolean;
  lastUserGivenFilename: string | null;
}

const DEFAULT_TOOL_STATE: ImageConverterToolState = {
  selectedFileId: null,
  processedFileId: null,
  outputFormat: 'png',
  outputQuality: 92,
  autoSaveProcessed: false,
  lastUserGivenFilename: null,
};

const metadata = importedMetadata as ToolMetadata;

const OUTPUT_FORMAT_OPTIONS: { value: ValidOutputFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WEBP' },
  { value: 'gif', label: 'GIF (Static)' },
  { value: 'bmp', label: 'BMP' },
];

interface ImageConverterClientProps {
  toolRoute: string;
}

export default function ImageConverterClient({ toolRoute }: ImageConverterClientProps) {
  const {
    state: toolState,
    setState,
    saveStateNow,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<ImageConverterToolState>(toolRoute, DEFAULT_TOOL_STATE);

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

  const { getFile, addFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const { isConverting, performConversion } = useImageConversion();

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
    const originalName = originalFilenameForDisplay || 'image';
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const extension = toolState.outputFormat;
    return `${baseName}.converted.${extension}`;
  }, [originalFilenameForDisplay, toolState.outputFormat]);

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
      const firstItem = resolvedPayload.data.find(item => item.type?.startsWith('image/') && 'id' in item);
      if (!firstItem) {
        setUiError('No valid image item found in received ITDE data.');
        return;
      }
      const newSelectedFileId = (firstItem as StoredFile).id;

      if (newSelectedFileId) {
        const oldSelectedId = toolState.selectedFileId;
        const oldProcessedId = toolState.processedFileId;
        const newState: Partial<ImageConverterToolState> = {
          selectedFileId: newSelectedFileId,
          processedFileId: null, // Force re-conversion
          lastUserGivenFilename: null,
        };
        setState(newState);
        await saveStateNow({ ...toolState, ...newState });
        setManualSaveSuccess(false);
        setDownloadAttempted(false);
        setUserDeferredAutoPopup(false);
        const destatedIds = [oldSelectedId, oldProcessedId].filter((id): id is string => !!(id && id !== newSelectedFileId));
        if (destatedIds.length > 0) {
          cleanupOrphanedTemporaryFiles(destatedIds).catch(e => console.error('[ImageConverter ITDE Accept] Cleanup call failed:', e));
        }
      }
    },
    [getToolMetadata, toolState, setState, saveStateNow, cleanupOrphanedTemporaryFiles]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingToolSettings && !initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = true;
    } else if (isLoadingToolSettings && initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = false;
    }
  }, [isLoadingToolSettings]);

  useEffect(() => {
    const canProceed = !isLoadingToolSettings && initialToolStateLoadCompleteRef.current;
    if (canProceed && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingToolSettings, itdeTarget, userDeferredAutoPopup]);

  // Load previews for original and processed images
  useEffect(() => {
    let mounted = true;
    let localOrigObjUrl: string | null = null;
    let localProcObjUrl: string | null = null;

    const loadPreviews = async () => {
      if (!mounted) return;

      // Revoke previous URLs if they exist
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
        } catch (e) { console.error("Error loading original image preview:", e); }
      }

      if (toolState.processedFileId) {
        try {
          const file = await getFile(toolState.processedFileId);
          if (mounted && file?.blob) {
            localProcObjUrl = URL.createObjectURL(file.blob);
            setProcessedImageSrcForUI(localProcObjUrl);
          }
        } catch (e) { console.error("Error loading processed image preview:", e); }
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
  }, [toolState.selectedFileId, toolState.processedFileId, getFile, isLoadingToolSettings]);


  // Auto-trigger conversion
  useEffect(() => {
    if (isLoadingToolSettings || !initialToolStateLoadCompleteRef.current || !toolState.selectedFileId || isConverting) {
      return;
    }

    // This effect triggers if selectedFileId, outputFormat, or outputQuality changes.
    // It should only run if processedFileId is null (meaning, new input or settings changed).
    if (toolState.processedFileId !== null) {
        // If processedFileId exists, we assume it's for current settings.
        // Changing settings will clear processedFileId, then this effect will run.
        return;
    }
    
    const autoConvert = async () => {
      const inputFile = await getFile(toolState.selectedFileId!);
      if (!inputFile) {
        setUiError('Selected input file not found.');
        return;
      }

      setUiError(null);
      const qualityForConversion = (toolState.outputFormat === 'jpeg' || toolState.outputFormat === 'webp')
        ? toolState.outputQuality / 100
        : undefined;

      const conversionResult = await performConversion(inputFile, toolState.outputFormat, qualityForConversion);

      if (conversionResult) {
        const outputFileName = generateDefaultOutputFilename();
        try {
          const newFileId = await addFile(
            conversionResult.blob,
            outputFileName,
            conversionResult.mimeType,
            !toolState.autoSaveProcessed // isTemporary
          );
          setState(prev => ({ ...prev, processedFileId: newFileId, lastUserGivenFilename: null }));
          setManualSaveSuccess(false);
          setDownloadAttempted(false);
        } catch (err) {
          setUiError(`Failed to save converted image: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        setUiError('Image conversion failed. The format might not be supported or the image is corrupted.');
      }
    };

    autoConvert();

  }, [
    toolState.selectedFileId, 
    toolState.outputFormat, 
    toolState.outputQuality, 
    toolState.processedFileId, // Key dependency to re-trigger if cleared
    toolState.autoSaveProcessed,
    isLoadingToolSettings, 
    isConverting, 
    getFile, 
    performConversion, 
    addFile, 
    setState, 
    generateDefaultOutputFilename
  ]);


  const handleFilesSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsLibraryModalOpen(false);
    setUiError(null);
    if (files?.[0]?.type?.startsWith('image/') && files[0].blob) {
      const newSelectedId = files[0].id;
      const oldSelectedId = toolState.selectedFileId;
      const oldProcessedId = toolState.processedFileId;

      const newState: Partial<ImageConverterToolState> = {
        selectedFileId: newSelectedId,
        processedFileId: null, // Clear to trigger re-conversion
        lastUserGivenFilename: null,
      };
      setState(newState);
      await saveStateNow({ ...toolState, ...newState }); // Save immediately after input change
      
      setManualSaveSuccess(false);
      setDownloadAttempted(false);

      const destatedIds = [oldSelectedId, oldProcessedId].filter((id): id is string => !!(id && id !== newSelectedId));
      if (destatedIds.length > 0) {
        cleanupOrphanedTemporaryFiles(destatedIds).catch(e => console.error('[ImageConverter New Selection] Cleanup failed:', e));
      }
    } else if (files?.length) {
      setUiError(`Selected file "${files[0].filename}" is not a recognized image type.`);
    }
  }, [toolState, setState, saveStateNow, cleanupOrphanedTemporaryFiles]);

  const handleSettingChange = useCallback(async (changedState: Partial<ImageConverterToolState>) => {
    const oldProcessedId = toolState.processedFileId;
    const newState = {
      ...toolState,
      ...changedState,
      processedFileId: null, // Clear to trigger re-conversion
      lastUserGivenFilename: null, // Reset filename if settings change
    };
    setState(newState);
    await saveStateNow(newState); // Save immediately after setting change

    setManualSaveSuccess(false);
    setDownloadAttempted(false);

    if (oldProcessedId) {
      cleanupOrphanedTemporaryFiles([oldProcessedId]).catch(e => console.error('[ImageConverter SettingChange] Cleanup failed:', e));
    }
  }, [toolState, setState, saveStateNow, cleanupOrphanedTemporaryFiles]);

  const handleOutputFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleSettingChange({ outputFormat: e.target.value as ValidOutputFormat });
  };

  const handleQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSettingChange({ outputQuality: parseInt(e.target.value, 10) });
  };
  
  const handleAutoSaveChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAutoSave = e.target.checked;
    setState(prev => ({ ...prev, autoSaveProcessed: newAutoSave }));
    setUiError(null);
    setManualSaveSuccess(false);

    if (newAutoSave && toolState.processedFileId && !processedOutputPermanent && !isConverting && !isManuallySaving) {
      setIsManuallySaving(true);
      try {
        const success = await makeFilePermanentAndUpdate(toolState.processedFileId);
        if (success) setProcessedOutputPermanent(true);
        else throw new Error('File could not be made permanent.');
      } catch (err) {
        setUiError(`Auto-save to permanent failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setState(prev => ({ ...prev, autoSaveProcessed: false })); // Revert if failed
      } finally {
        setIsManuallySaving(false);
      }
    }
    await saveStateNow({ ...toolState, autoSaveProcessed: newAutoSave });
  }, [toolState, processedOutputPermanent, isConverting, isManuallySaving, makeFilePermanentAndUpdate, setState, saveStateNow]);

  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;

    // Preserve autoSaveProcessed setting, reset others
    const clearedState: ImageConverterToolState = {
      ...DEFAULT_TOOL_STATE,
      autoSaveProcessed: toolState.autoSaveProcessed, 
    };
    setState(clearedState);
    await saveStateNow(clearedState);
    
    setUiError(null);
    setManualSaveSuccess(false);
    setDownloadAttempted(false);

    const destatedIds: string[] = [oldSelectedId, oldProcessedId].filter((id): id is string => !!id);
    if (destatedIds.length > 0) {
      cleanupOrphanedTemporaryFiles(destatedIds).catch(err => console.error(`[ImageConverter Clear] Cleanup call failed:`, err));
    }
  }, [toolState.autoSaveProcessed, toolState.selectedFileId, toolState.processedFileId, setState, saveStateNow, cleanupOrphanedTemporaryFiles]);

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
      setUiError(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally {
      setIsManuallySaving(false);
    }
  };

  const _internalPerformDownload = async (filename: string): Promise<boolean> => {
    if (!processedImageSrcForUI) { // Use UI source for download as it's readily available
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
    if (!toolState.processedFileId || isConverting || isManuallySaving) return;
    if (toolState.autoSaveProcessed && processedOutputPermanent) { // Already auto-saved and permanent
        setManualSaveSuccess(true); // Show success briefly
        setTimeout(() => setManualSaveSuccess(false), 1500);
        return;
    }
    const filenameToUse = toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filenameToUse);
    setFilenamePromptAction('save');
    setIsFilenamePromptOpen(true);
  };

  const initiateDownload = async () => {
    if (!toolState.processedFileId || !processedImageSrcForUI || isConverting || isManuallySaving) return;
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
  const displayError = uiError;
  const showQualitySlider = toolState.outputFormat === 'jpeg' || toolState.outputFormat === 'webp';

  const canPerformActions = !!toolState.processedFileId && !isConverting && !isManuallySaving;
  const canInitiateSaveCurrent = canPerformActions && !toolState.autoSaveProcessed && !processedOutputPermanent;

  const handleModalDeferAll = () => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); };
  const handleModalIgnoreAll = () => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); };
  const handleModalAccept = (sourceDirective: string) => { itdeTarget.acceptSignal(sourceDirective); };
  const handleModalIgnore = (sourceDirective: string) => {
    itdeTarget.ignoreSignal(sourceDirective);
    if (itdeTarget.pendingSignals.filter(s => s.sourceDirective !== sourceDirective).length === 0) setUserDeferredAutoPopup(false);
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
            disabled={isConverting || isManuallySaving}
            className="md:col-span-1"
          >
            {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
          </Button>
          <Select
            label="Output Format:"
            options={OUTPUT_FORMAT_OPTIONS}
            value={toolState.outputFormat}
            onChange={handleOutputFormatChange}
            disabled={isConverting || isManuallySaving}
            containerClassName="md:col-span-1"
          />
          {showQualitySlider && (
            <Range
              label={`Quality (${toolState.outputFormat.toUpperCase()}):`}
              min={1}
              max={100}
              step={1}
              value={toolState.outputQuality}
              onChange={handleQualityChange}
              disabled={isConverting || isManuallySaving}
              containerClassName="md:col-span-1"
            />
          )}
          {!showQualitySlider && <div className="md:col-span-1"></div>} {/* Placeholder for alignment */}
        </div>
        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-gray-200 mt-2">
          <Checkbox
            label="Auto-save converted image to Library"
            checked={toolState.autoSaveProcessed}
            onChange={handleAutoSaveChange}
            disabled={isConverting || isManuallySaving}
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
            {isConverting && !processedImageSrcForUI ? (
              <div className="flex flex-col items-center text-sm italic">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2" /> Converting...
              </div>
            ) : !isConverting && processedImageSrcForUI ? (
              <Image src={processedImageSrcForUI} alt={originalFilenameForDisplay ? `Converted ${originalFilenameForDisplay}` : 'Converted'} width={500} height={500} className="max-w-full max-h-full object-contain" unoptimized={true} />
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