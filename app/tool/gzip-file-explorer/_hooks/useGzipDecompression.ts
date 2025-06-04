import { useState, useCallback } from 'react';
import pako from 'pako';
import type { StoredFile } from '@/src/types/storage';
import { getMimeTypeForFile } from '@/app/lib/utils';

export interface DecompressionResult {
  fileName: string; // Guessed name of the decompressed file
  blob: Blob;       // Decompressed content
  originalSize: number; // Size of the input gzipped blob
  decompressedSize: number; // Size of the output decompressed blob
  mimeType: string; // Guessed MIME type of decompressed content
}

interface UseGzipDecompressionReturn {
  decompress: (gzippedFile: StoredFile) => Promise<DecompressionResult>;
  isLoading: boolean;
  error: string | null;
}

function guessDecompressedFilename(originalName: string): string {
  const lowerName = originalName.toLowerCase();
  if (lowerName.endsWith('.gz')) {
    return originalName.slice(0, -3);
  }
  if (lowerName.endsWith('.gzip')) {
    return originalName.slice(0, -5);
  }
  // If no .gz extension, it might be a file that is gzipped but not named with .gz
  // Or it's a misidentified file. We'll prepend for safety.
  return `decompressed_${originalName}`;
}

export default function useGzipDecompression(): UseGzipDecompressionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decompress = useCallback(async (gzippedFile: StoredFile): Promise<DecompressionResult> => {
    setIsLoading(true);
    setError(null);

    if (!gzippedFile.blob) {
      setError('Gzipped file blob is missing.');
      setIsLoading(false);
      throw new Error('Gzipped file blob is missing.');
    }

    try {
      const fileBuffer = await gzippedFile.blob.arrayBuffer();
      const decompressedData = pako.ungzip(new Uint8Array(fileBuffer));
      
      const guessedName = guessDecompressedFilename(gzippedFile.filename);
      const guessedMimeType = getMimeTypeForFile(guessedName);

      const decompressedBlob = new Blob([decompressedData], { type: guessedMimeType });

      setIsLoading(false);
      return {
        fileName: guessedName,
        blob: decompressedBlob,
        originalSize: gzippedFile.size,
        decompressedSize: decompressedBlob.size,
        mimeType: guessedMimeType,
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown decompression error';
      setError(`Decompression failed: ${errorMessage}`);
      setIsLoading(false);
      throw new Error(`Decompression failed: ${errorMessage}`);
    }
  }, []);

  return { decompress, isLoading, error };
}