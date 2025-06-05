'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is set only once.
const workerSrcSet = { current: false };

interface ExtractedAsset {
  data: Uint8Array;
  type: string; // MIME type
  name: string;
}

interface UsePdfMediaExtractionReturn {
  extractMedia: (
    pdfBlob: Blob
  ) => Promise<{ extractedAssets: ExtractedAsset[]; error?: string }>;
  isProcessing: boolean;
}

export function usePdfMediaExtraction(): UsePdfMediaExtractionReturn {
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!workerSrcSet.current) {
      try {
        // Try to use the versioned path if available, otherwise fallback.
        // The path needs to be relative to the public directory.
        const workerPath = `/libs/pdfjs-dist/build/pdf.worker.mjs`;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
        workerSrcSet.current = true;
        console.log(`PDF.js worker set to: ${workerPath}`);
      } catch (e) {
        console.error("Failed to set PDF.js worker source:", e);
        // Potentially set an error state or alert the user if this is critical
      }
    }
  }, []);


  const extractMedia = useCallback(
    async (
      pdfBlob: Blob
    ): Promise<{ extractedAssets: ExtractedAsset[]; error?: string }> => {
      setIsProcessing(true);
      const extractedAssets: ExtractedAsset[] = [];
      let error: string | undefined;

      if (!workerSrcSet.current) {
        return { extractedAssets, error: "PDF.js worker not initialized. Cannot process PDF." };
      }

      try {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer })
          .promise;

        for (let i = 1; i <= pdfDocument.numPages; i++) {
          const page = await pdfDocument.getPage(i);
          const operatorList = await page.getOperatorList();

          for (let j = 0; j < operatorList.fnArray.length; j++) {
            const fn = operatorList.fnArray[j];
            const args = operatorList.argsArray[j];

            if (fn === pdfjsLib.OPS.paintImageXObject) {
              const imgRef = args[0];
              try {
                // page.objs is an async function that takes a callback
                const imgData = await new Promise<any>((resolve, reject) => {
                  page.objs.get(imgRef, (data: any) => {
                    if (data) resolve(data);
                    else reject(new Error(`Image data for ref ${imgRef} not found.`));
                  });
                });

                if (!imgData) continue;
                
                let dataArray: Uint8Array | null = null;
                let contentType = 'application/octet-stream';
                let extension = 'bin';

                if (imgData.data instanceof HTMLImageElement) {
                  const canvas = document.createElement('canvas');
                  canvas.width = imgData.data.naturalWidth;
                  canvas.height = imgData.data.naturalHeight;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) continue;
                  ctx.drawImage(imgData.data, 0, 0);
                  const blob = await new Promise<Blob|null>(resolve => canvas.toBlob(resolve, 'image/png'));
                  if (blob) {
                    dataArray = new Uint8Array(await blob.arrayBuffer());
                    contentType = 'image/png';
                    extension = 'png';
                  }
                } else if (imgData.data instanceof Uint8Array) {
                  dataArray = imgData.data;
                  // Basic sniffing for common types
                  if (dataArray.length > 3 && dataArray[0] === 0xff && dataArray[1] === 0xd8 && dataArray[2] === 0xff) {
                    contentType = 'image/jpeg';
                    extension = 'jpg';
                  } else if (dataArray.length > 7 && dataArray[0] === 0x89 && dataArray[1] === 0x50 && dataArray[2] === 0x4e && dataArray[3] === 0x47 && dataArray[4] === 0x0d && dataArray[5] === 0x0a && dataArray[6] === 0x1a && dataArray[7] === 0x0a) {
                    contentType = 'image/png';
                    extension = 'png';
                  } else if (imgData.kind === 1) { // IMAGE (raw pixels)
                     // This is where it gets complex: raw pixel data needs width, height, colorspace
                     // For simplicity, we'll try to convert to PNG if it's RGBA-like
                    if (imgData.width && imgData.height && (imgData.data.length === imgData.width * imgData.height * 3 || imgData.data.length === imgData.width * imgData.height * 4)) {
                        const canvas = document.createElement('canvas');
                        canvas.width = imgData.width;
                        canvas.height = imgData.height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) continue;
                        const imageData = ctx.createImageData(imgData.width, imgData.height);
                        
                        if (imgData.data.length === imgData.width * imgData.height * 4) { // Assume RGBA
                            imageData.data.set(imgData.data);
                        } else if (imgData.data.length === imgData.width * imgData.height * 3) { // Assume RGB
                            let k = 0;
                            for (let px = 0; px < imgData.data.length; px += 3) {
                                imageData.data[k++] = imgData.data[px];
                                imageData.data[k++] = imgData.data[px+1];
                                imageData.data[k++] = imgData.data[px+2];
                                imageData.data[k++] = 255; // Alpha
                            }
                        }
                        ctx.putImageData(imageData, 0, 0);
                        const blob = await new Promise<Blob|null>(resolve => canvas.toBlob(resolve, 'image/png'));
                        if (blob) {
                            dataArray = new Uint8Array(await blob.arrayBuffer());
                            contentType = 'image/png';
                            extension = 'png';
                        }
                    }
                  }
                }
                // Add other conditions for different imgData types if necessary

                if (dataArray) {
                  extractedAssets.push({
                    data: dataArray,
                    type: contentType,
                    name: `page${i}_img${extractedAssets.length + 1}.${extension}`,
                  });
                }
              } catch (imgError) {
                console.warn(`Skipping image on page ${i} due to error:`, imgError);
              }
            }
          }
        }
      } catch (e) {
        console.error('Error processing PDF:', e);
        error = e instanceof Error ? e.message : 'Unknown error processing PDF';
      }

      setIsProcessing(false);
      return { extractedAssets, error };
    },
    []
  );

  return { extractMedia, isProcessing };
}