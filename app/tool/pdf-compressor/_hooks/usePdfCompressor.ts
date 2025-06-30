import { useState, useCallback } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';

export interface CompressionOptions {
  resolution: number;
}

const baseApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
const PROCESSING_URL = `${baseApiUrl}/api/directive/pdf-compressor`;

export function usePdfCompressor() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addFile } = useFileLibrary();

  const compressPdf = useCallback(
    async (
      pdfFile: StoredFile,
      options: CompressionOptions
    ): Promise<string | null> => {
      if (!pdfFile.blob) {
        setError('PDF file blob is missing.');
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', pdfFile.blob, pdfFile.filename);
        formData.append('resolution', options.resolution.toString());

        const response = await fetch(PROCESSING_URL, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: `Server returned an error: ${response.status}`,
          }));
          throw new Error(errorData.error || 'Failed to compress PDF.');
        }

        const newBlob = await response.blob();

        const originalFilename =
          pdfFile.filename.substring(0, pdfFile.filename.lastIndexOf('.')) ||
          pdfFile.filename;
        const newFilename = `${originalFilename}-compressed.pdf`;

        const newFileId = await addFile(
          newBlob,
          newFilename,
          'application/pdf',
          true
        );

        return newFileId;
      } catch (err) {
        console.error('Error during PDF compression API call:', err);
        setError(
          err instanceof Error
            ? `Compression failed: ${err.message}`
            : 'An unknown error occurred during PDF compression.'
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [addFile]
  );

  return { isLoading, error, progress: null, compressPdf };
}
