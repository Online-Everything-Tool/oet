import { useState, useCallback } from 'react';

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';

export interface ExtractedImage {
  blob: Blob;
  name: string;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
}

export function usePdfExtractor() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { addFile } = useFileLibrary();

  const extractMedia = useCallback(
    async (pdfFile: StoredFile): Promise<string[]> => {
      if (!pdfFile.blob) {
        setError('PDF file blob is missing.');
        return [];
      }

      setIsLoading(true);
      setError(null);
      setProgress({ current: 0, total: 0 });

      let pdf: PDFDocumentProxy | null = null;

      try {
        const pdfjsLib = await import('pdfjs-dist');

        pdfjsLib.GlobalWorkerOptions.workerSrc =
          '/data/pdf-media-extractor/pdf.worker.mjs';

        const arrayBuffer = await pdfFile.blob.arrayBuffer();
        pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        setProgress({ current: 0, total: numPages });

        const extractedImages: ExtractedImage[] = [];

        for (let i = 1; i <= numPages; i++) {
          const page: PDFPageProxy = await pdf.getPage(i);
          const operatorList = await page.getOperatorList();

          const imageOps = operatorList.fnArray.reduce((acc, op, index) => {
            if (op === pdfjsLib.OPS.paintImageXObject) {
              acc.push(operatorList.argsArray[index][0]);
            }
            return acc;
          }, [] as string[]);

          for (const imgName of imageOps) {
            try {
              const img = await page.objs.get(imgName);

              if (!img) {
                console.warn(`Could not retrieve image object: ${imgName}`);
                continue;
              }

              let blob: Blob | null = null;
              let fileExtension = 'png';

              if (img.data && img.data instanceof Uint8Array) {
                if (img.data[0] === 0xff && img.data[1] === 0xd8) {
                  blob = new Blob([img.data], { type: 'image/jpeg' });
                  fileExtension = 'jpg';
                }
              }

              if (!blob && img.width && img.height) {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) continue;

                const imageData = ctx.createImageData(img.width, img.height);

                if (img.data) {
                  imageData.data.set(img.data);
                } else {
                  if (img.bitmap) {
                    ctx.drawImage(img.bitmap, 0, 0);
                  } else {
                    console.warn(
                      `Image ${imgName} has no data or bitmap to process.`
                    );
                    continue;
                  }
                }

                if (!img.bitmap) {
                  ctx.putImageData(imageData, 0, 0);
                }

                blob = await canvasToBlob(canvas);
                fileExtension = 'png';
              }

              if (blob) {
                extractedImages.push({
                  blob,
                  name: `page${i}-${imgName}.${fileExtension}`,
                });
              } else {
                console.warn(
                  `Could not create a blob for image ${imgName} on page ${i}.`
                );
              }
            } catch (e) {
              console.warn(
                `Error processing image ${imgName} on page ${i}:`,
                e
              );
            }
          }
          setProgress({ current: i, total: numPages });
        }

        if (extractedImages.length === 0) {
          setError('No compatible images found in this PDF.');
          return [];
        }

        const addedFileIds: string[] = [];
        for (const image of extractedImages) {
          const fileId = await addFile(
            image.blob,
            image.name,
            image.blob.type,
            true
          );
          addedFileIds.push(fileId);
        }

        return addedFileIds;
      } catch (err) {
        console.error('Error extracting media from PDF:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'An unknown error occurred during PDF processing.'
        );
        return [];
      } finally {
        setIsLoading(false);

        if (pdf) {
          pdf.destroy();
        }
      }
    },
    [addFile]
  );

  return { isLoading, error, progress, extractMedia };
}
