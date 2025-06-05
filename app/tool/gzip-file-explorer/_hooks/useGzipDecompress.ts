// FILE: app/tool/gzip-file-explorer/_hooks/useGzipDecompress.ts
import { useState, useCallback } from 'react';
import pako from 'pako';

export interface GzipHeaderInfo {
  name: string | null;
  mtime: number | null; // Unix timestamp
  comment: string | null;
  os: number | null;
  extra: Uint8Array | null;
  hcrc: boolean | null;
}

interface UseGzipDecompressReturn {
  isDecompressing: boolean;
  error: string | null;
  decompressedData: Uint8Array | null;
  headerInfo: GzipHeaderInfo | null;
  decompressFile: (gzippedBlob: Blob) => Promise<void>;
  clearDecompressionResults: () => void;
}

const useGzipDecompress = (): UseGzipDecompressReturn => {
  const [isDecompressing, setIsDecompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decompressedData, setDecompressedData] = useState<Uint8Array | null>(null);
  const [headerInfo, setHeaderInfo] = useState<GzipHeaderInfo | null>(null);

  const clearDecompressionResults = useCallback(() => {
    setDecompressedData(null);
    setHeaderInfo(null);
    setError(null);
  }, []);

  const decompressFile = useCallback(async (gzippedBlob: Blob) => {
    setIsDecompressing(true);
    clearDecompressionResults();

    try {
      const arrayBuffer = await gzippedBlob.arrayBuffer();
      const gzippedData = new Uint8Array(arrayBuffer);

      // pako's ungzip with header option
      const pakoHeader: pako.Unzip$Options = {};
      const result = pako.ungzip(gzippedData, pakoHeader);
      
      setDecompressedData(result);
      
      const parsedHeader: GzipHeaderInfo = {
        name: pakoHeader.name || null,
        mtime: pakoHeader.mtime || null,
        comment: pakoHeader.comment || null,
        os: pakoHeader.os || null,
        extra: pakoHeader.extra || null,
        hcrc: pakoHeader.hcrc || null,
      };
      setHeaderInfo(parsedHeader);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown decompression error';
      console.error('Gzip Decompression Error:', err);
      setError(`Decompression failed: ${message}. Ensure the file is a valid Gzip archive.`);
      setDecompressedData(null);
      setHeaderInfo(null);
    } finally {
      setIsDecompressing(false);
    }
  }, [clearDecompressionResults]);

  return {
    isDecompressing,
    error,
    decompressedData,
    headerInfo,
    decompressFile,
    clearDecompressionResults,
  };
};

export default useGzipDecompress;
