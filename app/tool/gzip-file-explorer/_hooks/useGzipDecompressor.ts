import { useState, useCallback } from 'react';
import pako from 'pako';
import type { StoredFile } from '@/src/types/storage';
import { getMimeTypeForFile } from '@/app/lib/utils';

export interface DecompressedInfo {
  name: string;
  type: string;
  blob: Blob;
  size: number;
  comment?: string;
  modTime?: Date;
  originalGzFilename: string;
}

interface UseGzipDecompressorReturn {
  decompressedInfo: DecompressedInfo | null;
  isLoading: boolean;
  error: string | null;
  decompressFile: (inputFile: StoredFile) => Promise<void>;
  clearDecompressedInfo: () => void;
}

export default function useGzipDecompressor(): UseGzipDecompressorReturn {
  const [decompressedInfo, setDecompressedInfo] = useState<DecompressedInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearDecompressedInfo = useCallback(() => {
    setDecompressedInfo(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const decompressFile = useCallback(async (inputFile: StoredFile) => {
    if (!inputFile.blob) {
      setError('Input file blob is missing.');
      setDecompressedInfo(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setDecompressedInfo(null);

    try {
      const fileBuffer = await inputFile.blob.arrayBuffer();
      const fileData = new Uint8Array(fileBuffer);

      const gunzip = new pako.Inflate({ gzip: true });
      gunzip.push(fileData, true); // true for Z_FINISH

      if (gunzip.err) {
        throw new Error(`Pako decompression error: ${gunzip.msg} (Code: ${gunzip.err})`);
      }

      const resultBytes = gunzip.result as Uint8Array;
      if (!resultBytes) {
        throw new Error('Decompression resulted in empty data.');
      }
      
      const header = gunzip.header;
      
      let originalName = header?.name || '';
      if (!originalName) {
        originalName = inputFile.filename.replace(/\.gz$/i, '');
        if (!originalName || originalName === inputFile.filename) { // If .gz wasn't found or filename is just ".gz"
          originalName = 'decompressed_file';
        }
      }
      // Ensure filename doesn't have path components if header.name was a path
      originalName = originalName.split('/').pop() || originalName;


      const mimeType = getMimeTypeForFile(originalName);
      const blob = new Blob([resultBytes], { type: mimeType });

      setDecompressedInfo({
        name: originalName,
        type: mimeType,
        blob: blob,
        size: blob.size,
        comment: header?.comment,
        modTime: header?.time ? new Date(header.time * 1000) : undefined,
        originalGzFilename: inputFile.filename,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during GZIP decompression.';
      console.error("GZIP Decompression Error:", err);
      setError(errorMessage);
      setDecompressedInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    decompressedInfo,
    isLoading,
    error,
    decompressFile,
    clearDecompressedInfo,
  };
}