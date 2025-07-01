import { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';

export interface SelectedPage {
  sourceFileId: string;
  pageIndex: number;
}

export function usePdfPageMerger() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addFile, getFile } = useFileLibrary();

  const mergePages = useCallback(
    async (
      selectedPages: SelectedPage[],
      outputFilename: string
    ): Promise<string | null> => {
      if (selectedPages.length === 0) {
        setError('No pages selected to merge.');
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const newPdfDoc = await PDFDocument.create();
        const sourceDocs = new Map<string, PDFDocument>();

        for (const page of selectedPages) {
          if (!sourceDocs.has(page.sourceFileId)) {
            const file = await getFile(page.sourceFileId);
            if (!file || !file.blob) {
              throw new Error(
                `Could not load PDF with ID: ${page.sourceFileId}`
              );
            }
            const bytes = await file.blob.arrayBuffer();
            const doc = await PDFDocument.load(bytes);
            sourceDocs.set(page.sourceFileId, doc);
          }
        }

        for (const page of selectedPages) {
          const sourceDoc = sourceDocs.get(page.sourceFileId);
          if (sourceDoc) {
            const [copiedPage] = await newPdfDoc.copyPages(sourceDoc, [
              page.pageIndex,
            ]);
            newPdfDoc.addPage(copiedPage);
          }
        }

        const mergedPdfBytes = await newPdfDoc.save();
        const newBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const newFileId = await addFile(
          newBlob,
          outputFilename,
          'application/pdf',
          true
        );

        return newFileId;
      } catch (err) {
        console.error('Error during PDF merging:', err);
        setError(
          err instanceof Error
            ? `Merging failed: ${err.message}`
            : 'An unknown error occurred during PDF merging.'
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [addFile, getFile]
  );

  return { isLoading, error, mergePages };
}
