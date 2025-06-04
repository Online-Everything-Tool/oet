'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import useGzipDecompress, { GzipHeaderInfo } from '../_hooks/useGzipDecompress';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import Button from '../../_components/form/Button';
import Textarea from '../../_components/form/Textarea';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import type { StoredFile } from '@/src/types/storage';
import {
  formatBytes,
  getMimeTypeForFile,
  isTextBasedMimeType,
  bufferToHex,
} from '@/app/lib/utils';
import {
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  PhotoIcon,
  CpuChipIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import Image from 'next/image';

import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import toolSpecificMetadata from '../metadata.json';
import type { ToolMetadata as AppToolMetadata } from '@/src/types/tools';

const ownMetadata = toolSpecificMetadata as AppToolMetadata;
const MAX_TEXT_PREVIEW_SIZE_BYTES = 1024 * 100; // 100KB
const MAX_HEX_PREVIEW_BYTES = 512; // Show first 512 bytes for hex

interface GzipExplorerToolState {
  inputFileId: string | null;
  inputFileName: string | null;
  inputFileSize: number | null;
  processedInputFileIdForDecompressedOutput: string | null; // ID of the .gz file that resulted in current decompressedFileId

  originalFileNameFromHeader: string | null;
  modificationTimeFromHeader: number | null;
  commentFromHeader: string | null;

  decompressedFileId: string | null;
  decompressedFileType: string | null;
  decompressedFileSize: number | null;
}

const DEFAULT_TOOL_STATE: GzipExplorerToolState = {
  inputFileId: null,
  inputFileName: null,
  inputFileSize: null,
  processedInputFileIdForDecompressedOutput: null,
  originalFileNameFromHeader: null,
  modificationTimeFromHeader: null,
  commentFromHeader: null,
  decompressedFileId: null,
  decompressedFileType: null,
  decompressedFileSize: null,
};

interface GzipFileExplorerClientProps {
  toolRoute: string;
}

export default function GzipFileExplorerClient({ toolRoute }: GzipFileExplorerClientProps) {
  const { getFile, addFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
  } = useToolState<GzipExplorerToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const {
    decompressFile,
    isDecompressing,
    error: decompressionHookError,
    decompressedData, // Uint8Array | null
    headerInfo, // GzipHeaderInfo | null
    clearDecompressionResults,
  } = useGzipDecompress();

  const [currentInputFile, setCurrentInputFile] = useState<StoredFile | null>(null);
  const [isLoadingInputFile, setIsLoadingInputFile] = useState(false);
  
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [hexPreview, setHexPreview] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const [isSelectFileModalOpen, setIsSelectFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameActionContext, setFilenameActionContext] = useState<'download' | 'save' | null>(null);
  
  const [clientError, setClientError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const directiveName = ownMetadata.directive;

  // Combined loading state for UI
  const isProcessing = isLoadingToolState || isLoadingInputFile || isDecompressing || isLoadingPreview;

  // Load currentInputFile from inputFileId in toolState
  useEffect(() => {
    if (toolState.inputFileId) {
      if (currentInputFile && currentInputFile.id === toolState.inputFileId) return; // Already loaded

      setIsLoadingInputFile(true);
      setClientError(null);
      getFile(toolState.inputFileId)
        .then(file => {
          if (file) {
            setCurrentInputFile(file);
          } else {
            setClientError(`Input Gzip file (ID: ${toolState.inputFileId}) not found in library.`);
            setToolState(prev => ({
              ...prev,
              inputFileId: null, inputFileName: null, inputFileSize: null,
              processedInputFileIdForDecompressedOutput: null, // Clear association
            }));
            setCurrentInputFile(null);
          }
        })
        .catch(err => {
          console.error("Error loading input file:", err);
          setClientError(`Error loading input file: ${err.message}`);
        })
        .finally(() => setIsLoadingInputFile(false));
    } else {
      setCurrentInputFile(null);
    }
  }, [toolState.inputFileId, getFile, setToolState, currentInputFile]);

  // Trigger decompression
  useEffect(() => {
    if (currentInputFile && currentInputFile.id !== toolState.processedInputFileIdForDecompressedOutput && !isDecompressing && currentInputFile.blob) {
      // Clear previous results before new decompression
      clearDecompressionResults();
      setTextPreview(null);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
      setHexPreview(null);
      setToolState(prev => ({
        ...prev,
        decompressedFileId: null, decompressedFileType: null, decompressedFileSize: null,
        originalFileNameFromHeader: null, modificationTimeFromHeader: null, commentFromHeader: null,
      }));
      
      decompressFile(currentInputFile.blob);
    }
  }, [currentInputFile, toolState.processedInputFileIdForDecompressedOutput, isDecompressing, decompressFile, clearDecompressionResults, setToolState, imagePreviewUrl]);

  // Handle results from decompression hook
  useEffect(() => {
    if (decompressedData && headerInfo && currentInputFile && !toolState.decompressedFileId) {
      const processDecompressedOutput = async () => {
        setIsLoadingPreview(true);
        try {
          const originalName = headerInfo.name || currentInputFile.filename.replace(/\.gz$/i, '') || 'decompressed_file';
          const mimeType = getMimeTypeForFile(originalName);
          
          const decompressedBlob = new Blob([decompressedData], { type: mimeType });
          
          // Save to Dexie (as temporary initially)
          const newDecompressedFileId = await addFile(
            decompressedBlob,
            originalName,
            mimeType,
            true, // isTemporary
            toolRoute 
          );

          setToolState(prev => ({
            ...prev,
            processedInputFileIdForDecompressedOutput: currentInputFile.id,
            decompressedFileId: newDecompressedFileId,
            decompressedFileType: mimeType,
            decompressedFileSize: decompressedData.byteLength,
            originalFileNameFromHeader: headerInfo.name,
            modificationTimeFromHeader: headerInfo.mtime,
            commentFromHeader: headerInfo.comment,
          }));
          
          // No need to call clearDecompressionResults() here, it's called before new decompressFile
        } catch (err) {
          console.error("Error processing decompressed data:", err);
          setClientError(`Error saving decompressed file: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setIsLoadingPreview(false);
        }
      };
      processDecompressedOutput();
    }
  }, [decompressedData, headerInfo, currentInputFile, toolState.decompressedFileId, addFile, setToolState, toolRoute]);

  // Load preview content when decompressedFileId is set
  useEffect(() => {
    let objectUrlToRevoke: string | null = null;

    if (toolState.decompressedFileId && toolState.decompressedFileType) {
      setIsLoadingPreview(true);
      setTextPreview(null);
      setImagePreviewUrl(null);
      setHexPreview(null);

      getFile(toolState.decompressedFileId)
        .then(async (file) => {
          if (file && file.blob) {
            if (isTextBasedMimeType(toolState.decompressedFileType)) {
              const text = await file.blob.text();
              setTextPreview(text.length > MAX_TEXT_PREVIEW_SIZE_BYTES ? text.substring(0, MAX_TEXT_PREVIEW_SIZE_BYTES) + "\n\n--- Content truncated ---" : text);
            } else if (toolState.decompressedFileType?.startsWith('image/')) {
              objectUrlToRevoke = URL.createObjectURL(file.blob);
              setImagePreviewUrl(objectUrlToRevoke);
            } else {
              // Hex preview for other binary types
              const buffer = await file.blob.arrayBuffer();
              const firstBytes = new Uint8Array(buffer);
              setHexPreview(bufferToHex(firstBytes.slice(0, MAX_HEX_PREVIEW_BYTES)));
            }
          }
        })
        .catch(err => {
          console.error("Error loading preview content:", err);
          setClientError(`Error loading preview: ${err.message}`);
        })
        .finally(() => setIsLoadingPreview(false));
    } else {
      setTextPreview(null);
      setImagePreviewUrl(null);
      setHexPreview(null);
    }
    return () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [toolState.decompressedFileId, toolState.decompressedFileType, getFile]);
  
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
    if (receivedFileItem && (receivedFileItem.type === 'application/gzip' || receivedFileItem.type === 'application/x-gzip')) {
      let fileToProcess: StoredFile;
      if (!('id' in receivedFileItem)) { // InlineFile
        const tempName = `itde-received-${Date.now()}.gz`;
        const newId = await addFile(receivedFileItem.blob, tempName, receivedFileItem.type, true, toolRoute);
        const fetched = await getFile(newId);
        if (!fetched) throw new Error("Failed to retrieve saved InlineFile for ITDE");
        fileToProcess = fetched;
      } else { // StoredFile
        fileToProcess = receivedFileItem as StoredFile;
      }
      
      // Cleanup old files if any before setting new input
      const oldInputId = toolState.inputFileId;
      const oldDecompressedId = toolState.decompressedFileId;
      const idsToCleanup = [oldInputId, oldDecompressedId].filter(Boolean) as string[];
      if (idsToCleanup.length > 0) {
          cleanupOrphanedTemporaryFiles(idsToCleanup).catch(e => console.warn("ITDE: Cleanup of old files failed", e));
      }

      setToolState({
        ...DEFAULT_TOOL_STATE, // Reset most state
        inputFileId: fileToProcess.id,
        inputFileName: fileToProcess.filename,
        inputFileSize: fileToProcess.size,
      });
      setUserDeferredAutoPopup(false);

    } else {
      setClientError(`Received file from ${signal.sourceToolTitle} is not a Gzip file (type: ${receivedFileItem?.type}).`);
    }
  }, [getToolMetadata, addFile, getFile, toolState.inputFileId, toolState.decompressedFileId, setToolState, cleanupOrphanedTemporaryFiles, toolRoute]);

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

  const handleFileSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsSelectFileModalOpen(false);
    setClientError(null);
    const file = files[0];
    if (file) {
      if (file.type === 'application/gzip' || file.type === 'application/x-gzip' || file.filename.toLowerCase().endsWith('.gz')) {
        // Cleanup old files if replacing
        const oldInputId = toolState.inputFileId;
        const oldDecompressedId = toolState.decompressedFileId;
        const idsToCleanup = [oldInputId, oldDecompressedId].filter(Boolean) as string[];
        if (idsToCleanup.length > 0 && oldInputId !== file.id) {
            cleanupOrphanedTemporaryFiles(idsToCleanup).catch(e => console.warn("File Modal: Cleanup of old files failed", e));
        }
        
        setToolState({
          ...DEFAULT_TOOL_STATE, // Reset most state
          inputFileId: file.id,
          inputFileName: file.filename,
          inputFileSize: file.size,
        });
      } else {
        setClientError('Invalid file type. Please select a .gz file.');
      }
    }
  }, [toolState.inputFileId, toolState.decompressedFileId, setToolState, cleanupOrphanedTemporaryFiles]);

  const handleClear = useCallback(async () => {
    const idsToCleanup = [toolState.inputFileId, toolState.decompressedFileId].filter(Boolean) as string[];
    
    setCurrentInputFile(null);
    clearDecompressionResults();
    setTextPreview(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setHexPreview(null);
    setClientError(null);
    setToolState(DEFAULT_TOOL_STATE);
    await saveStateNow(DEFAULT_TOOL_STATE); // Persist cleared state

    if (idsToCleanup.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToCleanup).catch(e => console.warn("Clear: Cleanup failed", e));
    }
  }, [toolState.inputFileId, toolState.decompressedFileId, clearDecompressionResults, imagePreviewUrl, setToolState, saveStateNow, cleanupOrphanedTemporaryFiles]);

  const handleFilenameConfirm = useCallback(async (filename: string) => {
    setIsFilenameModalOpen(false);
    if (!toolState.decompressedFileId || !filenameActionContext) return;

    if (filenameActionContext === 'download') {
      const fileToDownload = await getFile(toolState.decompressedFileId);
      if (fileToDownload && fileToDownload.blob) {
        const url = URL.createObjectURL(fileToDownload.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2000);
      } else {
        setClientError('Failed to retrieve decompressed file for download.');
      }
    } else if (filenameActionContext === 'save') {
      const success = await makeFilePermanentAndUpdate(toolState.decompressedFileId, filename);
      if (success) {
        setSaveSuccess(true);
        // Update toolState if filename changed in library
        const updatedFile = await getFile(toolState.decompressedFileId);
        if (updatedFile) {
            setToolState(prev => ({...prev, decompressedFileType: updatedFile.type})); // Filename is part of StoredFile, not directly in toolState for output
        }
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        setClientError('Failed to save decompressed file to library permanently.');
      }
    }
    setFilenameActionContext(null);
  }, [toolState.decompressedFileId, filenameActionContext, getFile, makeFilePermanentAndUpdate, setToolState]);

  const initiateOutputAction = (action: 'download' | 'save') => {
    if (!toolState.decompressedFileId) {
      setClientError('No decompressed file available to ' + action + '.');
      return;
    }
    setFilenameActionContext(action);
    setIsFilenameModalOpen(true);
  };
  
  const handleCopyToClipboard = useCallback(async () => {
    if (!textPreview) {
      setClientError('No text content to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(textPreview);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setClientError('Failed to copy to clipboard.');
    }
  }, [textPreview]);

  const suggestedOutputFilename = useMemo(() => {
    return toolState.originalFileNameFromHeader || 
           toolState.inputFileName?.replace(/\.gz$/i, '') || 
           'decompressed_output';
  }, [toolState.originalFileNameFromHeader, toolState.inputFileName]);

  const canPerformOutputActions = !!toolState.decompressedFileId && !decompressionHookError && !clientError;

  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-gray-500 animate-pulse">Loading Gzip Explorer...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold">Input Gzip File</h2>
          <div className="flex items-center gap-2">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            <Button variant="primary" onClick={() => setIsSelectFileModalOpen(true)} iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}>
              Select .gz File
            </Button>
          </div>
        </div>
        {isProcessing && !clientError && <p className="text-sm text-gray-500 italic animate-pulse">Processing...</p>}
        {toolState.inputFileName && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Selected: <strong>{toolState.inputFileName}</strong> ({toolState.inputFileSize ? formatBytes(toolState.inputFileSize) : 'N/A'})
          </p>
        )}
        {!toolState.inputFileName && !isProcessing && <p className="text-sm text-gray-500 italic">No Gzip file selected.</p>}
      </div>

      {/* Error Display */}
      {(clientError || decompressionHookError) && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div><strong className="font-semibold">Error:</strong> {clientError || decompressionHookError}</div>
        </div>
      )}

      {/* Gzip Header Info */}
      {toolState.processedInputFileIdForDecompressedOutput && (headerInfo || toolState.originalFileNameFromHeader) && !isProcessing && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><InformationCircleIcon className="h-5 w-5 text-[rgb(var(--color-text-link))]"/>Gzip Header Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <p><strong>Original Filename:</strong> {toolState.originalFileNameFromHeader || headerInfo?.name || <span className="italic">Not specified</span>}</p>
            <p><strong>Modification Time:</strong> {
              (toolState.modificationTimeFromHeader || headerInfo?.mtime) ? 
              new Date((toolState.modificationTimeFromHeader || headerInfo!.mtime!) * 1000).toLocaleString() : 
              <span className="italic">Not specified</span>
            }</p>
            { (toolState.commentFromHeader || headerInfo?.comment) && 
              <p className="sm:col-span-2"><strong>Comment:</strong> {toolState.commentFromHeader || headerInfo?.comment}</p> 
            }
          </div>
        </div>
      )}
      
      {/* Decompressed Content Preview */}
      {toolState.decompressedFileId && !isProcessing && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <h3 className="text-md font-semibold mb-2">Decompressed Content Preview</h3>
          <p className="text-sm text-[rgb(var(--color-text-muted))] mb-2">
            Type: {toolState.decompressedFileType || 'Unknown'}, Size: {toolState.decompressedFileSize ? formatBytes(toolState.decompressedFileSize) : 'N/A'}
          </p>
          {isLoadingPreview && <p className="italic animate-pulse">Loading preview...</p>}
          {!isLoadingPreview && textPreview && (
            <>
              <h4 className="text-sm font-medium mb-1 flex items-center gap-1"><DocumentTextIcon className="h-4 w-4"/>Text Content:</h4>
              <Textarea value={textPreview} readOnly rows={10} textareaClassName="text-xs bg-gray-50 custom-scrollbar-dark" />
            </>
          )}
          {!isLoadingPreview && imagePreviewUrl && (
            <>
              <h4 className="text-sm font-medium mb-1 flex items-center gap-1"><PhotoIcon className="h-4 w-4"/>Image Preview:</h4>
              <div className="max-w-md max-h-96 border rounded overflow-hidden mx-auto bg-gray-100">
                <Image src={imagePreviewUrl} alt="Decompressed image preview" width={400} height={384} className="object-contain w-full h-full" unoptimized/>
              </div>
            </>
          )}
          {!isLoadingPreview && hexPreview && !textPreview && !imagePreviewUrl && (
             <>
              <h4 className="text-sm font-medium mb-1 flex items-center gap-1"><CpuChipIcon className="h-4 w-4"/>Binary Content (Hex Preview - First {MAX_HEX_PREVIEW_BYTES} bytes):</h4>
              <Textarea value={hexPreview} readOnly rows={8} textareaClassName="text-xs font-mono bg-gray-50 custom-scrollbar-dark" />
            </>
          )}
          {!isLoadingPreview && !textPreview && !imagePreviewUrl && !hexPreview && (
            <p className="italic text-gray-500">No preview available for this file type or content is empty.</p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap gap-2 justify-end">
          <OutputActionButtons
            canPerform={canPerformOutputActions}
            isSaveSuccess={saveSuccess}
            isCopySuccess={copySuccess && !!textPreview}
            isDownloadSuccess={downloadSuccess}
            onInitiateSave={() => initiateOutputAction('save')}
            onInitiateDownload={() => initiateOutputAction('download')}
            onCopy={textPreview ? handleCopyToClipboard : undefined}
            onClear={handleClear}
            directiveName={directiveName}
            outputConfig={ownMetadata.outputConfig}
          />
        </div>
      </div>

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
        isOpen={isFilenameModalOpen}
        onClose={() => { setIsFilenameModalOpen(false); setFilenameActionContext(null); }}
        onConfirm={handleFilenameConfirm}
        initialFilename={suggestedOutputFilename}
        title={filenameActionContext === 'download' ? 'Enter Download Filename' : 'Enter Filename for Library'}
        filenameAction={filenameActionContext || 'download'}
      />
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
