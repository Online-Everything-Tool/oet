import { useState, useCallback } from 'react';
import pako from 'pako';

export interface DecompressedGzipResult {
  data: Uint8Array;
  originalFilename: string | null;
  mtime: number | null;
}

interface UseGzipDecompressorReturn {
  decompressedResult: DecompressedGzipResult | null;
  isLoading: boolean;
  error: string | null;
  decompress: (fileBlob: Blob) => Promise<void>;
  clear: () => void;
}

const useGzipDecompressor = (): UseGzipDecompressorReturn => {
  const [decompressedResult, setDecompressedResult] = useState<DecompressedGzipResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(() => {
    setDecompressedResult(null);
    setIsLoading(false);
    setError(null);
  }, []);

  const decompress = useCallback(async (fileBlob: Blob) => {
    clear();
    setIsLoading(true);

    const fileReader = new FileReader();

    return new Promise<void>((resolve, reject) => {
      fileReader.onload = () => {
        try {
          const arrayBuffer = fileReader.result as ArrayBuffer;
          const data = new Uint8Array(arrayBuffer);

          const gunzip = new pako.Inflate({ gzip: true });
          gunzip.push(data, true); // true for final chunk

          if (gunzip.err) {
            const errMsg = `Decompression error: ${gunzip.msg || pako.zError(gunzip.err)}`;
            setError(errMsg);
            setIsLoading(false);
            reject(new Error(errMsg));
            return;
          }

          const decompressedDataArray = gunzip.result as Uint8Array;
          const header = gunzip.header;
          
          setDecompressedResult({
            data: decompressedDataArray,
            originalFilename: header?.name || null,
            mtime: header?.mtime || null,
          });
          setError(null);
          setIsLoading(false);
          resolve();

        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          setError(`Decompression failed: ${errMsg}`);
          setIsLoading(false);
          reject(new Error(`Decompression failed: ${errMsg}`));
        }
      };

      fileReader.onerror = () => {
        const errMsg = `File reading error: ${fileReader.error?.message || 'Unknown error'}`;
        setError(errMsg);
        setIsLoading(false);
        reject(new Error(errMsg));
      };

      fileReader.readAsArrayBuffer(fileBlob);
    });
  }, [clear]);

  return {
    decompressedResult,
    isLoading,
    error,
    decompress,
    clear,
  };
};

export default useGzipDecompressor;