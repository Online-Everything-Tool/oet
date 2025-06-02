'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import useGzipDecompressor from '../_hooks/useGzipDecompressor';
import Button from '../../_components/form/Button';
import Textarea from '../../_components/form/Textarea';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { useMetadata } from '@/app/context/MetadataContext';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import { formatBytes, getMimeTypeForFile } from '@/app/lib/utils';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata as AppToolMetadata, OutputConfig } from '@/src/types/tools';
import toolSpecificMetadata from '../metadata.json';
import { ArrowUpTrayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ownMetadata = toolSpecificMetadata as AppToolMetadata;

interface GzipExplorerState {
  selectedGzFileId: string | null;
  selectedGzFileName: string | null;
  selectedGzFileSize: number | null;
  
  decompressedDataArrayBuffer: ArrayBuffer | null; 
  decompressedOriginalFileName: string | null; 
  derivedOutputFileName: string | null; 
  
  decompressedFileId: string | null; 
}

const DEFAULT_GZIP_EXPLORER_STATE: GzipExplorerState = {
  selectedGzFileId: null,
  selectedGzFileName: null,
  selectedGzFileSize: null,
  decompressedDataArrayBuffer: null,
  decompressedOriginalFileName: null,
  derivedOutputFileName: null,
  decompressedFileId: null,
};

interface GzipFileExplorerClientProps {
  toolRoute: string;
}

export default function GzipFileExplorerClient({ toolRoute }: GzipFileExplorerClientProps) {
  const { getFile, addFile, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { decompressFile, isDecompressing, decompressionError: hookDecompressionError } = useGzipDecompressor();
  const { getToolMetadata } = useMetadata();

  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
  } = useToolState<GzipExplorerState>(toolRoute, DEFAULT_GZIP_EXPLORER_STATE);

  const [uiError, setUiError] = useState<string | null>(null);
  const [isSelectFileModalOpen, setIsSelectFileModalOpen] = useState(false);
  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState(false);
  const [filenameAction, setFilenameAction] = useState<'download' | 'save' | null>(null);
  
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [isBinaryContent, setIsBinaryContent] = useState<boolean>(false);

  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const currentGzFileRef = useRef<StoredFile | null>(null);

  const directiveName = ownMetadata.directive;

  useEffect(() => {
    setUiError(hookDecompressionError);
  }, [hookDecompressionError]);

  const processDecompressedData = useCallback((data: Uint8Array | null) => {
    if (!data) {
      setTextPreview(null);
      setIsBinaryContent(false);
      return;
    }
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const str = decoder.decode(data);
      setTextPreview(str);
      setIsBinaryContent(false);
    } catch (e) {
      setTextPreview(null);
      setIsBinaryContent(true);
    }
  }, []);

  useEffect(() => {
    if (toolState.decompressedDataArrayBuffer) {
      processDecompressedData(new Uint8Array(toolState.decompressedDataArrayBuffer));
    } else {
      setTextPreview(null);
      setIsBinaryContent(false);
    }
  }, [toolState.decompressedDataArrayBuffer, processDecompressedData]);

  const processSelectedGzFile = useCallback(async (fileToProcess: StoredFile) => {
    setUiError(null);
    const result = await decompressFile(fileToProcess);
    
    let newDerivedName = toolState.derivedOutputFileName;
    if (result.originalFilename) {
       newDerivedName = result.originalFilename;
    } else if (fileToProcess.filename) {
      newDerivedName = fileToProcess.filename.replace(/\.gz$/i, '');
    } else {
      newDerivedName = 'decompressed_file';
    }

    setToolState(prev => ({
      ...prev,
      decompressedDataArrayBuffer: result.content ? result.content.buffer.slice(0) : null, // Ensure new ArrayBuffer instance
      decompressedOriginalFileName: result.originalFilename,
      derivedOutputFileName: newDerivedName,
      decompressedFileId: null, // New .gz file, so old decompressed file ID is invalid
    }));

    if (toolState.decompressedFileId) {
       cleanupOrphanedTemporaryFiles([toolState.decompressedFileId]).catch(e => console.error("Error cleaning up old decompressed file:", e));
    }

  }, [decompressFile, setToolState, toolState.derivedOutputFileName, toolState.decompressedFileId, cleanupOrphanedTemporaryFiles]);

  useEffect(() => {
    if (!isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = true;
    }
    if (isLoadingToolState || !initialToolStateLoadCompleteRef.current || isDecompressing) return;

    if (toolState.selectedGzFileId && (!currentGzFileRef.current || currentGzFileRef.current.id !== toolState.selectedGzFileId)) {
      getFile(toolState.selectedGzFileId).then(file => {
        if (file) {
          currentGzFileRef.current = file;
          processSelectedGzFile(file);
        } else {
          setUiError(`Failed to load .gz file (ID: ${toolState.selectedGzFileId}). It may no longer exist.`);
          handleClear(false); // Don't clear selectedGzFileId, just the processed data
        }
      }).catch(err => {
        setUiError(`Error loading .gz file: ${err.message}`);
        handleClear(false);
      });
    }
  }, [toolState.selectedGzFileId, isLoadingToolState, isDecompressing, getFile, processSelectedGzFile]);


  const handleFileSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsSelectFileModalOpen(false);
    if (files.length === 0) return;
    const file = files[0];
    if (!file.blob) {
      setUiError(`Error: File "${file.filename}" has no content.`);
      return;
    }
    if (file.type === 'application/gzip' || file.type === 'application/x-gzip' || file.filename.toLowerCase().endsWith('.gz')) {
      currentGzFileRef.current = file;
      const oldDecompressedFileId = toolState.decompressedFileId;
      setToolState(prev => ({
        ...DEFAULT_GZIP_EXPLORER_STATE, // Reset most things
        selectedGzFileId: file.id,
        selectedGzFileName: file.filename,
        selectedGzFileSize: file.size,
      }));
      if(oldDecompressedFileId){
        cleanupOrphanedTemporaryFiles([oldDecompressedFileId]);
      }
    } else {
      setUiError('Invalid file. Please select a .gz file.');
    }
  }, [setToolState, toolState.decompressedFileId, cleanupOrphanedTemporaryFiles]);

  const handleClear = useCallback(async (clearFullState = true) => {
    const idsToCleanup = [];
    if (toolState.decompressedFileId) idsToCleanup.push(toolState.decompressedFileId);
    if (clearFullState && toolState.selectedGzFileId) idsToCleanup.push(toolState.selectedGzFileId);

    currentGzFileRef.current = null;
    setToolState(clearFullState ? DEFAULT_GZIP_EXPLORER_STATE : {
      ...toolState,
      decompressedDataArrayBuffer: null,
      decompressedOriginalFileName: null,
      derivedOutputFileName: null,
      decompressedFileId: null,
    });
    if(clearFullState) await saveStateNow(DEFAULT_GZIP_EXPLORER_STATE);
    
    setTextPreview(null);
    setIsBinaryContent(false);
    setUiError(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);

    if (idsToCleanup.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToCleanup).catch(e => console.error("Error during cleanup on clear:", e));
    }
  }, [toolState, setToolState, saveStateNow, cleanupOrphanedTemporaryFiles]);

  const handleFilenameConfirm = useCallback(async (filename: string) => {
    setIsFilenamePromptOpen(false);
    if (!toolState.decompressedDataArrayBuffer) {
      setUiError('No decompressed data available.');
      return;
    }

    const finalFilename = filename.trim() || toolState.derivedOutputFileName || 'decompressed_file';
    setToolState(prev => ({ ...prev, derivedOutputFileName: finalFilename }));

    const blob = new Blob([toolState.decompressedDataArrayBuffer], { type: getMimeTypeForFile(finalFilename) });

    if (filenameAction === 'download') {
      try {
        const url = URL.createObjectURL(blob);
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
    } else if (filenameAction === 'save') {
      try {
        const newFileId = await addFile(blob, finalFilename, blob.type, false, toolRoute);
        setToolState(prev => ({ ...prev, decompressedFileId: newFileId }));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        setUiError(`Save to library failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    setFilenameAction(null);
  }, [filenameAction, toolState, addFile, setToolState, toolRoute]);

  const initiateOutputAction = useCallback((action: 'download' | 'save') => {
    if (!toolState.decompressedDataArrayBuffer) {
      setUiError(`No content to ${action}.`);
      return;
    }
    setFilenameAction(action);
    setIsFilenamePromptOpen(true);
  }, [toolState.decompressedDataArrayBuffer]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!textPreview) {
      setUiError('No text content to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(textPreview);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setUiError('Failed to copy to clipboard.');
    }
  }, [textPreview]);

  const onBeforeSignalForSendTo = useCallback(async (): Promise<boolean> => {
    if (!toolState.decompressedDataArrayBuffer) {
      setUiError('No decompressed data to send.');
      return false;
    }
    if (toolState.decompressedFileId) { // Already saved
      const file = await getFile(toolState.decompressedFileId);
      if (file) return true; // Exists and is fine
    }

    // Needs to be saved (temporarily or permanently)
    const filename = toolState.derivedOutputFileName || toolState.decompressedOriginalFileName || 'decompressed_output';
    const mimeType = getMimeTypeForFile(filename);
    const blob = new Blob([toolState.decompressedDataArrayBuffer], { type: mimeType });
    
    try {
      const newFileId = await addFile(blob, filename, mimeType, true, toolRoute); // Save as temporary for ITDE
      setToolState(prev => ({ ...prev, decompressedFileId: newFileId }));
      // Crucially, save this new ID to Dexie *now* so the receiving tool can find it.
      await saveStateNow({...toolState, decompressedFileId: newFileId});
      return true;
    } catch (err) {
      setUiError(`Failed to prepare data for sending: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    }
  }, [toolState, addFile, getFile, setToolState, saveStateNow, toolRoute]);


  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    setUiError(null);
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
    if (receivedFileItem && ('id' in receivedFileItem) && (receivedFileItem.type === 'application/gzip' || receivedFileItem.type === 'application/x-gzip' || (receivedFileItem as StoredFile).filename.toLowerCase().endsWith('.gz'))) {
      currentGzFileRef.current = receivedFileItem as StoredFile;
      const oldDecompressedFileId = toolState.decompressedFileId;
      setToolState(prev => ({
        ...DEFAULT_GZIP_EXPLORER_STATE,
        selectedGzFileId: (receivedFileItem as StoredFile).id,
        selectedGzFileName: (receivedFileItem as StoredFile).filename,
        selectedGzFileSize: (receivedFileItem as StoredFile).size,
      }));
      if(oldDecompressedFileId){
        cleanupOrphanedTemporaryFiles([oldDecompressedFileId]);
      }
      setUserDeferredAutoPopup(false);
    } else {
      setUiError(`Received file from ${signal.sourceToolTitle} is not a Gzip file.`);
    }
  }, [getToolMetadata, setToolState, toolState.decompressedFileId, cleanupOrphanedTemporaryFiles]);

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (initialToolStateLoadCompleteRef.current && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [itdeTarget, userDeferredAutoPopup]);
  
  const handleModalDeferAll = () => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); };
  const handleModalIgnoreAll = () => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); };
  const handleModalAccept = (sd: string) => { itdeTarget.acceptSignal(sd); if (itdeTarget.pendingSignals.length -1 === 0) setUserDeferredAutoPopup(false); };
  const handleModalIgnore = (sd: string) => { itdeTarget.ignoreSignal(sd); if (itdeTarget.pendingSignals.length -1 === 0) setUserDeferredAutoPopup(false); };

  const isLoading = isLoadingToolState || isDecompressing;
  const canPerformOutputActions = !!toolState.decompressedDataArrayBuffer && !uiError && !isDecompressing;

  const selectedOutputItemsForITDE = useMemo(() => {
    if (toolState.decompressedFileId) {
      // This is a placeholder structure. `useItdeDiscovery` will use the ID to fetch the actual file.
      return [{ id: toolState.decompressedFileId, filename: toolState.derivedOutputFileName || 'file', type: 'application/octet-stream', size: 0, blob: new Blob(), createdAt: new Date() }];
    }
    return [];
  }, [toolState.decompressedFileId, toolState.derivedOutputFileName]);


  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-gray-500 animate-pulse">Loading Gzip Explorer...</p>;
  }

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <Button
            variant="primary"
            onClick={() => setIsSelectFileModalOpen(true)}
            disabled={isLoading}
            iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
          >
            Select .gz File
          </Button>
          <ReceiveItdeDataTrigger
            hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
            pendingSignalCount={itdeTarget.pendingSignals.length}
            onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
          />
        </div>
        {toolState.selectedGzFileName && (
          <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
            Selected: <strong>{toolState.selectedGzFileName}</strong>
            {toolState.selectedGzFileSize ? ` (${formatBytes(toolState.selectedGzFileSize)})` : ''}
          </p>
        )}
      </div>

      {isDecompressing && (
        <p className="text-center p-4 italic text-gray-500 animate-pulse">Decompressing...</p>
      )}

      {uiError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div><strong className="font-semibold">Error:</strong> {uiError}</div>
        </div>
      )}

      {toolState.decompressedDataArrayBuffer && !isDecompressing && (
        <>
          <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
            <h3 className="text-md font-semibold mb-2">Decompressed Content:</h3>
            {toolState.decompressedOriginalFileName && (
              <p className="text-sm text-[rgb(var(--color-text-muted))] mb-1">
                Original name (from Gzip header): <strong>{toolState.decompressedOriginalFileName}</strong>
              </p>
            )}
            <p className="text-sm text-[rgb(var(--color-text-muted))] mb-2">
              Size: {formatBytes(toolState.decompressedDataArrayBuffer.byteLength)}
            </p>
            {textPreview && !isBinaryContent && (
              <Textarea
                label="Text Preview"
                labelClassName="sr-only"
                value={textPreview}
                readOnly
                rows={10}
                textareaClassName="text-sm font-mono bg-[rgb(var(--color-bg-subtle))]"
                onClick={(e) => e.currentTarget.select()}
              />
            )}
            {isBinaryContent && (
              <div className="p-3 bg-[rgb(var(--color-bg-subtle))] rounded text-sm">
                Content appears to be binary. Download to view with an appropriate application.
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 items-center p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
            <OutputActionButtons
              canPerform={canPerformOutputActions}
              isSaveSuccess={saveSuccess}
              isCopySuccess={copySuccess}
              isDownloadSuccess={downloadSuccess}
              onInitiateSave={() => initiateOutputAction('save')}
              onInitiateDownload={() => initiateOutputAction('download')}
              onCopy={textPreview && !isBinaryContent ? handleCopyToClipboard : undefined}
              onClear={() => handleClear(true)}
              directiveName={directiveName}
              outputConfig={ownMetadata.outputConfig as OutputConfig}
              selectedOutputItems={selectedOutputItemsForITDE}
            />
             <SendToToolButton
                currentToolDirective={directiveName}
                currentToolOutputConfig={ownMetadata.outputConfig as OutputConfig}
                selectedOutputItems={selectedOutputItemsForITDE}
                onBeforeSignal={onBeforeSignalForSendTo}
                buttonText="Send To..."
                className={!canPerformOutputActions ? "opacity-50 cursor-not-allowed" : ""}
              />
          </div>
        </>
      )}
      
      {!toolState.selectedGzFileId && !isDecompressing && !uiError && (
         <p className="p-4 text-lg text-center text-gray-400 italic">
            Select a .gz file to begin exploring.
          </p>
      )}

      <FileSelectionModal
        isOpen={isSelectFileModalOpen}
        onClose={() => setIsSelectFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".gz,application/gzip,application/x-gzip"
        selectionMode="single"
        libraryFilter={{ type: 'application/gzip' }}
        initialTab="upload"
      />
      <FilenamePromptModal
        isOpen={isFilenamePromptOpen}
        onClose={() => { setIsFilenamePromptOpen(false); setFilenameAction(null); }}
        onConfirm={handleFilenameConfirm}
        initialFilename={toolState.derivedOutputFileName || toolState.decompressedOriginalFileName || 'decompressed_file'}
        title={filenameAction === 'download' ? 'Enter Download Filename' : 'Enter Filename for Library'}
        filenameAction={filenameAction || 'download'}
      />
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={handleModalAccept}
        onIgnore={handleModalIgnore}
        onDeferAll={handleModalDeferAll}
        onIgnoreAll={handleModalIgnoreAll}
      />
    </div>
  );
}