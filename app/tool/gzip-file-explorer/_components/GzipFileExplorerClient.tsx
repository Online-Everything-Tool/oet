'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import pako from 'pako';
import Image from 'next/image';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { StoredFile } from '@/src/types/storage';
import {
  formatBytes,
  getFileIconClassName,
  getMimeTypeForFile,
  isTextBasedMimeType,
} from '@/app/lib/utils';
import {
  ArrowUpTrayIcon,
  TrashIcon,
  EyeIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { XCircleIcon as XCircleIconSolid } from '@heroicons/react/24/solid';

import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import ownToolMetadata from '../metadata.json';
import type { ToolMetadata as AppToolMetadata } from '@/src/types/tools';

const MAX_TEXT_PREVIEW_SIZE = 1024 * 100; // 100KB

interface GzipExplorerToolState {
  selectedGzipFileId: string | null;
  decompressedFileId: string | null;
}

const DEFAULT_TOOL_STATE: GzipExplorerToolState = {
  selectedGzipFileId: null,
  decompressedFileId: null,
};

interface GzipFileExplorerClientProps {
  toolRoute: string;
}

export default function GzipFileExplorerClient({ toolRoute }: GzipFileExplorerClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
  } = useToolState<GzipExplorerToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const { getFile, addFile, makeFilePermanentAndUpdate, deleteFilePermanently } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const [isLoadingProcessing, setIsLoadingProcessing] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const [selectedGzipFile, setSelectedGzipFile] = useState<StoredFile | null>(null);
  const [decompressedStoredFile, setDecompressedStoredFile] = useState<StoredFile | null>(null);

  const [isSelectFileModalOpen, setIsSelectFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameAction, setFilenameAction] = useState<'download' | 'save' | null>(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] = useState('');

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'text' | 'image' | 'unsupported' | 'loading' | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const directiveName = ownToolMetadata.directive;

  // Effect to load files based on persisted state
  useEffect(() => {
    if (isLoadingToolState || !initialToolStateLoadCompleteRef.current) return;

    const loadFilesFromState = async () => {
      setIsLoadingProcessing(true);
      if (toolState.selectedGzipFileId) {
        const gzFile = await getFile(toolState.selectedGzipFileId);
        setSelectedGzipFile(gzFile || null);
        if (!gzFile) {
          setClientError(`Failed to load Gzip file (ID: ${toolState.selectedGzipFileId}). It may no longer exist.`);
          // Clear related state if GZ file is missing
          setToolState(prev => ({ ...prev, selectedGzipFileId: null, decompressedFileId: null }));
          setDecompressedStoredFile(null);
        }
      } else {
        setSelectedGzipFile(null);
      }

      if (toolState.decompressedFileId) {
        const decFile = await getFile(toolState.decompressedFileId);
        setDecompressedStoredFile(decFile || null);
        if (!decFile && toolState.selectedGzipFileId) { // Decompressed missing but GZ present
          // This might indicate an interruption. Optionally, reprocess here if selectedGzipFile is loaded.
          // For now, just clear the decompressedFileId from state.
          setToolState(prev => ({ ...prev, decompressedFileId: null }));
        }
      } else {
        setDecompressedStoredFile(null);
      }
      setIsLoadingProcessing(false);
    };
    loadFilesFromState();
  }, [toolState.selectedGzipFileId, toolState.decompressedFileId, isLoadingToolState, getFile, setToolState]);


  const processGzipFile = useCallback(async (gzippedFile: StoredFile) => {
    setIsLoadingProcessing(true);
    setClientError(null);
    if (decompressedStoredFile?.id) {
      // Clean up previous temporary decompressed file
      await deleteFilePermanently(decompressedStoredFile.id).catch(e => console.warn("Failed to delete old temp decompressed file", e));
      setDecompressedStoredFile(null);
    }

    try {
      if (!gzippedFile.blob) throw new Error("Gzip file content is missing.");
      const arrayBuffer = await gzippedFile.blob.arrayBuffer();
      const decompressedData = pako.ungzip(new Uint8Array(arrayBuffer));

      let originalFilename = gzippedFile.filename;
      if (originalFilename.toLowerCase().endsWith('.gz')) {
        originalFilename = originalFilename.substring(0, originalFilename.length - 3);
      } else {
        originalFilename = `${originalFilename}_decompressed`;
      }
      if (!originalFilename) originalFilename = "decompressed_file";


      const mimeType = getMimeTypeForFile(originalFilename);
      const decompressedBlob = new Blob([decompressedData], { type: mimeType });

      const newFileId = await addFile(decompressedBlob, originalFilename, mimeType, true, toolRoute);
      setToolState({ selectedGzipFileId: gzippedFile.id, decompressedFileId: newFileId });
      // The useEffect watching toolState.decompressedFileId will load this into decompressedStoredFile
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to decompress Gzip file.";
      setClientError(errorMsg);
      setToolState({ selectedGzipFileId: gzippedFile.id, decompressedFileId: null });
      setDecompressedStoredFile(null);
    } finally {
      setIsLoadingProcessing(false);
    }
  }, [addFile, setToolState, toolRoute, deleteFilePermanently, decompressedStoredFile?.id]);

  const handleFileSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsSelectFileModalOpen(false);
    if (files.length === 0) return;
    const file = files[0];

    if (file.type === 'application/gzip' || file.type === 'application/x-gzip' || file.filename.toLowerCase().endsWith('.gz')) {
      setSelectedGzipFile(file); // Update local state for immediate UI feedback
      await processGzipFile(file);
    } else {
      setClientError("Invalid file type. Please select a .gz file.");
      setSelectedGzipFile(null);
      setToolState(prev => ({ ...prev, selectedGzipFileId: null, decompressedFileId: null }));
      setDecompressedStoredFile(null);
    }
  }, [processGzipFile, setToolState]);


  const handleClear = useCallback(async () => {
    const oldDecompressedId = toolState.decompressedFileId;
    // selectedGzipFileId is not cleared here as it might be a permanent file user wants to keep.
    // If it was temporary from ITDE, it should be handled by ITDE source or general cleanup.
    setToolState(prev => ({ ...prev, decompressedFileId: null }));
    await saveStateNow({ ...toolState, decompressedFileId: null }); // Persist the change

    setSelectedGzipFile(null); // Clear local display state for GZ file
    setDecompressedStoredFile(null);
    setClientError(null);
    setIsLoadingProcessing(false);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);

    if (oldDecompressedId) {
      // The decompressed file is always created as temporary by this tool.
      // Removing it from state makes it an orphan, to be cleaned by FileLibrary's periodic cleanup.
      // Or, delete it immediately if desired:
      await deleteFilePermanently(oldDecompressedId).catch(e => console.warn("Failed to delete temp decompressed file on clear", e));
    }
  }, [toolState, setToolState, saveStateNow, deleteFilePermanently]);

  const handlePreview = useCallback(async () => {
    if (!decompressedStoredFile || !decompressedStoredFile.blob) {
      setPreviewError("Decompressed file content not available for preview.");
      setPreviewType('unsupported');
      setIsPreviewOpen(true);
      return;
    }

    setIsPreviewOpen(true);
    setPreviewFilename(decompressedStoredFile.filename);
    setPreviewContent(null);
    setPreviewError(null);
    setPreviewType('loading');

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }

    const mime = decompressedStoredFile.type;

    try {
      if (isTextBasedMimeType(mime)) {
        const text = await decompressedStoredFile.blob.text();
        setPreviewContent(text.length > MAX_TEXT_PREVIEW_SIZE ? text.substring(0, MAX_TEXT_PREVIEW_SIZE) + "\n\n--- Content truncated ---" : text);
        setPreviewType('text');
      } else if (mime.startsWith('image/')) {
        previewObjectUrlRef.current = URL.createObjectURL(decompressedStoredFile.blob);
        setPreviewContent(previewObjectUrlRef.current);
        setPreviewType('image');
      } else {
        setPreviewType('unsupported');
      }
    } catch (err) {
      setPreviewError(`Failed to load preview: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setPreviewType('unsupported');
    }
  }, [decompressedStoredFile]);

  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }, []);

  const handleDownloadDecompressed = useCallback(() => {
    if (!decompressedStoredFile || !decompressedStoredFile.blob) {
      setClientError("No decompressed file to download.");
      return;
    }
    try {
      const url = URL.createObjectURL(decompressedStoredFile.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = decompressedStoredFile.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (err) {
      setClientError(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [decompressedStoredFile]);

  const handleSaveDecompressedToLibrary = useCallback(() => {
    if (!decompressedStoredFile) {
      setClientError("No decompressed file to save.");
      return;
    }
    setSuggestedFilenameForPrompt(decompressedStoredFile.filename);
    setFilenameAction('save');
    setIsFilenameModalOpen(true);
  }, [decompressedStoredFile]);

  const handleFilenameConfirm = useCallback(async (filename: string) => {
    setIsFilenameModalOpen(false);
    if (!filenameAction || !toolState.decompressedFileId) return;

    const finalFilename = filename.trim() || decompressedStoredFile?.filename || "decompressed_output";

    if (filenameAction === 'save') {
      try {
        await makeFilePermanentAndUpdate(toolState.decompressedFileId, finalFilename);
        // Fetch the updated file to reflect changes in UI if necessary
        const updatedFile = await getFile(toolState.decompressedFileId);
        setDecompressedStoredFile(updatedFile || null);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        setClientError(`Failed to save to library: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    // Download action is handled directly by handleDownloadDecompressed, FilenamePromptModal is not used for it in this tool.
    // If it were, logic would be here. For this tool, download uses original derived name.
    setFilenameAction(null);
  }, [filenameAction, toolState.decompressedFileId, makeFilePermanentAndUpdate, getFile, decompressedStoredFile?.filename]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!decompressedStoredFile || !decompressedStoredFile.blob || !isTextBasedMimeType(decompressedStoredFile.type)) {
      setClientError("No text content to copy.");
      return;
    }
    try {
      const text = await decompressedStoredFile.blob.text();
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setClientError("Failed to copy to clipboard.");
    }
  }, [decompressedStoredFile]);

  // ITDE Handling
  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    setClientError(null);
    setIsLoadingProcessing(true);
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setClientError(`Metadata not found for source: ${signal.sourceToolTitle}`);
      setIsLoadingProcessing(false);
      return;
    }

    const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
    if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
      setClientError(resolvedPayload.errorMessage || 'No data received from source.');
      setIsLoadingProcessing(false);
      return;
    }

    const receivedFileItem = resolvedPayload.data[0];
    let fileToProcess: StoredFile | null = null;

    if (receivedFileItem && (receivedFileItem.type === 'application/gzip' || receivedFileItem.type === 'application/x-gzip' || ('filename' in receivedFileItem && (receivedFileItem as StoredFile).filename.toLowerCase().endsWith('.gz')))) {
      if (!('id' in receivedFileItem)) { // InlineFile
        try {
          const tempName = `itde-received-${Date.now()}.gz`;
          const newId = await addFile(receivedFileItem.blob, tempName, receivedFileItem.type, true, toolRoute);
          fileToProcess = await getFile(newId);
          if (!fileToProcess) throw new Error("Failed to retrieve saved InlineFile for ITDE.");
        } catch (e) {
          setClientError(`Failed to process incoming Gzip: ${e instanceof Error ? e.message : String(e)}`);
          setIsLoadingProcessing(false);
          return;
        }
      } else { // StoredFile
        fileToProcess = receivedFileItem as StoredFile;
      }
    } else if (receivedFileItem) {
      setClientError(`Received file from ${signal.sourceToolTitle} is not a Gzip file (type: ${receivedFileItem.type}).`);
      setIsLoadingProcessing(false);
      return;
    }

    if (fileToProcess) {
      setSelectedGzipFile(fileToProcess); // Update local state for immediate UI feedback
      await processGzipFile(fileToProcess);
      setUserDeferredAutoPopup(false);
    } else {
      setClientError('No valid Gzip file found in ITDE data.');
      setIsLoadingProcessing(false);
    }
  }, [getToolMetadata, addFile, getFile, processGzipFile, toolRoute]);

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = true;
    }
    if (initialToolStateLoadCompleteRef.current && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingToolState, itdeTarget, userDeferredAutoPopup]);

  const handleModalDeferAll = () => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); };
  const handleModalIgnoreAll = () => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); };

  const isLoading = isLoadingToolState || isLoadingProcessing;
  const canPerformOutputActions = !!decompressedStoredFile && !clientError && !isLoadingProcessing;
  const canCopyDecompressedContent = decompressedStoredFile ? isTextBasedMimeType(decompressedStoredFile.type) : false;

  const outputItemsForITDE = useMemo(() => {
    return decompressedStoredFile ? [decompressedStoredFile] : [];
  }, [decompressedStoredFile]);

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
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
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            {(selectedGzipFile || decompressedStoredFile || clientError) && (
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
        {selectedGzipFile && !clientError && (
          <p className="mt-3 text-sm text-[rgb(var(--color-text-muted))]">
            Selected Gzip: <strong>{selectedGzipFile.filename}</strong> ({formatBytes(selectedGzipFile.size)})
          </p>
        )}
      </div>

      {isLoading && (
        <p className="text-center p-4 italic text-gray-500 animate-pulse">Processing...</p>
      )}

      {clientError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div><strong className="font-semibold">Error:</strong> {clientError}</div>
        </div>
      )}

      {!isLoading && decompressedStoredFile && !clientError && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md space-y-4">
          <h3 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">Decompressed File:</h3>
          <div className="flex items-center gap-3 p-3 bg-[rgb(var(--color-bg-subtle))] rounded">
            <span className={`${getFileIconClassName(decompressedStoredFile.filename)} text-3xl w-8 h-8 flex items-center justify-center`} aria-hidden="true"></span>
            <div>
              <p className="font-medium text-[rgb(var(--color-text-base))] break-all">{decompressedStoredFile.filename}</p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {decompressedStoredFile.type} - {formatBytes(decompressedStoredFile.size)}
              </p>
            </div>
            <Button
              variant="neutral-outline"
              size="sm"
              onClick={handlePreview}
              iconLeft={<EyeIcon className="h-4 w-4" />}
              className="ml-auto"
            >
              Preview
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 pt-3 border-t border-[rgb(var(--color-border-base))]">
            <OutputActionButtons
              canPerform={canPerformOutputActions}
              isSaveSuccess={saveSuccess}
              isCopySuccess={copySuccess}
              isDownloadSuccess={downloadSuccess}
              onInitiateSave={handleSaveDecompressedToLibrary}
              onInitiateDownload={handleDownloadDecompressed}
              onCopy={canCopyDecompressedContent ? handleCopyToClipboard : undefined}
              onClear={handleClear}
              directiveName={directiveName}
              outputConfig={ownToolMetadata.outputConfig as AppToolMetadata['outputConfig']}
              selectedOutputItems={outputItemsForITDE}
            />
          </div>
        </div>
      )}

      {!isLoading && !selectedGzipFile && !clientError && (
        <p className="p-4 text-lg text-center text-gray-400 italic">
          Select a .gz file to begin.
        </p>
      )}

      <FileSelectionModal
        isOpen={isSelectFileModalOpen}
        onClose={() => setIsSelectFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".gz,application/gzip,application/x-gzip"
        selectionMode="single"
        libraryFilter={{ type: 'application/gzip' }} // Or more specific if known
        initialTab="upload"
      />

      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => { setIsFilenameModalOpen(false); setFilenameAction(null); }}
        onConfirm={handleFilenameConfirm}
        initialFilename={suggestedFilenameForPrompt}
        title={filenameAction === 'save' ? 'Enter Filename for Library' : 'Confirm Download Filename'}
        filenameAction={filenameAction || 'download'}
        confirmButtonText={filenameAction === 'save' ? 'Save to Library' : 'Download'}
      />

      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]" onClick={closePreview}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 px-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
              <h3 className="text-lg font-semibold truncate" title={previewFilename || ''}>{previewFilename || 'Preview'}</h3>
              <Button variant="link" onClick={closePreview} className="!p-1">
                <XCircleIconSolid className="h-6 w-6 text-gray-500 hover:text-gray-700" />
              </Button>
            </div>
            <div className="p-4 overflow-auto flex-grow min-h-[200px]">
              {previewType === 'loading' && <p className="text-center animate-pulse">Loading preview...</p>}
              {previewError && <div role="alert" className="p-2 bg-red-50 text-red-700 rounded text-sm"><strong className="font-semibold">Error:</strong> {previewError}</div>}
              {!previewError && previewType === 'text' && <pre className="text-sm whitespace-pre-wrap break-words max-h-[calc(90vh-100px)] overflow-auto"><code>{previewContent}</code></pre>}
              {!previewError && previewType === 'image' && previewContent && (
                <div className="flex justify-center items-center h-full max-h-[calc(90vh-100px)]">
                  <Image src={previewContent} alt={previewFilename || 'Preview'} width={800} height={600} className="max-w-full max-h-full object-contain" onError={() => setPreviewError("Failed to load image.")} unoptimized />
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
        onAccept={itdeTarget.acceptSignal}
        onIgnore={itdeTarget.ignoreSignal}
        onDeferAll={handleModalDeferAll}
        onIgnoreAll={handleModalIgnoreAll}
      />
    </div>
  );
}
