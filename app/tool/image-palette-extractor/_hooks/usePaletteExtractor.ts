'use client';

import { useState, useCallback } from 'react';

export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
}

type RGB = [number, number, number];

const componentToHex = (c: number): string => {
  const hex = c.toString(16);
  return hex.length === 1 ? '0' + hex : hex;
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
};

export const usePaletteExtractor = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractPalette = useCallback(
    async (
      imageBlob: Blob,
      options: { colorCount: number; quality: number }
    ): Promise<ColorInfo[] | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageBlob);
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (err) => reject(new Error(`Image load error: ${err}`));
          img.src = objectUrl;
        });
        URL.revokeObjectURL(objectUrl);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Could not get canvas context');

        // Quality setting determines the size of the canvas for processing
        const MAX_DIMENSION = 100 + options.quality * 15; // e.g., quality 10 -> 250px
        const aspectRatio = img.width / img.height;
        if (aspectRatio > 1) {
          canvas.width = MAX_DIMENSION;
          canvas.height = MAX_DIMENSION / aspectRatio;
        } else {
          canvas.height = MAX_DIMENSION;
          canvas.width = MAX_DIMENSION * aspectRatio;
        }
        canvas.width = Math.max(1, Math.round(canvas.width));
        canvas.height = Math.max(1, Math.round(canvas.height));

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels: RGB[] = [];
        for (let i = 0; i < imageData.data.length; i += 4) {
          // Skip transparent pixels
          if (imageData.data[i + 3] > 128) {
            pixels.push([
              imageData.data[i],
              imageData.data[i + 1],
              imageData.data[i + 2],
            ]);
          }
        }

        if (pixels.length === 0) {
          throw new Error('No opaque pixels found in the image.');
        }

        // Median Cut Algorithm
        const colorBuckets = [pixels];
        while (colorBuckets.length < options.colorCount) {
          const bucketToSplit = colorBuckets.shift();
          if (!bucketToSplit || bucketToSplit.length === 0) continue;

          // Find the dimension with the greatest range
          let minR = 255, maxR = 0;
          let minG = 255, maxG = 0;
          let minB = 255, maxB = 0;
          for (const pixel of bucketToSplit) {
            minR = Math.min(minR, pixel[0]);
            maxR = Math.max(maxR, pixel[0]);
            minG = Math.min(minG, pixel[1]);
            maxG = Math.max(maxG, pixel[1]);
            minB = Math.min(minB, pixel[2]);
            maxB = Math.max(maxB, pixel[2]);
          }
          const rangeR = maxR - minR;
          const rangeG = maxG - minG;
          const rangeB = maxB - minB;
          const sortIndex = rangeR >= rangeG && rangeR >= rangeB ? 0 : rangeG >= rangeB ? 1 : 2;

          bucketToSplit.sort((a, b) => a[sortIndex] - b[sortIndex]);
          const mid = Math.floor(bucketToSplit.length / 2);
          colorBuckets.push(bucketToSplit.slice(0, mid));
          colorBuckets.push(bucketToSplit.slice(mid));
        }

        const palette: ColorInfo[] = colorBuckets
          .filter(bucket => bucket.length > 0)
          .map((bucket) => {
            const total = bucket.reduce(
              (acc, pixel) => {
                acc[0] += pixel[0];
                acc[1] += pixel[1];
                acc[2] += pixel[2];
                return acc;
              },
              [0, 0, 0]
            );
            const avgR = Math.round(total[0] / bucket.length);
            const avgG = Math.round(total[1] / bucket.length);
            const avgB = Math.round(total[2] / bucket.length);
            return {
              rgb: { r: avgR, g: avgG, b: avgB },
              hex: rgbToHex(avgR, avgG, avgB),
            };
          });

        setIsLoading(false);
        return palette;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'An unknown error occurred.';
        setError(msg);
        setIsLoading(false);
        return null;
      }
    },
    []
  );

  return { isLoading, error, extractPalette };
};