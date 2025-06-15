import { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';

// Set worker source to a local copy for performance and offline capability.
// This requires the worker file to be copied to the public directory.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.mjs';

export interface ExtractedImage {
  blob: Blob;
  name: string;
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
        const arrayBuffer = await pdfFile.blob.arrayBuffer();
        const pdf: PDFDocumentProxy = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        setProgress({ current: 0, total: numPages });

        const allImagePromises: Promise<ExtractedImage | null>[] = [];

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
            const imagePromise = new Promise<ExtractedImage | null>((resolve) => {
              // Using page.objs.get is the recommended way to get object data.
              page.objs.get(imgName, (img) => {
                if (!img || !img.data) {
                  resolve(null);
                  return;
                }
                
                let blob: Blob;
                let fileExtension: string;

                if (img.kind === pdfjsLib.ImageKind.JPEG) {
                  blob = new Blob([img.data], { type: 'image/jpeg' });
                  fileExtension = 'jpg';
                } else {
                  // For other formats, create a PNG from raw pixel data
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) {
                    resolve(null);
                    return;
                  }
                  const imageData = ctx.createImageData(img.width, img.height);
                  // RGBA data, PDF might provide RGB, so we need to handle that.
                  if (img.data.length === img.width * img.height * 3) { // RGB
                    const rgba = new Uint8ClampedArray(img.width * img.height * 4);
                    for (let j = 0, k = 0; j < img.data.length; j += 3, k += 4) {
                      rgba[k] = img.data[j];
                      rgba[k + 1] = img.data[j + 1];
                      rgba[k + 2] = img.data[j + 2];
                      rgba[k + 3] = 255; // Alpha
                    }
                    imageData.data.set(rgba);
                  } else { // Assuming RGBA or other direct copy
                    imageData.data.set(img.data);
                  }
                  ctx.putImageData(imageData, 0, 0);
                  blob = new Blob([canvas.toDataURL('image/png')], { type: 'image/png' });
                  fileExtension = 'png';
                }

                resolve({
                  blob,
                  name: `page${i}-${imgName}.${fileExtension}`,
                });
              }).catch(() => resolve(null));
            });
            allImagePromises.push(imagePromise);
          }
          setProgress({ current: i, total: numPages });
        }

        const extractedImages = (await Promise.all(allImagePromises)).filter(
          (img): img is ExtractedImage => img !== null
        );

        if (extractedImages.length === 0) {
          setError('No images found in this PDF.');
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