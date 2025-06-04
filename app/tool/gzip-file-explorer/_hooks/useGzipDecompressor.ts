import { useState, useCallback } from 'react';
import pako from 'pako';
import { getMimeTypeForFile } from '@/app/lib/utils';

export interface DecompressResult {
  blob: Blob;
  filename: string; // Inferred original filename
  mimeType: string; // Inferred MIME type
}

interface UseGzipDecompressorReturn {
  result: DecompressResult | null;
  isLoading: boolean;
  error: string | null;
  decompressFile: (file: Blob, inputFilename: string) => Promise<DecompressResult | null>;
  reset: () => void;
}

export default function useGzipDecompressor(): UseGzipDecompressorReturn {
  const [result, setResult] = useState<DecompressResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decompressFile = useCallback(async (file: Blob, inputFilename: string): Promise<DecompressResult | null> => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const decompressedData = pako.inflate(new Uint8Array(buffer));

      let originalFilename = inputFilename;
      if (originalFilename.toLowerCase().endsWith('.gz')) {
        originalFilename = originalFilename.substring(0, originalFilename.length - 3);
      } else if (originalFilename.toLowerCase().endsWith('.tgz')) {
        originalFilename = originalFilename.substring(0, originalFilename.length - 4) + '.tar';
      }
      
      if (!originalFilename && inputFilename) {
        originalFilename = `${inputFilename}_decompressed`;
      } else if (!originalFilename && !inputFilename) {
        originalFilename = 'decompressed_file';
      }


      const inferredMimeType = getMimeTypeForFile(originalFilename);
      const decompressedBlob = new Blob([decompressedData], { type: inferredMimeType });

      const opResult: DecompressResult = {
        blob: decompressedBlob,
        filename: originalFilename,
        mimeType: inferredMimeType,
      };
      setResult(opResult);
      setIsLoading(false);
      return opResult;
    } catch (e) {
      console.error("Gzip decompression error:", e);
      const message = e instanceof Error ? e.message : String(e);
      let specificError = `Decompression failed: ${message}`;
      if (message.includes('incorrect header check') || message.includes('invalid stored block lengths')) {
        specificError = "Decompression failed: The file does not appear to be a valid Gzip file or is corrupted.";
      } else if (message.includes('not enough data') || message.includes('need dictionary')) {
         specificError = "Decompression failed: The Gzip file is incomplete, corrupted, or requires a preset dictionary not supported here.";
      }
      setError(specificError);
      setResult(null);
      setIsLoading(false);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { result, isLoading, error, decompressFile, reset };
}