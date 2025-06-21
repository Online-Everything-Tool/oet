import { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import type { StoredFile } from '@/src/types/storage';

export type CompressionLevel = 'low' | 'medium' | 'high';

interface UsePdfCompressorReturn {
  isCompressing: boolean;
  error: string | null;
  compressPdf: (
    pdfFile: StoredFile,
    level: CompressionLevel
  ) => Promise<Blob | null>;
}

export function usePdfCompressor(): UsePdfCompressorReturn {
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compressPdf = useCallback(
    async (
      pdfFile: StoredFile,
      level: CompressionLevel
    ): Promise<Blob | null> => {
      if (!pdfFile.blob) {
        setError('PDF file content is missing.');
        return null;
      }

      setIsCompressing(true);
      setError(null);

      try {
        const existingPdfBytes = await pdfFile.blob.arrayBuffer();
        const pdfDoc = await PDFDocument.load(existingPdfBytes, {
          // Disabling font subsetting on load can prevent errors with some documents
          updateMetadata: false,
        });

        // Compression logic based on level
        if (level === 'high') {
          // Remove metadata for high compression
          pdfDoc.setTitle('');
          pdfDoc.setAuthor('');
          pdfDoc.setSubject('');
          pdfDoc.setKeywords([]);
          pdfDoc.setProducer('');
          pdfDoc.setCreator('');
          pdfDoc.setCreationDate(new Date(0));
          pdfDoc.setModificationDate(new Date(0));
        }

        // The primary compression comes from re-saving the document,
        // which allows pdf-lib to restructure the file, remove unused objects,
        // and use object streams for better compression.
        const pdfBytes = await pdfDoc.save({
          useObjectStreams: level !== 'low', // Object streams are a key part of modern PDF compression
        });

        return new Blob([pdfBytes], { type: 'application/pdf' });
      } catch (err) {
        console.error('Error during PDF compression:', err);
        const message =
          err instanceof Error
            ? err.message
            : 'An unknown error occurred during compression.';
        setError(
          `Failed to compress PDF. The file may be corrupted or password-protected. Error: ${message}`
        );
        return null;
      } finally {
        setIsCompressing(false);
      }
    },
    []
  );

  return { isCompressing, error, compressPdf };
}