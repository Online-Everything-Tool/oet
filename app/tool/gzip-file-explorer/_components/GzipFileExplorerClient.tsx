'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import { useGzipDecompressor } from '../_hooks/useGzipDecompressor';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { StoredFile } from '@/src/types/storage';
import {
  formatBytesCompact,
  getMimeTypeForFile,
  PREVIEWABLE_TEXT_EXTENSIONS,
  PREVIEWABLE_IMAGE_EXTENSIONS,
} from '@/app/lib/utils';
import {
  ArrowUpTrayIcon,
  TrashIcon,
  XCircleIcon,
  EyeIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import toolSpecificMetadata from '../metadata.json';
import type { ToolMetadata as AppToolMetadata } from '@/src/types/tools';

const ownMetadata = toolSpecificMetadata as AppToolMetadata;

interface GzipExplorerState {
  selectedGzipFileId: string | null;
  decompressedFileId: string | null;
}

const DEFAULT_STATE: GzipExplorerState = {
  selectedGzipFileId: null,
  decompressedFileId: null,
};

const MAX_TEXT_PREVIEW_SIZE = 1024 * 256; // 256KB

export default function GzipFileExplorerClient({ toolRoute }: { toolRoute: string }) {
  const {
    state: persistentState,
    setState: setPersistentState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
  } = useToolState<GzipExplorerState>(toolRoute, DEFAULT_STATE);

  const { getFile, addFile, cleanupOrphanedTemporaryFiles, makeFilePermanentAndUpdate } = useFileLibrary();
  const gzipDecompressor = useGzipDecompressor();
  const { getToolMetadata } = useMetadata();

  const [selectedGzipFileObject, setSelectedGzipFileObject] = useState<StoredFile | null>(null);
  const [decompressedFileObject, setDecompressedFileObject] = useState<StoredFile | null>(null);
  const [gzipHeaderInfo, setGzipHeaderInfo] = useState<{originalFilename?: string, modificationTime?: Date, comment?: string} | null>(null);

  const [isSelectFileModalOpen, setIsSelectFileModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'text' | 'image' | 'unsupported' | 'loading' | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFilename, setPreviewModalFilename] = useState<string | null>(null);
  
  const [isFilenamePromptModalOpen, setIsFilenamePromptModalOpen] = useState(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<'download' | 'save' | null>(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] = useState('');

  const [clientError, setClientError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const directiveName = ownMetadata.directive;

  // Effect to load StoredFile objects based on IDs from persistent state
  useEffect(() => {
    if (isLoadingToolState) return;
    if (!initialToolStateLoadCompleteRef.current) initialToolStateLoadCompleteRef.current = true;

    if (persistentState.selectedGzipFileId) {
      if (!selectedGzipFileObject || selectedGzipFileObject.id !== persistentState.selectedGzipFileId) {
        getFile(persistentState.selectedGzipFileId).then(file => {
          if (file) setSelectedGzipFileObject(file);
          else { // File ID in state but not found in DB
            setClientError(`Previously selected Gzip file (ID: ${persistentState.selectedGzipFileId}) not found. Please select a new file.`);
            handleClearAll(false); // Clear state but don't try to delete non-existent file
          }
        });
      }
    } else {
      setSelectedGzipFileObject(null);
    }

    if (persistentState.decompressedFileId) {
       if (!decompressedFileObject || decompressedFileObject.id !== persistentState.decompressedFileId) {
        getFile(persistentState.decompressedFileId).then(file => {
          if (file) setDecompressedFileObject(file);
          // If not found, it might be an old ID, will be overwritten or cleared
        });
      }
    } else {
      setDecompressedFileObject(null);
    }
  }, [persistentState.selectedGzipFileId, persistentState.decompressedFileId, getFile, isLoadingToolState, selectedGzipFileObject, decompressedFileObject]);

  // Effect to trigger decompression when selectedGzipFileObject is set
  useEffect(() => {
    if (selectedGzipFileObject && selectedGzipFileObject.blob) {
      if (!decompressedFileObject || selectedGzipFileObject.id !== persistentState.selectedGzipFileId || 
          (decompressedFileObject && decompressedFileObject.toolRoute !== selectedGzipFileObject.id)) { // Check if decompressed file belongs to current gzip
        setClientError(null);
        gzipDecompressor.decompressFile(new File([selectedGzipFileObject.blob], selectedGzipFileObject.filename, { type: selectedGzipFileObject.type }));
      }
    } else if (!persistentState.selectedGzipFileId) { // If no Gzip file is selected (e.g. after clear)
        gzipDecompressor.clear();
        setDecompressedFileObject(null);
        setGzipHeaderInfo(null);
        if(persistentState.decompressedFileId) {
            setPersistentState(prev => ({...prev, decompressedFileId: null}));
        }
    }
  }, [selectedGzipFileObject, persistentState.selectedGzipFileId, gzipDecompressor, setDecompressedFileObject, setGzipHeaderInfo, setPersistentState]);


  // Effect to handle result from useGzipDecompressor
  useEffect(() => {
    if (gzipDecompressor.isLoading) return;

    if (gzipDecompressor.error) {
      setClientError(`Decompression error: ${gzipDecompressor.error}`);
      if (persistentState.decompressedFileId) { // If there was an old decompressed file, clear its ID
        const oldDecompressedId = persistentState.decompressedFileId;
        setPersistentState(prev => ({ ...prev, decompressedFileId: null }));
        cleanupOrphanedTemporaryFiles([oldDecompressedId]);
      }
      setDecompressedFileObject(null);
      setGzipHeaderInfo(null);
      return;
    }

    if (gzipDecompressor.result && selectedGzipFileObject) {
      const { decompressedBuffer, originalFilename: headerFilename, modificationTime, comment } = gzipDecompressor.result;
      setGzipHeaderInfo({ originalFilename: headerFilename, modificationTime, comment });

      const derivedFilename = headerFilename || selectedGzipFileObject.filename.replace(/\.gz$/i, '') || 'decompressed_file';
      const mimeType = getMimeTypeForFile(derivedFilename);
      const blob = new Blob([decompressedBuffer], { type: mimeType });

      // Cleanup old decompressed file if it exists and is different
      const oldDecompressedId = persistentState.decompressedFileId;
      
      addFile(blob, derivedFilename, mimeType, true, selectedGzipFileObject.id) // Mark as temporary, link to parent gzip via toolRoute
        .then(newId => {
          setPersistentState(prev => ({ ...prev, decompressedFileId: newId }));
          if (oldDecompressedId && oldDecompressedId !== newId) {
            cleanupOrphanedTemporaryFiles([oldDecompressedId]);
          }
        })
        .catch(err => {
          setClientError(`Failed to store decompressed file: ${err.message}`);
          setDecompressedFileObject(null);
        });
    }
  }, [gzipDecompressor.result, gzipDecompressor.error, gzipDecompressor.isLoading, selectedGzipFileObject, addFile, setPersistentState, cleanupOrphanedTemporaryFiles, persistentState.decompressedFileId]);

  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    setClientError(null);
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
    if (receivedFileItem && (receivedFileItem.type === 'application/gzip' || receivedFileItem.type === 'application/x-gzip' || ('filename' in receivedFileItem && (receivedFileItem as StoredFile).filename.toLowerCase().endsWith('.gz')))) {
      let fileToProcess: StoredFile;
      if (!('id'in receivedFileItem)) { // InlineFile
        const tempName = `itde-received-${Date.now()}.gz`;
        const newId = await addFile(receivedFileItem.blob, tempName, receivedFileItem.type, true);
        const fetched = await getFile(newId);
        if (!fetched) throw new Error("Failed to retrieve saved InlineFile for ITDE");
        fileToProcess = fetched;
      } else { // StoredFile
        fileToProcess = receivedFileItem as StoredFile;
      }
      
      // Cleanup previous files before setting new one
      const oldSelectedId = persistentState.selectedGzipFileId;
      const oldDecompressedId = persistentState.decompressedFileId;
      const idsToCleanup = [oldSelectedId, oldDecompressedId].filter(Boolean) as string[];
      
      setPersistentState({ selectedGzipFileId: fileToProcess.id, decompressedFileId: null });
      await saveStateNow({ selectedGzipFileId: fileToProcess.id, decompressedFileId: null });
      
      if (idsToCleanup.length > 0) {
        cleanupOrphanedTemporaryFiles(idsToCleanup);
      }
      setUserDeferredAutoPopup(false);

    } else {
      setClientError(`Received file from ${signal.sourceToolTitle} is not a Gzip file.`);
    }
  }, [getToolMetadata, addFile, getFile, setPersistentState, saveStateNow, cleanupOrphanedTemporaryFiles, persistentState.selectedGzipFileId, persistentState.decompressedFileId]);

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (initialToolStateLoadCompleteRef.current && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [itdeTarget, userDeferredAutoPopup, directiveName]);

  const handleClearAll = useCallback(async (performCleanup = true) => {
    const idsToCleanup: string[] = [];
    if (performCleanup) {
        if (persistentState.selectedGzipFileId) idsToCleanup.push(persistentState.selectedGzipFileId);
        if (persistentState.decompressedFileId) idsToCleanup.push(persistentState.decompressedFileId);
    }

    gzipDecompressor.clear();
    setSelectedGzipFileObject(null);
    setDecompressedFileObject(null);
    setGzipHeaderInfo(null);
    setClientError(null);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    
    setPersistentState(DEFAULT_STATE);
    await saveStateNow(DEFAULT_STATE);

    if (idsToCleanup.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToCleanup);
    }
  }, [persistentState, gzipDecompressor, setPersistentState, saveStateNow, cleanupOrphanedTemporaryFiles]);

  const handleFileSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsSelectFileModalOpen(false);
    if (files.length === 0) return;
    const file = files[0];
    if (file.type === 'application/gzip' || file.type === 'application/x-gzip' || file.filename.toLowerCase().endsWith('.gz')) {
      const oldSelectedId = persistentState.selectedGzipFileId;
      const oldDecompressedId = persistentState.decompressedFileId;
      const idsToCleanup = [oldSelectedId, oldDecompressedId].filter(Boolean) as string[];

      setPersistentState({ selectedGzipFileId: file.id, decompressedFileId: null });
      // No need for saveStateNow here, useEffect for selectedGzipFileObject will trigger processing and state save
      
      if (idsToCleanup.length > 0 && !idsToCleanup.includes(file.id)) {
         cleanupOrphanedTemporaryFiles(idsToCleanup);
      }
    } else {
      setClientError('Invalid file type. Please select a .gz file.');
    }
  }, [persistentState, setPersistentState, cleanupOrphanedTemporaryFiles]);

  const handleDownloadDecompressed = useCallback(() => {
    if (!decompressedFileObject || !decompressedFileObject.blob) {
      setClientError('No decompressed file to download.');
      return;
    }
    setFilenamePromptAction('download');
    setSuggestedFilenameForPrompt(decompressedFileObject.filename);
    setIsFilenamePromptModalOpen(true);
  }, [decompressedFileObject]);

  const handleSaveDecompressedToLibrary = useCallback(() => {
    if (!decompressedFileObject) {
      setClientError('No decompressed file to save.');
      return;
    }
    setFilenamePromptAction('save');
    setSuggestedFilenameForPrompt(decompressedFileObject.filename);
    setIsFilenamePromptModalOpen(true);
  }, [decompressedFileObject]);

  const handleFilenamePromptConfirm = useCallback(async (filename: string) => {
    setIsFilenamePromptModalOpen(false);
    if (!decompressedFileObject || !decompressedFileObject.blob) return;

    const finalFilename = filename.trim() || decompressedFileObject.filename;

    if (filenamePromptAction === 'download') {
      const url = URL.createObjectURL(decompressedFileObject.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } else if (filenamePromptAction === 'save') {
      try {
        await makeFilePermanentAndUpdate(decompressedFileObject.id, finalFilename);
        // Fetch the updated file to reflect permanent status and new name
        const updatedFile = await getFile(decompressedFileObject.id);
        if (updatedFile) setDecompressedFileObject(updatedFile);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        setClientError(`Failed to save to library: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    setFilenamePromptAction(null);
  }, [decompressedFileObject, filenamePromptAction, makeFilePermanentAndUpdate, getFile]);

  const openPreviewModal = useCallback(async () => {
    if (!decompressedFileObject || !decompressedFileObject.blob) return;
    setIsPreviewModalOpen(true);
    setPreviewModalFilename(decompressedFileObject.filename);
    setPreviewContent(null);
    setPreviewError(null);
    setPreviewType('loading');

    const extension = decompressedFileObject.filename.substring(decompressedFileObject.filename.lastIndexOf('.') + 1).toLowerCase();
    try {
      if (PREVIEWABLE_IMAGE_EXTENSIONS.includes(extension) && decompressedFileObject.type.startsWith('image/')) {
        const url = URL.createObjectURL(decompressedFileObject.blob);
        setPreviewContent(url);
        setPreviewType('image');
      } else if (PREVIEWABLE_TEXT_EXTENSIONS.includes(extension) || decompressedFileObject.type.startsWith('text/')) {
        if (decompressedFileObject.blob.size > MAX_TEXT_PREVIEW_SIZE) {
          setPreviewError(`Text file is too large for preview (${formatBytesCompact(decompressedFileObject.blob.size)}). Max preview size is ${formatBytesCompact(MAX_TEXT_PREVIEW_SIZE)}.`);
          setPreviewType('unsupported');
          return;
        }
        const text = await decompressedFileObject.blob.text();
        setPreviewContent(text);
        setPreviewType('text');
      } else {
        setPreviewType('unsupported');
      }
    } catch (err) {
      setPreviewError(`Failed to load preview: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setPreviewType('unsupported');
    }
  }, [decompressedFileObject, PREVIEWABLE_IMAGE_EXTENSIONS, PREVIEWABLE_TEXT_EXTENSIONS, formatBytesCompact]);

  useEffect(() => { // Cleanup object URL for image preview
    let objectUrlToRevoke: string | null = null;
    if (previewType === 'image' && previewContent?.startsWith('blob:')) {
      objectUrlToRevoke = previewContent;
    }
    return () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [previewType, previewContent]);


  const isLoading = isLoadingToolState || gzipDecompressor.isLoading;
  const canPerformOutputActions = !!decompressedFileObject && !gzipDecompressor.isLoading && !gzipDecompressor.error;

  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
     return <p className="text-center p-4 italic text-gray-500 animate-pulse">Loading Gzip Explorer...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
                <Button
                    variant="primary"
                    onClick={() => setIsSelectFileModalOpen(true)}
                    disabled={isLoading}
                    iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
                >
                    Select .gz File
                </Button>
                {(selectedGzipFileObject || clientError || decompressedFileObject) && (
                    <Button
                    variant="danger"
                    onClick={() => handleClearAll(true)}
                    disabled={isLoading && !!selectedGzipFileObject} // only disable if actively loading a file
                    iconLeft={<TrashIcon className="h-5 w-5" />}
                    >
                    Clear
                    </Button>
                )}
            </div>
            <ReceiveItdeDataTrigger
                hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
                pendingSignalCount={itdeTarget.pendingSignals.length}
                onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
        </div>
        {selectedGzipFileObject && (
          <div className="mt-3 text-sm text-[rgb(var(--color-text-muted))]">
            Selected: <strong>{selectedGzipFileObject.filename}</strong> ({formatBytesCompact(selectedGzipFileObject.size)})
          </div>
        )}
         {gzipDecompressor.isLoading && selectedGzipFileObject && (
          <div className="mt-2 text-sm text-blue-600 animate-pulse">Decompressing...</div>
        )}
      </div>

      {clientError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          <strong className="font-semibold">Error:</strong> {clientError}
        </div>
      )}

      {decompressedFileObject && !gzipDecompressor.isLoading && !clientError && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <h3 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-base))]">Decompressed File</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
            <div><strong>Filename:</strong> {decompressedFileObject.filename}</div>
            <div><strong>Size:</strong> {formatBytesCompact(decompressedFileObject.size)}</div>
            <div><strong>Type:</strong> {decompressedFileObject.type}</div>
            {gzipHeaderInfo?.modificationTime && (
                 <div><strong>ModTime (Header):</strong> {gzipHeaderInfo.modificationTime.toLocaleString()}</div>
            )}
            {gzipHeaderInfo?.originalFilename && gzipHeaderInfo.originalFilename !== decompressedFileObject.filename && (
                 <div className="md:col-span-2"><strong>Original Name (Header):</strong> {gzipHeaderInfo.originalFilename}</div>
            )}
            {gzipHeaderInfo?.comment && (
                 <div className="md:col-span-2"><strong>Comment (Header):</strong> {gzipHeaderInfo.comment}</div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="neutral-outline"
              onClick={openPreviewModal}
              iconLeft={<EyeIcon className="h-5 w-5" />}
            >
              Preview
            </Button>
            <OutputActionButtons
              canPerform={canPerformOutputActions}
              isSaveSuccess={saveSuccess}
              isDownloadSuccess={downloadSuccess}
              onInitiateSave={handleSaveDecompressedToLibrary}
              onInitiateDownload={handleDownloadDecompressed}
              onClear={() => handleClearAll(true)}
              directiveName={directiveName}
              outputConfig={ownMetadata.outputConfig}
              selectedOutputItems={decompressedFileObject ? [decompressedFileObject] : []}
            />
          </div>
        </div>
      )}
      
      <FileSelectionModal
        isOpen={isSelectFileModalOpen}
        onClose={() => setIsSelectFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".gz,application/gzip,application/x-gzip"
        selectionMode="single"
        libraryFilter={{ type: 'application/gzip' }} // Or more specific if possible
        initialTab="upload"
      />

      <FilenamePromptModal
        isOpen={isFilenamePromptModalOpen}
        onClose={() => { setIsFilenamePromptModalOpen(false); setFilenamePromptAction(null); }}
        onConfirm={handleFilenamePromptConfirm}
        initialFilename={suggestedFilenameForPrompt}
        title={filenamePromptAction === 'download' ? 'Enter Download Filename' : 'Enter Filename for Library'}
        filenameAction={filenamePromptAction || 'download'}
      />

      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]" onClick={() => setIsPreviewModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 px-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
              <h3 className="text-lg font-semibold truncate" title={previewFilename || ''}>{previewFilename || 'Preview'}</h3>
              <Button variant="link" onClick={() => setIsPreviewModalOpen(false)} className="!p-1"><XCircleIcon className="h-6 w-6 text-gray-500 hover:text-gray-700" /></Button>
            </div>
            <div className="p-4 overflow-auto flex-grow min-h-[200px]">
              {previewType === 'loading' && <p className="text-center animate-pulse">Loading preview...</p>}
              {previewError && <div role="alert" className="p-2 bg-red-50 text-red-700 rounded text-sm"><strong className="font-semibold">Error:</strong> {previewError}</div>}
              {!previewError && previewType === 'text' && <pre className="text-sm whitespace-pre-wrap break-words max-h-[calc(90vh-120px)] overflow-auto"><code>{previewContent}</code></pre>}
              {!previewError && previewType === 'image' && previewContent && (
                <div className="flex justify-center items-center h-full max-h-[calc(90vh-120px)]">
                  <Image src={previewContent} alt={previewFilename || 'Preview'} width={800} height={600} className="max-w-full max-h-full object-contain" onError={() => setPreviewError('Failed to load image.')} unoptimized />
                </div>
              )}
              {!previewError && previewType === 'unsupported' && <p className="text-center">Preview not available for this file type.</p>}
            </div>
          </div>
        </div>
      )}

      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={(sd) => { itdeTarget.acceptSignal(sd); if (itdeTarget.pendingSignals.length -1 === 0) setUserDeferredAutoPopup(false);}}
        onIgnore={(sd) => { itdeTarget.ignoreSignal(sd); if (itdeTarget.pendingSignals.length -1 === 0) setUserDeferredAutoPopup(false);}}
        onDeferAll={() => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); }}
        onIgnoreAll={() => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); }}
      />
    </div>
  );
}
