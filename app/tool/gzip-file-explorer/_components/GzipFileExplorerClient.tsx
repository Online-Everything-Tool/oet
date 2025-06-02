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
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import type { ToolMetadata, OutputConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import {
  formatBytes,
  getMimeTypeForFile,
  PREVIEWABLE_TEXT_EXTENSIONS,
  PREVIEWABLE_IMAGE_EXTENSIONS,
} from '@/app/lib/utils';
import {
  ArrowUpTrayIcon,
  TrashIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  XCircleIcon as XCircleIconSolid,
  ExclamationTriangleIcon,
  DocumentMagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import toolSpecificMetadata from '../metadata.json';

const ownMetadata = toolSpecificMetadata as ToolMetadata;
const MAX_TEXT_PREVIEW_SIZE = 1024 * 256; // 256KB

interface GzipToolState {
  selectedGzipFileId: string | null;
  selectedGzipFileName: string | null;
  selectedGzipFileSize: number | null;
  decompressedFileId: string | null;
  decompressedFileOriginalName: string | null;
  decompressedFileMimeType: string | null;
  decompressedFileSize: number | null;
}

const DEFAULT_GZIP_TOOL_STATE: GzipToolState = {
  selectedGzipFileId: null,
  selectedGzipFileName: null,
  selectedGzipFileSize: null,
  decompressedFileId: null,
  decompressedFileOriginalName: null,
  decompressedFileMimeType: null,
  decompressedFileSize: null,
};

interface GzipFileExplorerClientProps {
  toolRoute: string;
}

export default function GzipFileExplorerClient({
  toolRoute,
}: GzipFileExplorerClientProps) {
  const {
    getFile,
    addFile,
    makeFilePermanentAndUpdate,
    cleanupOrphanedTemporaryFiles,
  } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
  } = useToolState<GzipToolState>(toolRoute, DEFAULT_GZIP_TOOL_STATE);

  const [uiError, setUiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [isSelectFileModalOpen, setIsSelectFileModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<
    'text' | 'image' | 'unsupported' | 'loading'
  >('loading');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const [decompressedStoredFile, setDecompressedStoredFile] =
    useState<StoredFile | null>(null);

  const directiveName = ownMetadata.directive;

  useEffect(() => {
    if (toolState.decompressedFileId) {
      getFile(toolState.decompressedFileId)
        .then((file) => {
          if (file) setDecompressedStoredFile(file);
          else {
            setDecompressedStoredFile(null);
            // If file not found, maybe clear from state?
            // setToolState(prev => ({...prev, decompressedFileId: null, decompressedFileOriginalName: null, decompressedFileMimeType: null, decompressedFileSize: null}));
          }
        })
        .catch(() => setDecompressedStoredFile(null));
    } else {
      setDecompressedStoredFile(null);
    }
  }, [toolState.decompressedFileId, getFile, setToolState]);

  const decompressFile = useCallback(
    async (gzFile: StoredFile) => {
      if (!gzFile.blob) {
        setUiError(
          `File content for "${gzFile.filename}" is missing.`
        );
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setUiError(null);

      // Clear previous decompressed info
      if (toolState.decompressedFileId) {
        cleanupOrphanedTemporaryFiles([toolState.decompressedFileId]);
      }
      setToolState((prev) => ({
        ...prev,
        decompressedFileId: null,
        decompressedFileOriginalName: null,
        decompressedFileMimeType: null,
        decompressedFileSize: null,
      }));
      setDecompressedStoredFile(null);

      try {
        const pako = (await import('pako')).default;
        const arrayBuffer = await gzFile.blob.arrayBuffer();
        const decompressedDataArray = pako.ungzip(new Uint8Array(arrayBuffer));

        let originalName = gzFile.filename;
        if (originalName.toLowerCase().endsWith('.gz')) {
          originalName = originalName.substring(0, originalName.length - 3);
        } else if (originalName.toLowerCase().endsWith('.tgz')) {
          originalName = originalName.substring(0, originalName.length - 4) + '.tar';
        }
        if (!originalName) originalName = 'decompressed_file';

        const mimeType = getMimeTypeForFile(originalName);
        const decompressedBlob = new Blob([decompressedDataArray], {
          type: mimeType,
        });

        const decompressedFileId = await addFile(
          decompressedBlob,
          originalName,
          mimeType,
          true // Save as temporary initially
        );

        setToolState((prev) => ({
          ...prev,
          selectedGzipFileId: gzFile.id,
          selectedGzipFileName: gzFile.filename,
          selectedGzipFileSize: gzFile.size,
          decompressedFileId: decompressedFileId,
          decompressedFileOriginalName: originalName,
          decompressedFileMimeType: mimeType,
          decompressedFileSize: decompressedBlob.size,
        }));
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'Failed to decompress Gzip file.';
        setUiError(errorMsg);
        console.error('Gzip decompression error:', err);
        setToolState((prev) => ({
          ...prev,
          selectedGzipFileId: gzFile.id, // Keep selected Gzip info even on error
          selectedGzipFileName: gzFile.filename,
          selectedGzipFileSize: gzFile.size,
        }));
      } finally {
        setIsLoading(false);
      }
    },
    [addFile, setToolState, toolState.decompressedFileId, cleanupOrphanedTemporaryFiles]
  );

  useEffect(() => {
    if (!isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = true;
      if (toolState.selectedGzipFileId && !toolState.decompressedFileId && !uiError && !isLoading) { // Auto-process on load if not already processed
        getFile(toolState.selectedGzipFileId).then(file => {
          if (file) decompressFile(file);
        });
      }
    }
  }, [isLoadingToolState, toolState.selectedGzipFileId, toolState.decompressedFileId, getFile, decompressFile, uiError, isLoading]);


  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setUiError(null);
      setIsLoading(true);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setUiError(`Metadata not found for source: ${signal.sourceToolTitle}`);
        setIsLoading(false);
        return;
      }

      const { resolveItdeData } = await import('@/app/lib/itdeDataUtils');
      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );

      if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
        setUiError(resolvedPayload.errorMessage || 'No data received from source.');
        setIsLoading(false);
        return;
      }

      const receivedFileItem = resolvedPayload.data[0];
      let fileToProcess: StoredFile | null = null;

      if (receivedFileItem && (receivedFileItem.type === 'application/gzip' || receivedFileItem.type === 'application/x-gzip' || ('name' in receivedFileItem && ((receivedFileItem as StoredFile).filename.toLowerCase().endsWith('.gz') || (receivedFileItem as StoredFile).filename.toLowerCase().endsWith('.tgz'))))) {
        if (!('id'in receivedFileItem)) { // InlineFile
          try {
            const tempName = `itde-received-${Date.now()}.${receivedFileItem.type === 'application/gzip' ? 'gz' : 'bin'}`;
            const newId = await addFile(receivedFileItem.blob, tempName, receivedFileItem.type, true);
            fileToProcess = await getFile(newId);
            if (!fileToProcess) throw new Error('Failed to process ITDE file.');
          } catch (e) {
            setUiError(`Failed to process incoming Gzip file: ${e instanceof Error ? e.message : String(e)}`);
            setIsLoading(false); return;
          }
        } else {
          fileToProcess = receivedFileItem as StoredFile;
        }
      } else if (receivedFileItem) {
        setUiError(`Received file from ${signal.sourceToolTitle} is not a Gzip file (type: ${receivedFileItem.type}).`);
        setIsLoading(false); return;
      }

      if (fileToProcess) {
        if (toolState.selectedGzipFileId && toolState.selectedGzipFileId !== fileToProcess.id) {
           cleanupOrphanedTemporaryFiles([toolState.selectedGzipFileId]);
        }
        decompressFile(fileToProcess);
        setUserDeferredAutoPopup(false);
      } else {
        setUiError('No valid Gzip file found in ITDE data.');
        setIsLoading(false);
      }
    },
    [getToolMetadata, addFile, getFile, decompressFile, toolState.selectedGzipFileId, cleanupOrphanedTemporaryFiles]
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

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsSelectFileModalOpen(false);
      setUiError(null);
      const file = files[0];
      if (file) {
        if (file.type === 'application/gzip' || file.type === 'application/x-gzip' || file.filename.toLowerCase().endsWith('.gz') || file.filename.toLowerCase().endsWith('.tgz')) {
          if (toolState.selectedGzipFileId && toolState.selectedGzipFileId !== file.id) {
             cleanupOrphanedTemporaryFiles([toolState.selectedGzipFileId]);
          }
          decompressFile(file);
        } else {
          setUiError('Invalid file type. Please select a .gz or .tgz file.');
        }
      }
    },
    [decompressFile, toolState.selectedGzipFileId, cleanupOrphanedTemporaryFiles]
  );

  const handleClear = useCallback(async () => {
    const idsToCleanup = [];
    if (toolState.selectedGzipFileId) idsToCleanup.push(toolState.selectedGzipFileId);
    if (toolState.decompressedFileId) idsToCleanup.push(toolState.decompressedFileId);
    
    setToolState(DEFAULT_GZIP_TOOL_STATE);
    await saveStateNow(DEFAULT_GZIP_TOOL_STATE);
    setUiError(null);
    setIsLoading(false);
    setDecompressedStoredFile(null);
    if (idsToCleanup.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToCleanup);
    }
  }, [setToolState, saveStateNow, toolState.selectedGzipFileId, toolState.decompressedFileId, cleanupOrphanedTemporaryFiles]);

  const handleDownloadDecompressed = useCallback(async () => {
    if (!decompressedStoredFile || !decompressedStoredFile.blob) {
      setUiError('No decompressed file available to download.');
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
    } catch (err) {
      setUiError(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [decompressedStoredFile]);

  const handlePreviewDecompressed = useCallback(async () => {
    if (!decompressedStoredFile || !decompressedStoredFile.blob) {
      setUiError('No decompressed file available to preview.');
      return;
    }
    setIsPreviewModalOpen(true);
    setPreviewContent(null);
    setPreviewError(null);
    setPreviewType('loading');

    const filenameLower = decompressedStoredFile.filename.toLowerCase();
    const extension = filenameLower.substring(filenameLower.lastIndexOf('.') + 1);

    try {
      if (PREVIEWABLE_TEXT_EXTENSIONS.includes(extension) || decompressedStoredFile.type?.startsWith('text/')) {
        if (decompressedStoredFile.size > MAX_TEXT_PREVIEW_SIZE) {
           setPreviewError(`File is too large for text preview (${formatBytes(decompressedStoredFile.size)}). Max preview size is ${formatBytes(MAX_TEXT_PREVIEW_SIZE)}.`);
           setPreviewType('unsupported');
           return;
        }
        const text = await decompressedStoredFile.blob.text();
        setPreviewContent(text);
        setPreviewType('text');
      } else if (PREVIEWABLE_IMAGE_EXTENSIONS.includes(extension) || decompressedStoredFile.type?.startsWith('image/')) {
        const url = URL.createObjectURL(decompressedStoredFile.blob);
        setPreviewContent(url); // Store URL to be revoked on modal close
        setPreviewType('image');
      } else {
        setPreviewType('unsupported');
      }
    } catch (err) {
      setPreviewError(`Failed to load preview: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setPreviewType('unsupported');
    }
  }, [decompressedStoredFile]);

  useEffect(() => {
    // Cleanup for image preview URL
    let objectUrlToRevoke: string | null = null;
    if (previewType === 'image' && previewContent?.startsWith('blob:')) {
      objectUrlToRevoke = previewContent;
    }
    return () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [previewContent, previewType]);

  const handlePreSignalForITDE = async (): Promise<boolean | void> => {
    if (!toolState.decompressedFileId) {
      setUiError('No decompressed file to send.');
      return false;
    }
    try {
      await makeFilePermanentAndUpdate(toolState.decompressedFileId);
      // Fetch the updated file to ensure `selectedOutputItems` for discovery is up-to-date
      const updatedFile = await getFile(toolState.decompressedFileId);
      if (updatedFile) setDecompressedStoredFile(updatedFile);
      return true;
    } catch (err) {
      setUiError(`Failed to prepare file for sending: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    }
  };
  
  const handleModalDeferAll = () => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); };
  const handleModalIgnoreAll = () => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); };

  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-gray-500 animate-pulse">Loading Gzip Explorer...</p>;
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
            Select Gzip File (.gz, .tgz)
          </Button>
          <ReceiveItdeDataTrigger
            hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
            pendingSignalCount={itdeTarget.pendingSignals.length}
            onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
          />
        </div>
        {toolState.selectedGzipFileName && (
          <p className="mt-3 text-sm text-[rgb(var(--color-text-muted))]">
            Selected: <strong>{toolState.selectedGzipFileName}</strong>
            {toolState.selectedGzipFileSize !== null && ` (${formatBytes(toolState.selectedGzipFileSize)})`}
          </p>
        )}
      </div>

      {isLoading && (
        <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Decompressing...</p>
      )}

      {uiError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div><strong className="font-semibold">Error:</strong> {uiError}</div>
        </div>
      )}

      {toolState.decompressedFileId && toolState.decompressedFileOriginalName && !isLoading && !uiError && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <h3 className="text-lg font-semibold text-[rgb(var(--color-text-base))] mb-2">Decompressed File</h3>
          <p className="text-sm mb-1">
            Name: <strong>{toolState.decompressedFileOriginalName}</strong>
          </p>
          <p className="text-sm mb-1">
            Type: {toolState.decompressedFileMimeType || 'Unknown'}
          </p>
          <p className="text-sm mb-3">
            Size: {toolState.decompressedFileSize !== null ? formatBytes(toolState.decompressedFileSize) : 'Unknown'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={handleDownloadDecompressed}
              iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
            >
              Download
            </Button>
            <Button
              variant="neutral"
              onClick={handlePreviewDecompressed}
              iconLeft={<EyeIcon className="h-5 w-5" />}
            >
              Preview
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] justify-end">
        {toolState.decompressedFileId && decompressedStoredFile && (
           <SendToToolButton
            currentToolDirective={directiveName}
            currentToolOutputConfig={ownMetadata.outputConfig as OutputConfig}
            selectedOutputItems={decompressedStoredFile ? [decompressedStoredFile] : []}
            onBeforeSignal={handlePreSignalForITDE}
            buttonText="Send Decompressed File To..."
          />
        )}
        <Button
          variant="danger"
          onClick={handleClear}
          disabled={isLoading && (!toolState.selectedGzipFileId && !toolState.decompressedFileId)}
          iconLeft={<TrashIcon className="h-5 w-5" />}
        >
          Clear All
        </Button>
      </div>

      <FileSelectionModal
        isOpen={isSelectFileModalOpen}
        onClose={() => setIsSelectFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".gz,.tgz,application/gzip,application/x-gzip"
        selectionMode="single"
        libraryFilter={{ type: 'application/gzip' }} // Modal might need to handle .tgz or more generic types
        initialTab="upload"
      />

      {isPreviewModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]"
          onClick={() => setIsPreviewModalOpen(false)}
          role="dialog" aria-modal="true"
        >
          <div
            className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 px-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center bg-[rgb(var(--color-bg-subtle))] rounded-t-lg">
              <h3 className="text-lg font-semibold text-[rgb(var(--color-text-base))] truncate" title={toolState.decompressedFileOriginalName || ''}>
                <DocumentMagnifyingGlassIcon className="h-5 w-5 inline-block mr-2 align-text-bottom" />
                Preview: {toolState.decompressedFileOriginalName || 'File'}
              </h3>
              <Button variant="link" onClick={() => setIsPreviewModalOpen(false)} className="!p-1">
                <XCircleIconSolid className="h-7 w-7 text-gray-400 hover:text-gray-600" />
              </Button>
            </div>
            <div className="p-4 overflow-auto flex-grow min-h-[200px]">
              {previewType === 'loading' && <p className="text-center animate-pulse">Loading preview...</p>}
              {previewError && <div role="alert" className="p-2 bg-red-50 text-red-700 rounded text-sm">{previewError}</div>}
              {!previewError && previewType === 'text' && (
                <pre className="text-sm whitespace-pre-wrap break-words max-h-[calc(90vh-120px)] overflow-auto bg-gray-50 p-2 rounded">
                  <code>{previewContent}</code>
                </pre>
              )}
              {!previewError && previewType === 'image' && previewContent && (
                <div className="flex justify-center items-center h-full max-h-[calc(90vh-120px)]">
                  <Image
                    src={previewContent}
                    alt={toolState.decompressedFileOriginalName || 'Preview'}
                    width={800}
                    height={600}
                    className="max-w-full max-h-full object-contain"
                    onError={() => setPreviewError('Failed to load image resource.')}
                    unoptimized
                  />
                </div>
              )}
              {!previewError && previewType === 'unsupported' && (
                <p className="text-center text-gray-500 p-5">Preview not available for this file type ({toolState.decompressedFileMimeType || 'unknown type'}).</p>
              )}
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