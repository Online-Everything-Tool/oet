import { useState, useCallback } from 'react';
import pako from 'pako';

export interface GzipDecompressionResult {
  decompressedBuffer: ArrayBuffer;
  originalFilename?: string;
  modificationTime?: Date;
  comment?: string;
}

export interface UseGzipDecompressorReturn {
  result: GzipDecompressionResult | null;
  isLoading: boolean;
  error: string | null;
  decompressFile: (gzippedFile: File) => Promise<void>;
  clear: () => void;
}

export function useGzipDecompressor(): UseGzipDecompressorReturn {
  const [result, setResult] = useState<GzipDecompressionResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const decompressFile = useCallback(async (gzippedFile: File) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const buffer = await gzippedFile.arrayBuffer();
      const view = new Uint8Array(buffer);

      let originalFilename: string | undefined;
      let modificationTime: Date | undefined;
      let comment: string | undefined;

      // Basic Gzip header parsing
      if (view.length >= 10 && view[0] === 0x1f && view[1] === 0x8b && view[2] === 0x08) { // Check magic bytes and compression method
        const flags = view[3];
        let currentOffset = 10; // Skip fixed part of header

        // MTIME (Modification Time)
        const mtimeUnix = view[4] | (view[5] << 8) | (view[6] << 16) | (view[7] << 24);
        if (mtimeUnix > 0) {
          modificationTime = new Date(mtimeUnix * 1000);
        }

        // FEXTRA flag
        if (flags & 0x04) {
          if (view.length < currentOffset + 2) throw new Error("Invalid Gzip header: FEXTRA flag set but file too short for XLEN.");
          const xlen = view[currentOffset] | (view[currentOffset + 1] << 8);
          currentOffset += 2 + xlen;
          if (view.length < currentOffset) throw new Error("Invalid Gzip header: FEXTRA flag set but file too short for extra field.");
        }
        // FNAME flag
        if (flags & 0x08) {
          const nameStartOffset = currentOffset;
          while (currentOffset < view.length && view[currentOffset] !== 0) {
            currentOffset++;
          }
          if (view[currentOffset] !== 0) throw new Error("Invalid Gzip header: FNAME flag set but no null terminator found for filename.");
          originalFilename = new TextDecoder().decode(view.slice(nameStartOffset, currentOffset));
          currentOffset++; // Skip null terminator
        }
        // FCOMMENT flag
        if (flags & 0x10) {
          const commentStartOffset = currentOffset;
          while (currentOffset < view.length && view[currentOffset] !== 0) {
            currentOffset++;
          }
          if (view[currentOffset] !== 0) throw new Error("Invalid Gzip header: FCOMMENT flag set but no null terminator found for comment.");
          comment = new TextDecoder().decode(view.slice(commentStartOffset, currentOffset));
          currentOffset++; // Skip null terminator
        }
        // FHCRC flag
        if (flags & 0x02) {
          currentOffset += 2; // Skip CRC16
          if (view.length < currentOffset) throw new Error("Invalid Gzip header: FHCRC flag set but file too short for CRC16.");
        }
      } else if (view.length < 10) {
         // Not a Gzip file or too short, try to decompress anyway, pako might handle it or throw
      } else if (view[0] !== 0x1f || view[1] !== 0x8b) {
        // Not a Gzip file, try to decompress anyway, pako might handle it or throw
      }


      const decompressedPayload = pako.ungzip(view);
      setResult({
        decompressedBuffer: decompressedPayload.buffer,
        originalFilename,
        modificationTime,
        comment,
      });

    } catch (e) {
      console.error("Gzip decompression error:", e);
      setError(e instanceof Error ? e.message : "Failed to decompress Gzip file.");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { result, isLoading, error, decompressFile, clear };
}