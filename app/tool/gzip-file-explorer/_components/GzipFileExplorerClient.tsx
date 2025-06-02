'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import pako from 'pako';
import Image from 'next/image';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
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
} from '@/app/lib/utils';
import {
  ArrowUpTrayIcon,
  DocumentMagnifyingGlassIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import toolSpecificMetadata from '../metadata.json';
import type { ToolMetadata as AppToolMetadata } from '@/src/types/tools';

declare module 'pako' {
    export function inflate(data: Uint8Array, options: { to: 'Uint8Array', gzip: true }): { result: Uint8Array; header?: pako.Header; err?: any; msg?: any } | Uint8Array;
    export interface Header {
        name?: string;
    }
}


const ownMetadata = toolSpecificMetadata as AppToolMetadata;
const MAX_TEXT_PREVIEW_SIZE = 1024 * 256; // 256KB

interface GzipToolState {
  selectedGzipFileId: string | null;
  selectedGzipFilename: string | null;
  decompressedFileId: string | null;
}

const DEFAULT_GZIP_TOOL_STATE: GzipToolState = {
  selectedGzipFileId: null,
  selectedGzipFilename: null,
  decompressedFileId: null,
};

interface GzipFileExplorerClientProps {
  toolRoute: string;
}

export default function GzipFileExplorerClient({
  toolRoute,
}: GzipFileExplorerClientProps) {
  const {
    addFile,
    getFile,
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

  const [currentGzipFile, setCurrentGzipFile] = useState<StoredFile | null>(
    null
  );
  const [currentDecompressedFile, setCurrentDecompressedFile] =
    useState<StoredFile | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewType, setPreviewType] = useState<
    'text' | 'image' | 'binary' | 'loading' | 'error' | null
  >(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const previewImageUrlRef = useRef<string | null>(null);

  const [isSelectFileModalOpen, setIsSelectFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<
    'download' | 'saveToLibrary' | null
  >(null);
  const [filenameForPrompt, setFilenameForPrompt] = useState('');

  const [copySuccess, setCopySuccess] = useState(false); // For text preview copy
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const directiveName = ownMetadata.directive;

  // Effect for cleaning up Object URLs for image previews
  useEffect(() => {
    return () => {
      if (previewImageUrlRef.current) {
        URL.revokeObjectURL(previewImageUrlRef.current);
        previewImageUrlRef.current = null;
      }
    };
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewType(null);
    setPreviewText(null);
    if (previewImageUrlRef.current) {
      URL.revokeObjectURL(previewImageUrlRef.current);
      previewImageUrlRef.current = null;
    }
    setPreviewImageUrl(null);
  }, []);

  const decompressAndPreview = useCallback(
    async (gzipFile: StoredFile) => {
      if (!gzipFile.blob) {
        setError(`Gzip file "${gzipFile.filename}" has no content.`);
        return;
      }

      setIsProcessing(true);
      setError(null);
      clearPreview();
      setPreviewType('loading');
      setCurrentDecompressedFile(null); // Clear previous decompressed file display

      // Clean up previously decompressed file if it exists and was temporary
      if (toolState.decompressedFileId) {
        const oldDecompressedFile = await getFile(toolState.decompressedFileId);
        if (oldDecompressedFile?.isTemporary) {
          cleanupOrphanedTemporaryFiles([toolState.decompressedFileId]).catch(
            (e) =>
              console.error(
                'Failed to cleanup old temporary decompressed file:',
                e
              )
          );
        }
      }

      try {
        const gzipFileDataArrayBuffer = await gzipFile.blob.arrayBuffer();
        const gzipFileDataUint8Array = new Uint8Array(gzipFileDataArrayBuffer);

        const inflated = pako.inflate(gzipFileDataUint8Array, {
          to: 'Uint8Array',
          gzip: true,
        });

        // pako.inflate with gzip:true returns an object { result, header, err, msg }
        // For pako versions that might return Uint8Array directly or throw on error:
        let decompressedDataUint8Array: Uint8Array;
        let header: pako.Header | undefined;

        if (inflated && typeof inflated === 'object' && 'result' in inflated) {
          // Modern pako structure
          if (inflated.err) {
            throw new Error(
              `Pako inflation error: ${inflated.msg || inflated.err}`
            );
          }
          decompressedDataUint8Array = inflated.result as Uint8Array; // Type assertion
          header = inflated.header;
        } else if (inflated instanceof Uint8Array) {
          // Older pako or direct ungzip might return Uint8Array
          decompressedDataUint8Array = inflated;
          // Header might not be available here, would need manual parsing or different pako API if required
        } else {
          throw new Error('Unexpected result from pako.inflate');
        }

        const originalFilenameFromHeader = header?.name;
        const outputFilename =
          originalFilenameFromHeader ||
          gzipFile.filename.replace(/\.(gz|gzip)$/i, '') ||
          `${gzipFile.filename}_decompressed`;

        const outputMimeType = getMimeTypeForFile(outputFilename);
        const decompressedBlob = new Blob([decompressedDataUint8Array], {
          type: outputMimeType,
        });

        const newDecompressedFileId = await addFile(
          decompressedBlob,
          outputFilename,
          outputMimeType,
          true // Initially temporary
        );

        const newDecompressedFile = await getFile(newDecompressedFileId);
        if (!newDecompressedFile) {
          throw new Error('Failed to retrieve newly saved decompressed file.');
        }

        setCurrentDecompressedFile(newDecompressedFile);
        const newStateUpdate = {
          ...toolState,
          decompressedFileId: newDecompressedFileId,
        };
        setToolState(newStateUpdate);
        await saveStateNow(newStateUpdate); // Persist the new decompressedFileId

        // Setup preview
        if (isTextBasedMimeType(newDecompressedFile.type)) {
          let text = await newDecompressedFile.blob.text();
          if (text.length > MAX_TEXT_PREVIEW_SIZE) {
            text =
              text.substring(0, MAX_TEXT_PREVIEW_SIZE) +
              '\n\n--- Content truncated ---';
          }
          setPreviewText(text);
          setPreviewType('text');
        } else if (newDecompressedFile.type.startsWith('image/')) {
          if (previewImageUrlRef.current) {
            URL.revokeObjectURL(previewImageUrlRef.current);
          }
          const url = URL.createObjectURL(newDecompressedFile.blob);
          previewImageUrlRef.current = url;
          setPreviewImageUrl(url);
          setPreviewType('image');
        } else {
          setPreviewType('binary');
        }
      } catch (err: any) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to decompress Gzip file.';
        setError(errorMsg);
        setPreviewType('error');
        setCurrentDecompressedFile(null);
        const errorStateUpdate = { ...toolState, decompressedFileId: null };
        setToolState(errorStateUpdate);
        await saveStateNow(errorStateUpdate);
      } finally {
        setIsProcessing(false);
      }
    },
    [
      addFile,
      getFile,
      clearPreview,
      toolState,
      setToolState,
      saveStateNow,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  // Effect to load initial files from toolState IDs
  useEffect(() => {
    if (!isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = true;
      let activeGzipFile: StoredFile | null = null;

      const loadInitialData = async () => {
        setIsProcessing(true); // Use general processing flag
        if (toolState.selectedGzipFileId) {
          const gzFile = await getFile(toolState.selectedGzipFileId);
          if (gzFile) {
            setCurrentGzipFile(gzFile);
            activeGzipFile = gzFile; // Keep track for possible auto-decompression
          } else {
            // Gzip file ID in state but not found in DB, clear relevant state
            setToolState((prev) => ({
              ...prev,
              selectedGzipFileId: null,
              selectedGzipFilename: null,
              decompressedFileId: null,
            }));
            setCurrentGzipFile(null);
            setCurrentDecompressedFile(null);
            clearPreview();
          }
        }

        if (toolState.decompressedFileId) {
          const decFile = await getFile(toolState.decompressedFileId);
          if (decFile) {
            setCurrentDecompressedFile(decFile);
            // Setup preview for existing decompressed file
            if (isTextBasedMimeType(decFile.type)) {
              let text = await decFile.blob.text();
              if (text.length > MAX_TEXT_PREVIEW_SIZE) {
                text =
                  text.substring(0, MAX_TEXT_PREVIEW_SIZE) +
                  '\n\n--- Content truncated ---';
              }
              setPreviewText(text);
              setPreviewType('text');
            } else if (decFile.type.startsWith('image/')) {
              if (previewImageUrlRef.current) {
                URL.revokeObjectURL(previewImageUrlRef.current);
              }
              const url = URL.createObjectURL(decFile.blob);
              previewImageUrlRef.current = url;
              setPreviewImageUrl(url);
              setPreviewType('image');
            } else {
              setPreviewType('binary');
            }
          } else {
            // Decompressed file ID in state but not found, clear it
            setToolState((prev) => ({ ...prev, decompressedFileId: null }));
            setCurrentDecompressedFile(null);
            // If Gzip file exists, re-decompress
            if (activeGzipFile) {
              await decompressAndPreview(activeGzipFile);
            } else {
              clearPreview();
            }
          }
        } else if (activeGzipFile) {
          // Gzip file loaded, but no decompressed file ID in state, so decompress
          await decompressAndPreview(activeGzipFile);
        }
        setIsProcessing(false);
      };

      loadInitialData().catch((e) => {
        setError(`Error loading initial state: ${e.message}`);
        setIsProcessing(false);
      });
    }
  }, [
    isLoadingToolState,
    toolState.selectedGzipFileId,
    toolState.decompressedFileId,
    getFile,
    setToolState,
    decompressAndPreview,
    clearPreview,
  ]);

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[], _source: 'library' | 'upload') => {
      setIsSelectFileModalOpen(false);
      if (files.length === 0) return;

      const file = files[0];
      if (
        !(
          file.type === 'application/gzip' ||
          file.type === 'application/x-gzip' ||
          file.filename.toLowerCase().endsWith('.gz') ||
          file.filename.toLowerCase().endsWith('.gzip')
        )
      ) {
        setError(
          'Invalid file type. Please select a Gzip compressed file (.gz).'
        );
        return;
      }

      // If a new Gzip file is selected, clean up the old one if it was temporary
      if (
        currentGzipFile &&
        currentGzipFile.id !== file.id &&
        currentGzipFile.isTemporary
      ) {
        cleanupOrphanedTemporaryFiles([currentGzipFile.id]).catch((e) =>
          console.error('Failed to cleanup old temporary Gzip file:', e)
        );
      }

      setCurrentGzipFile(file);
      const newState = {
        ...DEFAULT_GZIP_TOOL_STATE, // Reset most state for a new file
        selectedGzipFileId: file.id,
        selectedGzipFilename: file.filename,
      };
      setToolState(newState);
      // saveStateNow will be called by decompressAndPreview after it updates decompressedFileId

      await decompressAndPreview(file);
      setUserDeferredAutoPopup(false); // Reset ITDE deferral
    },
    [
      setToolState,
      decompressAndPreview,
      currentGzipFile,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setError(null);
      setIsProcessing(true);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setError(`Metadata not found for source: ${signal.sourceToolTitle}`);
        setIsProcessing(false);
        return;
      }

      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );

      if (
        resolvedPayload.type === 'error' ||
        resolvedPayload.type === 'none' ||
        !resolvedPayload.data ||
        resolvedPayload.data.length === 0
      ) {
        setError(
          resolvedPayload.errorMessage || 'No data received from source.'
        );
        setIsProcessing(false);
        return;
      }

      const receivedFileItem = resolvedPayload.data[0];
      let fileToProcess: StoredFile | null = null;

      if (
        receivedFileItem &&
        (receivedFileItem.type === 'application/gzip' ||
          receivedFileItem.type === 'application/x-gzip' ||
          ('filename' in receivedFileItem &&
            ((receivedFileItem as StoredFile).filename
              .toLowerCase()
              .endsWith('.gz') ||
              (receivedFileItem as StoredFile).filename
                .toLowerCase()
                .endsWith('.gzip'))))
      ) {
        if (!('id' in receivedFileItem)) {
          // InlineFile, needs to be saved to library first
          try {
            const tempName = `itde-received-${Date.now()}.gz`;
            const newId = await addFile(
              receivedFileItem.blob,
              tempName,
              receivedFileItem.type || 'application/gzip',
              true // Save as temporary
            );
            fileToProcess = await getFile(newId);
            if (!fileToProcess)
              throw new Error('Failed to retrieve saved InlineFile for ITDE.');
          } catch (e) {
            setError(
              `Failed to process incoming Gzip data: ${e instanceof Error ? e.message : String(e)}`
            );
            setIsProcessing(false);
            return;
          }
        } else {
          fileToProcess = receivedFileItem as StoredFile;
        }
      } else if (receivedFileItem) {
        setError(
          `Received file from ${signal.sourceToolTitle} is not a Gzip file (type: ${receivedFileItem.type}).`
        );
        setIsProcessing(false);
        return;
      }

      if (fileToProcess) {
        // Clean up old Gzip file if temporary
        if (currentGzipFile?.isTemporary) {
          cleanupOrphanedTemporaryFiles([currentGzipFile.id]).catch((e) =>
            console.error('Cleanup of old Gzip file failed (ITDE):', e)
          );
        }
        setCurrentGzipFile(fileToProcess);
        const newState = {
          ...DEFAULT_GZIP_TOOL_STATE,
          selectedGzipFileId: fileToProcess.id,
          selectedGzipFilename: fileToProcess.filename,
        };
        setToolState(newState);
        await decompressAndPreview(fileToProcess);
        setUserDeferredAutoPopup(false);
      } else {
        setError('No valid Gzip file found in ITDE data.');
        setIsProcessing(false);
      }
    },
    [
      getToolMetadata,
      addFile,
      getFile,
      decompressAndPreview,
      setToolState,
      currentGzipFile,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (
      initialToolStateLoadCompleteRef.current &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [itdeTarget, userDeferredAutoPopup]);

  const handleClear = useCallback(async () => {
    setError(null);
    clearPreview();
    setCurrentGzipFile(null);
    setCurrentDecompressedFile(null);

    const idsToCleanup: string[] = [];
    if (toolState.selectedGzipFileId) {
      const gzFile = await getFile(toolState.selectedGzipFileId);
      if (gzFile?.isTemporary) idsToCleanup.push(toolState.selectedGzipFileId);
    }
    if (toolState.decompressedFileId) {
      // Decompressed files are always initially temporary
      idsToCleanup.push(toolState.decompressedFileId);
    }

    setToolState(DEFAULT_GZIP_TOOL_STATE);
    await saveStateNow(DEFAULT_GZIP_TOOL_STATE);

    if (idsToCleanup.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToCleanup).catch((e) =>
        console.error('Cleanup failed during clear:', e)
      );
    }
    setSaveSuccess(false);
    setDownloadSuccess(false);
    setCopySuccess(false);
  }, [
    clearPreview,
    toolState,
    setToolState,
    saveStateNow,
    getFile,
    cleanupOrphanedTemporaryFiles,
  ]);

  const handleFilenameConfirm = useCallback(
    async (filename: string) => {
      setIsFilenameModalOpen(false);
      if (!currentDecompressedFile || !filenamePromptAction) return;

      let finalFilename = filename.trim();
      if (!finalFilename) {
        finalFilename = currentDecompressedFile.filename; // Default to its current name
      }

      if (filenamePromptAction === 'download') {
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
        } catch (err: any) {
          setError(
            `Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      } else if (filenamePromptAction === 'saveToLibrary') {
        try {
          await makeFilePermanentAndUpdate(
            currentDecompressedFile.id,
            finalFilename
          );
          // Refresh currentDecompressedFile state to reflect permanence and new name
          const updatedFile = await getFile(currentDecompressedFile.id);
          if (updatedFile) setCurrentDecompressedFile(updatedFile);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err: any) {
          setError(
            `Failed to save to library: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      }
      setFilenamePromptAction(null);
    },
    [
      currentDecompressedFile,
      filenamePromptAction,
      makeFilePermanentAndUpdate,
      getFile,
    ]
  );

  const initiateOutputAction = (action: 'download' | 'saveToLibrary') => {
    if (!currentDecompressedFile) {
      setError(`No decompressed file to ${action}.`);
      return;
    }
    setFilenameForPrompt(currentDecompressedFile.filename);
    setFilenamePromptAction(action);
    setIsFilenameModalOpen(true);
  };

  const handleCopyPreviewText = useCallback(async () => {
    if (previewType === 'text' && previewText) {
      try {
        await navigator.clipboard.writeText(previewText);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err: any) {
        setError('Failed to copy text to clipboard.');
      }
    }
  }, [previewType, previewText]);

  const canPerformOutputActions = !!currentDecompressedFile && !error;

  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Gzip File Explorer...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <Button
            variant="primary"
            onClick={() => setIsSelectFileModalOpen(true)}
            disabled={isProcessing}
            iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
          >
            Select .gz File
          </Button>
          <ReceiveItdeDataTrigger
            hasDeferredSignals={
              itdeTarget.pendingSignals.length > 0 &&
              userDeferredAutoPopup &&
              !itdeTarget.isModalOpen
            }
            pendingSignalCount={itdeTarget.pendingSignals.length}
            onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
          />
        </div>
        {currentGzipFile && (
          <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
            Selected: <strong>{currentGzipFile.filename}</strong> (
            {formatBytes(currentGzipFile.size)})
          </p>
        )}
      </div>

      {isProcessing && previewType === 'loading' && (
        <div className="p-4 text-center text-gray-500 italic animate-pulse">
          Decompressing and analyzing...
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        </div>
      )}

      {currentDecompressedFile && !isProcessing && !error && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <h3 className="text-lg font-semibold mb-2 text-[rgb(var(--color-text-base))] flex items-center">
            <DocumentMagnifyingGlassIcon className="h-6 w-6 mr-2 text-[rgb(var(--color-text-link))]" />
            Decompressed Content: {currentDecompressedFile.filename}
          </h3>
          <p className="text-sm text-[rgb(var(--color-text-muted))] mb-1">
            Type: {currentDecompressedFile.type || 'Unknown'}
          </p>
          <p className="text-sm text-[rgb(var(--color-text-muted))] mb-3">
            Size: {formatBytes(currentDecompressedFile.size)}
            {currentGzipFile &&
              ` (from ${formatBytes(currentGzipFile.size)} compressed)`}
          </p>

          {previewType === 'text' && previewText !== null && (
            <>
              <Textarea
                label="Text Preview (read-only)"
                labelClassName="sr-only"
                value={previewText}
                readOnly
                rows={10}
                textareaClassName="text-sm font-mono bg-[rgb(var(--color-bg-subtle))]"
              />
              <Button
                variant="neutral-outline"
                size="sm"
                onClick={handleCopyPreviewText}
                disabled={copySuccess}
                className="mt-2"
              >
                {copySuccess ? 'Copied!' : 'Copy Text'}
              </Button>
            </>
          )}
          {previewType === 'image' && previewImageUrl && (
            <div className="my-2 p-2 border rounded-md bg-[rgb(var(--color-bg-subtle))] max-h-[50vh] overflow-auto">
              <Image
                src={previewImageUrl}
                alt={`Preview of ${currentDecompressedFile.filename}`}
                width={500}
                height={300}
                className="max-w-full h-auto object-contain mx-auto"
                unoptimized
                onError={() => {
                  setError(
                    `Failed to load image preview for ${currentDecompressedFile.filename}`
                  );
                  setPreviewType('error');
                }}
              />
            </div>
          )}
          {previewType === 'binary' && (
            <div className="my-2 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-sm flex items-center gap-2">
              <InformationCircleIcon className="h-5 w-5 shrink-0" />
              <span>
                Binary content. Preview not available. You can download or save
                it.
              </span>
            </div>
          )}
          {previewType === 'error' && !error && ( // If main error is not set, but preview specific error
            <div className="my-2 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-md text-sm">
              Preview unavailable for this file.
            </div>
          )}
        </div>
      )}

      {!currentGzipFile && !isProcessing && !error && (
        <p className="p-4 text-lg text-center text-gray-400 italic">
          Select a .gz file to begin.
        </p>
      )}

      <div className="flex flex-wrap gap-2 items-center p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <OutputActionButtons
          canPerform={canPerformOutputActions}
          isSaveSuccess={saveSuccess}
          isDownloadSuccess={downloadSuccess}
          onInitiateSave={() => initiateOutputAction('saveToLibrary')}
          onInitiateDownload={() => initiateOutputAction('download')}
          onClear={handleClear}
          directiveName={directiveName}
          outputConfig={ownMetadata.outputConfig}
          selectedOutputItems={
            currentDecompressedFile ? [currentDecompressedFile] : []
          }
        />
      </div>

      <FileSelectionModal
        isOpen={isSelectFileModalOpen}
        onClose={() => setIsSelectFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".gz,application/gzip,application/x-gzip"
        selectionMode="single"
        libraryFilter={{ type: 'application/gzip' }} // Or more specific if known
        initialTab="upload"
        defaultSaveUploadsToLibrary={false} // Input .gz files are temporary by default
      />

      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => {
          setIsFilenameModalOpen(false);
          setFilenamePromptAction(null);
        }}
        onConfirm={handleFilenameConfirm}
        initialFilename={filenameForPrompt}
        title={
          filenamePromptAction === 'download'
            ? 'Enter Download Filename'
            : 'Enter Filename for Library'
        }
        filenameAction={filenamePromptAction || 'download'}
        confirmButtonText={
          filenamePromptAction === 'download' ? 'Download' : 'Save to Library'
        }
      />

      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={(sd) => {
          itdeTarget.acceptSignal(sd);
          if (itdeTarget.pendingSignals.length - 1 === 0) setUserDeferredAutoPopup(false);
        }}
        onIgnore={(sd) => {
          itdeTarget.ignoreSignal(sd);
          if (itdeTarget.pendingSignals.length - 1 === 0) setUserDeferredAutoPopup(false);
        }}
        onDeferAll={() => {
          setUserDeferredAutoPopup(true);
          itdeTarget.closeModal();
        }}
        onIgnoreAll={() => {
          setUserDeferredAutoPopup(false);
          itdeTarget.ignoreAllSignals();
        }}
      />
    </div>
  );
}
