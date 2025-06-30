'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import {
  usePdfCompressor,
  CompressionLevel,
  CompressionOptions,
} from '../_hooks/usePdfCompressor';
import type { StoredFile } from '@/src/types/storage';
import { OutputConfig } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import Button from '@/app/tool/_components/form/Button';
import RadioGroup from '@/app/tool/_components/form/RadioGroup';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import useItdeTargetHandler from '@/app/tool/_hooks/useItdeTargetHandler';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import { resolveItdeData } from '@/app/lib/itdeDataUtils';
import toolSpecificMetadata from '../metadata.json';
import { formatBytes } from '@/app/lib/utils';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/20/solid';

interface PdfCompressorState {
  inputPdfId: string | null;
  processedPdfId: string | null;
  compressionLevel: CompressionLevel;
  lastUserGivenFilename: string | null;
}

const DEFAULT_STATE: PdfCompressorState = {
  inputPdfId: null,
  processedPdfId: null,
  compressionLevel: 'medium',
  lastUserGivenFilename: null,
};

const COMPRESSION_OPTIONS = [
  { value: 'low', label: 'Low (Best Quality)' },
  { value: 'medium', label: 'Medium (Balanced)' },
  { value: 'high', label: 'High (Smallest Size)' },
] as const;

export default function PdfCompressorClient({
  toolRoute,
}: {
  toolRoute: string;
}) {
  const { state, setState, isLoadingState, clearStateAndPersist } =
    useToolState<PdfCompressorState>(toolRoute, DEFAULT_STATE);

  const { getFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } =
    useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const {
    isLoading: isCompressing,
    error: compressionError,
    progress,
    compressPdf,
  } = usePdfCompressor();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState(false);
  const [filenamePromptInitialValue, setFilenamePromptInitialValue] =
    useState('');
  const [error, setError] = useState<string | null>(null);

  const [inputPdf, setInputPdf] = useState<StoredFile | null>(null);
  const [processedPdf, setProcessedPdf] = useState<StoredFile | null>(null);
  const [manualSaveSuccess, setManualSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    setError(compressionError);
  }, [compressionError]);

  useEffect(() => {
    if (state.inputPdfId) {
      getFile(state.inputPdfId).then((pdf) => setInputPdf(pdf || null));
    } else {
      setInputPdf(null);
    }
  }, [state.inputPdfId, getFile]);

  useEffect(() => {
    if (state.processedPdfId) {
      getFile(state.processedPdfId).then((pdf) => setProcessedPdf(pdf || null));
    } else {
      setProcessedPdf(null);
    }
  }, [state.processedPdfId, getFile]);

  const handleClear = useCallback(async () => {
    const idsToClean = [];
    if (state.inputPdfId) idsToClean.push(state.inputPdfId);
    if (state.processedPdfId) idsToClean.push(state.processedPdfId);
    await clearStateAndPersist();
    setError(null);
    if (idsToClean.length > 0) {
      await cleanupOrphanedTemporaryFiles(idsToClean);
    }
  }, [
    clearStateAndPersist,
    state.inputPdfId,
    state.processedPdfId,
    cleanupOrphanedTemporaryFiles,
  ]);

  const handleFileSelected = useCallback(
    async (files: StoredFile[]) => {
      setIsModalOpen(false);
      if (files.length > 0 && files[0].id) {
        if (state.inputPdfId !== files[0].id) {
          await handleClear();
          setState({ inputPdfId: files[0].id });
        }
      }
    },
    [state.inputPdfId, setState, handleClear]
  );

  const handleItdeSignal = useCallback(
    async (signal: { sourceDirective: string }) => {
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) return;
      const resolved = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );
      if (
        resolved.type === 'itemList' &&
        resolved.data?.length &&
        'id' in resolved.data[0]
      ) {
        handleFileSelected(resolved.data as StoredFile[]);
      }
    },
    [getToolMetadata, handleFileSelected]
  );

  const itdeHandler = useItdeTargetHandler({
    targetToolDirective: toolSpecificMetadata.directive,
    onProcessSignal: handleItdeSignal,
  });

  useEffect(() => {
    if (!isLoadingState) {
      itdeHandler.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeHandler]);

  const handleCompress = async () => {
    if (!inputPdf) {
      setError('Please select a PDF file first.');
      return;
    }
    const compressionOptions: CompressionOptions = {
      level: state.compressionLevel,
    };
    const newFileId = await compressPdf(inputPdf, compressionOptions);
    if (newFileId) {
      if (state.processedPdfId) {
        await cleanupOrphanedTemporaryFiles([state.processedPdfId]);
      }
      setState({ processedPdfId: newFileId, lastUserGivenFilename: null });
      setManualSaveSuccess(false);
      setDownloadSuccess(false);
    }
  };

  const initiateDownload = () => {
    if (!processedPdf) return;
    const filename =
      state.lastUserGivenFilename || processedPdf.filename || 'compressed.pdf';
    setFilenamePromptInitialValue(filename);
    setIsFilenamePromptOpen(true);
  };

  const handleConfirmFilename = async (filename: string) => {
    setIsFilenamePromptOpen(false);
    setState({ lastUserGivenFilename: filename });
    if (!processedPdf?.blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(processedPdf.blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const handleSaveToLibrary = async () => {
    if (!processedPdf) return;
    await makeFilePermanentAndUpdate(processedPdf.id);
    setManualSaveSuccess(true);
    setTimeout(() => setManualSaveSuccess(false), 2000);
  };

  const sizeReduction = useMemo(() => {
    if (!inputPdf || !processedPdf) return 0;
    return 1 - processedPdf.size / inputPdf.size;
  }, [inputPdf, processedPdf]);

  const canPerformActions = !!state.processedPdfId && !isCompressing;
  const canInitiateSave = canPerformActions && !!processedPdf?.isTemporary;

  return (
    <div className="space-y-4">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="accent2"
            onClick={() => setIsModalOpen(true)}
            iconLeft={<DocumentArrowUpIcon className="h-5 w-5" />}
          >
            {state.inputPdfId ? 'Change PDF' : 'Select PDF'}
          </Button>
          {inputPdf && (
            <Button
              variant="primary"
              onClick={handleCompress}
              disabled={isCompressing}
              isLoading={isCompressing}
              iconLeft={<ArrowPathIcon className="h-5 w-5" />}
            >
              Compress
            </Button>
          )}
          <div className="ml-auto">
            <OutputActionButtons
              canPerform={canPerformActions}
              isSaveSuccess={manualSaveSuccess}
              isDownloadSuccess={downloadSuccess}
              canInitiateSave={canInitiateSave}
              onInitiateSave={handleSaveToLibrary}
              onInitiateDownload={initiateDownload}
              onClear={handleClear}
              directiveName={toolSpecificMetadata.directive}
              outputConfig={toolSpecificMetadata.outputConfig as OutputConfig}
              selectedOutputItems={processedPdf ? [processedPdf] : []}
            />
          </div>
        </div>
        <div className="pt-3 border-t border-[rgb(var(--color-border-base))]">
          <RadioGroup
            legend="Compression Level"
            name="compressionLevel"
            options={COMPRESSION_OPTIONS}
            selectedValue={state.compressionLevel}
            onChange={(value) => setState({ compressionLevel: value })}
            disabled={isCompressing}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm">
          {error}
        </div>
      )}

      {isCompressing && (
        <div className="text-center p-4">
          <p className="text-lg font-semibold animate-pulse">
            Compressing PDF...
          </p>
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Processing page {progress.current} of {progress.total}
          </p>
          <div className="w-full bg-[rgb(var(--color-bg-neutral))] rounded-full h-2.5 mt-2">
            <div
              className="bg-[rgb(var(--color-button-primary-bg))] h-2.5 rounded-full"
              style={{
                width: `${(progress.current / (progress.total || 1)) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-medium mb-1">Input PDF</h3>
          <div className="p-4 border rounded-md min-h-24 flex items-center justify-center">
            {inputPdf ? (
              <div>
                <p className="font-semibold">{inputPdf.filename}</p>
                <p className="text-sm text-[rgb(var(--color-text-muted))]">
                  {formatBytes(inputPdf.size)}
                </p>
              </div>
            ) : (
              <p className="text-[rgb(var(--color-text-muted))]">
                No PDF selected
              </p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-medium mb-1">Output PDF</h3>
          <div className="p-4 border rounded-md min-h-24 flex items-center justify-center">
            {processedPdf ? (
              <div>
                <p className="font-semibold">{processedPdf.filename}</p>
                <p className="text-sm text-[rgb(var(--color-text-muted))]">
                  {formatBytes(processedPdf.size)}
                </p>
                <p
                  className={`font-bold mt-1 ${
                    sizeReduction > 0
                      ? 'text-[rgb(var(--color-status-success))]'
                      : 'text-[rgb(var(--color-status-error))]'
                  }`}
                >
                  {(sizeReduction * 100).toFixed(2)}% size reduction
                </p>
              </div>
            ) : (
              <p className="text-[rgb(var(--color-text-muted))]">
                Output appears here
              </p>
            )}
          </div>
        </div>
      </div>

      <FileSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFilesSelected={handleFileSelected}
        mode="selectExistingOrUploadNew"
        accept="application/pdf"
        selectionMode="single"
        libraryFilter={{ type: 'application/pdf' }}
      />
      <FilenamePromptModal
        isOpen={isFilenamePromptOpen}
        onClose={() => setIsFilenamePromptOpen(false)}
        onConfirm={handleConfirmFilename}
        initialFilename={processedPdf?.filename || 'compressed.pdf'}
        filenameAction="download"
      />
      <IncomingDataModal
        isOpen={itdeHandler.isModalOpen}
        signals={itdeHandler.pendingSignals}
        onAccept={itdeHandler.acceptSignal}
        onIgnore={itdeHandler.ignoreSignal}
        onDeferAll={itdeHandler.closeModal}
        onIgnoreAll={itdeHandler.ignoreAllSignals}
      />
    </div>
  );
}
