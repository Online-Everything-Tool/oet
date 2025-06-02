import { useState, useCallback } from 'react';
import type { StoredFile } from '@/src/types/storage';

export interface ConvertedImageData {
  blob: Blob;
  dataUrl: string;
  mimeType: string;
}

interface UseClientSideImageConverterReturn {
  isConverting: boolean;
  conversionError: string | null;
  convertedData: ConvertedImageData | null;
  performConversion: (
    inputFile: StoredFile,
    outputMimeType: string, // e.g., 'image/jpeg'
    quality?: number // 0-1 for jpeg/webp
  ) => Promise<ConvertedImageData | null>;
  clearConvertedData: () => void;
}

export default function useClientSideImageConverter(): UseClientSideImageConverterReturn {
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [convertedData, setConvertedData] = useState<ConvertedImageData | null>(null);

  const clearConvertedData = useCallback(() => {
    setConvertedData(null);
    setConversionError(null);
  }, []);

  const performConversion = useCallback(
    async (
      inputFile: StoredFile,
      outputMimeType: string,
      quality?: number // 0-1 for jpeg/webp
    ): Promise<ConvertedImageData | null> => {
      if (!inputFile.blob || !inputFile.type?.startsWith('image/')) {
        setConversionError('Invalid input file. Must be an image.');
        setIsConverting(false);
        return null;
      }

      setIsConverting(true);
      setConversionError(null);
      setConvertedData(null);

      let tempObjectUrl: string | null = null;

      try {
        const img = new window.Image();
        tempObjectUrl = URL.createObjectURL(inputFile.blob);

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (errEvent) => {
            console.error('Image load error:', errEvent);
            reject(new Error('Failed to load image for conversion.'));
          };
          img.src = tempObjectUrl;
        });
        
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          throw new Error('Image has zero dimensions after loading.');
        }

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas 2D context.');
        }

        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

        const qualityForExport = (outputMimeType === 'image/jpeg' || outputMimeType === 'image/webp') ? quality : undefined;

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, outputMimeType, qualityForExport);
        });

        if (!blob) {
          throw new Error(`Failed to convert image to ${outputMimeType}. Browser may not support this format or quality.`);
        }
        
        // For WEBP, toDataURL might not support quality param, but blob does.
        // We'll generate dataURL from the blob to ensure consistency.
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const newConvertedData = { blob, dataUrl, mimeType: outputMimeType };
        setConvertedData(newConvertedData);
        return newConvertedData;

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown conversion error.';
        console.error('Image Conversion Error:', err);
        setConversionError(message);
        setConvertedData(null);
        return null;
      } finally {
        setIsConverting(false);
        if (tempObjectUrl) {
          URL.revokeObjectURL(tempObjectUrl);
        }
      }
    },
    []
  );

  return {
    isConverting,
    conversionError,
    convertedData,
    performConversion,
    clearConvertedData,
  };
}