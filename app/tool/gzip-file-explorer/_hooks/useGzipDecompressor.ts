import { useState, useCallback } from 'react';
import pako from 'pako';
import type { StoredFile } from '@/src/types/storage';
import { getMimeTypeForFile } from '@/app/lib/utils';

export interface DecompressedOutput {
  blob: Blob;
  filename: string;
  type: string; // MIME type of the decompressed file
}

interface UseGzipDecompressorReturn {
  isLoading: boolean;
  error: string | null;
  decompress: (
    inputFile: StoredFile
  ) => Promise<DecompressedOutput | null>;
}

export default function useGzipDecompressor(): UseGzipDecompressorReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decompress = useCallback(
    async (inputFile: StoredFile): Promise<DecompressedOutput | null> => {
      if (!inputFile?.blob) {
        setError('Input file or blob is missing.');
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const arrayBuffer = await inputFile.blob.arrayBuffer();
        const decompressedUint8Array = pako.ungzip(arrayBuffer);

        let outputFilename = inputFile.filename || 'decompressed_file';
        if (outputFilename.toLowerCase().endsWith('.tar.gz')) {
          outputFilename = outputFilename.slice(0, -7) + '.tar';
        } else if (outputFilename.toLowerCase().endsWith('.tgz')) {
          outputFilename = outputFilename.slice(0, -4) + '.tar';
        } else if (outputFilename.toLowerCase().endsWith('.gz')) {
          outputFilename = outputFilename.slice(0, -3);
        } else {
          // If no .gz extension, append a suffix (should be rare given inputConfig)
          outputFilename = `${outputFilename}_decompressed`;
        }
        
        // Ensure filename is not empty (e.g. if original was just ".gz")
        if (!outputFilename || outputFilename.startsWith('.')) {
            outputFilename = `decompressed_file_${Date.now()}${outputFilename.startsWith('.') ? outputFilename : ''}`;
        }


        const outputType = getMimeTypeForFile(outputFilename);
        const blob = new Blob([decompressedUint8Array], { type: outputType });

        return { blob, filename: outputFilename, type: outputType };
      } catch (e) {
        console.error('Gzip decompression error:', e);
        setError(
          e instanceof Error ? e.message : 'Gzip decompression failed. The file might be corrupted or not a valid gzip file.'
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { isLoading, error, decompress };
}