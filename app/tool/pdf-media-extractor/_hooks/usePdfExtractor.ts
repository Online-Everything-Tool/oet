import { useState, useCallback } from 'react';
// Type-only imports are safe for SSR as they are removed during compilation
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';

export interface ExtractedImage {
  blob: Blob;
  name: string;
}

// A helper to promisify canvas.toBlob, which uses a callback.
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => {
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

      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/data/pdf-media-extractor/pdf.worker.mjs';

        const arrayBuffer = await pdfFile.blob.arrayBuffer();
        const pdf: PDFDocumentProxy = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        setProgress({ current: 0, total: numPages });

        const extractedImages: ExtractedImage[] = [];

        for (let i = 1; i <= numPages; i++) {
          const page: PDFPageProxy = await pdf.getPage(i);
          
          // --- THE FINAL PRODUCTION-SAFE LOGIC ---
          // Revert from the untyped page.getImages() to the fundamental getOperatorList().
          // This is transparent to the build-time minifier and won't be optimized away.
          const operatorList = await page.getOperatorList();
          
          const imageOps = operatorList.fnArray.reduce((acc, op, index) => {
            if (op === pdfjsLib.OPS.paintImageXObject) {
              acc.push(operatorList.argsArray[index][0]);
            }
            return acc;
          }, [] as string[]);

          for (const imgName of imageOps) {
            try {
              // Await page.objs.get() inside a try...catch. This handles the "not resolved yet"
              // race condition error gracefully by skipping the problematic image.
              const img = await page.objs.get(imgName);

              if (!img) {
                console.warn(`Could not retrieve image object: ${imgName}`);
                continue;
              }

              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) continue;

              if (img.bitmap) {
                ctx.drawImage(img.bitmap, 0, 0);
              } else if (img.data) {
                const imageData = ctx.createImageData(img.width, img.height);
                if (img.kind === pdfjsLib.ImageKind.RGB_24BPP) {
                  const data = new Uint8ClampedArray(img.width * img.height * 4);
                  for (let j = 0, k = 0; j < img.data.length; j += 3, k += 4) {
                    data[k] = img.data[j]; data[k + 1] = img.data[j + 1]; data[k + 2] = img.data[j + 2]; data[k + 3] = 255;
                  }
                  imageData.data.set(data);
                } else {
                  imageData.data.set(img.data);
                }
                ctx.putImageData(imageData, 0, 0);
              } else {
                continue;
              }

              const blob = await canvasToBlob(canvas);
              if (blob) {
                extractedImages.push({ blob, name: `page${i}-${imgName}.png` });
              }
            } catch (e) {
              // Catch errors for individual images and log them, without crashing the whole process.
              console.warn(`Error processing image ${imgName} on page ${i}:`, e);
            }
          }
          setProgress({ current: i, total: numPages });
        }

        if (extractedImages.length === 0) {
          setError('No compatible images found in this PDF.');
          setIsLoading(false);
          return [];
        }

        const addedFileIds: string[] = [];
        for (const image of extractedImages) {
          const fileId = await addFile(image.blob, image.name, image.blob.type, true);
          addedFileIds.push(fileId);
        }

        setIsLoading(false);
        return addedFileIds;
      } catch (err) {
        console.error('Error extracting media from PDF:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred during PDF processing.');
        setIsLoading(false);
        return [];
      }
    },
    [addFile]
  );

  return { isLoading, error, progress, extractMedia };
}