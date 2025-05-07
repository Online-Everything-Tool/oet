// --- FILE: app/tool/image-montage/_hooks/useMontageCanvas.ts ---
import { useRef, useEffect, useCallback } from 'react';

interface MontageImage {
  id: number;
  image: HTMLImageElement;
  alt: string;
  tilt: number;
  overlapPercent: number;
}

type RenderedBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

const POLAROID_WIDTH = 150;
const POLAROID_HEIGHT = 150;
const BORDER_PADDING = 10;
const BOTTOM_PADDING = 30;
const TOTAL_POLAROID_WIDTH = POLAROID_WIDTH + BORDER_PADDING * 2;
const TOTAL_POLAROID_HEIGHT = POLAROID_HEIGHT + BORDER_PADDING + BOTTOM_PADDING;
const MAX_OVERLAP_PERCENT = 80;

const calculateMaxBoundsLocal = (
  width: number,
  height: number
): { maxW: number; maxH: number } => {
  const diagonal = Math.sqrt(width * width + height * height);
  return { maxW: diagonal, maxH: diagonal };
};

const calculateRenderedBoundsLocal = (
  images: MontageImage[],
  mainCanvasHeight: number
): RenderedBounds | null => {
  if (images.length === 0) return null;
  const { maxW, maxH } = calculateMaxBoundsLocal(
    TOTAL_POLAROID_WIDTH,
    TOTAL_POLAROID_HEIGHT
  );
  const canvasPaddingValue = maxH * 0.3;
  let totalContentWidth = TOTAL_POLAROID_WIDTH;
  for (let i = 1; i < images.length; i++) {
    const currentOverlapPercent = Math.max(
      0,
      Math.min(MAX_OVERLAP_PERCENT, images[i].overlapPercent)
    );
    const overlapPixels = TOTAL_POLAROID_WIDTH * (currentOverlapPercent / 100);
    totalContentWidth += TOTAL_POLAROID_WIDTH - overlapPixels;
  }
  const finalCanvasWidth = Math.ceil(
    totalContentWidth + canvasPaddingValue * 2
  );
  const horizontalBuffer = (maxW - TOTAL_POLAROID_WIDTH) / 2;
  const verticalBuffer = (maxH - TOTAL_POLAROID_HEIGHT) / 2;
  const minX = Math.max(0, canvasPaddingValue - horizontalBuffer);
  const maxX = Math.min(
    finalCanvasWidth,
    canvasPaddingValue + totalContentWidth + horizontalBuffer
  );
  const centerY = mainCanvasHeight / 2;
  const minY = Math.max(
    0,
    centerY - TOTAL_POLAROID_HEIGHT / 2 - verticalBuffer
  );
  const maxY = Math.min(
    mainCanvasHeight,
    centerY + TOTAL_POLAROID_HEIGHT / 2 + verticalBuffer
  );
  const width = Math.max(1, Math.ceil(maxX - minX));
  const height = Math.max(1, Math.ceil(maxY - minY));
  return {
    minX: Math.floor(minX),
    minY: Math.floor(minY),
    maxX: Math.ceil(maxX),
    maxY: Math.ceil(maxY),
    width,
    height,
  };
};

interface UseMontageCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  generateMontageBlob: () => Promise<Blob | null>;
}

export function useMontageCanvas(
  montageImages: MontageImage[]
): UseMontageCanvasReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context');
      return;
    }

    if (montageImages.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const computedStyle = getComputedStyle(document.documentElement);
    const subtleBgColor =
      computedStyle.getPropertyValue('--color-bg-subtle').trim() ||
      '244 244 245';
    const componentBgColor =
      computedStyle.getPropertyValue('--color-bg-component').trim() ||
      '255 255 255';
    const borderBaseColor =
      computedStyle.getPropertyValue('--color-border-base').trim() ||
      '212 212 216';
    const { maxH } = calculateMaxBoundsLocal(
      TOTAL_POLAROID_WIDTH,
      TOTAL_POLAROID_HEIGHT
    );
    const canvasPadding = maxH * 0.3;
    const canvasHeight = Math.ceil(maxH + canvasPadding * 2);
    let totalContentWidth = TOTAL_POLAROID_WIDTH;
    for (let i = 1; i < montageImages.length; i++) {
      const currentOverlapPercent = Math.max(
        0,
        Math.min(MAX_OVERLAP_PERCENT, montageImages[i].overlapPercent)
      );
      const overlapPixels =
        TOTAL_POLAROID_WIDTH * (currentOverlapPercent / 100);
      totalContentWidth += TOTAL_POLAROID_WIDTH - overlapPixels;
    }
    const canvasWidth = Math.ceil(totalContentWidth + canvasPadding * 2);
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.fillStyle = `rgb(${subtleBgColor})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    let nextImageStartX = canvasPadding;
    montageImages.forEach((imgData, index) => {
      const { image, tilt } = imgData;
      const tiltRad = tilt * (Math.PI / 180);
      const centerX = nextImageStartX + TOTAL_POLAROID_WIDTH / 2;
      const centerY = canvasHeight / 2;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(tiltRad);
      const polaroidX = -TOTAL_POLAROID_WIDTH / 2;
      const polaroidY = -TOTAL_POLAROID_HEIGHT / 2;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = `rgb(${componentBgColor})`;
      ctx.fillRect(
        polaroidX,
        polaroidY,
        TOTAL_POLAROID_WIDTH,
        TOTAL_POLAROID_HEIGHT
      );
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      const imageX = polaroidX + BORDER_PADDING;
      const imageY = polaroidY + BORDER_PADDING;
      ctx.drawImage(image, imageX, imageY, POLAROID_WIDTH, POLAROID_HEIGHT);
      ctx.strokeStyle = `rgba(${borderBaseColor}, 0.3)`;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(
        imageX - 0.5,
        imageY - 0.5,
        POLAROID_WIDTH + 1,
        POLAROID_HEIGHT + 1
      );
      ctx.restore();
      if (index < montageImages.length - 1) {
        const nextOverlapPercent = Math.max(
          0,
          Math.min(MAX_OVERLAP_PERCENT, montageImages[index + 1].overlapPercent)
        );
        const nextOverlapPixels =
          TOTAL_POLAROID_WIDTH * (nextOverlapPercent / 100);
        nextImageStartX += TOTAL_POLAROID_WIDTH - nextOverlapPixels;
      }
    });
  }, [montageImages]);

  const generateMontageBlob = useCallback(async (): Promise<Blob | null> => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas || montageImages.length === 0) {
      console.warn('generateMontageBlob called with no canvas or images.');
      return null;
    }

    try {
      const bounds = calculateRenderedBoundsLocal(
        montageImages,
        mainCanvas.height
      );
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        throw new Error('Failed to calculate image bounds.');
      }

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = bounds.width;
      tempCanvas.height = bounds.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        throw new Error('Failed to get context for temporary canvas.');
      }
      const computedStyle = getComputedStyle(document.documentElement);
      const bgColor =
        computedStyle.getPropertyValue('--color-bg-subtle').trim() ||
        '244 244 245';
      tempCtx.fillStyle = `rgb(${bgColor})`;
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(
        mainCanvas,
        bounds.minX,
        bounds.minY,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        tempCanvas.toBlob(resolve, 'image/png', 0.95)
      );
      if (!blob) {
        throw new Error('Failed to create blob from temporary canvas.');
      }
      return blob;
    } catch (err) {
      console.error('Error generating montage blob:', err);
      return null;
    }
  }, [montageImages]);

  return { canvasRef, generateMontageBlob };
}
