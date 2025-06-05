'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import JSZip from 'jszip';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '@/app/tool/_hooks/useToolState';
import Button from '@/app/tool/_components/form/Button';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import type { ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import {
  ArrowUpTrayIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import SendToToolButton from '@/app/tool/_components/shared/SendToToolButton';
import { usePdfMediaExtraction } from '../_hooks/usePdfMediaExtraction';
import MediaPreviewCard from './MediaPreviewCard';
import importedMetadata from '../metadata.json';
import { formatBytesCompact } from '@/app/lib/utils';

interface PdfMediaExtractorToolState {
  selectedPdfFileId: string | null;
  selectedPdfFileName: string | null;
  extractedMediaFileIds: string[];
}

const DEFAULT_TOOL_STATE: PdfMediaExtractorToolState = {
  selectedPdfFileId: null,
  selectedPdfFileName: null,
  extractedMediaFileIds: [],
};

const metadata = importedMetadata as ToolMetadata;

interface DisplayMediaFile {
  id: string; // StoredFile.id
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
}

interface PdfMediaExtractorClientProps {
  toolRoute: string;
}

export default function PdfMediaExtractorClient({
  toolRoute,
}: PdfMediaExtractorClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
  } = useToolState<PdfMediaExtractorToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const {
    getFile,
    addFile,
    deleteFilePermanently,
    cleanupOrphanedTemporaryFiles,
  } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const { extractMedia, isProcessing: isHookProcessing } =
    usePdfMediaExtraction();

  const [currentPdfFile, setCurrentPdfFile] = useState<StoredFile | null>(null);
  const [displayedMedia, setDisplayedMedia] = useState<DisplayMediaFile[]>([]);
  const [uiError, setUiError] = useState<string | null>(null);
  const [isClientProcessing, setIsClientProcessing] = useState(false); // For actions like zipping
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  const directiveName = metadata.directive;
  const isLoading =
    isLoadingToolState || isHookProcessing || isClientProcessing;

  // Effect to load PDF if selectedPdfFileId changes
  useEffect(() => {
    if (isLoadingToolState || !initialToolStateLoadCompleteRef.current) return;

    const loadPdf = async () => {
      if (toolState.selectedPdfFileId) {
        setUiError(null);
        const file = await getFile(toolState.selectedPdfFileId);
        if (file) {
          setCurrentPdfFile(file);
        } else {
          setUiError(
            `Failed to load previously selected PDF (ID: ${toolState.selectedPdfFileId}). It may have been deleted.`
          );
          setToolState((prev) => ({
            ...prev,
            selectedPdfFileId: null,
            selectedPdfFileName: null,
            extractedMediaFileIds: [],
          }));
          setCurrentPdfFile(null);
          setDisplayedMedia([]);
        }
      } else {
        setCurrentPdfFile(null);
        setDisplayedMedia([]); // Clear display if no PDF is selected
      }
    };
    loadPdf();
  }, [toolState.selectedPdfFileId, isLoadingToolState, getFile, setToolState]);

  // Effect to process PDF when currentPdfFile is set
  useEffect(() => {
    if (!currentPdfFile?.blob || isHookProcessing) return;

    const process = async () => {
      const { extractedAssets, error: extractionError } = await extractMedia(
        currentPdfFile.blob
      );
      if (extractionError) {
        setUiError(extractionError);
        setToolState((prev) => ({ ...prev, extractedMediaFileIds: [] }));
        return;
      }
      if (extractedAssets.length === 0) {
        setUiError('No images found in the PDF.');
        setToolState((prev) => ({ ...prev, extractedMediaFileIds: [] }));
        return;
      }

      const newFileIds: string[] = [];
      for (const asset of extractedAssets) {
        const blob = new Blob([asset.data], { type: asset.type });
        try {
          // Add as temporary file initially
          const fileId = await addFile(blob, asset.name, asset.type, true);
          newFileIds.push(fileId);
        } catch (addError) {
          console.error('Error adding extracted file to library:', addError);
          setUiError(
            `Error saving extracted file ${asset.name}: ${addError instanceof Error ? addError.message : 'Unknown error'}`
          );
          // Optionally, break or collect errors
        }
      }
      setToolState((prev) => ({ ...prev, extractedMediaFileIds: newFileIds }));
    };

    process();
  }, [currentPdfFile, extractMedia, addFile, setToolState, isHookProcessing]);

  // Effect to update displayedMedia when extractedMediaFileIds changes
  useEffect(() => {
    const updateDisplay = async () => {
      // Revoke old URLs
      objectUrlsRef.current.forEach(URL.revokeObjectURL);
      objectUrlsRef.current.clear();

      if (toolState.extractedMediaFileIds.length === 0) {
        setDisplayedMedia([]);
        return;
      }

      const newDisplayedMedia: DisplayMediaFile[] = [];
      for (const fileId of toolState.extractedMediaFileIds) {
        const file = await getFile(fileId);
        if (file) {
          let previewUrl: string | undefined;
          if (file.type.startsWith('image/') && file.blob) {
            previewUrl = URL.createObjectURL(file.blob);
            objectUrlsRef.current.set(file.id, previewUrl);
          }
          newDisplayedMedia.push({
            id: file.id,
            name: file.filename,
            type: file.type,
            size: file.size,
            previewUrl,
          });
        }
      }
      setDisplayedMedia(newDisplayedMedia);
    };
    updateDisplay();

    // Cleanup object URLs on component unmount or when this effect re-runs
    return () => {
      objectUrlsRef.current.forEach(URL.revokeObjectURL);
      objectUrlsRef.current.clear();
    };
  }, [toolState.extractedMediaFileIds, getFile]);

  // ITDE Handler
  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setUiError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setUiError(
          `Metadata not found for source tool: ${signal.sourceToolTitle}`
        );
        return;
      }
      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );
      if (
        resolvedPayload.type === 'error' ||
        !resolvedPayload.data ||
        resolvedPayload.data.length === 0
      ) {
        setUiError(
          resolvedPayload.errorMessage || 'No data received from source.'
        );
        return;
      }
      const pdfFile = resolvedPayload.data.find(
        (item) => item.type === 'application/pdf' && 'id' in item
      ) as StoredFile | undefined;

      if (pdfFile) {
        const oldExtractedIds = toolState.extractedMediaFileIds;
        setToolState({
          selectedPdfFileId: pdfFile.id,
          selectedPdfFileName: pdfFile.filename,
          extractedMediaFileIds: [],
        });
        await saveStateNow({
          ...toolState,
          selectedPdfFileId: pdfFile.id,
          selectedPdfFileName: pdfFile.filename,
          extractedMediaFileIds: [],
        });
        if (oldExtractedIds.length > 0) {
          await cleanupOrphanedTemporaryFiles(oldExtractedIds);
        }
        setUserDeferredAutoPopup(false);
      } else {
        setUiError('No PDF file found in the received data.');
      }
    },
    [
      getToolMetadata,
      setToolState,
      saveStateNow,
      toolState,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = true;
    }
    if (
      initialToolStateLoadCompleteRef.current &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [
    isLoadingToolState,
    itdeTarget,
    userDeferredAutoPopup,
    initialToolStateLoadCompleteRef,
  ]);

  const handlePdfSelected = useCallback(
    async (files: StoredFile[]) => {
      setIsPdfModalOpen(false);
      if (files.length > 0) {
        const pdfFile = files[0];
        if (pdfFile.type === 'application/pdf') {
          const oldExtractedIds = toolState.extractedMediaFileIds;
          setToolState({
            selectedPdfFileId: pdfFile.id,
            selectedPdfFileName: pdfFile.filename,
            extractedMediaFileIds: [],
          });
          if (oldExtractedIds.length > 0) {
            await cleanupOrphanedTemporaryFiles(oldExtractedIds);
          }
        } else {
          setUiError('Invalid file type. Please select a PDF file.');
        }
      }
    },
    [setToolState, toolState.extractedMediaFileIds, cleanupOrphanedTemporaryFiles]
  );

  const handleClear = useCallback(async () => {
    const idsToCleanup = [...toolState.extractedMediaFileIds];
    if (toolState.selectedPdfFileId) {
      const pdfInfo = await getFile(toolState.selectedPdfFileId);
      if (pdfInfo?.isTemporary) {
        idsToCleanup.push(toolState.selectedPdfFileId);
      }
    }
    setToolState(DEFAULT_TOOL_STATE);
    await saveStateNow(DEFAULT_TOOL_STATE); // Persist cleared state
    setCurrentPdfFile(null);
    setDisplayedMedia([]);
    setUiError(null);
    if (idsToCleanup.length > 0) {
      await cleanupOrphanedTemporaryFiles(idsToCleanup);
    }
  }, [
    setToolState,
    saveStateNow,
    toolState.extractedMediaFileIds,
    toolState.selectedPdfFileId,
    getFile,
    cleanupOrphanedTemporaryFiles,
  ]);

  const handleDownloadAll = useCallback(async () => {
    if (displayedMedia.length === 0) {
      setUiError('No media to download.');
      return;
    }
    setIsClientProcessing(true);
    setUiError(null);
    const zip = new JSZip();
    for (const media of displayedMedia) {
      const file = await getFile(media.id);
      if (file?.blob) {
        zip.file(media.name, file.blob);
      }
    }
    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      const pdfBaseName =
        toolState.selectedPdfFileName?.replace(/\.pdf$/i, '') || 'extracted';
      link.download = `${pdfBaseName}_media.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setUiError(
        `Failed to create ZIP: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsClientProcessing(false);
    }
  }, [displayedMedia, getFile, toolState.selectedPdfFileName]);

  const handleDownloadIndividual = useCallback(
    async (fileId: string) => {
      const file = await getFile(fileId);
      if (file?.blob) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(file.blob);
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } else {
        setUiError(`Could not find file (ID: ${fileId}) for download.`);
      }
    },
    [getFile]
  );

  const itdeSendableItems = useMemo(() => {
    return toolState.extractedMediaFileIds
      .map((id) => {
        const f = displayedMedia.find((dm) => dm.id === id);
        if (!f) return null;
        // This is a placeholder for ITDE discovery, actual blob not needed here.
        return {
          id,
          filename: f.name,
          type: f.type,
          size: f.size,
          blob: new Blob(),
          createdAt: new Date(),
        } as StoredFile;
      })
      .filter((item): item is StoredFile => item !== null);
  }, [toolState.extractedMediaFileIds, displayedMedia]);

  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading PDF Media Extractor...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="primary"
            onClick={() => setIsPdfModalOpen(true)}
            disabled={isLoading}
            iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
          >
            Select PDF
          </Button>
          {currentPdfFile && (
            <Button
              variant="danger"
              onClick={handleClear}
              disabled={isLoading}
              iconLeft={<TrashIcon className="h-5 w-5" />}
            >
              Clear
            </Button>
          )}
          <div className="ml-auto">
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
        </div>
        {toolState.selectedPdfFileName && (
          <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
            Selected: <strong>{toolState.selectedPdfFileName}</strong>
          </p>
        )}
      </div>

      {uiError && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {uiError}
          </div>
        </div>
      )}

      {isHookProcessing && (
        <div className="text-center p-4">
          <p className="animate-pulse text-[rgb(var(--color-text-muted))]">
            Extracting media from PDF...
          </p>
        </div>
      )}

      {!isHookProcessing && displayedMedia.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-[rgb(var(--color-text-base))]">
              Extracted Media ({displayedMedia.length})
            </h2>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleDownloadAll}
                disabled={isLoading || displayedMedia.length === 0}
                iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
              >
                Download All (.zip)
              </Button>
              <SendToToolButton
                currentToolDirective={directiveName}
                currentToolOutputConfig={metadata.outputConfig}
                selectedOutputItems={itdeSendableItems}
                buttonText="Send To..."
                className={isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {displayedMedia.map((media) => (
              <MediaPreviewCard
                key={media.id}
                mediaFile={media}
                onDownload={handleDownloadIndividual}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>
      )}

      {!isHookProcessing &&
        !uiError &&
        toolState.selectedPdfFileId &&
        displayedMedia.length === 0 && (
          <div className="text-center p-8 border-2 border-dashed border-[rgb(var(--color-border-base))] rounded-md">
            <PhotoIcon className="mx-auto h-12 w-12 text-[rgb(var(--color-text-muted))]" />
            <p className="mt-2 text-lg font-medium text-[rgb(var(--color-text-base))]">
              No extractable media found
            </p>
            <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
              The selected PDF does not seem to contain any common image
              formats that could be extracted.
            </p>
          </div>
        )}

      <FileSelectionModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onFilesSelected={handlePdfSelected}
        mode="selectExistingOrUploadNew"
        accept="application/pdf"
        selectionMode="single"
        libraryFilter={{ type: 'application/pdf' }}
        initialTab="upload"
      />

      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={itdeTarget.acceptSignal}
        onIgnore={itdeTarget.ignoreSignal}
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