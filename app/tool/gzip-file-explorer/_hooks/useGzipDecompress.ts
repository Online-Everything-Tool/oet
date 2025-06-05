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

      // Use correct typing for pako's ungzip with header information
      const result = pako.ungzip(gzippedData, { to: 'string' });
      const pakoHeader = pako.inflateRaw(gzippedData, { to: 'string' });


      setDecompressedData(new Uint8Array(Buffer.from(result)));
      
      let parsedHeader: GzipHeaderInfo = {
        name: null,
        mtime: null,
        comment: null,
        os: null,
        extra: null,
        hcrc: null,
      };

      try {
        // Attempt to parse header information, handle potential errors
        const header = JSON.parse(pakoHeader)
        parsedHeader = {
          name: header.name || null,
          mtime: header.mtime || null,
          comment: header.comment || null,
          os: header.os || null,
          extra: header.extra || null,
          hcrc: header.hcrc || null,
        };
      } catch (e) {
        console.warn("Could not parse header information", e);
      }

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
