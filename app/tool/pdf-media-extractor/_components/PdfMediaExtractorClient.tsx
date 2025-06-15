'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import { usePdfExtractor } from '../_hooks/usePdfExtractor';
import type { StoredFile } from '@/src/types/storage';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import Button from '@/app/tool/_components/form/Button';
import { DocumentArrowUpIcon, XCircleIcon } from '@heroicons/react/24/outline';
import ExtractedMediaItem from './ExtractedMediaItem';
import SendToToolButton from '@/app/tool/_components/shared/SendToToolButton';
import useItdeTargetHandler from '@/app/tool/_hooks/useItdeTargetHandler';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import { resolveItdeData } from '@/app/lib/itdeDataUtils';
import toolSpecificMetadata from '../metadata.json';
import { OutputConfig } from '@/src/types/tools';

interface PdfExtractorState {
  inputPdfId: string | null;
  inputPdfName: string | null;
  outputMediaIds: string[];
  selectedOutputIds: string[];
}

const DEFAULT_STATE: PdfExtractorState = {
  inputPdfId: null,
  inputPdfName: null,
  outputMediaIds: [],
  selectedOutputIds: [],
};

export default function PdfMediaExtractorClient({ toolRoute }: { toolRoute: string }) {
  const { state, setState, isLoadingState, clearStateAndPersist, saveStateNow } = useToolState<PdfExtractorState>(toolRoute, DEFAULT_STATE);
  const { getFile, makeFilePermanentAndUpdate, deleteFilePermanently, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const { isLoading: isExtracting, error: extractionError, progress, extractMedia } = usePdfExtractor();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [extractedFiles, setExtractedFiles] = useState<StoredFile[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(extractionError);
  }, [extractionError]);

  const handleClear = useCallback(async () => {
    const idsToClean = [...state.outputMediaIds];
    if (state.inputPdfId) {
      idsToClean.push(state.inputPdfId);
    }
    await clearStateAndPersist();
    setExtractedFiles([]);
    setError(null);
    if (idsToClean.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToClean);
    }
  }, [clearStateAndPersist, state.inputPdfId, state.outputMediaIds, cleanupOrphanedTemporaryFiles]);

  const processPdf = useCallback(async (pdfId: string) => {
    const pdfFile = await getFile(pdfId);
    if (!pdfFile) {
      setError('Could not retrieve the selected PDF file.');
      return;
    }
    
    // Clear previous results before starting
    if (state.outputMediaIds.length > 0) {
      cleanupOrphanedTemporaryFiles(state.outputMediaIds);
    }
    setState({ outputMediaIds: [], selectedOutputIds: [] });

    const newMediaIds = await extractMedia(pdfFile);
    setState({ outputMediaIds: newMediaIds, inputPdfName: pdfFile.filename });
  }, [getFile, extractMedia, setState, state.outputMediaIds, cleanupOrphanedTemporaryFiles]);

  useEffect(() => {
    if (state.inputPdfId && !isExtracting) {
      const hasBeenProcessed = state.outputMediaIds.length > 0 || extractionError;
      if (!hasBeenProcessed) {
        processPdf(state.inputPdfId);
      }
    }
  }, [state.inputPdfId, processPdf, isExtracting, state.outputMediaIds.length, extractionError]);

  useEffect(() => {
    let active = true;
    const urlsToRevoke: string[] = [];

    const loadFiles = async () => {
      if (state.outputMediaIds.length === 0) {
        setExtractedFiles([]);
        return;
      }
      const files = (await Promise.all(state.outputMediaIds.map(id => getFile(id)))).filter(Boolean) as StoredFile[];
      if (!active) return;

      const newPreviewUrls: Record<string, string> = {};
      files.forEach(file => {
        if (file.blob) {
          const url = URL.createObjectURL(file.blob);
          newPreviewUrls[file.id] = url;
          urlsToRevoke.push(url);
        }
      });

      setExtractedFiles(files);
      setPreviewUrls(newPreviewUrls);
    };

    loadFiles();

    return () => {
      active = false;
      urlsToRevoke.forEach(URL.revokeObjectURL);
    };
  }, [state.outputMediaIds, getFile]);

  const handleFileSelected = useCallback(async (files: StoredFile[]) => {
    setIsModalOpen(false);
    if (files.length > 0 && files[0].id) {
      if (state.inputPdfId !== files[0].id) {
        await handleClear();
        setState({ inputPdfId: files[0].id });
      }
    }
  }, [state.inputPdfId, setState, handleClear]);

  const handleItdeSignal = useCallback(async (signal: { sourceDirective: string }) => {
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setError(`Metadata not found for source: ${signal.sourceDirective}`);
      return;
    }
    const resolved = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
    if (resolved.type === 'itemList' && resolved.data && resolved.data.length > 0) {
      const pdfItem = resolved.data.find(item => item.type === 'application/pdf' && 'id' in item) as StoredFile | undefined;
      if (pdfItem) {
        if (state.inputPdfId !== pdfItem.id) {
          await handleClear();
          setState({ inputPdfId: pdfItem.id });
        }
      } else {
        setError('No PDF file found in the received data.');
      }
    } else {
      setError(resolved.errorMessage || 'Failed to receive data.');
    }
  }, [getToolMetadata, setState, state.inputPdfId, handleClear]);

  const itdeHandler = useItdeTargetHandler({
    targetToolDirective: toolSpecificMetadata.directive,
    onProcessSignal: handleItdeSignal,
  });

  useEffect(() => {
    if (!isLoadingState) {
      itdeHandler.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeHandler]);

  const handleSelectItem = (id: string) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedOutputIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { ...prev, selectedOutputIds: Array.from(newSelected) };
    });
  };

  const handleDownloadItem = (file: StoredFile) => {
    if (!file.blob) return;
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveItem = async (file: StoredFile) => {
    await makeFilePermanentAndUpdate(file.id, file.filename);
    // Optimistically update UI
    setExtractedFiles(prev => prev.map(f => f.id === file.id ? { ...f, isTemporary: false } : f));
  };

  const handleDeleteItem = async (id: string) => {
    await deleteFilePermanently(id);
    setState(prev => ({
      ...prev,
      outputMediaIds: prev.outputMediaIds.filter(mediaId => mediaId !== id),
      selectedOutputIds: prev.selectedOutputIds.filter(selId => selId !== id),
    }));
  };
  
  const selectedFilesForItde = useMemo(() => {
    return extractedFiles.filter(f => state.selectedOutputIds.includes(f.id));
  }, [extractedFiles, state.selectedOutputIds]);

  return (
    <div className="space-y-4">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="accent2" onClick={() => setIsModalOpen(true)} iconLeft={<DocumentArrowUpIcon className="h-5 w-5" />}>
            {state.inputPdfId ? 'Change PDF' : 'Select PDF'}
          </Button>
          {(state.inputPdfId || error) && (
            <Button variant="danger" onClick={handleClear} iconLeft={<XCircleIcon className="h-5 w-5" />}>
              Clear
            </Button>
          )}
          {state.selectedOutputIds.length > 0 && (
             <SendToToolButton
                currentToolDirective={toolSpecificMetadata.directive}
                currentToolOutputConfig={toolSpecificMetadata.outputConfig as OutputConfig}
                selectedOutputItems={selectedFilesForItde}
                onBeforeSignal={() => saveStateNow()}
              />
          )}
        </div>
        {state.inputPdfName && !isExtracting && <p className="text-sm text-[rgb(var(--color-text-muted))]">Loaded: <strong>{state.inputPdfName}</strong></p>}
      </div>

      {error && <div className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm">{error}</div>}

      {isExtracting && (
        <div className="text-center p-4">
          <p className="text-lg font-semibold animate-pulse">Extracting Media...</p>
          <p className="text-sm text-[rgb(var(--color-text-muted))]">Processing page {progress.current} of {progress.total}</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}></div>
          </div>
        </div>
      )}

      {!isExtracting && extractedFiles.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Extracted Media ({extractedFiles.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {extractedFiles.map(file => (
              <ExtractedMediaItem
                key={file.id}
                file={file}
                previewUrl={previewUrls[file.id] || null}
                isSelected={state.selectedOutputIds.includes(file.id)}
                onSelect={handleSelectItem}
                onDownload={handleDownloadItem}
                onSave={handleSaveItem}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        </div>
      )}

      {!isExtracting && !state.inputPdfId && !isLoadingState && (
        <div className="text-center p-8 border-2 border-dashed border-[rgb(var(--color-border-soft))] rounded-lg">
          <p className="text-lg text-[rgb(var(--color-text-muted))]">Select a PDF file to start extracting images.</p>
        </div>
      )}

      <FileSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFilesSelected={handleFileSelected}
        mode="selectExistingOrUploadNew"
        accept="application/pdf"
        selectionMode="single"
        libraryFilter={{ type: 'application/pdf' }}
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