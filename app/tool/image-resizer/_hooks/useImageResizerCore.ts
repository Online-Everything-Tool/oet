import { useState, useCallback } from 'react';

export interface ResizeOptions {
  targetWidth: number | null;
  targetHeight: number | null;
  maintainAspectRatio: boolean;
  outputFormat: 'png' | 'jpeg' | 'webp' | 'original';
  jpegQuality: number; // Range 0-1
  originalMimeType: string;
}

export interface ResizeResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  mimeType: string;
}

interface UseImageResizerCoreReturn {
  resizeImage: (imageBlob: Blob, options: ResizeOptions) => Promise<ResizeResult | null>;
  isLoading: boolean;
  error: string | null;
}

const loadImage = (blob: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (errEvent) => {
      URL.revokeObjectURL(url);
      const errorMsg = typeof errEvent === 'string' ? errEvent : (errEvent instanceof ErrorEvent ? errEvent.message : 'Failed to load image');
      reject(new Error(errorMsg));
    };
    img.src = url;
  });
};

export default function useImageResizerCore(): UseImageResizerCoreReturn {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const resizeImage = useCallback(async (imageBlob: Blob, options: ResizeOptions): Promise<ResizeResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const img = await loadImage(imageBlob);
      const originalWidth = img.naturalWidth;
      const originalHeight = img.naturalHeight;

      if (originalWidth === 0 || originalHeight === 0) {
        throw new Error('Image has invalid dimensions (0x0).');
      }

      let finalWidth: number;
      let finalHeight: number;

      const aspectRatio = originalWidth / originalHeight;

      let tWidth = options.targetWidth;
      let tHeight = options.targetHeight;

      if (!tWidth && !tHeight) { // If no dimensions specified, use original
        tWidth = originalWidth;
        tHeight = originalHeight;
      }


      if (options.maintainAspectRatio) {
        if (tWidth && tHeight) {
          const widthRatio = tWidth / originalWidth;
          const heightRatio = tHeight / originalHeight;
          if (widthRatio < heightRatio) {
            finalWidth = tWidth;
            finalHeight = Math.round(tWidth / aspectRatio);
          } else {
            finalHeight = tHeight;
            finalWidth = Math.round(tHeight * aspectRatio);
          }
        } else if (tWidth) {
          finalWidth = tWidth;
          finalHeight = Math.round(tWidth / aspectRatio);
        } else if (tHeight) {
          finalHeight = tHeight;
          finalWidth = Math.round(tHeight * aspectRatio);
        } else { // Should not happen due to check above, but as fallback
          finalWidth = originalWidth;
          finalHeight = originalHeight;
        }
      } else {
        finalWidth = tWidth || originalWidth;
        finalHeight = tHeight || originalHeight;
      }
      
      finalWidth = Math.max(1, Math.round(finalWidth));
      finalHeight = Math.max(1, Math.round(finalHeight));


      const canvas = document.createElement('canvas');
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas 2D context.');
      }

      ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

      let outputMimeTypeForBlob: string;
      let qualityForBlob: number | undefined;

      if (options.outputFormat === 'original') {
        if (['image/png', 'image/jpeg', 'image/webp'].includes(options.originalMimeType)) {
          outputMimeTypeForBlob = options.originalMimeType;
        } else {
          outputMimeTypeForBlob = 'image/png'; // Default for unsupported original types like GIF, BMP
        }
      } else {
        outputMimeTypeForBlob = `image/${options.outputFormat}`;
      }

      if (outputMimeTypeForBlob === 'image/jpeg') {
        qualityForBlob = options.jpegQuality;
      }
      
      // For WebP, quality is also an option but typically 0-1. Let's assume jpegQuality can be reused if needed.
      // For now, only JPEG quality is explicitly handled. WebP will use browser default.

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, outputMimeTypeForBlob, qualityForBlob);
      });

      if (!blob) {
        throw new Error('Failed to convert canvas to Blob.');
      }
      
      const dataUrl = canvas.toDataURL(outputMimeTypeForBlob, qualityForBlob);

      setIsLoading(false);
      return { blob, dataUrl, width: finalWidth, height: finalHeight, mimeType: outputMimeTypeForBlob };

    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'An unknown error occurred during resizing.';
      console.error("Error in resizeImage:", e);
      setError(message);
      setIsLoading(false);
      return null;
    }
  }, []);

  return { resizeImage, isLoading, error };
}