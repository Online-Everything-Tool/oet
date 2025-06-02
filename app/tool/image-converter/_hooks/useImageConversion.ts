'use client';

import { useState, useCallback } from 'react';
import type { StoredFile } from '@/src/types/storage';

export type ValidOutputFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp';

export const FORMAT_TO_MIMETYPE: Record<ValidOutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif', // Canvas typically produces static GIFs
  bmp: 'image/bmp',
};

export interface ConversionResult {
  blob: Blob;
  dataUrl: string;
  mimeType: string;
}

interface UseImageConversionReturn {
  isConverting: boolean;
  performConversion: (
    imageFile: StoredFile,
    format: ValidOutputFormat,
    quality?: number // For JPEG/WEBP, range 0-1
  ) => Promise<ConversionResult | null>;
}

export function useImageConversion(): UseImageConversionReturn {
  const [isConverting, setIsConverting] = useState(false);

  const performConversion = useCallback(
    async (
      imageFile: StoredFile,
      format: ValidOutputFormat,
      quality?: number // Range 0-1
    ): Promise<ConversionResult | null> => {
      if (!imageFile.blob || !imageFile.type?.startsWith('image/')) {
        console.error('Invalid input file for conversion.');
        return null;
      }

      setIsConverting(true);

      try {
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(imageFile.blob);

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve();
          };
          img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(
              new Error(`Failed to load image: ${err instanceof ErrorEvent ? err.message : String(err)}`)
            );
          };
          img.src = objectUrl;
        });

        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          throw new Error('Image has zero dimensions.');
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas context.');
        }

        ctx.drawImage(img, 0, 0);

        const mimeType = FORMAT_TO_MIMETYPE[format];
        let actualQuality: number | undefined = quality;

        if (format === 'jpeg' || format === 'webp') {
          if (typeof quality !== 'number' || quality < 0 || quality > 1) {
            actualQuality = 0.92; // Default quality
          }
        } else {
          actualQuality = undefined; // Quality param not used for PNG, GIF, BMP
        }
        
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, mimeType, actualQuality)
        );

        if (!blob) {
          throw new Error(`Failed to convert to ${format}. Browser may not support this format via canvas.`);
        }
        
        // For BMP, toDataURL might be more reliable if toBlob fails for it in some browsers
        // However, modern browsers generally support image/bmp for toBlob.
        // If specific issues arise, this could be a fallback:
        // const dataUrl = (format === 'bmp' && !blob) ? canvas.toDataURL(mimeType) : URL.createObjectURL(blob);
        // For now, assume toBlob works for listed formats.
        const dataUrl = canvas.toDataURL(mimeType, actualQuality);


        return { blob, dataUrl, mimeType };

      } catch (error) {
        console.error('Image conversion error:', error);
        return null;
      } finally {
        setIsConverting(false);
      }
    },
    []
  );

  return { isConverting, performConversion };
}