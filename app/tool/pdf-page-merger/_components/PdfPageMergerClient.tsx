'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { usePdfPageMerger, SelectedPage } from '../_hooks/usePdfPageMerger';
import type { StoredFile } from '@/src/types/storage';
import { OutputConfig } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import Button from '@/app/tool/_components/form/Button';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import toolSpecificMetadata from '../metadata.json';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { XCircleIcon } from '@heroicons/react/20/solid';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import PageThumbnail from './PageThumbnail';
import { useDebounce } from 'use-debounce';

interface SourcePdf {
  id: string;
  name: string;
  pageCount: number;
  file: StoredFile;
  docProxy: PDFDocumentProxy;
  pages: PDFPageProxy[];
}

interface PdfMergerState {
  sourcePdfIds: string[];
  selectedPages: SelectedPage[];
  mergedPdfId: string | null;
  lastUserGivenFilename: string | null;
}

const DEFAULT_STATE: PdfMergerState = {
  sourcePdfIds: [],
  selectedPages: [],
  mergedPdfId: null,
  lastUserGivenFilename: 'merged.pdf',
};

export default function PdfPageMergerClient({
  toolRoute,
}: {
  toolRoute: string;
}) {
  const {
    state,
    setState,
    saveStateNow,
    isLoadingState,
    clearStateAndPersist,
  } = useToolState<PdfMergerState>(toolRoute, DEFAULT_STATE);

  const { getFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } =
    useFileLibrary();
  const {
    isLoading: isMerging,
    error: mergingError,
    mergePages,
  } = usePdfPageMerger();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState(false);
  const [filenamePromptInitialValue, setFilenamePromptInitialValue] =
    useState('');
  const [sourcePdfs, setSourcePdfs] = useState<SourcePdf[]>([]);
  const [mergedPdf, setMergedPdf] = useState<StoredFile | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [manualSaveSuccess, setManualSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    setError(mergingError);
  }, [mergingError]);

  useEffect(() => {
    if (state.mergedPdfId) {
      getFile(state.mergedPdfId).then((pdf) => setMergedPdf(pdf || null));
    } else {
      setMergedPdf(null);
    }
  }, [state.mergedPdfId, getFile]);

  const selectedPages = useMemo(
    () => ({
      selectedPages: state.selectedPages,
    }),
    [state.selectedPages]
  );

  const [debouncedSelectedPages] = useDebounce(selectedPages, 300);

  useEffect(() => {
    if (isLoadingState) {
      return;
    }
    if (!debouncedSelectedPages.selectedPages || debouncedSelectedPages.selectedPages.length === 0) {
      const cleanup = async () => {
        const oldMergedPdfId = state.mergedPdfId;
        if (oldMergedPdfId) {
          await saveStateNow({ ...state, mergedPdfId: null });
          await cleanupOrphanedTemporaryFiles([oldMergedPdfId]);
        }
      };
      cleanup();
    } else {
      const create = async () => {
        const newFileId = await mergePages(
          debouncedSelectedPages.selectedPages,
          state.lastUserGivenFilename || 'merged.pdf'
        );
        if (newFileId) {
          const oldMergedPdfId = state.mergedPdfId;
          await saveStateNow({ ...state, mergedPdfId: newFileId });
          if (oldMergedPdfId) {
            await cleanupOrphanedTemporaryFiles([oldMergedPdfId]);
          }
          setManualSaveSuccess(false);
          setDownloadSuccess(false);
        }
      };
      create();
    }
  }, [isLoadingState, debouncedSelectedPages]);

  const loadSourcePdfs = useCallback(async () => {
    if (!state.sourcePdfIds || state.sourcePdfIds.length === 0) {
      setSourcePdfs([]);
      return;
    }
    setIsProcessingFiles(true);
    setError(null);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        '/data/pdf-media-extractor/pdf.worker.mjs';

      const loadedPdfs: SourcePdf[] = [];
      for (const id of state.sourcePdfIds) {
        const file = await getFile(id);
        if (file && file.blob) {
          const docProxy = await pdfjsLib.getDocument(
            await file.blob.arrayBuffer()
          ).promise;
          const pages: PDFPageProxy[] = [];
          for (let i = 1; i <= docProxy.numPages; i++) {
            pages.push(await docProxy.getPage(i));
          }
          loadedPdfs.push({
            id,
            name: file.filename,
            pageCount: docProxy.numPages,
            file,
            docProxy,
            pages,
          });
        }
      }
      setSourcePdfs(loadedPdfs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load source PDFs.');
    } finally {
      setIsProcessingFiles(false);
    }
  }, [state.sourcePdfIds, getFile]);

  useEffect(() => {
    loadSourcePdfs();
  }, [loadSourcePdfs]);

  const handleClear = useCallback(async () => {
    const idsToClean = [...(state.sourcePdfIds || [])];
    if (state.mergedPdfId) idsToClean.push(state.mergedPdfId);

    await clearStateAndPersist();
    setError(null);
    setSourcePdfs([]);
    if (idsToClean.length > 0) {
      await cleanupOrphanedTemporaryFiles(idsToClean);
    }
  }, [
    clearStateAndPersist,
    state.sourcePdfIds,
    state.mergedPdfId,
    cleanupOrphanedTemporaryFiles,
  ]);

  const handleRemoveSourcePdf = async (id: string) => {
    const filteredSourcePdfs = sourcePdfs.filter((pdf) => pdf.id !== id);
    setSourcePdfs(filteredSourcePdfs);
    await saveStateNow({
      ...state,
      sourcePdfIds: filteredSourcePdfs.map((pdf) => pdf.id),
      selectedPages: state.selectedPages.filter((sp) => sp.sourceFileId !== id),
    });
    await cleanupOrphanedTemporaryFiles([id]);
  };

  const handleFilesSelected = useCallback(
    async (files: StoredFile[]) => {
      setIsModalOpen(false);
      const currentIds = state.sourcePdfIds || [];
      const newIds = files
        .map((f) => f.id)
        .filter((id) => !currentIds.includes(id));
      if (newIds.length > 0) {
        setState((prev) => ({
          ...prev,
          sourcePdfIds: [...currentIds, ...newIds],
        }));
      }
    },
    [state.sourcePdfIds, setState]
  );

  const handlePageSelect = (sourceFileId: string, pageIndex: number) => {
    setState((prev) => {
      const newSelectedPages = [
        ...(prev.selectedPages || []),
        { sourceFileId, pageIndex },
      ];
      return { ...prev, selectedPages: newSelectedPages };
    });
  };

  const selectedPagesWithProxies = useMemo(() => {
    return (state.selectedPages || [])
      .map((sp) => {
        const sourceDoc = sourcePdfs.find((s) => s.id === sp.sourceFileId);
        if (!sourceDoc) return null;
        return {
          ...sp,
          pageProxy: sourceDoc.pages[sp.pageIndex],
          sourceName: sourceDoc.name,
        };
      })
      .filter(Boolean) as ({
      pageProxy: PDFPageProxy;
      sourceName: string;
    } & SelectedPage)[];
  }, [state.selectedPages, sourcePdfs]);

  const initiateDownload = () => {
    if (!mergedPdf) return;
    const filename =
      state.lastUserGivenFilename || mergedPdf.filename || 'merged.pdf';
    setFilenamePromptInitialValue(filename);
    setIsFilenamePromptOpen(true);
  };

  const handleConfirmFilename = (filename: string) => {
    setIsFilenamePromptOpen(false);
    setState((prev) => ({ ...prev, lastUserGivenFilename: filename }));
    if (!mergedPdf?.blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(mergedPdf.blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const handleSaveToLibrary = async () => {
    if (!mergedPdf) return;
    await makeFilePermanentAndUpdate(mergedPdf.id);
    setManualSaveSuccess(true);
    setTimeout(() => setManualSaveSuccess(false), 2000);
  };

  const canPerformActions =
    !isLoadingState &&
    !!state.mergedPdfId &&
    !!state.selectedPages &&
    state.selectedPages.length > 0;
  const canInitiateSave = canPerformActions && !!mergedPdf?.isTemporary;

  return (
    <div className="space-y-6">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex flex-wrap justify-between items-center">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="accent2"
            onClick={() => setIsModalOpen(true)}
            iconLeft={<DocumentArrowUpIcon className="h-5 w-5" />}
          >
            Add PDFs
          </Button>
        </div>
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
          selectedOutputItems={mergedPdf ? [mergedPdf] : []}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
          {error}
        </div>
      )}
      {isProcessingFiles && (
        <div className="text-center p-4">
          <p className="animate-pulse">Loading PDF pages...</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">
            Source Documents ({sourcePdfs.length})
          </h3>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto p-2 bg-gray-50 rounded">
            {sourcePdfs.map((doc) => (
              <div
                key={doc.id}
                className="p-2 border rounded-md bg-white relative"
              >
                <p className="font-bold text-sm truncate" title={doc.name}>
                  {doc.name}
                </p>
                <p className="text-xs text-gray-500">{doc.pageCount} pages</p>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-2">
                  {doc.pages.map((page, i) => (
                    <PageThumbnail
                      key={`${doc.id}-${i}`}
                      page={page}
                      isSelected={false}
                      onSelect={() => handlePageSelect(doc.id, i)}
                      pageNumber={i + 1}
                    />
                  ))}
                </div>
                <button
                  onClick={() => handleRemoveSourcePdf(doc.id)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 z-10 hover:bg-red-700"
                >
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">
            Staged for Merge ({selectedPagesWithProxies.length} pages)
          </h3>
          <div className="p-4 border-2 border-dashed rounded-md bg-gray-50 min-h-48 max-h-[60vh] overflow-y-auto">
            {selectedPagesWithProxies.length === 0 ? (
              <p className="text-center text-gray-500 py-10">
                Click pages on the left to add them here.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {selectedPagesWithProxies.map((sp, i) => (
                  <div key={i} className="relative">
                    <PageThumbnail
                      page={sp.pageProxy}
                      isSelected={true}
                      onSelect={() => {}}
                      pageNumber={sp.pageIndex + 1}
                    />
                    <button
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          selectedPages: (prev.selectedPages || []).filter(
                            (_, idx) => idx !== i
                          ),
                        }))
                      }
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 z-10 hover:bg-red-700"
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <FileSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFilesSelected={handleFilesSelected}
        mode="selectExistingOrUploadNew"
        accept="application/pdf"
        selectionMode="multiple"
        libraryFilter={{ type: 'application/pdf' }}
      />
      <FilenamePromptModal
        isOpen={isFilenamePromptOpen}
        onClose={() => setIsFilenamePromptOpen(false)}
        onConfirm={handleConfirmFilename}
        initialFilename={filenamePromptInitialValue}
        filenameAction="download"
      />
    </div>
  );
}
