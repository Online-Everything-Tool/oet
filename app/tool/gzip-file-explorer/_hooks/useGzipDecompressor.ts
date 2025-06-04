import { useState, useCallback } from 'react';
import pako from 'pako';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';
import { getMimeTypeForFile } from '@/app/lib/utils';

export interface ParsedGzipHeader {
  text?: boolean;
  time?: number;
  os?: number;
  extra?: Uint8Array;
  name?: string;
  comment?: string;
  hcrc?: boolean;
}

interface DecompressResult {
  decompressedFileId: string;
  headerInfo: ParsedGzipHeader;
  originalFileName: string | null;
  uncompressedSize: number;
  determinedMimeType: string;
}

interface UseGzipDecompressorReturn {
  decompress: (gzFile: StoredFile) => Promise<DecompressResult | null>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export default function useGzipDecompressor(): UseGzipDecompressorReturn {
  const { addFile } = useFileLibrary();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const decompress = useCallback(
    async (gzFile: StoredFile): Promise<DecompressResult | null> => {
      if (!gzFile.blob) {
        setError('Gzip file blob is missing.');
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const fileBuffer = await gzFile.blob.arrayBuffer();
        const inflateInstance = new pako.Inflate({ gzip: true });
        
        inflateInstance.push(new Uint8Array(fileBuffer), true);

        if (inflateInstance.err) {
          throw new Error(`Pako inflation error: ${inflateInstance.msg || pako.deflateMessages[inflateInstance.err]}`);
        }

        const decompressedData = inflateInstance.result as Uint8Array;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const headerInfo = inflateInstance.header as any as ParsedGzipHeader;
        
        const originalFileNameFromHeader = headerInfo?.name || null;
        const uncompressedSize = decompressedData.length;

        let determinedMimeType = 'application/octet-stream';
        if (originalFileNameFromHeader) {
          determinedMimeType = getMimeTypeForFile(originalFileNameFromHeader);
        }
        
        const decompressedBlob = new Blob([decompressedData], { type: determinedMimeType });
        
        const nameForStorage = originalFileNameFromHeader || 
                               (gzFile.filename.toLowerCase().endsWith('.gz') 
                                 ? gzFile.filename.slice(0, -3) 
                                 : `${gzFile.filename}_decompressed`);

        const decompressedFileId = await addFile(
          decompressedBlob,
          nameForStorage,
          determinedMimeType,
          true // Mark as temporary
        );

        return {
          decompressedFileId,
          headerInfo,
          originalFileName: originalFileNameFromHeader,
          uncompressedSize,
          determinedMimeType,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown decompression error';
        console.error('Decompression failed:', err);
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [addFile]
  );

  return { decompress, isLoading, error, clearError };
}