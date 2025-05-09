// --- FILE: app/tool/image-montage/_hooks/useMontageCanvas.ts ---
import { useRef, useEffect, useCallback } from 'react';
import type { MontageEffect } from './useMontageState'; // Import the effect type

// Assume MontageImage is defined in useMontageState and imported or defined here identically
interface MontageImage {
  id: number; // Temporary unique ID for React keys during rendering cycle
  imageId: string; // Persistent ID from FileLibrary
  image: HTMLImageElement; // The actual loaded element
  alt: string;
  tilt: number;
  overlapPercent: number;
  zIndex: number;
  originalWidth: number;
  originalHeight: number;
}

type RenderedBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

// --- Constants ---
const POLAROID_IMAGE_WIDTH = 150;
const POLAROID_IMAGE_HEIGHT = 150;
const POLAROID_BORDER_PADDING = 10;
const POLAROID_BOTTOM_PADDING = 30;
const TOTAL_POLAROID_WIDTH = POLAROID_IMAGE_WIDTH + POLAROID_BORDER_PADDING * 2;
const TOTAL_POLAROID_HEIGHT =
  POLAROID_IMAGE_HEIGHT + POLAROID_BORDER_PADDING + POLAROID_BOTTOM_PADDING;
const NATURAL_MAX_DIMENSION = 170;
const MAX_OVERLAP_PERCENT = 80;
const FINAL_OUTPUT_PADDING = 10;

// --- Helper Functions ---

// Calculates the maximum possible canvas dimensions needed based on potential rotation
const calculateMaxBoundsNeeded = (
  width: number,
  height: number
): { maxW: number; maxH: number } => {
  const diagonal = Math.sqrt(width * width + height * height);
  return { maxW: diagonal, maxH: diagonal };
};

// Calculates the dimensions for drawing an image while preserving aspect ratio
const calculateAspectRatioFit = (
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number; xOffset: number; yOffset: number } => {
  if (!srcWidth || !srcHeight)
    return { width: 0, height: 0, xOffset: 0, yOffset: 0 };
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  const scaledWidth = Math.round(srcWidth * ratio);
  const scaledHeight = Math.round(srcHeight * ratio);
  const xOffset = Math.round((maxWidth - scaledWidth) / 2);
  const yOffset = Math.round((maxHeight - scaledHeight) / 2);
  return {
    width: Math.max(1, scaledWidth),
    height: Math.max(1, scaledHeight),
    xOffset,
    yOffset,
  };
};

// --- Main Hook ---

interface UseMontageCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  generateMontageBlob: () => Promise<Blob | null>;
}

export function useMontageCanvas(
  montageImages: MontageImage[], // Expects array in LAYOUT order from useMontageState
  effect: MontageEffect
): UseMontageCanvasReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Main drawing effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[MontageCanvas] Failed to get 2D context');
      return;
    }

    const computedStyle = getComputedStyle(document.documentElement);
    const subtleBgColor =
      computedStyle.getPropertyValue('--color-bg-subtle').trim() ||
      '244 244 245';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (montageImages.length === 0) {
      canvas.width = 1;
      canvas.height = 1;
      return;
    }

    // --- Calculate required canvas dimensions AND Center Positions based on LAYOUT order ---
    let totalContentWidth = 0;
    let maxItemHeight = 0;
    const centerPositions = new Map<string, number>(); // Map imageId to its final centerX (including padding)
    let currentLayoutX = 0; // Tracks the starting X edge of the current image's content area, relative to start of content block (0)

    montageImages.forEach((imgData, index) => {
      let itemWidth = 0;
      let itemHeight = 0;
      if (effect === 'polaroid') {
        itemWidth = TOTAL_POLAROID_WIDTH;
        itemHeight = TOTAL_POLAROID_HEIGHT;
      } else {
        if (imgData.originalWidth && imgData.originalHeight) {
          const fit = calculateAspectRatioFit(
            imgData.originalWidth,
            imgData.originalHeight,
            NATURAL_MAX_DIMENSION,
            NATURAL_MAX_DIMENSION
          );
          itemWidth = fit.width;
          itemHeight = fit.height;
        } else {
          itemWidth = NATURAL_MAX_DIMENSION;
          itemHeight = NATURAL_MAX_DIMENSION;
        } // Use fallback size
      }
      const { maxH: rotatedHeight } = calculateMaxBoundsNeeded(
        itemWidth,
        itemHeight
      );
      maxItemHeight = Math.max(maxItemHeight, rotatedHeight);

      let currentImageCenterX = 0;
      if (index === 0) {
        currentLayoutX = 0; // First image starts at the beginning
        currentImageCenterX = currentLayoutX + itemWidth / 2;
        totalContentWidth = itemWidth;
      } else {
        const prevImgData = montageImages[index - 1];
        const prevItemWidth =
          effect === 'polaroid'
            ? TOTAL_POLAROID_WIDTH
            : prevImgData.originalWidth && prevImgData.originalHeight
              ? calculateAspectRatioFit(
                  prevImgData.originalWidth,
                  prevImgData.originalHeight,
                  NATURAL_MAX_DIMENSION,
                  NATURAL_MAX_DIMENSION
                ).width
              : NATURAL_MAX_DIMENSION;
        // Overlap percentage of the *current* image determines how much it overlaps the *previous* one
        const overlapPercent = Math.max(
          0,
          Math.min(MAX_OVERLAP_PERCENT, imgData.overlapPercent)
        );
        const overlapPixels = prevItemWidth * (overlapPercent / 100);

        // The start edge of the current image is the start edge of the previous one + previous width - overlap
        currentLayoutX = currentLayoutX + prevItemWidth - overlapPixels;
        currentImageCenterX = currentLayoutX + itemWidth / 2; // Center relative to its start edge
        totalContentWidth = currentLayoutX + itemWidth; // Update total width to the right edge of current image
      }
      centerPositions.set(imgData.imageId, currentImageCenterX); // Store center relative to content block start
    });

    // Determine padding and final canvas size
    const canvasPadding = maxItemHeight * 0.3;
    const canvasWidth = Math.ceil(totalContentWidth + canvasPadding * 2);
    const canvasHeight = Math.ceil(maxItemHeight + canvasPadding * 2);
    canvas.width = Math.max(1, canvasWidth);
    canvas.height = Math.max(1, canvasHeight);

    // Apply final offset to all calculated positions to account for left padding
    centerPositions.forEach((val, key) => {
      centerPositions.set(key, val + canvasPadding);
    });

    // Fill background
    ctx.fillStyle = `rgb(${subtleBgColor})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // --- End Dimension & Position Calculation ---

    // --- Draw Images ---
    // Sort by zIndex for drawing order
    const imagesToDraw = [...montageImages].sort((a, b) => a.zIndex - b.zIndex);
    const componentBgColor =
      computedStyle.getPropertyValue('--color-bg-component').trim() ||
      '255 255 255';

    imagesToDraw.forEach((imgData) => {
      const { image, tilt, imageId, originalWidth, originalHeight } = imgData;
      const hasValidImageElement =
        image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
      const widthToUse = hasValidImageElement
        ? image.naturalWidth
        : originalWidth;
      const heightToUse = hasValidImageElement
        ? image.naturalHeight
        : originalHeight;

      const tiltRad = tilt * (Math.PI / 180);
      const centerX = centerPositions.get(imageId); // Get pre-calculated final centerX
      if (centerX === undefined) {
        console.error(`[Canvas Draw] Position not found for ${imageId}`);
        return;
      }
      const centerY = canvasHeight / 2; // Use final canvasHeight

      // Determine the item's bounding box size for centering the draw operations
      let currentItemWidth = 0;
      let currentItemHeight = 0;
      if (effect === 'polaroid') {
        currentItemWidth = TOTAL_POLAROID_WIDTH;
        currentItemHeight = TOTAL_POLAROID_HEIGHT;
      } else {
        if (widthToUse && heightToUse) {
          const fit = calculateAspectRatioFit(
            widthToUse,
            heightToUse,
            NATURAL_MAX_DIMENSION,
            NATURAL_MAX_DIMENSION
          );
          currentItemWidth = fit.width;
          currentItemHeight = fit.height;
        } else {
          currentItemWidth = NATURAL_MAX_DIMENSION;
          currentItemHeight = NATURAL_MAX_DIMENSION;
        }
      }
      const drawX = -currentItemWidth / 2; // Top-left relative to center for drawing commands
      const drawY = -currentItemHeight / 2;

      ctx.save();
      ctx.translate(centerX, centerY); // Translate to final position
      ctx.rotate(tiltRad);

      if (effect === 'polaroid') {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = `rgb(${componentBgColor})`;
        ctx.fillRect(drawX, drawY, TOTAL_POLAROID_WIDTH, TOTAL_POLAROID_HEIGHT);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        const imgAreaX = drawX + POLAROID_BORDER_PADDING;
        const imgAreaY = drawY + POLAROID_BORDER_PADDING;
        const targetW = POLAROID_IMAGE_WIDTH;
        const targetH = POLAROID_IMAGE_HEIGHT;

        if (hasValidImageElement && widthToUse > 0 && heightToUse > 0) {
          const imgRatio = widthToUse / heightToUse;
          const targetRatio = targetW / targetH;
          let sourceX = 0,
            sourceY = 0,
            sourceWidth = widthToUse,
            sourceHeight = heightToUse;
          if (imgRatio > targetRatio) {
            sourceHeight = heightToUse;
            sourceWidth = heightToUse * targetRatio;
            sourceX = (widthToUse - sourceWidth) / 2;
            sourceY = 0;
          } else {
            sourceWidth = widthToUse;
            sourceHeight = widthToUse / targetRatio;
            sourceX = 0;
            sourceY = (heightToUse - sourceHeight) / 2;
          }
          sourceWidth = Math.max(1, Math.floor(sourceWidth));
          sourceHeight = Math.max(1, Math.floor(sourceHeight));
          sourceX = Math.max(0, Math.floor(sourceX));
          sourceY = Math.max(0, Math.floor(sourceY));
          if (sourceX + sourceWidth > image.naturalWidth) {
            sourceWidth = image.naturalWidth - sourceX;
          }
          if (sourceY + sourceHeight > image.naturalHeight) {
            sourceHeight = image.naturalHeight - sourceY;
          }

          if (sourceWidth <= 0 || sourceHeight <= 0) {
            console.warn(
              `[Canvas Polaroid] Invalid source rect for ${imageId}. Drawing fallback.`
            );
            ctx.fillStyle = '#fcc';
            ctx.fillRect(imgAreaX, imgAreaY, targetW, targetH);
          } else {
            try {
              ctx.drawImage(
                image,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                imgAreaX,
                imgAreaY,
                targetW,
                targetH
              );
            } catch (e) {
              console.error(`[Canvas Polaroid] drawImage Error ${imageId}:`, e);
              ctx.fillStyle = '#fcc';
              ctx.fillRect(imgAreaX, imgAreaY, targetW, targetH);
            }
          }
        } else {
          console.warn(
            `[Canvas Polaroid] Invalid image element or zero dimensions for ${imageId}. Drawing fallback.`
          );
          ctx.fillStyle = '#ccc';
          ctx.fillRect(imgAreaX, imgAreaY, targetW, targetH);
        }
      } else {
        // 'natural' effect
        if (hasValidImageElement && widthToUse > 0 && heightToUse > 0) {
          const fit = calculateAspectRatioFit(
            widthToUse,
            heightToUse,
            NATURAL_MAX_DIMENSION,
            NATURAL_MAX_DIMENSION
          );
          const destX = drawX + fit.xOffset;
          const destY = drawY + fit.yOffset;
          const destW = fit.width;
          const destH = fit.height;
          if (destW <= 0 || destH <= 0) {
            console.warn(
              `[Canvas Natural] Invalid destination rect for ${imageId}. Drawing fallback.`
            );
            ctx.fillStyle = '#fcc';
            ctx.fillRect(drawX, drawY, currentItemWidth, currentItemHeight);
          } else {
            try {
              ctx.drawImage(image, destX, destY, destW, destH);
            } catch (e) {
              console.error(`[Canvas Natural] drawImage Error ${imageId}:`, e);
              ctx.fillStyle = '#fcc';
              ctx.fillRect(drawX, drawY, currentItemWidth, currentItemHeight);
            }
          }
        } else {
          console.warn(
            `[Canvas Natural] Invalid image element or zero dimensions for ${imageId}. Drawing fallback.`
          );
          ctx.fillStyle = '#ccc';
          ctx.fillRect(drawX, drawY, currentItemWidth, currentItemHeight);
        }
      }
      ctx.restore();
    }); // End imagesToDraw.forEach loop
  }, [montageImages, effect]);

  // generateMontageBlob (cropping logic still uses simplified bounds)
  const generateMontageBlob = useCallback(async (): Promise<Blob | null> => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas || montageImages.length === 0) return null;

    // Using simplified bounds (full canvas) until accurate calculation is implemented
    const bounds = {
      minX: 0,
      minY: 0,
      maxX: mainCanvas.width,
      maxY: mainCanvas.height,
      width: mainCanvas.width,
      height: mainCanvas.height,
    };

    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      console.error(
        '[MontageCanvas] Failed to calculate valid bounds for cropping. Returning full canvas.'
      );
      const fullBlob = await new Promise<Blob | null>((resolve) =>
        mainCanvas.toBlob(resolve, 'image/png', 0.95)
      );
      return fullBlob;
    }

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = bounds.width + FINAL_OUTPUT_PADDING * 2;
      tempCanvas.height = bounds.height + FINAL_OUTPUT_PADDING * 2;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Failed to get context for temp canvas.');

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
        FINAL_OUTPUT_PADDING,
        FINAL_OUTPUT_PADDING,
        bounds.width,
        bounds.height
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        tempCanvas.toBlob(resolve, 'image/png', 0.95)
      );
      if (!blob) throw new Error('Failed to create blob from temp canvas.');
      return blob;
    } catch (err) {
      console.error(
        '[MontageCanvas] Error generating cropped montage blob:',
        err
      );
      const fullBlob = await new Promise<Blob | null>((resolve) =>
        mainCanvas.toBlob(resolve, 'image/png', 0.95)
      ); // Fallback
      return fullBlob;
    }
  }, [montageImages, effect]); // Depend on layout-ordered images and effect

  return { canvasRef, generateMontageBlob };
}
