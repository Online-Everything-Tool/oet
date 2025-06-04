'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import useGzipDecompression, { DecompressionResult } from '../_hooks/useGzipDecompression';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { formatBytes, PREVIEWABLE_IMAGE_EXTENSIONS, PREVIEWABLE_TEXT_EXTENSIONS } from '@/app/lib/utils';
import {
  ArrowUpTrayIcon,
  DocumentMagnifyingGlassIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import toolSpecificMetadata from '../metadata.json';

interface GzipExplorerToolState {
  selectedGzipFileId: string | null;
  selectedGzipFileName: string | null;
  selectedGzipFileSize: number | null;
  decompressedFileId: string | null; // StoredFile ID of the decompressed content
  lastDecompressedInfo: {
    name: string;
    type: string;
    size: number;
  } | null;
}

const DEFAULT_GZIP_TOOL_STATE: GzipExplorerToolState = {
  selectedGzipFileId: null,
  selectedGzipFileName: null,
  selectedGzipFileSize: null,
  decompressedFileId: null,
  lastDecompressedInfo: null,
};

const MAX_TEXT_PREVIEW_SIZE = 1024 * 100; // 100KB
const ownMetadata = toolSpecificMetadata as ToolMetadata;

interface GzipFileExplorerClientProps {
  toolRoute: string;
}

export default function GzipFileExplorerClient({ toolRoute }: GzipFileExplorerClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
  } = useToolState<GzipExplorerToolState>(toolRoute, DEFAULT_GZIP_TOOL_STATE);

  const { getFile, addFile, deleteFilePermanently, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { decompress, isLoading: isDecompressing, error: decompressionError } = useGzipDecompression();
  const { getToolMetadata } = useMetadata();

  const [currentGzipFile, setCurrentGzipFile] = useState<StoredFile | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // General processing like loading file

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContentUrl, setPreviewContentUrl] = useState<string | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'text' | 'image' | 'unsupported' | 'loading' | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isSelectFileModalOpen, setIsSelectFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameActionType, setFilenameActionType] = useState<'download' | 'save' | null>(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] = useState('');

  const [copySuccess, setCopySuccess] = useState(false); // Not used for Gzip, but OutputActionButtons expects it
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const directiveName = ownMetadata.directive;
  const isLoading = isLoadingToolState || isDecompressing || isProcessing;
  const displayError = clientError || decompressionError;

  // Effect to load the GZIP file from Dexie when selectedGzipFileId changes
  useEffect(() => {
    if (toolState.selectedGzipFileId && !isLoadingToolState) {
      setIsProcessing(true);
      setClientError(null);
      getFile(toolState.selectedGzipFileId)
        .then((file) => {
          if (file) {
            setCurrentGzipFile(file);
          } else {
            setClientError(`Failed to load GZIP file (ID: ${toolState.selectedGzipFileId}). It may no longer exist.`);
            // Clear relevant parts of state if file not found
            setToolState(prev => ({
              ...prev,
              selectedGzipFileId: null,
              selectedGzipFileName: null,
              selectedGzipFileSize: null,
              decompressedFileId: null,
              lastDecompressedInfo: null,
            }));
            setCurrentGzipFile(null);
          }
        })
        .catch((err) => {
          console.error("Error loading GZIP file:", err);
          setClientError(`Error loading GZIP file: ${err instanceof Error ? err.message : String(err)}`);
        })
        .finally(() => setIsProcessing(false));
    } else if (!toolState.selectedGzipFileId) {
      setCurrentGzipFile(null); // Clear if no ID
    }
  }, [toolState.selectedGzipFileId, getFile, isLoadingToolState, setToolState]);

  // Effect to trigger decompression when currentGzipFile changes
  useEffect(() => {
    if (currentGzipFile && currentGzipFile.blob) {
      const oldDecompressedFileId = toolState.decompressedFileId;
      decompress(currentGzipFile)
        .then(async (result: DecompressionResult) => {
          const newDecompressedFileId = await addFile(result.blob, result.fileName, result.mimeType, true, toolRoute); // Save as temporary
          
          const newStateUpdate: Partial<GzipExplorerToolState> = {
            decompressedFileId: newDecompressedFileId,
            lastDecompressedInfo: {
              name: result.fileName,
              type: result.mimeType,
              size: result.decompressedSize,
            },
          };
          setToolState(prev => ({...prev, ...newStateUpdate}));
          await saveStateNow({...toolState, ...newStateUpdate});

          if (oldDecompressedFileId && oldDecompressedFileId !== newDecompressedFileId) {
             // Asynchronously clean up the old temporary file
            cleanupOrphanedTemporaryFiles([oldDecompressedFileId]).catch(e => console.warn("Failed to cleanup old decompressed file", e));
          }
        })
        .catch((err) => {
          // Error is already set by useGzipDecompression hook, or handled there
          console.error("Decompression process failed:", err);
          setToolState(prev => ({...prev, decompressedFileId: null, lastDecompressedInfo: null}));
        });
    } else if (!currentGzipFile) {
       // If currentGzipFile is cleared, clear decompressed info too
      if (toolState.decompressedFileId || toolState.lastDecompressedInfo) {
        const oldId = toolState.decompressedFileId;
        const clearedState: Partial<GzipExplorerToolState> = { decompressedFileId: null, lastDecompressedInfo: null };
        setToolState(prev => ({...prev, ...clearedState}));
        saveStateNow({...toolState, ...clearedState});
        if (oldId) {
          cleanupOrphanedTemporaryFiles([oldId]).catch(e => console.warn("Failed to cleanup old decompressed file on clear", e));
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGzipFile, decompress, addFile, toolRoute, saveStateNow /* setToolState, toolState.decompressedFileId are dependencies but cause loops if not careful */ ]);


  const handleFileSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsSelectFileModalOpen(false);
    setClientError(null);
    const file = files[0];
    if (file) {
      if (file.type === 'application/gzip' || file.type === 'application/x-gzip' || file.filename.toLowerCase().endsWith('.gz')) {
        const oldSelectedFileId = toolState.selectedGzipFileId;
        const oldDecompressedFileId = toolState.decompressedFileId;

        const newState: Partial<GzipExplorerToolState> = {
          selectedGzipFileId: file.id,
          selectedGzipFileName: file.filename,
          selectedGzipFileSize: file.size,
          decompressedFileId: null, // Will be set by effect after decompression
          lastDecompressedInfo: null,
        };
        setToolState(newState); 
        // setCurrentGzipFile will be set by the effect listening to selectedGzipFileId
        
        // Cleanup old files if they were different
        const idsToCleanup: string[] = [];
        if (oldSelectedFileId && oldSelectedFileId !== file.id) idsToCleanup.push(oldSelectedFileId);
        if (oldDecompressedFileId) idsToCleanup.push(oldDecompressedFileId);
        
        if (idsToCleanup.length > 0) {
          cleanupOrphanedTemporaryFiles(idsToCleanup).catch(e => console.warn("Failed to cleanup old files on new selection", e));
        }
      } else {
        setClientError('Invalid file. Please select a .gz file.');
      }
    }
  }, [toolState.selectedGzipFileId, toolState.decompressedFileId, setToolState, cleanupOrphanedTemporaryFiles]);

  const handleClear = useCallback(async () => {
    const idsToCleanup: string[] = [];
    if (toolState.selectedGzipFileId) idsToCleanup.push(toolState.selectedGzipFileId);
    if (toolState.decompressedFileId) idsToCleanup.push(toolState.decompressedFileId);

    setCurrentGzipFile(null);
    setClientError(null);
    setIsPreviewOpen(false);
    setPreviewContentUrl(null);
    setPreviewTextContent(null);
    
    setToolState(DEFAULT_GZIP_TOOL_STATE);
    await saveStateNow(DEFAULT_GZIP_TOOL_STATE);

    if (idsToCleanup.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToCleanup).catch(e => console.warn("Failed to cleanup files on clear", e));
    }
    setSaveSuccess(false);
    setDownloadSuccess(false);
  }, [toolState.selectedGzipFileId, toolState.decompressedFileId, setToolState, saveStateNow, cleanupOrphanedTemporaryFiles]);

  const handlePreviewDecompressed = async () => {
    if (!toolState.decompressedFileId) {
      setPreviewError("No decompressed file available to preview.");
      setPreviewType('unsupported');
      setIsPreviewOpen(true);
      return;
    }

    setIsPreviewOpen(true);
    setPreviewType('loading');
    setPreviewError(null);
    setPreviewTextContent(null);
    setPreviewContentUrl(null);

    try {
      const decompressedFile = await getFile(toolState.decompressedFileId);
      if (!decompressedFile || !decompressedFile.blob) {
        throw new Error("Decompressed file data not found in library.");
      }

      const { name, type } = toolState.lastDecompressedInfo || { name: 'file', type: decompressedFile.type };
      const extension = name.substring(name.lastIndexOf('.') + 1).toLowerCase();

      if (PREVIEWABLE_TEXT_EXTENSIONS.includes(extension) || type.startsWith('text/')) {
        const text = await decompressedFile.blob.text();
        setPreviewTextContent(text.length > MAX_TEXT_PREVIEW_SIZE ? text.substring(0, MAX_TEXT_PREVIEW_SIZE) + "\n\n--- Content truncated ---" : text);
        setPreviewType('text');
      } else if (PREVIEWABLE_IMAGE_EXTENSIONS.includes(extension) || type.startsWith('image/')) {
        const url = URL.createObjectURL(decompressedFile.blob);
        setPreviewContentUrl(url); // Revoke this in useEffect cleanup for previewContentUrl
        setPreviewType('image');
      } else {
        setPreviewType('unsupported');
      }
    } catch (err) {
      setPreviewError(`Failed to load preview: ${err instanceof Error ? err.message : String(err)}`);
      setPreviewType('unsupported');
    }
  };
  
  useEffect(() => {
    const url = previewContentUrl;
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previewContentUrl]);

  const closePreview = useCallback(() => setIsPreviewOpen(false), []);

  const handleFilenameConfirm = useCallback(async (chosenFilename: string) => {
    const action = filenameActionType;
    setIsFilenameModalOpen(false);
    setFilenameActionType(null);

    if (!action || !toolState.decompressedFileId) {
      setClientError(clientError || "No decompressed file to process.");
      return;
    }

    const decompressedFile = await getFile(toolState.decompressedFileId);
    if (!decompressedFile || !decompressedFile.blob) {
      setClientError("Decompressed file data not found.");
      return;
    }
    
    let finalFilename = chosenFilename.trim();
    if (!finalFilename) finalFilename = toolState.lastDecompressedInfo?.name || 'decompressed_file';

    if (action === 'download') {
      try {
        const url = URL.createObjectURL(decompressedFile.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        setDownloadSuccess(true);
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        if (clientError) setClientError(null);
        setTimeout(() => setDownloadSuccess(false), 2000);
      } catch (err) {
        setClientError(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (action === 'save') {
      try {
        // The file is already in Dexie (as temporary). Make it permanent.
        // For simplicity, we'll use addFile which handles put (update if exists)
        // and then we can ensure isTemporary is false.
        // A more direct update might be `makeFilePermanentAndUpdate` from FileLibraryContext if available.
        // For now, let's re-add with permanent flag.
        await deleteFilePermanently(toolState.decompressedFileId); // remove old temp entry
        const newPermanentId = await addFile(decompressedFile.blob, finalFilename, decompressedFile.type, false, toolRoute);
        setToolState(prev => ({...prev, decompressedFileId: newPermanentId})); // update state with new permanent ID
        setSaveSuccess(true);
        if (clientError) setClientError(null);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        setClientError(`Save to library failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [filenameActionType, toolState.decompressedFileId, toolState.lastDecompressedInfo, getFile, addFile, deleteFilePermanently, clientError, toolRoute, setToolState]);

  const initiateOutputAction = (action: 'download' | 'save') => {
    if (!toolState.decompressedFileId || !toolState.lastDecompressedInfo) {
      setClientError(`No decompressed file available to ${action}.`);
      return;
    }
    setClientError(null);
    setSuggestedFilenameForPrompt(toolState.lastDecompressedInfo.name);
    setFilenameActionType(action);
    setIsFilenameModalOpen(true);
  };

  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    setClientError(null);
    setIsProcessing(true);
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setClientError(`Metadata not found for source: ${signal.sourceToolTitle}`);
      setIsProcessing(false);
      return;
    }

    const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
    if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
      setClientError(resolvedPayload.errorMessage || 'No data received from source.');
      setIsProcessing(false);
      return;
    }

    const receivedFileItem = resolvedPayload.data[0];
    let fileToProcess: StoredFile | null = null;

    if (receivedFileItem && (receivedFileItem.type === 'application/gzip' || receivedFileItem.type === 'application/x-gzip' || ('name' in receivedFileItem && (receivedFileItem as StoredFile).filename.toLowerCase().endsWith('.gz')))) {
      if (!('id' in receivedFileItem)) { // InlineFile
        try {
          const tempName = `itde-received-${Date.now()}.gz`;
          const newId = await addFile(receivedFileItem.blob, tempName, receivedFileItem.type, true, toolRoute);
          fileToProcess = await getFile(newId);
          if (!fileToProcess) throw new Error('Failed to retrieve saved InlineFile');
        } catch (e) {
          setClientError(`Failed to process incoming GZIP: ${e instanceof Error ? e.message : String(e)}`);
          setIsProcessing(false);
          return;
        }
      } else { // StoredFile
        fileToProcess = receivedFileItem as StoredFile;
      }
    } else if (receivedFileItem) {
      setClientError(`Received file from ${signal.sourceToolTitle} is not a GZIP file (type: ${receivedFileItem.type}).`);
      setIsProcessing(false);
      return;
    }

    if (fileToProcess) {
      const oldSelectedId = toolState.selectedGzipFileId;
      const oldDecompressedId = toolState.decompressedFileId;
      
      const newStateUpdate: Partial<GzipExplorerToolState> = {
        selectedGzipFileId: fileToProcess.id,
        selectedGzipFileName: fileToProcess.filename,
        selectedGzipFileSize: fileToProcess.size,
        decompressedFileId: null, // Will be set by effect
        lastDecompressedInfo: null,
      };
      setToolState(newStateUpdate);
      // setCurrentGzipFile will be set by effect
      setUserDeferredAutoPopup(false);

      const idsToCleanup: string[] = [];
      if(oldSelectedId && oldSelectedId !== fileToProcess.id) idsToCleanup.push(oldSelectedId);
      if(oldDecompressedId) idsToCleanup.push(oldDecompressedId);
      if(idsToCleanup.length > 0) {
        cleanupOrphanedTemporaryFiles(idsToCleanup).catch(e => console.warn("Cleanup failed after ITDE", e));
      }

    }
    setIsProcessing(false);
  }, [getToolMetadata, addFile, getFile, setToolState, toolState.selectedGzipFileId, toolState.decompressedFileId, cleanupOrphanedTemporaryFiles, toolRoute]);

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
  const handleModalAccept = (sd: string) => itdeTarget.acceptSignal(sd);
  const handleModalIgnore = (sd: string) => {
    itdeTarget.ignoreSignal(sd);
    if (itdeTarget.pendingSignals.filter(s => s.sourceDirective !== sd).length === 0) setUserDeferredAutoPopup(false);
  };

  const canPerformOutputActions = !!toolState.decompressedFileId && !!toolState.lastDecompressedInfo && !displayError;

  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-gray-500 animate-pulse">Loading Gzip File Explorer...</p>;
  }

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
          <ReceiveItdeDataTrigger
            hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
            pendingSignalCount={itdeTarget.pendingSignals.length}
            onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
          />
        </div>
        {toolState.selectedGzipFileName && (
          <div className="mt-3 text-sm">
            <p><strong>Selected GZIP File:</strong> {toolState.selectedGzipFileName}</p>
            <p><strong>Size:</strong> {toolState.selectedGzipFileSize ? formatBytes(toolState.selectedGzipFileSize) : 'N/A'}</p>
          </div>
        )}
      </div>

      {isLoading && <p className="text-center p-4 italic text-gray-500 animate-pulse">Processing...</p>}
      
      {displayError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          <strong className="font-semibold">Error:</strong> {displayError}
        </div>
      )}

      {toolState.lastDecompressedInfo && !isDecompressing && !decompressionError && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <h3 className="text-lg font-semibold mb-2">Decompressed File Information:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <p><strong>Name:</strong> {toolState.lastDecompressedInfo.name}</p>
            <p><strong>Type:</strong> {toolState.lastDecompressedInfo.type}</p>
            <p><strong>Size:</strong> {formatBytes(toolState.lastDecompressedInfo.size)}</p>
            <p><strong>Original GZIP Size:</strong> {toolState.selectedGzipFileSize ? formatBytes(toolState.selectedGzipFileSize) : 'N/A'}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="neutral-outline"
              onClick={handlePreviewDecompressed}
              disabled={isLoading}
              iconLeft={<EyeIcon className="h-5 w-5" />}
            >
              Preview
            </Button>
            <OutputActionButtons
              canPerform={canPerformOutputActions}
              isSaveSuccess={saveSuccess}
              isCopySuccess={copySuccess} // Not applicable for Gzip, but part of component
              isDownloadSuccess={downloadSuccess}
              onInitiateSave={() => initiateOutputAction('save')}
              onInitiateDownload={() => initiateOutputAction('download')}
              onCopy={undefined} // No direct text copy for Gzip explorer output
              onClear={handleClear}
              directiveName={directiveName}
              outputConfig={ownMetadata.outputConfig}
              selectedOutputItems={toolState.decompressedFileId ? [{id: toolState.decompressedFileId, type: toolState.lastDecompressedInfo.type, filename: toolState.lastDecompressedInfo.name} as StoredFile] : []}
            />
          </div>
        </div>
      )}
      
      {!toolState.selectedGzipFileId && !isLoading && !displayError && (
         <div className="p-6 border-2 border-dashed border-[rgb(var(--color-border-base))] rounded-md text-center">
            <DocumentMagnifyingGlassIcon className="mx-auto h-12 w-12 text-[rgb(var(--color-text-muted))]" />
            <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
              Select a GZIP (.gz) file to view its decompressed content.
            </p>
          </div>
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
        onClose={() => { setIsFilenameModalOpen(false); setFilenameActionType(null); }}
        onConfirm={handleFilenameConfirm}
        initialFilename={suggestedFilenameForPrompt}
        title={filenameActionType === 'download' ? 'Enter Download Filename' : 'Enter Filename for Library'}
        filenameAction={filenameActionType || 'download'}
        promptMessage={filenameActionType === 'download' ? 'Please enter a filename for the download:' : 'Please enter a filename to save to the library:'}
        confirmButtonText={filenameActionType === 'download' ? 'Download' : 'Save to Library'}
      />

      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]" onClick={closePreview}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 px-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
              <h3 className="text-lg font-semibold truncate" title={toolState.lastDecompressedInfo?.name || 'Preview'}>
                Preview: {toolState.lastDecompressedInfo?.name || 'File'}
              </h3>
              <Button variant="link" onClick={closePreview} className="!p-1">
                <XCircleIcon className="h-6 w-6 text-gray-500 hover:text-gray-700" />
              </Button>
            </div>
            <div className="p-4 overflow-auto flex-grow min-h-[200px]">
              {previewType === 'loading' && <p className="text-center animate-pulse">Loading preview...</p>}
              {previewError && <div role="alert" className="p-2 bg-red-50 text-red-700 rounded text-sm"><strong className="font-semibold">Error:</strong> {previewError}</div>}
              {!previewError && previewType === 'text' && <pre className="text-sm whitespace-pre-wrap break-words max-h-[calc(90vh-100px)] overflow-auto"><code>{previewTextContent}</code></pre>}
              {!previewError && previewType === 'image' && previewContentUrl && (
                <div className="flex justify-center items-center h-full max-h-[calc(90vh-100px)]">
                  <Image src={previewContentUrl} alt={toolState.lastDecompressedInfo?.name || 'Preview'} width={800} height={600} className="max-w-full max-h-full object-contain" onError={() => setPreviewError('Failed to load image.')} unoptimized />
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
        onAccept={handleModalAccept}
        onIgnore={handleModalIgnore}
        onDeferAll={handleModalDeferAll}
        onIgnoreAll={handleModalIgnoreAll}
      />
    </div>
  );
}