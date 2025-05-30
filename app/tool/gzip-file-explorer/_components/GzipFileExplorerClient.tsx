'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import useGzipDecompressor from '../_hooks/useGzipDecompressor';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata as AppToolMetadata, OutputConfig } from '@/src/types/tools';
import {
  formatBytes,
  getMimeTypeForFile,
  PREVIEWABLE_TEXT_EXTENSIONS,
  PREVIEWABLE_IMAGE_EXTENSIONS,
} from '@/app/lib/utils';
import {
  ArrowUpTrayIcon,
  DocumentMagnifyingGlassIcon,
  ExclamationTriangleIcon,
  XCircleIcon as ClearIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import toolSpecificMetadata from '../metadata.json';

const ownMetadata = toolSpecificMetadata as AppToolMetadata;
const MAX_TEXT_PREVIEW_SIZE = 1024 * 256; // 256KB

interface GzipExplorerToolState {
  selectedGzipFileId: string | null;
  decompressedFileId: string | null;
  originalFilenameFromHeader: string | null; // Store filename from gzip header
  uncompressedSize: number | null;
}

const DEFAULT_STATE: GzipExplorerToolState = {
  selectedGzipFileId: null,
  decompressedFileId: null,
  originalFilenameFromHeader: null,
  uncompressedSize: null,
};

interface GzipFileExplorerClientProps {
  toolRoute: string;
}

export default function GzipFileExplorerClient({ toolRoute }: GzipFileExplorerClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    errorLoadingState: toolStateError,
    saveStateNow,
    clearStateAndPersist: clearToolStateAndPersist,
  } = useToolState<GzipExplorerToolState>(toolRoute, DEFAULT_STATE);

  const { getFile, addFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const decompressor = useGzipDecompressor();
  const { getToolMetadata } = useMetadata();

  const [selectedGzipFile, setSelectedGzipFile] = useState<StoredFile | null>(null);
  const [decompressedStoredFile, setDecompressedStoredFile] = useState<StoredFile | null>(null);

  const [clientError, setClientError] = useState<string | null>(null);
  const [isSelectFileModalOpen, setIsSelectFileModalOpen] = useState(false);
  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<'download' | 'save' | null>(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] = useState('');

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'text' | 'image' | 'unsupported' | 'loading' | null>(null);
  const [previewModalError, setPreviewModalError] = useState<string | null>(null);
  const [previewModalFilename, setPreviewModalFilename] = useState<string | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const directiveName = ownMetadata.directive;
  const currentOutputConfig = ownMetadata.outputConfig as OutputConfig;

  // Effect to load selectedGzipFile from ID in toolState
  useEffect(() => {
    if (toolState.selectedGzipFileId && (!selectedGzipFile || selectedGzipFile.id !== toolState.selectedGzipFileId)) {
      setClientError(null);
      decompressor.clear();
      getFile(toolState.selectedGzipFileId)
        .then(file => {
          if (file) {
            setSelectedGzipFile(file);
          } else {
            setClientError(`Failed to load previously selected Gzip file (ID: ${toolState.selectedGzipFileId}). It may have been deleted.`);
            // Clear relevant parts of toolState if file not found
            setToolState(prev => ({
              ...prev,
              selectedGzipFileId: null,
              decompressedFileId: null,
              originalFilenameFromHeader: null,
              uncompressedSize: null,
            }));
            setSelectedGzipFile(null);
            setDecompressedStoredFile(null);
          }
        })
        .catch(err => {
          console.error("Error loading Gzip file by ID:", err);
          setClientError(`Error loading Gzip file: ${err.message}`);
        });
    } else if (!toolState.selectedGzipFileId && selectedGzipFile) {
      // If ID is cleared in toolState, clear local file state
      setSelectedGzipFile(null);
      setDecompressedStoredFile(null);
      decompressor.clear();
    }
  }, [toolState.selectedGzipFileId, getFile, setToolState, decompressor, selectedGzipFile]);

  // Effect to trigger decompression when selectedGzipFile changes
  useEffect(() => {
    if (selectedGzipFile?.blob) {
      decompressor.decompress(selectedGzipFile.blob).catch(_err => {
        // Error is handled by decompressor.error state
        console.error("Decompression initiation failed:", _err);
      });
    }
  }, [selectedGzipFile, decompressor.decompress]); // decompressor.decompress is stable

  // Effect to handle decompressor results (store decompressed file)
  useEffect(() => {
    if (decompressor.decompressedResult) {
      const { data, originalFilename: filenameFromHeader } = decompressor.decompressedResult;
      const finalFilename = filenameFromHeader || selectedGzipFile?.filename?.replace(/\.gz$/i, '') || 'decompressed_file';
      const mimeType = getMimeTypeForFile(finalFilename);
      const blob = new Blob([data], { type: mimeType });

      // Clean up old decompressed file if it exists and is temporary
      const oldDecompressedFileId = toolState.decompressedFileId;

      addFile(blob, finalFilename, mimeType, true, toolRoute) // true for temporary
        .then(async newId => {
          setToolState(prev => ({
            ...prev,
            decompressedFileId: newId,
            originalFilenameFromHeader: filenameFromHeader,
            uncompressedSize: data.length,
          }));
          await saveStateNow({
            ...toolState,
            decompressedFileId: newId,
            originalFilenameFromHeader: filenameFromHeader,
            uncompressedSize: data.length,
          });
          if (oldDecompressedFileId && oldDecompressedFileId !== newId) {
            const oldFile = await getFile(oldDecompressedFileId);
            if (oldFile?.isTemporary) {
              cleanupOrphanedTemporaryFiles([oldDecompressedFileId]).catch(e => console.warn("Cleanup of old decompressed file failed", e));
            }
          }
        })
        .catch(err => {
          console.error("Error adding decompressed file to library:", err);
          setClientError(`Failed to store decompressed file: ${err.message}`);
        });
    }
  }, [decompressor.decompressedResult, selectedGzipFile, addFile, setToolState, saveStateNow, toolState.decompressedFileId, toolRoute, getFile, cleanupOrphanedTemporaryFiles, toolState, decompressor]);

  // Effect to load StoredFile for decompressedFileId for ITDE and display
  useEffect(() => {
    if (toolState.decompressedFileId) {
      getFile(toolState.decompressedFileId)
        .then(file => {
          setDecompressedStoredFile(file || null);
        })
        .catch(err => {
          console.error("Error loading decompressed StoredFile:", err);
          setDecompressedStoredFile(null);
        });
    } else {
      setDecompressedStoredFile(null);
    }
  }, [toolState.decompressedFileId, getFile]);

  const handleGzipFileSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsSelectFileModalOpen(false);
    if (files.length === 0) return;
    const file = files[0];

    if (!file.type?.match(/gzip|x-gzip/i) && !file.filename?.toLowerCase().endsWith('.gz')) {
      setClientError('Invalid file type. Please select a .gz file.');
      return;
    }
    setClientError(null);

    const oldSelectedGzipFileId = toolState.selectedGzipFileId;
    const oldDecompressedFileId = toolState.decompressedFileId;

    const newState: GzipExplorerToolState = {
      ...DEFAULT_STATE, // Reset most state for a new file
      selectedGzipFileId: file.id,
    };
    setToolState(newState); // This will trigger useEffect to load selectedGzipFile
    await saveStateNow(newState);

    // Cleanup old files if they were different
    const idsToCleanup: string[] = [];
    if (oldSelectedGzipFileId && oldSelectedGzipFileId !== file.id) {
      const oldGzip = await getFile(oldSelectedGzipFileId);
      if (oldGzip?.isTemporary) idsToCleanup.push(oldSelectedGzipFileId);
    }
    if (oldDecompressedFileId) {
      const oldDecomp = await getFile(oldDecompressedFileId);
      if (oldDecomp?.isTemporary) idsToCleanup.push(oldDecompressedFileId);
    }
    if (idsToCleanup.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToCleanup).catch(e => console.warn("Cleanup during new file selection failed", e));
    }

  }, [setToolState, saveStateNow, toolState.selectedGzipFileId, toolState.decompressedFileId, getFile, cleanupOrphanedTemporaryFiles]);

  const handleClear = useCallback(async () => {
    const idsToCleanup: string[] = [];
    if (toolState.selectedGzipFileId) {
      const file = await getFile(toolState.selectedGzipFileId);
      if (file?.isTemporary) idsToCleanup.push(toolState.selectedGzipFileId);
    }
    if (toolState.decompressedFileId) {
      const file = await getFile(toolState.decompressedFileId);
      if (file?.isTemporary) idsToCleanup.push(toolState.decompressedFileId);
    }

    await clearToolStateAndPersist(); // Resets toolState to DEFAULT_STATE and saves

    setSelectedGzipFile(null);
    setDecompressedStoredFile(null);
    decompressor.clear();
    setClientError(null);
    setSaveSuccess(false);
    setDownloadSuccess(false);

    if (idsToCleanup.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToCleanup).catch(e => console.warn("Cleanup on clear failed", e));
    }
  }, [clearToolStateAndPersist, decompressor, toolState.selectedGzipFileId, toolState.decompressedFileId, getFile, cleanupOrphanedTemporaryFiles]);

  const handleInitiateSave = useCallback(async () => {
    if (!toolState.decompressedFileId) {
      setClientError("No decompressed file to save.");
      return;
    }
    try {
      await makeFilePermanentAndUpdate(toolState.decompressedFileId);
      setSaveSuccess(true);
      // Refresh decompressedStoredFile to reflect permanent status
      const updatedFile = await getFile(toolState.decompressedFileId);
      setDecompressedStoredFile(updatedFile || null);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setClientError(`Failed to save to library: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [toolState.decompressedFileId, makeFilePermanentAndUpdate, getFile]);

  const handleInitiateDownload = useCallback(() => {
    if (!decompressedStoredFile?.blob) {
      setClientError("No decompressed file content to download.");
      return;
    }
    setSuggestedFilenameForPrompt(decompressedStoredFile.filename || 'decompressed_file');
    setFilenamePromptAction('download');
    setIsFilenamePromptOpen(true);
  }, [decompressedStoredFile]);

  const handleFilenamePromptConfirm = useCallback((filename: string) => {
    setIsFilenamePromptOpen(false);
    if (!filenamePromptAction || !decompressedStoredFile?.blob) return;

    if (filenamePromptAction === 'download') {
      try {
        const url = URL.createObjectURL(decompressedStoredFile.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2000);
      } catch (err) {
        setClientError(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    setFilenamePromptAction(null);
  }, [filenamePromptAction, decompressedStoredFile]);

  const handlePreview = useCallback(async () => {
    if (!decompressedStoredFile?.blob) {
      setClientError("No decompressed file to preview.");
      return;
    }
    setIsPreviewModalOpen(true);
    setPreviewModalFilename(decompressedStoredFile.filename);
    setPreviewContent(null);
    setPreviewModalError(null);
    setPreviewType('loading');

    const filenameLower = decompressedStoredFile.filename.toLowerCase();
    const extension = filenameLower.substring(filenameLower.lastIndexOf('.') + 1);

    try {
      if (PREVIEWABLE_TEXT_EXTENSIONS.includes(extension) || decompressedStoredFile.type?.startsWith('text/')) {
        const text = await decompressedStoredFile.blob.text();
        setPreviewContent(
          text.length > MAX_TEXT_PREVIEW_SIZE
            ? text.substring(0, MAX_TEXT_PREVIEW_SIZE) + '\n\n--- Content truncated ---'
            : text
        );
        setPreviewType('text');
      } else if (PREVIEWABLE_IMAGE_EXTENSIONS.includes(extension) || decompressedStoredFile.type?.startsWith('image/')) {
        const objectURL = URL.createObjectURL(decompressedStoredFile.blob);
        setPreviewContent(objectURL); // Store URL to be revoked later
        setPreviewType('image');
      } else {
        setPreviewType('unsupported');
      }
    } catch (err) {
      setPreviewModalError(`Failed to load preview: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setPreviewType('unsupported');
    }
  }, [decompressedStoredFile]);

  const closePreviewModal = useCallback(() => {
    if (previewType === 'image' && previewContent?.startsWith('blob:')) {
      URL.revokeObjectURL(previewContent);
    }
    setIsPreviewModalOpen(false);
    setPreviewContent(null);
    setPreviewType(null);
    setPreviewModalError(null);
    setPreviewModalFilename(null);
  }, [previewType, previewContent]);

  // ITDE Handling
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
    let fileToProcess: StoredFile | null = null;

    if (receivedFileItem && (receivedFileItem.type?.match(/gzip|x-gzip/i) || ('filename' in receivedFileItem && (receivedFileItem as StoredFile).filename?.toLowerCase().endsWith('.gz')))) {
      if (!('id' in receivedFileItem)) { // InlineFile
        try {
          const tempName = `itde-received-${Date.now()}.gz`;
          const newId = await addFile(receivedFileItem.blob, tempName, receivedFileItem.type || 'application/gzip', true, toolRoute);
          fileToProcess = await getFile(newId);
          if (!fileToProcess) throw new Error('Failed to retrieve saved InlineFile');
        } catch (e) {
          setClientError(`Failed to process incoming Gzip: ${e instanceof Error ? e.message : String(e)}`);
          return;
        }
      } else { // StoredFile
        fileToProcess = receivedFileItem as StoredFile;
      }
    } else if (receivedFileItem) {
      setClientError(`Received file from ${signal.sourceToolTitle} is not a Gzip file (type: ${receivedFileItem.type}).`);
      return;
    }

    if (fileToProcess) {
      handleGzipFileSelectedFromModal([fileToProcess]); // Reuses existing selection logic
      setUserDeferredAutoPopup(false);
    } else {
      setClientError('No valid Gzip file found in ITDE data.');
    }
  }, [getToolMetadata, addFile, getFile, handleGzipFileSelectedFromModal, toolRoute]);

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
  }, [isLoadingToolState, itdeTarget, userDeferredAutoPopup, initialToolStateLoadCompleteRef]);

  const isLoading = isLoadingToolState || decompressor.isLoading;
  const displayError = clientError || toolStateError || decompressor.error;
  const canPerformOutputActions = !!toolState.decompressedFileId && !decompressor.isLoading && !decompressor.error;

  const decompressedFileForItde = useMemo(() => decompressedStoredFile ? [decompressedStoredFile] : [], [decompressedStoredFile]);

  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Gzip Explorer...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <Button
            variant="primary"
            onClick={() => setIsSelectFileModalOpen(true)}
            disabled={isLoading}
            iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
          >
            Select Gzip File
          </Button>
          <div className="flex gap-2 items-center">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            {(selectedGzipFile || toolState.decompressedFileId || displayError) && (
              <Button
                variant="danger"
                onClick={handleClear}
                disabled={isLoading}
                iconLeft={<ClearIcon className="h-5 w-5" />}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {displayError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div><strong className="font-semibold">Error:</strong> {displayError}</div>
        </div>
      )}

      {isLoading && !displayError && (
        <div className="text-center p-4 text-[rgb(var(--color-text-muted))]">
          <p className="animate-pulse">Processing...</p>
        </div>
      )}

      {selectedGzipFile && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md space-y-3">
          <h3 className="text-md font-semibold text-[rgb(var(--color-text-base))]">Selected Gzip File:</h3>
          <p className="text-sm"><strong>Name:</strong> {selectedGzipFile.filename}</p>
          <p className="text-sm"><strong>Size:</strong> {formatBytes(selectedGzipFile.size)}</p>
          <p className="text-sm"><strong>Type:</strong> {selectedGzipFile.type}</p>
        </div>
      )}

      {toolState.decompressedFileId && decompressedStoredFile && !decompressor.isLoading && !decompressor.error && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md space-y-4">
          <h3 className="text-md font-semibold text-[rgb(var(--color-text-base))]">Decompressed File Info:</h3>
          <p className="text-sm">
            <strong>Original Name (from header):</strong> {toolState.originalFilenameFromHeader || decompressedStoredFile.filename || <span className="italic">Not specified</span>}
          </p>
          <p className="text-sm">
            <strong>Uncompressed Size:</strong> {toolState.uncompressedSize !== null ? formatBytes(toolState.uncompressedSize) : <span className="italic">N/A</span>}
          </p>
          <p className="text-sm">
            <strong>Detected MIME Type:</strong> {decompressedStoredFile.type}
          </p>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[rgb(var(--color-border-base))]">
            <Button
              variant="neutral-outline"
              onClick={handlePreview}
              iconLeft={<DocumentMagnifyingGlassIcon className="h-5 w-5" />}
              disabled={isLoading}
            >
              Preview Content
            </Button>
            <OutputActionButtons
              canPerform={canPerformOutputActions}
              isSaveSuccess={saveSuccess}
              isDownloadSuccess={downloadSuccess}
              onInitiateSave={handleInitiateSave}
              onInitiateDownload={handleInitiateDownload}
              onClear={handleClear} // This clear is for the whole tool state
              directiveName={directiveName}
              outputConfig={currentOutputConfig}
              selectedOutputItems={decompressedFileForItde}
              canInitiateSave={!decompressedStoredFile.isTemporary === false} // Only allow save if it's temporary
            />
          </div>
        </div>
      )}

      {!isLoading && !selectedGzipFile && !displayError && (
        <div className="p-6 text-center border-2 border-dashed border-[rgb(var(--color-border-base))] rounded-lg">
          <InformationCircleIcon className="mx-auto h-12 w-12 text-[rgb(var(--color-text-muted))]" />
          <h3 className="mt-2 text-sm font-medium text-[rgb(var(--color-text-base))]">No Gzip file selected</h3>
          <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">Select a .gz file to explore its contents.</p>
        </div>
      )}

      <FileSelectionModal
        isOpen={isSelectFileModalOpen}
        onClose={() => setIsSelectFileModalOpen(false)}
        onFilesSelected={handleGzipFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".gz,application/gzip,application/x-gzip"
        selectionMode="single"
        libraryFilter={{ type: 'application/gzip' }} // Or more specific if known
        initialTab="upload"
      />

      <FilenamePromptModal
        isOpen={isFilenamePromptOpen}
        onClose={() => setIsFilenamePromptOpen(false)}
        onConfirm={handleFilenamePromptConfirm}
        initialFilename={suggestedFilenameForPrompt}
        title={filenamePromptAction === 'download' ? "Download Decompressed File" : "Save Decompressed File"}
        filenameAction={filenamePromptAction || 'download'}
      />

      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]" onClick={closePreviewModal}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 px-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
              <h3 className="text-lg font-semibold truncate" title={previewModalFilename || ''}>{previewModalFilename || 'Preview'}</h3>
              <Button variant="link" onClick={closePreviewModal} className="!p-1">
                <XCircleIcon className="h-6 w-6 text-gray-500 hover:text-gray-700" />
              </Button>
            </div>
            <div className="p-4 overflow-auto flex-grow min-h-[200px]">
              {previewType === 'loading' && <p className="text-center animate-pulse">Loading preview...</p>}
              {previewModalError && <div role="alert" className="p-2 bg-red-50 text-red-700 rounded text-sm"><strong>Error:</strong> {previewModalError}</div>}
              {!previewModalError && previewType === 'text' && <pre className="text-sm whitespace-pre-wrap break-words max-h-[calc(90vh-100px)] overflow-auto"><code>{previewContent}</code></pre>}
              {!previewModalError && previewType === 'image' && previewContent && (
                <div className="flex justify-center items-center h-full max-h-[calc(90vh-100px)]">
                  <Image src={previewContent} alt={previewModalFilename || 'Preview'} width={800} height={600} className="max-w-full max-h-full object-contain" onError={() => setPreviewModalError('Failed to load image.')} unoptimized />
                </div>
              )}
              {!previewModalError && previewType === 'unsupported' && <p className="text-center">Preview not available for this file type.</p>}
            </div>
          </div>
        </div>
      )}

      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={itdeTarget.acceptSignal}
        onIgnore={itdeTarget.ignoreSignal}
        onDeferAll={() => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); }}
        onIgnoreAll={() => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); }}
      />
    </div>
  );
}
