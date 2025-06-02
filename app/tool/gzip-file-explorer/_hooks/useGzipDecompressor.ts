import { useState, useCallback } from 'react';
import pako from 'pako';
import type { StoredFile } from '@/src/types/storage';

export interface DecompressResult {
  content: Uint8Array | null;
  originalFilename: string | null; // Original filename from gzip header
}

interface UseGzipDecompressorReturn {
  decompressFile: (file: StoredFile) => Promise<DecompressResult>;
  isDecompressing: boolean;
  decompressionError: string | null;
}

export default function useGzipDecompressor(): UseGzipDecompressorReturn {
  const [isDecompressing, setIsDecompressing] = useState(false);
  const [decompressionError, setDecompressionError] = useState<string | null>(null);

  const decompressFile = useCallback(async (file: StoredFile): Promise<DecompressResult> => {
    if (!file.blob) {
      setDecompressionError('File blob is missing.');
      return { content: null, originalFilename: null };
    }

    setIsDecompressing(true);
    setDecompressionError(null);

    try {
      const gzippedData = await file.blob.arrayBuffer();
      const inflator = new pako.Inflate({ gzip: true });
      inflator.push(new Uint8Array(gzippedData), true); // true for final chunk

      if (inflator.err) {
        // Ensure inflator.msg is a string, or use pako.strError for numeric codes
        const errorMessage = typeof inflator.msg === 'string' && inflator.msg.length > 0 
                             ? inflator.msg 
                             : pako.strError(inflator.err);
        throw new Error(`Pako error ${inflator.err}: ${errorMessage}`);
      }

      const decompressedContent = inflator.result as Uint8Array;
      // Ensure header and name are properly accessed, providing null if not present
      const originalFilename = inflator.header?.name || null;
      
      setIsDecompressing(false);
      return { content: decompressedContent, originalFilename: originalFilename };

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Gzip decompression error:', error);
      setDecompressionError(`Decompression failed: ${msg}`);
      setIsDecompressing(false);
      return { content: null, originalFilename: null };
    }
  }, []);

  return { decompressFile, isDecompressing, decompressionError };
}