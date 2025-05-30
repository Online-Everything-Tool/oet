'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ToolMetadata as AppToolMetadata, OutputConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import {
  ArrowUpTrayIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import useGzipDecompressor, { DecompressedInfo } from '../_hooks/useGzipDecompressor';
import DecompressedFilePreview from './DecompressedFilePreview';
import { formatBytes, isTextBasedMimeType } from '@/app/lib/utils';
import toolSpecificMetadata from '../metadata.json';

interface GzipExplorerState {
  inputFileId: string | null;
  inputFileName: string | null;
  inputFileSize: number | null;
  decompressedFileOriginalName: string | null;
  decompressedFileMimeType: string | null;
  decompressedFileComment: string | null;
  decompressedFileModTime: number | null; // Store as timestamp
  decompressedFileId: string | null; // For ITDE and library reference
  processingError: string | null; // Error from useGzipDecompressor
}

const DEFAULT_GZIP_EXPLORER_STATE: GzipExplorerState = {
  inputFileId: null,
  inputFileName: null,
  inputFileSize: null,
  decompressedFileOriginalName: null,
  decompressedFileMimeType: null,
  decompressedFileComment: null,
  decompressedFileModTime: null,
  decompressedFileId: null,
  processingError: null,
};

const ownMetadata = toolSpecificMetadata as AppToolMetadata;

interface GzipFileExplorerClientProps {
  toolRoute: string;
}

export default function GzipFileExplorerClient({ toolRoute }: GzipFileExplorerClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
    clearStateAndPersist: clearToolStateAndPersist,
  } = useToolState<GzipExplorerState>(toolRoute, DEFAULT_GZIP_EXPLORER_STATE);

  const { getFile, addFile, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const decompressor = useGzipDecompressor();

  const [currentGzFile, setCurrentGzFile] = useState<StoredFile | null>(null);
  const [decompressedBlobForActions, setDecompressedBlobForActions] = useState<Blob | null>(null);
  
  const [uiError, setUiError] = useState<string | null>(null);
  const [isFileSelectionModalOpen, setIsFileSelectionModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameActionContext, setFilenameActionContext] = useState<'download' | 'save' | null>(null);
  
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [userDeferredItdePopup, setUserDeferredItdePopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const directiveName = ownMetadata.directive;

  // Effect to process file when currentGzFile changes or toolState.inputFileId changes
  useEffect(() => {
    if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) return;
    initialToolStateLoadCompleteRef.current = true;

    if (currentGzFile) {
      if (currentGzFile.id === toolState.inputFileId && decompressor.decompressedInfo && decompressor.decompressedInfo.originalGzFilename === currentGzFile.filename) {
        // Already processed this file
        return;
      }
      decompressor.decompressFile(currentGzFile);
    } else if (toolState.inputFileId && !currentGzFile && !decompressor.isLoading) {
      // Attempt to load from persisted state
      getFile(toolState.inputFileId).then(file => {
        if (file) {
          setCurrentGzFile(file);
        } else {
          setUiError(`Failed to load previously selected GZIP file (ID: ${toolState.inputFileId}). It may no longer exist.`);
          // Clear relevant parts of toolState if file not found
          setToolState(prev => ({
            ...prev,
            inputFileId: null, inputFileName: null, inputFileSize: null,
            decompressedFileId: null, decompressedFileOriginalName: null, 
            // Keep other decompressed info if it was from a different file previously? Or clear all?
            // For now, let's clear most, assuming it's tied to the inputFileId
            decompressedFileMimeType: null, decompressedFileComment: null, decompressedFileModTime: null,
            processingError: "Previous GZIP file not found."
          }));
        }
      });
    }
  }, [toolState.inputFileId, currentGzFile, getFile, decompressor.decompressFile, decompressor.isLoading, decompressor.decompressedInfo, isLoadingToolState, setToolState]);

  // Effect to update toolState when decompressor finishes
  useEffect(() => {
    if (decompressor.decompressedInfo) {
      setToolState(prev => ({
        ...prev,
        inputFileName: decompressor.decompressedInfo!.originalGzFilename, // Set from actual processed file
        // inputFileId is already set when currentGzFile is set
        decompressedFileOriginalName: decompressor.decompressedInfo!.name,
        decompressedFileMimeType: decompressor.decompressedInfo!.type,
        decompressedFileComment: decompressor.decompressedInfo!.comment || null,
        decompressedFileModTime: decompressor.decompressedInfo!.modTime?.getTime() || null,
        processingError: null,
        // decompressedFileId should be cleared if the input file changes, or set when saved.
        // If the input file is the same, we might want to keep it, but safer to clear on new decomp.
        decompressedFileId: prev.inputFileName === decompressor.decompressedInfo!.originalGzFilename ? prev.decompressedFileId : null,
      }));
      setDecompressedBlobForActions(decompressor.decompressedInfo.blob);
      setUiError(null);
    } else if (decompressor.error) {
      setToolState(prev => ({ ...prev, processingError: decompressor.error, decompressedFileId: null }));
      setDecompressedBlobForActions(null);
      setUiError(decompressor.error); // Also show in general UI error
    }
  }, [decompressor.decompressedInfo, decompressor.error, setToolState]);


  const handleFileSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsFileSelectionModalOpen(false);
    setUiError(null);
    decompressor.clearDecompressedInfo(); // Clear previous decompression results
    
    const file = files[0];
    if (file) {
      if (file.type === 'application/gzip' || file.type === 'application/x-gzip' || file.filename.toLowerCase().endsWith('.gz')) {
        const oldInputFileId = toolState.inputFileId;
        const oldDecompressedFileId = toolState.decompressedFileId;

        setCurrentGzFile(file); // This will trigger decompression effect
        setToolState(prev => ({
            ...DEFAULT_GZIP_EXPLORER_STATE, // Reset most state for new file
            inputFileId: file.id,
            inputFileSize: file.size,
            // inputFileName will be set by decompressor effect
        }));
        
        // Cleanup old files if they were temporary and different
        const idsToCleanup: string[] = [];
        if (oldInputFileId && oldInputFileId !== file.id) {
            // We don't mark input GZ files as temporary typically, but if it was, it'd be handled by library's general cleanup.
            // For now, assume input GZ is permanent or managed elsewhere.
        }
        if (oldDecompressedFileId) {
            const oldDecompressed = await getFile(oldDecompressedFileId);
            if (oldDecompressed?.isTemporary) {
                idsToCleanup.push(oldDecompressedFileId);
            }
        }
        if (idsToCleanup.length > 0) {
            cleanupOrphanedTemporaryFiles(idsToCleanup).catch(e => console.error("Cleanup failed for old temp files:", e));
        }

      } else {
        setUiError('Invalid file type. Please select a .gz file.');
      }
    }
  }, [decompressor, toolState.inputFileId, toolState.decompressedFileId, setToolState, getFile, cleanupOrphanedTemporaryFiles]);

  const handleClear = useCallback(async () => {
    const currentDecompressedId = toolState.decompressedFileId;
    decompressor.clearDecompressedInfo();
    setCurrentGzFile(null);
    setDecompressedBlobForActions(null);
    setUiError(null);
    await clearToolStateAndPersist(); // Resets to DEFAULT_GZIP_EXPLORER_STATE and saves

    if (currentDecompressedId) {
      const decompressedFile = await getFile(currentDecompressedId);
      if (decompressedFile?.isTemporary) {
        cleanupOrphanedTemporaryFiles([currentDecompressedId]).catch(e => console.error("Cleanup failed for temporary decompressed file on clear:", e));
      }
    }
    // No need to clean up inputFileId explicitly, as it's assumed to be a permanent library item or managed by user.
  }, [clearToolStateAndPersist, decompressor, toolState.decompressedFileId, getFile, cleanupOrphanedTemporaryFiles]);

  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    setUiError(null);
    decompressor.clearDecompressedInfo();
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setUiError(`Metadata not found for source: ${signal.sourceToolTitle}`);
      return;
    }
    const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
    if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
      setUiError(resolvedPayload.errorMessage || 'No data received from source.');
      return;
    }
    const receivedFileItem = resolvedPayload.data[0];
    let fileToProcess: StoredFile | null = null;

    if (receivedFileItem && (receivedFileItem.type === 'application/gzip' || receivedFileItem.type === 'application/x-gzip' || ('filename' in receivedFileItem && (receivedFileItem as StoredFile).filename.toLowerCase().endsWith('.gz')))) {
      if (!('id' in receivedFileItem)) { // InlineFile
        try {
          const tempName = `itde-received-${Date.now()}.gz`;
          const newId = await addFile(receivedFileItem.blob, tempName, receivedFileItem.type, true); // Save as temp
          fileToProcess = await getFile(newId);
          if (!fileToProcess) throw new Error('Failed to retrieve saved InlineFile for ITDE');
        } catch (e) {
          setUiError(`Failed to process incoming GZIP: ${e instanceof Error ? e.message : String(e)}`);
          return;
        }
      } else { // StoredFile
        fileToProcess = receivedFileItem as StoredFile;
      }
    } else if (receivedFileItem) {
      setUiError(`Received file from ${signal.sourceToolTitle} is not a GZIP (type: ${receivedFileItem.type}).`);
      return;
    }

    if (fileToProcess) {
      handleFileSelectedFromModal([fileToProcess]); // Re-use selection logic
      setUserDeferredItdePopup(false);
    } else {
      setUiError('No valid GZIP file found in ITDE data.');
    }
  }, [decompressor, getToolMetadata, addFile, getFile, handleFileSelectedFromModal]);

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (initialToolStateLoadCompleteRef.current && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredItdePopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [itdeTarget, userDeferredItdePopup]);

  const handleFilenameConfirm = useCallback(async (filename: string) => {
    setIsFilenameModalOpen(false);
    if (!decompressedBlobForActions || !toolState.decompressedFileOriginalName || !toolState.decompressedFileMimeType) {
      setUiError('No decompressed content available to ' + (filenameActionContext || 'process') + '.');
      return;
    }
    const action = filenameActionContext;
    setFilenameActionContext(null);

    const finalFilename = filename.trim() || toolState.decompressedFileOriginalName || 'decompressed_file';

    if (action === 'download') {
      try {
        const url = URL.createObjectURL(decompressedBlobForActions);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2000);
      } catch (err) {
        setUiError(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } else if (action === 'save') {
      try {
        const newFileId = await addFile(decompressedBlobForActions, finalFilename, toolState.decompressedFileMimeType, false, toolRoute); // Save permanently
        setToolState(prev => ({ ...prev, decompressedFileId: newFileId }));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        setUiError(`Save to library failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }, [decompressedBlobForActions, toolState, filenameActionContext, addFile, setToolState, toolRoute]);

  const initiateOutputAction = (action: 'download' | 'save') => {
    if (!decompressedBlobForActions) {
      setUiError('No decompressed content to ' + action + '.');
      return;
    }
    setFilenameActionContext(action);
    setIsFilenameModalOpen(true);
  };

  const handleCopyToClipboard = useCallback(async () => {
    if (!decompressedBlobForActions || !toolState.decompressedFileMimeType || !isTextBasedMimeType(toolState.decompressedFileMimeType)) {
      setUiError('Cannot copy: content is not text or not available.');
      return;
    }
    try {
      const text = await decompressedBlobForActions.text();
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setUiError(`Copy to clipboard failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [decompressedBlobForActions, toolState.decompressedFileMimeType]);

  const onBeforeSignalSend = useCallback(async (): Promise<boolean> => {
    if (toolState.decompressedFileId) return true; // Already in library

    if (!decompressedBlobForActions || !toolState.decompressedFileOriginalName || !toolState.decompressedFileMimeType) {
      setUiError("Decompressed file data is not ready to be sent.");
      return false;
    }
    try {
      const newId = await addFile(
        decompressedBlobForActions,
        toolState.decompressedFileOriginalName,
        toolState.decompressedFileMimeType,
        true, // Mark as temporary for ITDE
        toolRoute
      );
      const newState = { ...toolState, decompressedFileId: newId };
      setToolState(newState);
      await saveStateNow(newState); // Persist the new ID
      return true;
    } catch (err) {
      setUiError(`Failed to prepare file for sending: ${err instanceof Error ? err.message : "Unknown error"}`);
      return false;
    }
  }, [toolState, decompressedBlobForActions, addFile, setToolState, saveStateNow, toolRoute]);

  const itdeOutputItems = useMemo((): StoredFile[] => {
    if (toolState.decompressedFileId && toolState.decompressedFileOriginalName && toolState.decompressedFileMimeType && decompressedBlobForActions) {
      return [{
        id: toolState.decompressedFileId,
        filename: toolState.decompressedFileOriginalName,
        type: toolState.decompressedFileMimeType,
        size: decompressedBlobForActions.size,
        // Blob not strictly needed here as ITDE resolver fetches by ID, but good for consistency if SendToToolButton uses it.
        blob: decompressedBlobForActions, 
        createdAt: toolState.decompressedFileModTime ? new Date(toolState.decompressedFileModTime) : new Date(),
        isTemporary: true, // This is a placeholder; actual temp status is in Dexie.
      }];
    }
    return [];
  }, [toolState, decompressedBlobForActions]);

  const isLoadingOverall = isLoadingToolState || decompressor.isLoading;
  const canPerformOutputActions = !!decompressedBlobForActions && !decompressor.isLoading && !decompressor.error;

  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Gzip Explorer...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="primary"
            onClick={() => setIsFileSelectionModalOpen(true)}
            disabled={isLoadingOverall}
            iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
          >
            Select .gz File
          </Button>
          {(currentGzFile || toolState.inputFileName || uiError || toolState.processingError) && (
            <Button
              variant="danger"
              onClick={handleClear}
              disabled={isLoadingOverall}
              iconLeft={<TrashIcon className="h-5 w-5" />}
            >
              Clear
            </Button>
          )}
          <div className="ml-auto">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredItdePopup && !itdeTarget.isModalOpen}
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
          </div>
        </div>
        <div className="mt-2 text-sm text-[rgb(var(--color-text-muted))] min-h-[1.25rem]">
          {isLoadingOverall && toolState.inputFileName && <span>Processing: <em>{toolState.inputFileName}</em>...</span>}
          {!isLoadingOverall && toolState.inputFileName && <span>Loaded GZIP: <strong>{toolState.inputFileName}</strong> ({toolState.inputFileSize ? formatBytes(toolState.inputFileSize) : 'size unknown'})</span>}
          {!isLoadingOverall && !toolState.inputFileName && <span>Ready for a .gz file.</span>}
        </div>
      </div>

      {(uiError || toolState.processingError) && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div><strong className="font-semibold">Error:</strong> {uiError || toolState.processingError}</div>
        </div>
      )}

      {decompressor.decompressedInfo && !decompressor.error && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md space-y-3">
          <h3 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">Decompressed File Information:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><strong>Original Name:</strong> {toolState.decompressedFileOriginalName || 'N/A'}</div>
            <div><strong>MIME Type:</strong> {toolState.decompressedFileMimeType || 'N/A'}</div>
            <div><strong>Size:</strong> {decompressedBlobForActions ? formatBytes(decompressedBlobForActions.size) : 'N/A'}</div>
            {toolState.decompressedFileModTime && <div><strong>Mod. Time:</strong> {new Date(toolState.decompressedFileModTime).toLocaleString()}</div>}
            {toolState.decompressedFileComment && <div className="md:col-span-2"><strong>Comment:</strong> {toolState.decompressedFileComment}</div>}
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[rgb(var(--color-border-base))]">
            <Button 
              variant="neutral-outline" 
              onClick={() => setIsPreviewModalOpen(true)} 
              disabled={!canPerformOutputActions}
              iconLeft={<EyeIcon className="h-5 w-5" />}
            >
              Preview
            </Button>
            <OutputActionButtons
              canPerform={canPerformOutputActions}
              isSaveSuccess={saveSuccess}
              isCopySuccess={copySuccess}
              isDownloadSuccess={downloadSuccess}
              onInitiateSave={() => initiateOutputAction('save')}
              onInitiateDownload={() => initiateOutputAction('download')}
              onCopy={isTextBasedMimeType(toolState.decompressedFileMimeType) ? handleCopyToClipboard : undefined}
              onClear={handleClear} // This clear is for the whole tool, might be confusing here.
                                    // Let's assume OutputActionButtons' clear is for output section.
                                    // For this tool, clear means clear everything.
              directiveName={directiveName}
              outputConfig={ownMetadata.outputConfig as OutputConfig}
              selectedOutputItems={itdeOutputItems}
              canInitiateSave={!!decompressedBlobForActions}
            />
          </div>
        </div>
      )}

      <FileSelectionModal
        isOpen={isFileSelectionModalOpen}
        onClose={() => setIsFileSelectionModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".gz,application/gzip,application/x-gzip"
        selectionMode="single"
        libraryFilter={{ type: 'application/gzip' }} // Or broader if types vary
        initialTab="upload"
      />
      <DecompressedFilePreview
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        fileBlob={decompressedBlobForActions}
        fileName={toolState.decompressedFileOriginalName}
        fileMimeType={toolState.decompressedFileMimeType}
      />
      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => { setIsFilenameModalOpen(false); setFilenameActionContext(null); }}
        onConfirm={handleFilenameConfirm}
        initialFilename={toolState.decompressedFileOriginalName || 'decompressed_file'}
        title={filenameActionContext === 'download' ? 'Enter Download Filename' : 'Enter Filename for Library'}
        filenameAction={filenameActionContext || 'download'}
      />
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={(sd) => { itdeTarget.acceptSignal(sd); if (itdeTarget.pendingSignals.length -1 === 0) setUserDeferredItdePopup(false);}}
        onIgnore={(sd) => { itdeTarget.ignoreSignal(sd); if (itdeTarget.pendingSignals.length -1 === 0) setUserDeferredItdePopup(false);}}
        onDeferAll={() => { setUserDeferredItdePopup(true); itdeTarget.closeModal(); }}
        onIgnoreAll={() => { setUserDeferredItdePopup(false); itdeTarget.ignoreAllSignals(); }}
      />
    </div>
  );
}