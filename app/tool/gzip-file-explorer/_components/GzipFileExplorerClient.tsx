'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import Image from 'next/image';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import useGzipDecompressor from '../_hooks/useGzipDecompressor';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ToolMetadata as AppToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import {
  formatBytes,
  getFileIconClassName,
  isTextBasedMimeType,
} from '@/app/lib/utils';
import {
  ArrowUpTrayIcon,
  DocumentMagnifyingGlassIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import toolSpecificMetadata from '../metadata.json';

interface GzipToolState {
  inputFileId: string | null;
  inputFileName: string | null;
  inputFileSize: number | null;
  decompressedFileId: string | null;
  decompressedFileName: string | null;
  decompressedFileType: string | null;
  decompressedFileSize: number | null;
}

const DEFAULT_GZIP_TOOL_STATE: GzipToolState = {
  inputFileId: null,
  inputFileName: null,
  inputFileSize: null,
  decompressedFileId: null,
  decompressedFileName: null,
  decompressedFileType: null,
  decompressedFileSize: null,
};

const MAX_TEXT_PREVIEW_SIZE_BYTES = 256 * 1024; // 256KB
const ownMetadata = toolSpecificMetadata as AppToolMetadata;

interface GzipFileExplorerClientProps {
  toolRoute: string;
}

export default function GzipFileExplorerClient({
  toolRoute,
}: GzipFileExplorerClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
    errorLoadingState: toolStateError,
  } = useToolState<GzipToolState>(toolRoute, DEFAULT_GZIP_TOOL_STATE);

  const {
    getFile,
    addFile,
    makeFilePermanentAndUpdate,
    deleteFilePermanently,
    cleanupOrphanedTemporaryFiles,
  } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const {
    isLoading: isDecompressing,
    error: decompressorError,
    decompress,
  } = useGzipDecompressor();

  const [currentInputFile, setCurrentInputFile] = useState<StoredFile | null>(
    null
  );
  const [currentDecompressedFile, setCurrentDecompressedFile] =
    useState<StoredFile | null>(null);

  const [clientError, setClientError] = useState<string | null>(null);
  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null); // URL for images, text for text
  const [previewType, setPreviewType] = useState<
    'text' | 'image' | 'unsupported' | 'loading'
  >('loading');
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameAction, setFilenameAction] = useState<
    'download' | 'save' | null
  >(null);

  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const directiveName = ownMetadata.directive;
  const isLoading = isLoadingToolState || isDecompressing;
  const displayError = clientError || decompressorError || toolStateError;

  // Load files from state IDs
  useEffect(() => {
    if (toolState.inputFileId && !currentInputFile) {
      getFile(toolState.inputFileId).then(setCurrentInputFile);
    } else if (!toolState.inputFileId && currentInputFile) {
      setCurrentInputFile(null);
    }
  }, [toolState.inputFileId, getFile, currentInputFile]);

  useEffect(() => {
    if (toolState.decompressedFileId && !currentDecompressedFile) {
      getFile(toolState.decompressedFileId).then(setCurrentDecompressedFile);
    } else if (!toolState.decompressedFileId && currentDecompressedFile) {
      setCurrentDecompressedFile(null);
    }
  }, [toolState.decompressedFileId, getFile, currentDecompressedFile]);

  // Auto-process when input file changes
  useEffect(() => {
    if (
      currentInputFile &&
      currentInputFile.id === toolState.inputFileId && // Ensure we are processing the file that's in state
      !toolState.decompressedFileId && // Only if not already decompressed
      !isDecompressing && !decompressorError && !clientError // And no current operations/errors
    ) {
      const process = async () => {
        const result = await decompress(currentInputFile);
        if (result) {
          try {
            const newFileId = await addFile(
              result.blob,
              result.filename,
              result.type,
              true, // Add as temporary
              toolRoute
            );
            setToolState((prev) => ({
              ...prev,
              decompressedFileId: newFileId,
              decompressedFileName: result.filename,
              decompressedFileType: result.type,
              decompressedFileSize: result.blob.size,
            }));
          } catch (addErr) {
            setClientError(
              `Failed to store decompressed file: ${addErr instanceof Error ? addErr.message : String(addErr)}`
            );
          }
        }
      };
      process();
    }
  }, [
    currentInputFile,
    toolState.inputFileId,
    toolState.decompressedFileId,
    decompress,
    addFile,
    setToolState,
    isDecompressing,
    decompressorError,
    clientError,
    toolRoute
  ]);
  
  // Effect for initial state load completion
  useEffect(() => {
    if (!isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = true;
    }
  }, [isLoadingToolState]);

  const handleClear = useCallback(async () => {
    const idsToCleanup: string[] = [];
    if (toolState.inputFileId) idsToCleanup.push(toolState.inputFileId);
    if (toolState.decompressedFileId) idsToCleanup.push(toolState.decompressedFileId);

    setCurrentInputFile(null);
    setCurrentDecompressedFile(null);
    setClientError(null);
    setToolState(DEFAULT_GZIP_TOOL_STATE);
    await saveStateNow(DEFAULT_GZIP_TOOL_STATE);
    
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);

    if (idsToCleanup.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToCleanup).catch(e => 
        console.error("[GzipExplorer Clear] Cleanup failed:", e)
      );
    }
  }, [setToolState, saveStateNow, toolState.inputFileId, toolState.decompressedFileId, cleanupOrphanedTemporaryFiles]);

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[], source: 'library' | 'upload', filterToThese?: boolean) => {
      setIsLoadFileModalOpen(false);
      setClientError(null);
      const file = files[0];
      if (file) {
        if (
          file.type === 'application/gzip' ||
          file.type === 'application/x-gzip' ||
          file.filename.toLowerCase().endsWith('.gz')
        ) {
          // Cleanup previous files if any
          const oldInputId = toolState.inputFileId;
          const oldDecompressedId = toolState.decompressedFileId;
          const idsToPotentiallyDelete = [];
          if (oldInputId && oldInputId !== file.id) idsToPotentiallyDelete.push(oldInputId);
          if (oldDecompressedId) idsToPotentiallyDelete.push(oldDecompressedId);

          if (idsToPotentiallyDelete.length > 0) {
             cleanupOrphanedTemporaryFiles(idsToPotentiallyDelete).catch(e => 
                console.error("[GzipExplorer FileSelect] Old files cleanup failed:", e)
             );
          }
          
          setToolState({
            ...DEFAULT_GZIP_TOOL_STATE, // Reset most state
            inputFileId: file.id,
            inputFileName: file.filename,
            inputFileSize: file.size,
          });
          // setCurrentInputFile will be set by effect
        } else {
          setClientError('Invalid file. Please select a .gz file.');
          if (source === 'upload' && file.isTemporary && file.id) {
            // If an invalid file was uploaded and made temporary, delete it.
            deleteFilePermanently(file.id).catch(e => console.warn("Failed to delete invalid temp upload", e));
          }
        }
      }
    },
    [setToolState, toolState.inputFileId, toolState.decompressedFileId, cleanupOrphanedTemporaryFiles, deleteFilePermanently]
  );

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setClientError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setClientError(`Metadata not found for source: ${signal.sourceToolTitle}`);
        return;
      }

      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );
      if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
        setClientError(resolvedPayload.errorMessage || 'No data received from source.');
        return;
      }

      const receivedFileItem = resolvedPayload.data[0];
      let fileToProcess: StoredFile | null = null;

      if (receivedFileItem && (
          receivedFileItem.type === 'application/gzip' || 
          receivedFileItem.type === 'application/x-gzip' ||
          ('filename' in receivedFileItem && (receivedFileItem as StoredFile).filename.toLowerCase().endsWith('.gz'))
        )) {
        if (!('id' in receivedFileItem)) { // InlineFile
          try {
            const tempName = `itde-received-${Date.now()}.gz`;
            const newId = await addFile(receivedFileItem.blob, tempName, receivedFileItem.type, true, toolRoute);
            fileToProcess = await getFile(newId);
            if (!fileToProcess) throw new Error('Failed to retrieve saved InlineFile');
          } catch (e) {
            setClientError(`Failed to process incoming GZip: ${e instanceof Error ? e.message : String(e)}`);
            return;
          }
        } else { // StoredFile
          fileToProcess = receivedFileItem as StoredFile;
        }
      } else if (receivedFileItem) {
        setClientError(`Received file from ${signal.sourceToolTitle} is not a GZip (type: ${receivedFileItem.type}).`);
        return;
      }

      if (fileToProcess) {
        handleFileSelectedFromModal([fileToProcess], 'library'); // Treat as if selected from library
        setUserDeferredAutoPopup(false);
      } else {
         setClientError('No valid GZip file found in ITDE data.');
      }
    },
    [getToolMetadata, addFile, getFile, handleFileSelectedFromModal, toolRoute]
  );
  
  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (initialToolStateLoadCompleteRef.current && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [itdeTarget, userDeferredAutoPopup]);


  const handleOpenPreview = useCallback(async () => {
    if (!currentDecompressedFile?.blob) {
      setClientError('No decompressed file content to preview.');
      return;
    }
    setIsPreviewModalOpen(true);
    setPreviewType('loading');
    setPreviewContent(null);

    const fileType = currentDecompressedFile.type || '';
    const filename = currentDecompressedFile.filename || 'preview';

    if (isTextBasedMimeType(fileType)) {
      try {
        let text = await currentDecompressedFile.blob.text();
        if (currentDecompressedFile.blob.size > MAX_TEXT_PREVIEW_SIZE_BYTES) {
          text = text.substring(0, MAX_TEXT_PREVIEW_SIZE_BYTES / 2) + // Approx, char vs byte
                 '\n\n--- CONTENT TRUNCATED ---';
        }
        setPreviewContent(text);
        setPreviewType('text');
      } catch (e) {
        setPreviewContent(`Error reading text: ${e instanceof Error ? e.message : String(e)}`);
        setPreviewType('unsupported');
      }
    } else if (fileType.startsWith('image/')) {
      const url = URL.createObjectURL(currentDecompressedFile.blob);
      setPreviewContent(url);
      setPreviewType('image');
    } else {
      setPreviewType('unsupported');
    }
  }, [currentDecompressedFile]);

  // Cleanup object URL for image preview
  useEffect(() => {
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

  const handleFilenameConfirm = useCallback(
    async (filename: string) => {
      setIsFilenameModalOpen(false);
      if (!currentDecompressedFile || !filenameAction) return;

      let finalFilename = filename.trim();
      if (!finalFilename) finalFilename = currentDecompressedFile.filename;

      if (filenameAction === 'download') {
        try {
          const url = URL.createObjectURL(currentDecompressedFile.blob);
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
          setClientError(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else if (filenameAction === 'save') {
        try {
          await makeFilePermanentAndUpdate(currentDecompressedFile.id, finalFilename);
          setToolState(prev => ({...prev, decompressedFileName: finalFilename})); // Update name in state
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err) {
          setClientError(`Save to library failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      setFilenameAction(null);
    },
    [currentDecompressedFile, filenameAction, makeFilePermanentAndUpdate, setToolState]
  );
  
  const initiateOutputAction = (action: 'download' | 'save') => {
    if (!currentDecompressedFile) {
        setClientError('No decompressed file available.');
        return;
    }
    setFilenameAction(action);
    setIsFilenameModalOpen(true);
  };

  const handleCopyToClipboard = useCallback(async () => {
    if (!currentDecompressedFile || !isTextBasedMimeType(currentDecompressedFile.type)) {
      setClientError('Cannot copy: Output is not text or not available.');
      return;
    }
    try {
      const text = await currentDecompressedFile.blob.text();
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setClientError(`Copy failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [currentDecompressedFile]);

  const canPerformOutputActions = !!currentDecompressedFile && !displayError;

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      {/* Input Section */}
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap gap-2 items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Input Gzip File</h2>
          <div className="flex gap-2 items-center">
            <ReceiveItdeDataTrigger
                hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
                pendingSignalCount={itdeTarget.pendingSignals.length}
                onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            <Button
              variant="primary"
              onClick={() => setIsLoadFileModalOpen(true)}
              disabled={isLoading}
              iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
            >
              Select .gz File
            </Button>
          </div>
        </div>
        {isLoading && !currentInputFile && <p className="text-sm italic">Loading state...</p>}
        {currentInputFile && (
          <div className="text-sm">
            <p>
              Selected: <strong>{currentInputFile.filename}</strong>
            </p>
            <p>
              Size: {formatBytes(currentInputFile.size)}
            </p>
            <p>
              Type: {currentInputFile.type}
            </p>
          </div>
        )}
        {!isLoading && !currentInputFile && (
          <p className="text-sm italic">No .gz file selected.</p>
        )}
      </div>

      {/* Error Display */}
      {displayError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div><strong className="font-semibold">Error:</strong> {displayError}</div>
        </div>
      )}

      {/* Output Section */}
      {(currentDecompressedFile || isDecompressing) && !displayError && (
         <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
            <h2 className="text-lg font-semibold mb-2">Decompressed Output</h2>
            {isDecompressing && !currentDecompressedFile && <p className="text-sm italic animate-pulse">Decompressing...</p>}
            {currentDecompressedFile && (
                <>
                    <div className="text-sm mb-3">
                        <p>Filename: <strong>{currentDecompressedFile.filename}</strong></p>
                        <p>Size: {formatBytes(currentDecompressedFile.size)}</p>
                        <p>Type: {currentDecompressedFile.type}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <Button 
                            variant="neutral-outline"
                            onClick={handleOpenPreview}
                            iconLeft={<DocumentMagnifyingGlassIcon className="h-5 w-5" />}
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
                            onCopy={isTextBasedMimeType(currentDecompressedFile.type) ? handleCopyToClipboard : undefined}
                            onClear={handleClear}
                            directiveName={directiveName}
                            outputConfig={ownMetadata.outputConfig}
                            selectedOutputItems={currentDecompressedFile ? [currentDecompressedFile] : []}
                        />
                    </div>
                </>
            )}
         </div>
      )}
      
      {/* Clear button if there's any state or error */}
      {(currentInputFile || displayError) && !currentDecompressedFile && !isDecompressing && (
         <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
            <Button
                variant="danger"
                onClick={handleClear}
                iconLeft={<XCircleIcon className="h-5 w-5" />}
            >
                Clear
            </Button>
         </div>
      )}


      {/* Modals */}
      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".gz,application/gzip,application/x-gzip"
        selectionMode="single"
        libraryFilter={{ type: 'application/gzip' }} // Or more specific if needed
        initialTab="upload"
      />

      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => { setIsFilenameModalOpen(false); setFilenameAction(null); }}
        onConfirm={handleFilenameConfirm}
        initialFilename={currentDecompressedFile?.filename || 'decompressed_file'}
        title={filenameAction === 'download' ? 'Enter Download Filename' : 'Enter Filename for Library'}
        filenameAction={filenameAction || 'download'}
      />

      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]" onClick={() => setIsPreviewModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 px-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
              <h3 className="text-lg font-semibold truncate" title={currentDecompressedFile?.filename || 'Preview'}>
                {currentDecompressedFile?.filename || 'Preview'}
              </h3>
              <Button variant="link" onClick={() => setIsPreviewModalOpen(false)} className="!p-1">
                <XCircleIcon className="h-6 w-6 text-gray-500 hover:text-gray-700" />
              </Button>
            </div>
            <div className="p-4 overflow-auto flex-grow min-h-[200px]">
              {previewType === 'loading' && <p className="text-center animate-pulse">Loading preview...</p>}
              {previewType === 'unsupported' && <p className="text-center">Preview not available for this file type.</p>}
              {previewType === 'text' && previewContent && (
                <pre className="text-sm whitespace-pre-wrap break-words max-h-[calc(90vh-120px)] overflow-auto">
                  <code>{previewContent}</code>
                </pre>
              )}
              {previewType === 'image' && previewContent && (
                <div className="flex justify-center items-center h-full max-h-[calc(90vh-120px)]">
                  <Image
                    src={previewContent}
                    alt={currentDecompressedFile?.filename || 'Preview'}
                    width={800}
                    height={600}
                    className="max-w-full max-h-full object-contain"
                    unoptimized
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={(sd) => { itdeTarget.acceptSignal(sd); if(itdeTarget.pendingSignals.length -1 === 0) setUserDeferredAutoPopup(false);}}
        onIgnore={(sd) => { itdeTarget.ignoreSignal(sd); if(itdeTarget.pendingSignals.length -1 === 0) setUserDeferredAutoPopup(false);}}
        onDeferAll={() => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); }}
        onIgnoreAll={() => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); }}
      />
    </div>
  );
}