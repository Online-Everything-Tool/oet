'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import useToolState from '../../_hooks/useToolState';
import useGzipDecompressor from '../_hooks/useGzipDecompressor';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import { getMimeTypeForFile, formatBytes, isTextBasedMimeType } from '@/app/lib/utils';

import Button from '../../_components/form/Button';
import Textarea from '../../_components/form/Textarea';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';

import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata as AppToolMetadata } from '@/src/types/tools';
import toolSpecificMetadata from '../metadata.json';

import { ArrowUpTrayIcon, DocumentTextIcon, PhotoIcon, QuestionMarkCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ownMetadata = toolSpecificMetadata as AppToolMetadata;
const MAX_TEXT_PREVIEW_SIZE = 1024 * 256; // 256KB

interface GzipExplorerState {
  selectedGzipFileId: string | null;
  selectedGzipFileName: string | null;
  selectedGzipFileSize: number | null;

  decompressedFileId: string | null;
  decompressedOriginalFileName: string | null;
  decompressedFileSize: number | null;
  decompressedFileType: string | null;

  previewDataUrl: string | null;
  previewTextContent: string | null;
  isPreviewable: boolean;
  isTextPreviewTruncated: boolean;

  error: string | null;
  isLoading: boolean;
}

const DEFAULT_STATE: GzipExplorerState = {
  selectedGzipFileId: null,
  selectedGzipFileName: null,
  selectedGzipFileSize: null,
  decompressedFileId: null,
  decompressedOriginalFileName: null,
  decompressedFileSize: null,
  decompressedFileType: null,
  previewDataUrl: null,
  previewTextContent: null,
  isPreviewable: false,
  isTextPreviewTruncated: false,
  error: null,
  isLoading: false,
};

interface GzipFileExplorerClientProps {
  toolRoute: string;
}

export default function GzipFileExplorerClient({ toolRoute }: GzipFileExplorerClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingPersistence,
    saveStateNow,
  } = useToolState<GzipExplorerState>(toolRoute, DEFAULT_STATE);

  const { decompressFile, isLoading: isLoadingDecompressionHook, error: decompressionError, clearError: clearDecompressionError } = useGzipDecompressor();
  const { getFile, addFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const [isSelectFileModalOpen, setIsSelectFileModalOpen] = useState(false);
  const [userDeferredItdePopup, setUserDeferredItdePopup] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  
  const initialToolStateLoadCompleteRef = useRef(false);
  const currentPreviewObjectUrlRef = useRef<string | null>(null);

  const directiveName = ownMetadata.directive;

  const isLoadingOverall = toolState.isLoading || isLoadingPersistence || isLoadingDecompressionHook;

  const clearAllOutputState = useCallback((excludeError: boolean = false) => {
    setToolState(prev => ({
      ...prev,
      decompressedFileId: null,
      decompressedOriginalFileName: null,
      decompressedFileSize: null,
      decompressedFileType: null,
      previewDataUrl: null,
      previewTextContent: null,
      isPreviewable: false,
      isTextPreviewTruncated: false,
      isLoading: false,
      error: excludeError ? prev.error : null,
    }));
    if (currentPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(currentPreviewObjectUrlRef.current);
      currentPreviewObjectUrlRef.current = null;
    }
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    if (!excludeError) clearDecompressionError();
  }, [setToolState, clearDecompressionError]);

  const handleClear = useCallback(async () => {
    const idsToCleanup: string[] = [];
    if (toolState.selectedGzipFileId) idsToCleanup.push(toolState.selectedGzipFileId);
    if (toolState.decompressedFileId) idsToCleanup.push(toolState.decompressedFileId);
    
    setToolState(DEFAULT_STATE);
    await saveStateNow(DEFAULT_STATE);
    
    if (currentPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(currentPreviewObjectUrlRef.current);
      currentPreviewObjectUrlRef.current = null;
    }
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    clearDecompressionError();

    if (idsToCleanup.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToCleanup).catch(e => console.error("Cleanup failed on clear:", e));
    }
  }, [setToolState, saveStateNow, toolState.selectedGzipFileId, toolState.decompressedFileId, cleanupOrphanedTemporaryFiles, clearDecompressionError]);

  const generatePreview = useCallback(async (file: StoredFile) => {
    if (currentPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(currentPreviewObjectUrlRef.current);
      currentPreviewObjectUrlRef.current = null;
    }
    setToolState(prev => ({ ...prev, previewDataUrl: null, previewTextContent: null, isPreviewable: false, isTextPreviewTruncated: false }));

    if (!file.blob || !file.type) {
      setToolState(prev => ({ ...prev, isPreviewable: false }));
      return;
    }

    if (isTextBasedMimeType(file.type)) {
      try {
        let text = await file.blob.text();
        let truncated = false;
        if (text.length > MAX_TEXT_PREVIEW_SIZE) {
          text = text.substring(0, MAX_TEXT_PREVIEW_SIZE);
          truncated = true;
        }
        setToolState(prev => ({ ...prev, previewTextContent: text, isPreviewable: true, isTextPreviewTruncated: truncated }));
      } catch (e) {
        setToolState(prev => ({ ...prev, error: `Error reading text preview: ${e instanceof Error ? e.message : String(e)}`, isPreviewable: false }));
      }
    } else if (file.type.startsWith('image/')) {
      try {
        const url = URL.createObjectURL(file.blob);
        currentPreviewObjectUrlRef.current = url;
        setToolState(prev => ({ ...prev, previewDataUrl: url, isPreviewable: true }));
      } catch (e) {
         setToolState(prev => ({ ...prev, error: `Error creating image preview URL: ${e instanceof Error ? e.message : String(e)}`, isPreviewable: false }));
      }
    } else {
      setToolState(prev => ({ ...prev, isPreviewable: false }));
    }
  }, [setToolState]);
  
  // Effect to revoke object URL on unmount or when previewDataUrl changes
  useEffect(() => {
    const objectUrl = currentPreviewObjectUrlRef.current;
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        currentPreviewObjectUrlRef.current = null;
      }
    };
  }, []);


  const processGzipFile = useCallback(async (gzipFile: StoredFile) => {
    setToolState(prev => ({ ...prev, isLoading: true, error: null }));
    clearAllOutputState(true); // Keep existing error if any, or clear if new process starts

    try {
      const { decompressedBuffer, headerInfo } = await decompressFile(gzipFile);
      
      let originalFilename = headerInfo?.name || gzipFile.filename.replace(/\.gz$/i, '').replace(/\.gzip$/i, '');
      if (!originalFilename || originalFilename === gzipFile.filename) { // If still ends with .gz or no extension change
        const parts = gzipFile.filename.split('.');
        if (parts.length > 1 && (parts[parts.length -1].toLowerCase() === 'gz' || parts[parts.length -1].toLowerCase() === 'gzip')) {
          originalFilename = parts.slice(0, -1).join('.');
        } else {
          originalFilename = 'decompressed_file'; // Fallback
        }
      }
      
      const decompressedMimeType = getMimeTypeForFile(originalFilename);
      const decompressedBlob = new Blob([decompressedBuffer], { type: decompressedMimeType });

      const oldDecompressedFileId = toolState.decompressedFileId;
      const newDecompressedFileId = await addFile(decompressedBlob, originalFilename, decompressedMimeType, true, toolRoute);
      
      setToolState(prev => ({
        ...prev,
        selectedGzipFileId: gzipFile.id,
        selectedGzipFileName: gzipFile.filename,
        selectedGzipFileSize: gzipFile.size,
        decompressedFileId: newDecompressedFileId,
        decompressedOriginalFileName: originalFilename,
        decompressedFileSize: decompressedBlob.size,
        decompressedFileType: decompressedMimeType,
        isLoading: false,
      }));
      await saveStateNow({ 
        ...toolState, 
        selectedGzipFileId: gzipFile.id,
        selectedGzipFileName: gzipFile.filename,
        selectedGzipFileSize: gzipFile.size,
        decompressedFileId: newDecompressedFileId,
        decompressedOriginalFileName: originalFilename,
        decompressedFileSize: decompressedBlob.size,
        decompressedFileType: decompressedMimeType,
        isLoading: false,
        error: null, // Clear error on success
         // Clear preview states, they will be set by generatePreview
        previewDataUrl: null,
        previewTextContent: null,
        isPreviewable: false,
        isTextPreviewTruncated: false,
      });

      const newDecompressedStoredFile = await getFile(newDecompressedFileId);
      if (newDecompressedStoredFile) {
        await generatePreview(newDecompressedStoredFile);
      }

      if (oldDecompressedFileId && oldDecompressedFileId !== newDecompressedFileId) {
        cleanupOrphanedTemporaryFiles([oldDecompressedFileId]).catch(e => console.error("Cleanup of old decompressed file failed:", e));
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setToolState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      // Do not save error to persistent state here, it's transient
    }
  }, [setToolState, decompressFile, addFile, getFile, generatePreview, toolRoute, saveStateNow, toolState, cleanupOrphanedTemporaryFiles, clearAllOutputState]);

  const handleFilesSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsSelectFileModalOpen(false);
    if (files.length === 0) return;
    const file = files[0];

    if (file.type === 'application/gzip' || file.type === 'application/x-gzip' || file.filename.toLowerCase().endsWith('.gz')) {
      const oldSelectedGzipFileId = toolState.selectedGzipFileId;
      if (oldSelectedGzipFileId && oldSelectedGzipFileId !== file.id) {
         cleanupOrphanedTemporaryFiles([oldSelectedGzipFileId]).catch(e => console.error("Cleanup of old GZIP file failed:", e));
      }
      await processGzipFile(file);
    } else {
      setToolState(prev => ({ ...prev, error: 'Invalid file type. Please select a .gz file.' }));
    }
  }, [processGzipFile, toolState.selectedGzipFileId, cleanupOrphanedTemporaryFiles, setToolState]);

  // Auto-load from persistence
  useEffect(() => {
    if (!isLoadingPersistence && !initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = true;
      if (toolState.selectedGzipFileId && !toolState.decompressedFileId && !toolState.isLoading && !toolState.error) {
        // If there's a selected GZIP but no decompressed output, try to process it
        getFile(toolState.selectedGzipFileId).then(file => {
          if (file) processGzipFile(file);
        }).catch(e => {
          setToolState(prev => ({ ...prev, error: `Failed to load persisted GZIP file: ${e.message}`}));
        });
      } else if (toolState.decompressedFileId && (!toolState.previewTextContent && !toolState.previewDataUrl && toolState.isPreviewable === false)) {
        // If there's a decompressed file ID but no preview, generate preview
         getFile(toolState.decompressedFileId).then(file => {
          if (file) generatePreview(file);
        }).catch(e => {
          setToolState(prev => ({ ...prev, error: `Failed to load persisted decompressed file for preview: ${e.message}`}));
        });
      }
    }
  }, [isLoadingPersistence, toolState, getFile, processGzipFile, generatePreview, setToolState]);
  
  // Handle external decompression errors
  useEffect(() => {
    if (decompressionError) {
      setToolState(prev => ({ ...prev, error: decompressionError, isLoading: false }));
    }
  }, [decompressionError, setToolState]);

  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    setUserDeferredItdePopup(false);
    setToolState(prev => ({ ...prev, isLoading: true, error: null }));
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setToolState(prev => ({ ...prev, error: `Metadata not found for source: ${signal.sourceToolTitle}`, isLoading: false }));
      return;
    }

    const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
    if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
      setToolState(prev => ({ ...prev, error: resolvedPayload.errorMessage || 'No data received from source.', isLoading: false }));
      return;
    }

    const receivedFileItem = resolvedPayload.data[0];
    let fileToProcess: StoredFile | null = null;

    if (receivedFileItem && (receivedFileItem.type === 'application/gzip' || receivedFileItem.type === 'application/x-gzip' || ('filename' in receivedFileItem && (receivedFileItem as StoredFile).filename?.toLowerCase().endsWith('.gz')))) {
      if (!('id' in receivedFileItem)) { // InlineFile
        try {
          const tempName = `itde-received-${Date.now()}.gz`;
          const newId = await addFile(receivedFileItem.blob, tempName, receivedFileItem.type || 'application/gzip', true, toolRoute);
          fileToProcess = await getFile(newId);
          if (!fileToProcess) throw new Error('Failed to retrieve saved InlineFile from library.');
        } catch (e) {
          setToolState(prev => ({ ...prev, error: `Failed to process incoming GZIP: ${e instanceof Error ? e.message : String(e)}`, isLoading: false }));
          return;
        }
      } else { // StoredFile
        fileToProcess = receivedFileItem as StoredFile;
      }
    } else {
      setToolState(prev => ({ ...prev, error: `Received file from ${signal.sourceToolTitle} is not a GZIP.`, isLoading: false }));
      return;
    }

    if (fileToProcess) {
      const oldSelectedGzipFileId = toolState.selectedGzipFileId;
      if (oldSelectedGzipFileId && oldSelectedGzipFileId !== fileToProcess.id) {
         cleanupOrphanedTemporaryFiles([oldSelectedGzipFileId]).catch(e => console.error("Cleanup of old GZIP file (ITDE) failed:", e));
      }
      await processGzipFile(fileToProcess);
    } else {
      setToolState(prev => ({...prev, isLoading: false}));
    }
  }, [setToolState, getToolMetadata, addFile, getFile, processGzipFile, toolRoute, toolState.selectedGzipFileId, cleanupOrphanedTemporaryFiles]);

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (initialToolStateLoadCompleteRef.current && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredItdePopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [itdeTarget, userDeferredItdePopup]);

  const handleInitiateSave = useCallback(async () => {
    if (!toolState.decompressedFileId || !toolState.decompressedOriginalFileName) return;
    setToolState(prev => ({ ...prev, isLoading: true }));
    try {
      await makeFilePermanentAndUpdate(toolState.decompressedFileId, toolState.decompressedOriginalFileName);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      setToolState(prev => ({ ...prev, error: `Failed to save to library: ${e instanceof Error ? e.message : String(e)}` }));
    } finally {
      setToolState(prev => ({ ...prev, isLoading: false }));
    }
  }, [toolState.decompressedFileId, toolState.decompressedOriginalFileName, makeFilePermanentAndUpdate, setToolState]);

  const handleInitiateDownload = useCallback(async () => {
    if (!toolState.decompressedFileId) return;
    setToolState(prev => ({ ...prev, isLoading: true }));
    try {
      const file = await getFile(toolState.decompressedFileId);
      if (file?.blob) {
        const url = URL.createObjectURL(file.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = toolState.decompressedOriginalFileName || 'decompressed_file';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2000);
      } else {
        throw new Error('Decompressed file data not found.');
      }
    } catch (e) {
      setToolState(prev => ({ ...prev, error: `Download failed: ${e instanceof Error ? e.message : String(e)}` }));
    } finally {
      setToolState(prev => ({ ...prev, isLoading: false }));
    }
  }, [toolState.decompressedFileId, toolState.decompressedOriginalFileName, getFile, setToolState]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!toolState.previewTextContent) {
      setToolState(prev => ({ ...prev, error: 'No text content to copy.' }));
      return;
    }
    try {
      await navigator.clipboard.writeText(toolState.previewTextContent);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (e) {
      setToolState(prev => ({ ...prev, error: `Failed to copy: ${e instanceof Error ? e.message : String(e)}` }));
    }
  }, [toolState.previewTextContent, setToolState]);

  const selectedOutputItemsForITDE = useMemo((): StoredFile[] => {
    if (toolState.decompressedFileId && toolState.decompressedOriginalFileName && toolState.decompressedFileType && toolState.decompressedFileSize !== null) {
      // We don't have the actual blob here, but ITDE resolver will fetch it.
      // For discovery, we need a StoredFile-like object.
      return [{
        id: toolState.decompressedFileId,
        filename: toolState.decompressedOriginalFileName,
        type: toolState.decompressedFileType,
        size: toolState.decompressedFileSize,
        blob: new Blob([]), // Placeholder blob
        createdAt: new Date(), 
        isTemporary: true, // Assume temporary for this placeholder
      }];
    }
    return [];
  }, [toolState.decompressedFileId, toolState.decompressedOriginalFileName, toolState.decompressedFileType, toolState.decompressedFileSize]);


  if (isLoadingPersistence && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Gzip Explorer...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <Button
            variant="primary"
            onClick={() => setIsSelectFileModalOpen(true)}
            disabled={isLoadingOverall}
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
            {(toolState.selectedGzipFileId || toolState.error) && (
              <Button
                variant="danger"
                onClick={handleClear}
                disabled={isLoadingOverall}
                iconLeft={<XCircleIcon className="h-5 w-5" />}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        {toolState.selectedGzipFileName && (
          <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
            Selected: <strong>{toolState.selectedGzipFileName}</strong>
            {toolState.selectedGzipFileSize !== null && ` (${formatBytes(toolState.selectedGzipFileSize)})`}
          </p>
        )}
      </div>

      {toolState.error && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div><strong className="font-semibold">Error:</strong> {toolState.error}</div>
        </div>
      )}

      {isLoadingOverall && <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Processing...</p>}

      {!isLoadingOverall && toolState.decompressedFileId && (
        <div className="border border-[rgb(var(--color-border-base))] rounded-md">
          <div className="p-3 bg-[rgb(var(--color-bg-subtle))] border-b border-[rgb(var(--color-border-base))] rounded-t-md">
            <h3 className="text-md font-semibold text-[rgb(var(--color-text-base))]">Decompressed Content</h3>
            {toolState.decompressedOriginalFileName && (
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                Original Name: <strong>{toolState.decompressedOriginalFileName}</strong>
              </p>
            )}
            {toolState.decompressedFileType && (
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                Type: {toolState.decompressedFileType}
                {toolState.decompressedFileSize !== null && ` (${formatBytes(toolState.decompressedFileSize)})`}
              </p>
            )}
          </div>
          
          <div className="p-3 min-h-[200px] max-h-[50vh] overflow-auto">
            {toolState.previewTextContent && (
              <Textarea
                value={toolState.previewTextContent}
                readOnly
                rows={10}
                textareaClassName="text-sm font-mono bg-white"
                aria-label="Decompressed text content"
              />
            )}
            {toolState.isTextPreviewTruncated && (
               <p className="text-xs text-center text-[rgb(var(--color-text-muted))] mt-1 italic">
                Text preview truncated to {formatBytes(MAX_TEXT_PREVIEW_SIZE)}. Full content available via download/save.
              </p>
            )}
            {toolState.previewDataUrl && (
              <div className="flex justify-center items-center">
                <Image
                  src={toolState.previewDataUrl}
                  alt={toolState.decompressedOriginalFileName || 'Decompressed image'}
                  width={400}
                  height={300}
                  className="max-w-full max-h-[45vh] object-contain border border-[rgb(var(--color-border-base))]"
                  unoptimized
                />
              </div>
            )}
            {!toolState.isPreviewable && toolState.decompressedFileId && (
              <div className="flex flex-col items-center justify-center text-center text-[rgb(var(--color-text-muted))] p-4">
                <QuestionMarkCircleIcon className="h-12 w-12 mb-2" />
                <p>Preview not available for this file type ({toolState.decompressedFileType || 'unknown'}).</p>
                <p className="text-xs mt-1">You can still download or save it.</p>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] rounded-b-md flex flex-wrap gap-2 justify-end">
            <OutputActionButtons
              canPerform={!!toolState.decompressedFileId}
              isSaveSuccess={saveSuccess}
              isCopySuccess={copySuccess}
              isDownloadSuccess={downloadSuccess}
              onInitiateSave={handleInitiateSave}
              onInitiateDownload={handleInitiateDownload}
              onCopy={toolState.previewTextContent ? handleCopyToClipboard : undefined}
              onClear={handleClear}
              directiveName={directiveName}
              outputConfig={ownMetadata.outputConfig}
              selectedOutputItems={selectedOutputItemsForITDE}
            />
          </div>
        </div>
      )}
      
      {!isLoadingOverall && !toolState.selectedGzipFileId && !toolState.error && (
        <div className="text-center p-8 border-2 border-dashed border-[rgb(var(--color-border-base))] rounded-lg text-[rgb(var(--color-text-muted))]">
          <ArrowUpTrayIcon className="h-12 w-12 mx-auto mb-2" />
          <p className="text-lg font-medium">No Gzip file selected</p>
          <p className="text-sm">Select a <code>.gz</code> file to view its contents.</p>
        </div>
      )}

      <FileSelectionModal
        isOpen={isSelectFileModalOpen}
        onClose={() => setIsSelectFileModalOpen(false)}
        onFilesSelected={handleFilesSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".gz,application/gzip,application/x-gzip"
        selectionMode="single"
        libraryFilter={{ type: 'application/gzip' }}
        initialTab="upload"
      />
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={(sd) => { itdeTarget.acceptSignal(sd); if (itdeTarget.pendingSignals.length -1 === 0) setUserDeferredItdePopup(false); }}
        onIgnore={(sd) => { itdeTarget.ignoreSignal(sd); if (itdeTarget.pendingSignals.length -1 === 0) setUserDeferredItdePopup(false); }}
        onDeferAll={() => { setUserDeferredItdePopup(true); itdeTarget.closeModal(); }}
        onIgnoreAll={() => { setUserDeferredItdePopup(false); itdeTarget.ignoreAllSignals(); }}
      />
    </div>
  );
}