'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import useToolState from '../../_hooks/useToolState';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useGzipDecompressor, { ParsedGzipHeader } from '../_hooks/useGzipDecompressor';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import Button from '../../_components/form/Button';
import GzipHeaderDisplay from './GzipHeaderDisplay';
import DecompressedFilePreviewModal from './DecompressedFilePreviewModal';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import { formatBytes, getMimeTypeForFile, isTextBasedMimeType } from '@/app/lib/utils';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata as AppToolMetadata } from '@/src/types/tools';
import ownToolMetadata from '../metadata.json';

import {
  ArrowUpTrayIcon,
  TrashIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  //XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  //PhotoIcon,
} from '@heroicons/react/24/outline';


interface PersistedGzipExplorerState {
  selectedGzFileId: string | null;
  selectedGzFileName: string | null;
  selectedGzFileSize: number | null;
  decompressedFileId: string | null;
  decompressedFileName: string | null;
  decompressedFileType: string | null;
  decompressedFileSize: number | null;
  gzipHeaderInfo: ParsedGzipHeader | null;
}

const DEFAULT_GZIP_EXPLORER_STATE: PersistedGzipExplorerState = {
  selectedGzFileId: null,
  selectedGzFileName: null,
  selectedGzFileSize: null,
  decompressedFileId: null,
  decompressedFileName: null,
  decompressedFileType: null,
  decompressedFileSize: null,
  gzipHeaderInfo: null,
};

const metadata = ownToolMetadata as AppToolMetadata;

interface GzipFileExplorerClientProps {
  toolRoute: string;
}

export default function GzipFileExplorerClient({ toolRoute }: GzipFileExplorerClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingPersistence,
    errorLoadingState: persistenceError,
    saveStateNow,
  } = useToolState<PersistedGzipExplorerState>(toolRoute, DEFAULT_GZIP_EXPLORER_STATE);

  const { getFile, addFile: addFileToLibrary, cleanupOrphanedTemporaryFiles/*, deleteFilePermanently*/ } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const decompressor = useGzipDecompressor();

  const [isSelectFileModalOpen, setIsSelectFileModalOpen] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'text' | 'image' | 'unsupported' | 'loading' | null>(null);
  const [previewModalError, setPreviewModalError] = useState<string | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);

  const [userDeferredItdePopup, setUserDeferredItdePopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const [currentDecompressedStoredFile, setCurrentDecompressedStoredFile] = useState<StoredFile | null>(null);

  const isLoading = isLoadingPersistence || decompressor.isLoading;
  const displayError = clientError || persistenceError || decompressor.error;

  const directiveName = metadata.directive;

  useEffect(() => {
    if (toolState.decompressedFileId && (!currentDecompressedStoredFile || currentDecompressedStoredFile.id !== toolState.decompressedFileId)) {
      getFile(toolState.decompressedFileId).then(file => {
        setCurrentDecompressedStoredFile(file || null);
      });
    } else if (!toolState.decompressedFileId && currentDecompressedStoredFile) {
      setCurrentDecompressedStoredFile(null);
    }
  }, [toolState.decompressedFileId, getFile, currentDecompressedStoredFile]);


  const handleDecompressFile = useCallback(async (gzFile: StoredFile) => {
    decompressor.clearError();
    const result = await decompressor.decompress(gzFile);
    if (result) {
      setToolState(prev => ({
        ...prev,
        decompressedFileId: result.decompressedFileId,
        decompressedFileName: result.originalFileName || (gzFile.filename.endsWith('.gz') ? gzFile.filename.slice(0,-3) : `${gzFile.filename}_decompressed`),
        decompressedFileType: result.determinedMimeType,
        decompressedFileSize: result.uncompressedSize,
        gzipHeaderInfo: result.headerInfo,
      }));
      setClientError(null);
    } else {
      // Error is handled by decompressor.error, which is part of displayError
      setToolState(prev => ({
        ...prev,
        decompressedFileId: null,
        decompressedFileName: null,
        decompressedFileType: null,
        decompressedFileSize: null,
        gzipHeaderInfo: null,
      }));
    }
  }, [decompressor, setToolState]);

  useEffect(() => {
    if (!isLoadingPersistence && !initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = true;
    }
    if (!initialToolStateLoadCompleteRef.current || isLoading) return;

    if (toolState.selectedGzFileId && !toolState.decompressedFileId && !decompressor.error && !clientError) {
      getFile(toolState.selectedGzFileId).then(file => {
        if (file) {
          handleDecompressFile(file);
        } else {
          setClientError(`Failed to load selected Gzip file (ID: ${toolState.selectedGzFileId}). It may no longer exist.`);
          // Clear related state if file not found
          setToolState(prev => ({
            ...prev,
            selectedGzFileId: null, selectedGzFileName: null, selectedGzFileSize: null,
            decompressedFileId: null, decompressedFileName: null, decompressedFileType: null,
            decompressedFileSize: null, gzipHeaderInfo: null,
          }));
        }
      });
    }
  }, [
    toolState.selectedGzFileId, 
    toolState.decompressedFileId, 
    isLoadingPersistence, 
    isLoading,
    decompressor.error,
    clientError,
    getFile, 
    handleDecompressFile,
    setToolState
  ]);

  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    setClientError(null);
    decompressor.clearError();
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setClientError(`Metadata not found for source: ${signal.sourceToolTitle}`);
      return;
    }

    const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
    if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
      setClientError(resolvedPayload.errorMessage || 'No data received from source.');
      return;
    }

    const receivedFileItem = resolvedPayload.data[0];
    let fileToProcess: StoredFile | null = null;

    const isGzipType = (type?: string, name?: string) => 
      type === 'application/gzip' || type === 'application/x-gzip' || (name && name.toLowerCase().endsWith('.gz'));

    if (receivedFileItem && isGzipType(receivedFileItem.type, (receivedFileItem as StoredFile).filename)) {
      if (!('id' in receivedFileItem)) { // InlineFile
        try {
          const tempName = `itde-received-${Date.now()}.gz`;
          const newId = await addFileToLibrary(receivedFileItem.blob, tempName, receivedFileItem.type || 'application/gzip', true);
          fileToProcess = (await getFile(newId)) || null; //Fixed the type error here
          if (!fileToProcess) throw new Error('Failed to retrieve saved InlineFile.');
        } catch (e) {
          setClientError(`Failed to process incoming Gzip: ${e instanceof Error ? e.message : String(e)}`);
          return;
        }
      } else { // StoredFile
        fileToProcess = receivedFileItem as StoredFile;
      }
    } else if (receivedFileItem) {
      setClientError(`Received file from ${signal.sourceToolTitle} is not a Gzip file.`);
      return;
    }

    if (fileToProcess) {
      const oldDecompressedFileId = toolState.decompressedFileId;
      setToolState({
        ...DEFAULT_GZIP_EXPLORER_STATE,
        selectedGzFileId: fileToProcess.id,
        selectedGzFileName: fileToProcess.filename,
        selectedGzFileSize: fileToProcess.size,
      });
      // handleDecompressFile will be triggered by useEffect watching selectedGzFileId
      if (oldDecompressedFileId) {
         cleanupOrphanedTemporaryFiles([oldDecompressedFileId]).catch(e => console.warn("Cleanup of old decompressed file failed on ITDE receive:", e));
      }
      setUserDeferredItdePopup(false);
    }
  }, [getToolMetadata, addFileToLibrary, getFile, toolState.decompressedFileId, setToolState, decompressor, cleanupOrphanedTemporaryFiles]);

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (initialToolStateLoadCompleteRef.current && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredItdePopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [itdeTarget, userDeferredItdePopup]);

  const handleFilesSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsSelectFileModalOpen(false);
    setClientError(null);
    decompressor.clearError();
    const file = files[0];
    if (file) {
      const isGzip = file.type === 'application/gzip' || file.type === 'application/x-gzip' || file.filename.toLowerCase().endsWith('.gz');
      if (isGzip) {
        const oldDecompressedFileId = toolState.decompressedFileId;
        
        setToolState({
          ...DEFAULT_GZIP_EXPLORER_STATE, // Reset most state for new file
          selectedGzFileId: file.id,
          selectedGzFileName: file.filename,
          selectedGzFileSize: file.size,
        });
        // Actual decompression will be triggered by useEffect watching selectedGzFileId
        
        if (oldDecompressedFileId) {
          // Clean up the previously decompressed file as it's now orphaned by this tool's state
          // It was temporary, so cleanupOrphanedTemporaryFiles should get it.
          cleanupOrphanedTemporaryFiles([oldDecompressedFileId]).catch(e => console.warn("Cleanup of old decompressed file failed on new selection:", e));
        }
      } else {
        setClientError('Invalid file. Please select a .gz file.');
      }
    }
  }, [toolState.decompressedFileId, setToolState, decompressor, cleanupOrphanedTemporaryFiles]);

  const handleClear = useCallback(async () => {
    setClientError(null);
    decompressor.clearError();
    const oldDecompressedFileId = toolState.decompressedFileId;
    
    setToolState(DEFAULT_GZIP_EXPLORER_STATE);
    await saveStateNow(DEFAULT_GZIP_EXPLORER_STATE);
    
    setCurrentDecompressedStoredFile(null);
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(null);
    }
    setIsPreviewModalOpen(false);

    if (oldDecompressedFileId) {
      cleanupOrphanedTemporaryFiles([oldDecompressedFileId]).catch(e => console.warn("Cleanup of old decompressed file failed on clear:", e));
    }
  }, [toolState.decompressedFileId, setToolState, saveStateNow, decompressor, previewObjectUrl, cleanupOrphanedTemporaryFiles]);

  const handlePreviewDecompressed = useCallback(async () => {
    if (!toolState.decompressedFileId) {
      setPreviewModalError("No decompressed file available to preview.");
      setIsPreviewModalOpen(true);
      return;
    }
    setPreviewModalError(null);
    setPreviewType('loading');
    setIsPreviewModalOpen(true);

    const decompFile = await getFile(toolState.decompressedFileId);
    if (!decompFile || !decompFile.blob) {
      setPreviewModalError("Failed to load decompressed file data for preview.");
      setPreviewType('unsupported');
      return;
    }

    const fileType = toolState.decompressedFileType || getMimeTypeForFile(toolState.decompressedFileName || '');
    
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl); // Clean up previous if any
    setPreviewObjectUrl(null);

    if (isTextBasedMimeType(fileType)) {
      try {
        const text = await decompFile.blob.text();
        setPreviewContent(text);
        setPreviewType('text');
      } catch (e) {
        setPreviewModalError(`Error reading text content: ${e instanceof Error ? e.message : String(e)}`);
        setPreviewType('unsupported');
      }
    } else if (fileType.startsWith('image/')) {
      const url = URL.createObjectURL(decompFile.blob);
      setPreviewObjectUrl(url);
      setPreviewContent(url);
      setPreviewType('image');
    } else {
      setPreviewType('unsupported');
    }
  }, [toolState.decompressedFileId, toolState.decompressedFileName, toolState.decompressedFileType, getFile, previewObjectUrl]);

  const closePreviewModal = useCallback(() => {
    setIsPreviewModalOpen(false);
    setPreviewContent(null);
    setPreviewType(null);
    setPreviewModalError(null);
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(null);
    }
  }, [previewObjectUrl]);

  const handleDownloadDecompressed = useCallback(async () => {
    if (!toolState.decompressedFileId || !toolState.decompressedFileName) {
      setClientError("No decompressed file available to download.");
      return;
    }
    const decompFile = await getFile(toolState.decompressedFileId);
    if (!decompFile || !decompFile.blob) {
      setClientError("Failed to load decompressed file data for download.");
      return;
    }
    try {
      const url = URL.createObjectURL(decompFile.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = toolState.decompressedFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setClientError(null);
    } catch (err) {
      setClientError(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [toolState.decompressedFileId, toolState.decompressedFileName, getFile]);
  
  const canPreview = useMemo(() => {
    if (!toolState.decompressedFileType) return false;
    return isTextBasedMimeType(toolState.decompressedFileType) || toolState.decompressedFileType.startsWith('image/');
  }, [toolState.decompressedFileType]);

  if (isLoadingPersistence && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Gzip Explorer...</p>;
  }

  return (
    <div className="space-y-4">
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
          <div className="flex gap-2 items-center">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredItdePopup && !itdeTarget.isModalOpen}
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            {(toolState.selectedGzFileId || displayError) && (
              <Button
                variant="danger"
                onClick={handleClear}
                disabled={isLoading}
                iconLeft={<TrashIcon className="h-5 w-5" />}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        {toolState.selectedGzFileName && (
          <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
            Selected: <strong>{toolState.selectedGzFileName}</strong>
            {toolState.selectedGzFileSize && ` (${formatBytes(toolState.selectedGzFileSize)})`}
          </p>
        )}
      </div>

      {displayError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div><strong className="font-semibold">Error:</strong> {displayError}</div>
        </div>
      )}

      {isLoading && !displayError && (
        <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Processing...</p>
      )}

      {!isLoading && toolState.selectedGzFileId && toolState.gzipHeaderInfo && (
        <GzipHeaderDisplay header={toolState.gzipHeaderInfo} />
      )}

      {!isLoading && toolState.decompressedFileId && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <h3 className="text-lg font-semibold text-[rgb(var(--color-text-base))] mb-2">Decompressed File:</h3>
          <div className="space-y-1 text-sm text-[rgb(var(--color-text-muted))] mb-3">
            <p>Name: <strong className="text-[rgb(var(--color-text-base))]">{toolState.decompressedFileName || 'N/A'}</strong></p>
            <p>Type: <strong className="text-[rgb(var(--color-text-base))]">{toolState.decompressedFileType || 'N/A'}</strong></p>
            <p>Size: <strong className="text-[rgb(var(--color-text-base))]">{toolState.decompressedFileSize ? formatBytes(toolState.decompressedFileSize) : 'N/A'}</strong></p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canPreview && (
              <Button variant="neutral-outline" onClick={handlePreviewDecompressed} iconLeft={<EyeIcon className="h-5 w-5" />}>
                Preview
              </Button>
            )}
            <Button variant="secondary" onClick={handleDownloadDecompressed} iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}>
              Download
            </Button>
            <SendToToolButton
              currentToolDirective={directiveName}
              currentToolOutputConfig={metadata.outputConfig}
              selectedOutputItems={currentDecompressedStoredFile ? [currentDecompressedStoredFile] : []}
            />
          </div>
        </div>
      )}
      
      {!isLoading && !toolState.selectedGzFileId && !displayError && (
         <div className="text-center py-8">
            <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-400" />
            <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
              Select a Gzip compressed file (.gz) to view its contents.
            </p>
          </div>
      )}


      <FileSelectionModal
        isOpen={isSelectFileModalOpen}
        onClose={() => setIsSelectFileModalOpen(false)}
        onFilesSelected={handleFilesSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".gz,application/gzip,application/x-gzip"
        selectionMode="single"
        libraryFilter={{ type: 'application/gzip' }} // Or more specific if possible
        initialTab="upload"
      />

      <DecompressedFilePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={closePreviewModal}
        fileName={toolState.decompressedFileName}
        previewContentUrlOrText={previewContent}
        previewType={previewType}
        error={previewModalError}
      />
      
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={(sourceDir) => { itdeTarget.acceptSignal(sourceDir); if(itdeTarget.pendingSignals.length -1 === 0) setUserDeferredItdePopup(false);}}
        onIgnore={(sourceDir) => { itdeTarget.ignoreSignal(sourceDir); if(itdeTarget.pendingSignals.length -1 === 0) setUserDeferredItdePopup(false);}}
        onDeferAll={() => { setUserDeferredItdePopup(true); itdeTarget.closeModal(); }}
        onIgnoreAll={() => { setUserDeferredItdePopup(false); itdeTarget.ignoreAllSignals(); }}
      />
    </div>
  );
}
