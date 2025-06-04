```typescript
import { useCallback, useState } from 'react';
import pako from 'pako';
import type { StoredFile } from '@/src/types/storage';

interface GzipHeaderInfo {
  name?: string;
  mtime?: number;
  comment?: string;
  os?: number;
  extra?: Uint8Array;
}

interface DecompressResult {
  decompressedBuffer: Uint8Array;
  headerInfo: GzipHeaderInfo | null;
}

interface UseGzipDecompressorReturn {
  decompressFile: (gzippedFile: StoredFile) => Promise<DecompressResult>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

const useGzipDecompressor = (): UseGzipDecompressorReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const decompressFile = useCallback(async (gzippedFile: StoredFile): Promise<DecompressResult> => {
    setIsLoading(true);
    setError(null);

    if (!gzippedFile.blob) {
      setIsLoading(false);
      const errMsg = 'Gzip file blob is missing.';
      setError(errMsg);
      throw new Error(errMsg);
    }

    try {
      const gzippedArrayBuffer = await gzippedFile.blob.arrayBuffer();
      const gzippedData = new Uint8Array(gzippedArrayBuffer);

      return new Promise<DecompressResult>((resolve, reject) => {
        const decompressedChunks: Uint8Array[] = []; // Fixed: Changed to const
        let totalLength = 0;
        let headerInfo: GzipHeaderInfo | null = null;

        const inflator = new pako.Inflate({ gzip: true });

        inflator.onHeader = (header) => {
          headerInfo = {
            name: header.name,
            mtime: header.mtime,
            comment: header.comment,
            os: header.os,
            extra: header.extra,
          };
        };

        inflator.onData = (chunk) => {
          decompressedChunks.push(chunk);
          totalLength += chunk.length;
        };

        inflator.onEnd = (status) => {
          setIsLoading(false);
          if (status === 0) { // pako.Z_OK
            const decompressedBuffer = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of decompressedChunks) {
              decompressedBuffer.set(chunk, offset);
              offset += chunk.length;
            }
            resolve({ decompressedBuffer, headerInfo });
          } else {
            const errMsg = `Decompression failed with status: ${status}. Pako error: ${inflator.msg || 'Unknown pako error'}`;
            setError(errMsg);
            reject(new Error(errMsg));
          }
        };
        
        inflator.push(gzippedData, true); // true for final chunk
      });

    } catch (err) {
      setIsLoading(false);
      const errMsg = err instanceof Error ? `Decompression error: ${err.message}` : 'An unknown decompression error occurred.';
      setError(errMsg);
      throw new Error(errMsg);
    }
  }, []);

  return { decompressFile, isLoading, error, clearError };
};

export default useGzipDecompressor;
```
