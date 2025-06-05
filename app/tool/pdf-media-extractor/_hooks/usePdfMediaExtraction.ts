'use client';

import { useState, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is set only once.
let workerSrcSet = false;

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
    if (!workerSrcSet) {
      try {
        // Try to use the versioned path if available, otherwise fallback.
        // The path needs to be relative to the public directory.
        const workerPath = `/libs/pdfjs-dist/build/pdf.worker.mjs`;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
        workerSrcSet = true;
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

      if (!workerSrcSet) {
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
                // page.objs.get is deprecated, use page.objs.resolve instead
                const imgData = await new Promise<pdfjsLib.OPS.paintImageXObject>((resolve, reject) => {
                  page.objs.resolve(imgRef, (data: pdfjsLib.OPS.paintImageXObject | null) => {
                    if (data) resolve(data);
                    else reject(new Error(`Image data for ref ${imgRef} not found.`));
                  });
                });

                if (!imgData) continue;

                let dataArray: Uint8Array | null = null;
                let contentType = 'application/octet-stream';
                let extension = 'bin';

                if (imgData.data instanceof Uint8Array) {
                  dataArray = imgData.data;
                  // ... (rest of the image processing logic)
                }

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
