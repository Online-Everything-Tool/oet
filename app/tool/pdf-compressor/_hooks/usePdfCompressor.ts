import { useState, useCallback } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export type CompressionLevel = 'low' | 'medium' | 'high' | 'custom';

export interface CompressionOptions {
  level: CompressionLevel;
  quality?: number;
  maxDimension?: number;
}

const COMPRESSION_PRESETS: Record<
  'low' | 'medium' | 'high',
  Omit<CompressionOptions, 'level'>
> = {
  low: { quality: 0.9, maxDimension: 2400 },
  medium: { quality: 0.75, maxDimension: 1920 },
  high: { quality: 0.6, maxDimension: 1280 },
};

export function usePdfCompressor() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { addFile } = useFileLibrary();

  const compressPdf = useCallback(
    async (
      pdfFile: StoredFile,
      options: CompressionOptions
    ): Promise<string | null> => {
      if (!pdfFile.blob) {
        setError('PDF file blob is missing.');
        return null;
      }

      setIsLoading(true);
      setError(null);
      setProgress({ current: 0, total: 0 });

      try {
        const pdfjsLib = await import('pdfjs-dist');
        const { PDFDocument } = await import('pdf-lib');
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          '/data/pdf-media-extractor/pdf.worker.mjs';

        const originalPdfBytes = await pdfFile.blob.arrayBuffer();
        const pdfDocToRead: PDFDocumentProxy = await pdfjsLib.getDocument({
          data: originalPdfBytes.slice(0),
        }).promise;
        const pdfDocToWrite = await PDFDocument.create();
        const numPages = pdfDocToRead.numPages;
        setProgress({ current: 0, total: numPages });

        const preset =
          options.level === 'custom'
            ? options
            : COMPRESSION_PRESETS[options.level];

        for (let i = 0; i < numPages; i++) {
          const page: PDFPageProxy = await pdfDocToRead.getPage(i + 1);
          const viewport = page.getViewport({ scale: 1.5 });

          let { width, height } = viewport;
          let scale = 1.0;

          if (preset.maxDimension) {
            if (width > preset.maxDimension || height > preset.maxDimension) {
              scale =
                width > height
                  ? preset.maxDimension / width
                  : preset.maxDimension / height;
              width *= scale;
              height *= scale;
            }
          }

          width = Math.round(width);
          height = Math.round(height);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) continue;

          await page.render({
            canvasContext: context,
            viewport: page.getViewport({ scale: scale }),
          }).promise;

          const compressedImageBytes = await new Promise<ArrayBuffer>(
            (resolve) => {
              canvas.toBlob(
                (blob) => {
                  blob?.arrayBuffer().then(resolve);
                },
                'image/jpeg',
                preset.quality
              );
            }
          );

          const jpgImage = await pdfDocToWrite.embedJpg(compressedImageBytes);
          const newPage = pdfDocToWrite.addPage([width, height]);
          newPage.drawImage(jpgImage, {
            x: 0,
            y: 0,
            width: width,
            height: height,
          });

          setProgress({ current: i + 1, total: numPages });
        }

        const pdfBytes = await pdfDocToWrite.save();
        const newBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const originalFilename =
          pdfFile.filename.substring(0, pdfFile.filename.lastIndexOf('.')) ||
          pdfFile.filename;
        const newFilename = `${originalFilename}-compressed.pdf`;
        const newFileId = await addFile(
          newBlob,
          newFilename,
          'application/pdf',
          true
        );
        return newFileId;
      } catch (err) {
        console.error('Error during PDF compression:', err);
        setError(
          err instanceof Error
            ? `Compression failed: ${err.message}`
            : 'An unknown error occurred during PDF compression.'
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [addFile]
  );

  return { isLoading, error, progress, compressPdf };
}
