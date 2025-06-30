'use client';

import React, { useState, useCallback, useEffect } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import {
  usePdfCompressor,
  CompressionOptions,
} from '../_hooks/usePdfCompressor';
import type { StoredFile } from '@/src/types/storage';
import { OutputConfig } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import Button from '@/app/tool/_components/form/Button';
import Range from '@/app/tool/_components/form/Range';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import useItdeTargetHandler from '@/app/tool/_hooks/useItdeTargetHandler';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import { resolveItdeData } from '@/app/lib/itdeDataUtils';
import toolSpecificMetadata from '../metadata.json';
import { formatBytes, getFileIconClassName } from '@/app/lib/utils';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon, ServerIcon } from '@heroicons/react/20/solid';

interface PdfCompressorState {
  inputPdfId: string | null;
  processedPdfId: string | null;
  imageResolution: number;
  lastUserGivenFilename: string | null;
}

const DEFAULT_STATE: PdfCompressorState = {
  inputPdfId: null,
  processedPdfId: null,
  imageResolution: 150,
  lastUserGivenFilename: null,
};

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
      resolution: state.imageResolution,
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
          <Range
            label="Image Quality (DPI): Lower is smaller file size"
            id="imageResolution"
            min={72}
            max={300}
            step={1}
            value={state.imageResolution}
            onChange={(e) =>
              setState({ imageResolution: parseInt(e.target.value, 10) })
            }
            disabled={isCompressing}
          />
        </div>
      </div>

      <div className="p-3 bg-[rgb(var(--color-bg-info-subtle))] border border-[rgb(var(--color-border-info))] text-[rgb(var(--color-text-emphasis))] rounded-md text-sm flex items-start gap-2">
        <ServerIcon className="h-5 w-5 mt-0.5 flex-shrink-0 text-[rgb(var(--color-text-link))]" />
        <div>
          <span className="font-bold">Server-Side Processing:</span> This tool
          uploads your PDF to our secure server for high-quality compression of
          embedded images. Your file is deleted immediately after processing.
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
            Uploading & Compressing PDF...
          </p>
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Please wait, this may take a moment for large files.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-medium mb-1">Input PDF</h3>
          <div className="p-4 border rounded-md min-h-24 flex items-center justify-center text-center">
            {inputPdf ? (
              <div className="flex items-center gap-3">
                <span
                  className={`${getFileIconClassName(inputPdf.filename)} text-3xl`}
                ></span>
                <div>
                  <p
                    className="font-semibold text-left"
                    title={inputPdf.filename}
                  >
                    {inputPdf.filename}
                  </p>
                  <p className="text-sm text-[rgb(var(--color-text-muted))] text-left">
                    {formatBytes(inputPdf.size)}
                  </p>
                </div>
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
          <div className="p-4 border rounded-md min-h-24 flex items-center justify-center text-center">
            {processedPdf ? (
              <div className="flex items-center gap-3">
                <span
                  className={`${getFileIconClassName(processedPdf.filename)} text-3xl`}
                ></span>
                <div>
                  <p
                    className="font-semibold text-left"
                    title={processedPdf.filename}
                  >
                    {processedPdf.filename}
                  </p>
                  <p className="text-sm text-[rgb(var(--color-text-muted))] text-left">
                    {formatBytes(processedPdf.size)}
                  </p>
                </div>
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
