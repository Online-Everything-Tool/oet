'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import useToolState from '../../_hooks/useToolState';
import useGzipDecompressor from '../_hooks/useGzipDecompressor';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import { formatBytes, getMimeTypeForFile } from '@/app/lib/utils';

import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';

import { ArrowUpTrayIcon, DocumentTextIcon, PhotoIcon, QuestionMarkCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata as AppToolMetadata, OutputConfig } from '@/src/types/tools';
import ownToolMetadata from '../metadata.json';


interface GzipExplorerState {
  selectedGzipFileId: string | null;
  selectedGzipFileName: string | null;
  selectedGzipFileSize: number | null;
  decompressedFileId: string | null;
  decompressedFileNameSuggestion: string | null; // Filename suggested by decompressor
  uiError: string | null;
}

const DEFAULT_STATE: GzipExplorerState = {
  selectedGzipFileId: null,
  selectedGzipFileName: null,
  selectedGzipFileSize: null,
  decompressedFileId: null,
  decompressedFileNameSuggestion: null,
  uiError: null,
};

const MAX_TEXT_PREVIEW_SIZE = 1024 * 100; // 100KB for text preview

export default function GzipFileExplorerClient({ toolRoute }: { toolRoute: string }) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingPersistence,
    saveStateNow,
  } = useToolState<GzipExplorerState>(toolRoute, DEFAULT_STATE);

  const { getFile, addFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const decompressor = useGzipDecompressor();
  const { getToolMetadata } = useMetadata();

  const [currentGzipFile, setCurrentGzipFile] = useState<StoredFile | null>(null);
  const [decompressedFileInfo, setDecompressedFileInfo] = useState<{ name: string; type: string; size: number } | null>(null);
  
  const [previewContent, setPreviewContent] = useState<string | null>(null); // For text or data URL for image
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [isSelectFileModalOpen, setIsSelectFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameActionContext, setFilenameActionContext] = useState<'download' | 'save' | null>(null);
  
  const [userDeferredItdePopup, setUserDeferredItdePopup] = useState(false);
  const initialToolStateLoadComplete = useRef(false);

  const [copySuccess, setCopySuccess] = useState(false);
  const [saveToLibrarySuccess, setSaveToLibrarySuccess] = useState(false);
  const [downloadSuccessFlag, setDownloadSuccessFlag] = useState(false);

  const isLoading = isLoadingPersistence || decompressor.isLoading;
  const displayError = toolState.uiError || decompressor.error;
  const directiveName = (ownToolMetadata as AppToolMetadata).directive;

  // Effect for initial state load and GZIP file processing
  useEffect(() => {
    if (!isLoadingPersistence && !initialToolStateLoadComplete.current) {
      initialToolStateLoadComplete.current = true;
      if (toolState.selectedGzipFileId && !currentGzipFile) {
        getFile(toolState.selectedGzipFileId).then(file => {
          if (file) setCurrentGzipFile(file);
          else setToolState(prev => ({ ...prev, selectedGzipFileId: null, selectedGzipFileName: null, selectedGzipFileSize: null }));
        });
      }
    }
  }, [isLoadingPersistence, toolState.selectedGzipFileId, getFile, currentGzipFile, setToolState]);

  useEffect(() => {
    if (currentGzipFile && currentGzipFile.blob && currentGzipFile.id === toolState.selectedGzipFileId) {
      decompressor.decompressFile(currentGzipFile.blob, currentGzipFile.filename)
        .catch(e => console.error("Decompression initiation failed", e));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGzipFile]); // decompressor.decompressFile is stable

  // Effect to handle decompressor result
  useEffect(() => {
    if (decompressor.result && decompressor.result.blob) {
      const { blob, filename: suggestedName, mimeType } = decompressor.result;
      addFile(blob, suggestedName, mimeType, true) // Save as temporary initially
        .then(newId => {
          setToolState(prev => ({
            ...prev,
            decompressedFileId: newId,
            decompressedFileNameSuggestion: suggestedName,
            uiError: null,
          }));
        })
        .catch(e => {
          setToolState(prev => ({ ...prev, uiError: `Failed to store decompressed file: ${e.message}` }));
        });
    } else if (decompressor.error) {
       setToolState(prev => ({ ...prev, uiError: decompressor.error, decompressedFileId: null, decompressedFileNameSuggestion: null }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decompressor.result, decompressor.error, addFile, setToolState]); // toolState setter is stable

  // Effect for loading decompressed file info and preview
  useEffect(() => {
    let objectUrlToRevoke: string | null = null;
    const loadPreviewAndInfo = async () => {
      if (!toolState.decompressedFileId) {
        setPreviewContent(null); setPreviewMime(null); setDecompressedFileInfo(null);
        return;
      }
      setIsPreviewLoading(true);
      setPreviewContent(null); setPreviewMime(null);

      const file = await getFile(toolState.decompressedFileId);
      if (file && file.blob) {
        setDecompressedFileInfo({ name: file.filename, type: file.type, size: file.size });
        setPreviewMime(file.type);
        if (file.type.startsWith('text/')) {
          try {
            const text = await file.blob.text();
            setPreviewContent(text.length > MAX_TEXT_PREVIEW_SIZE ? text.substring(0, MAX_TEXT_PREVIEW_SIZE) + "\n\n--- Preview Truncated ---" : text);
          } catch (e) { setPreviewContent('Error reading text content.'); }
        } else if (file.type.startsWith('image/')) {
          objectUrlToRevoke = URL.createObjectURL(file.blob);
          setPreviewContent(objectUrlToRevoke);
        } else {
          setPreviewContent(null);
        }
      } else {
        setDecompressedFileInfo(null);
      }
      setIsPreviewLoading(false);
    };
    loadPreviewAndInfo();
    return () => { if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke); };
  }, [toolState.decompressedFileId, getFile]);

  const handleClear = useCallback(async () => {
    const idsToClean: string[] = [];
    if (toolState.selectedGzipFileId) idsToClean.push(toolState.selectedGzipFileId);
    if (toolState.decompressedFileId) idsToClean.push(toolState.decompressedFileId);
    
    setCurrentGzipFile(null);
    decompressor.reset();
    setToolState(DEFAULT_STATE);
    await saveStateNow(DEFAULT_STATE);
    setDecompressedFileInfo(null);
    setPreviewContent(null);
    setPreviewMime(null);
    setCopySuccess(false);
    setSaveToLibrarySuccess(false);
    setDownloadSuccessFlag(false);

    if (idsToClean.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToClean).catch(e => console.error("Cleanup failed on clear:", e));
    }
  }, [toolState, decompressor, setToolState, saveStateNow, cleanupOrphanedTemporaryFiles]);

  const handleFileSelectedFromModal = useCallback(async (files: StoredFile[], source: 'library' | 'upload') => {
    setIsSelectFileModalOpen(false);
    if (files.length === 0) return;
    const newGzipFile = files[0];

    if (!newGzipFile.type.match(/gzip|x-gzip/) && !newGzipFile.filename.toLowerCase().endsWith('.gz')) {
      setToolState(prev => ({ ...prev, uiError: "Selected file does not appear to be a Gzip file." }));
      return;
    }
    
    const oldSelectedId = toolState.selectedGzipFileId;
    const oldDecompressedId = toolState.decompressedFileId;
    const idsToClean: string[] = [];
    if (oldSelectedId && oldSelectedId !== newGzipFile.id) idsToClean.push(oldSelectedId);
    if (oldDecompressedId) idsToClean.push(oldDecompressedId);

    setCurrentGzipFile(newGzipFile);
    setToolState(prev => ({
      ...DEFAULT_STATE, // Reset most state for new file
      selectedGzipFileId: newGzipFile.id,
      selectedGzipFileName: newGzipFile.filename,
      selectedGzipFileSize: newGzipFile.size,
      uiError: null,
    }));
    decompressor.reset();
    setDecompressedFileInfo(null);
    setPreviewContent(null);
    setPreviewMime(null);

    if (idsToClean.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToClean).catch(e => console.error("Cleanup failed on new file selection:", e));
    }
  }, [toolState.selectedGzipFileId, toolState.decompressedFileId, setToolState, decompressor, cleanupOrphanedTemporaryFiles]);

  const handleProcessItdeSignal = useCallback(async (signal: IncomingSignal) => {
    setUserDeferredItdePopup(false);
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setToolState(prev => ({ ...prev, uiError: `Metadata not found for source: ${signal.sourceToolTitle}` }));
      return;
    }
    const resolvedData: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
    if (resolvedData.type === 'error' || !resolvedData.data || resolvedData.data.length === 0) {
      setToolState(prev => ({ ...prev, uiError: resolvedData.errorMessage || "No data received." }));
      return;
    }
    const item = resolvedData.data[0];
    if (item && ('id' in item) && (item.type.match(/gzip|x-gzip/) || (item as StoredFile).filename.toLowerCase().endsWith('.gz'))) {
      handleFileSelectedFromModal([item as StoredFile], 'library'); // Treat as if selected from library
    } else if (item && !('id' in item) && (item.type.match(/gzip|x-gzip/))) { // InlineFile
        try {
            const tempName = `itde-received-${Date.now()}.gz`;
            const newId = await addFile(item.blob, tempName, item.type, true); // Save as temp
            const newlyFetchedFile = await getFile(newId);
            if (newlyFetchedFile) handleFileSelectedFromModal([newlyFetchedFile], 'upload');
            else throw new Error("Failed to retrieve saved InlineFile");
        } catch (e) {
            setToolState(prev => ({ ...prev, uiError: `Error processing ITDE Gzip data: ${e instanceof Error ? e.message : String(e)}`}));
        }
    } else {
      setToolState(prev => ({ ...prev, uiError: "Received data is not a Gzip file." }));
    }
  }, [getToolMetadata, setToolState, handleFileSelectedFromModal, addFile, getFile]);

  const itdeHandler = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessItdeSignal,
  });

  useEffect(() => {
    if (initialToolStateLoadComplete.current && itdeHandler.pendingSignals.length > 0 && !itdeHandler.isModalOpen && !userDeferredItdePopup) {
      itdeHandler.openModalIfSignalsExist();
    }
  }, [itdeHandler, userDeferredItdePopup]);

  const handleFilenameConfirm = useCallback(async (chosenFilename: string) => {
    setIsFilenameModalOpen(false);
    if (!toolState.decompressedFileId || !filenameActionContext) return;

    const fileToActOn = await getFile(toolState.decompressedFileId);
    if (!fileToActOn || !fileToActOn.blob) {
      setToolState(prev => ({ ...prev, uiError: "Decompressed file data not found." }));
      return;
    }

    const finalFilename = chosenFilename || fileToActOn.filename || "decompressed_file";

    if (filenameActionContext === 'download') {
      const url = URL.createObjectURL(fileToActOn.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccessFlag(true);
      setTimeout(() => setDownloadSuccessFlag(false), 2000);
    } else if (filenameActionContext === 'save') {
      try {
        await makeFilePermanentAndUpdate(toolState.decompressedFileId, finalFilename);
        setDecompressedFileInfo(prev => prev ? {...prev, name: finalFilename} : null);
        setSaveToLibrarySuccess(true);
        setTimeout(() => setSaveToLibrarySuccess(false), 2000);
      } catch (e) {
        setToolState(prev => ({ ...prev, uiError: `Failed to save to library: ${e.message}` }));
      }
    }
    setFilenameActionContext(null);
  }, [toolState.decompressedFileId, filenameActionContext, getFile, makeFilePermanentAndUpdate, setToolState]);

  const initiateOutputAction = (action: 'download' | 'save') => {
    if (!toolState.decompressedFileId) {
      setToolState(prev => ({ ...prev, uiError: "No decompressed file to perform action on." }));
      return;
    }
    setFilenameActionContext(action);
    setIsFilenameModalOpen(true);
  };

  const handleCopyToClipboard = useCallback(async () => {
    if (!previewContent || !previewMime?.startsWith('text/')) {
      setToolState(prev => ({ ...prev, uiError: "No text content to copy." }));
      return;
    }
    try {
      await navigator.clipboard.writeText(previewContent);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (e) {
      setToolState(prev => ({ ...prev, uiError: "Failed to copy to clipboard." }));
    }
  }, [previewContent, previewMime, setToolState]);

  const handlePreSignalForITDE = async (): Promise<boolean | void> => {
    if (!toolState.decompressedFileId) {
      setToolState(prev => ({ ...prev, uiError: 'No decompressed file available to send.' }));
      return false;
    }
    await saveStateNow(); // Ensure state with decompressedFileId is saved
    return true;
  };
  
  const canPerformOutputActions = !!toolState.decompressedFileId && !decompressor.isLoading && !decompressor.error;

  if (isLoadingPersistence && !initialToolStateLoadComplete.current) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Gzip Explorer...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">Input Gzip File</h2>
          <div className="flex items-center gap-2">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeHandler.pendingSignals.length > 0 && userDeferredItdePopup && !itdeHandler.isModalOpen}
              pendingSignalCount={itdeHandler.pendingSignals.length}
              onReviewIncomingClick={itdeHandler.openModalIfSignalsExist}
            />
            <Button variant="primary" onClick={() => setIsSelectFileModalOpen(true)} iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />} disabled={isLoading}>
              Select Gzip File
            </Button>
          </div>
        </div>
        {currentGzipFile ? (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Selected: <strong>{currentGzipFile.filename}</strong> ({formatBytes(currentGzipFile.size)})
          </p>
        ) : (
          <p className="text-sm text-[rgb(var(--color-text-muted))] italic">No Gzip file selected.</p>
        )}
      </div>

      {/* Error Display */}
      {displayError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div><strong className="font-semibold">Error:</strong> {displayError}</div>
        </div>
      )}

      {/* Decompression Status / Output Section */}
      {(isLoading && !displayError && currentGzipFile) && (
        <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Decompressing...</p>
      )}

      {toolState.decompressedFileId && decompressedFileInfo && !isLoading && !displayError && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <h3 className="text-md font-semibold text-[rgb(var(--color-text-base))] mb-2">Decompressed Content:</h3>
          <div className="mb-3 p-3 bg-[rgb(var(--color-bg-subtle))] rounded">
            <p><strong>Original Name:</strong> {decompressedFileInfo.name}</p>
            <p><strong>Type:</strong> {decompressedFileInfo.type || 'Unknown'}</p>
            <p><strong>Size:</strong> {formatBytes(decompressedFileInfo.size)}</p>
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Preview:</h4>
            {isPreviewLoading ? (
              <p className="italic text-sm animate-pulse">Loading preview...</p>
            ) : previewContent ? (
              previewMime?.startsWith('text/') ? (
                <pre className="text-xs bg-white p-2 border border-[rgb(var(--color-border-base))] rounded max-h-60 overflow-auto whitespace-pre-wrap break-all">
                  <code>{previewContent}</code>
                </pre>
              ) : previewMime?.startsWith('image/') ? (
                <div className="border border-[rgb(var(--color-border-base))] rounded p-2 flex justify-center items-center max-h-80 bg-white">
                  <Image src={previewContent} alt="Image preview" width={300} height={300} className="max-w-full max-h-72 object-contain" unoptimized/>
                </div>
              ) : (
                <p className="text-sm italic p-2 bg-white border rounded">Preview not available for type: {previewMime}.</p>
              )
            ) : (
              <p className="text-sm italic p-2 bg-white border rounded">No preview available.</p>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 pt-3 border-t border-[rgb(var(--color-border-base))]">
            <OutputActionButtons
              canPerform={canPerformOutputActions}
              isSaveSuccess={saveToLibrarySuccess}
              isCopySuccess={copySuccess}
              isDownloadSuccess={downloadSuccessFlag}
              onInitiateSave={() => initiateOutputAction('save')}
              onInitiateDownload={() => initiateOutputAction('download')}
              onCopy={previewMime?.startsWith('text/') ? handleCopyToClipboard : undefined}
              onClear={handleClear}
              directiveName={directiveName}
              outputConfig={ownToolMetadata.outputConfig as OutputConfig}
            />
          </div>
        </div>
      )}
      
      {/* Modals */}
      <FileSelectionModal
        isOpen={isSelectFileModalOpen}
        onClose={() => setIsSelectFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".gz,application/gzip,application/x-gzip"
        selectionMode="single"
        libraryFilter={{ type: 'application/gzip' }} // Also consider x-gzip
        initialTab="upload"
      />
      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => { setIsFilenameModalOpen(false); setFilenameActionContext(null); }}
        onConfirm={handleFilenameConfirm}
        initialFilename={toolState.decompressedFileNameSuggestion || decompressedFileInfo?.name || "decompressed_file"}
        title={filenameActionContext === 'download' ? "Download Decompressed File" : "Save Decompressed File to Library"}
        filenameAction={filenameActionContext || "download"}
      />
      <IncomingDataModal
        isOpen={itdeHandler.isModalOpen}
        signals={itdeHandler.pendingSignals}
        onAccept={itdeHandler.acceptSignal}
        onIgnore={itdeHandler.ignoreSignal}
        onDeferAll={() => { setUserDeferredItdePopup(true); itdeHandler.closeModal(); }}
        onIgnoreAll={() => { setUserDeferredItdePopup(false); itdeHandler.ignoreAllSignals(); }}
      />
    </div>
  );
}