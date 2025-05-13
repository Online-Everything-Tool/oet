// --- FILE: app/tool/image-montage/_hooks/useMontageCanvas.ts ---
import { useRef, useEffect, useCallback } from 'react';
import type { MontageEffect } from './useMontageState';

interface MontageImage {
  id: number;
  imageId: string;
  image: HTMLImageElement;
  alt: string;
  tilt: number;
  overlapPercent: number;
  zIndex: number;
  originalWidth: number;
  originalHeight: number;
}

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
const FINAL_OUTPUT_PADDING = 30;
const CANVAS_LEFT_PADDING = 30;
const CANVAS_VERTICAL_PADDING_FACTOR = 0.15;

// --- Helper Functions ---
const calculateMaxBoundsNeeded = (
  width: number,
  height: number
): { maxW: number; maxH: number } => {
  const diagonal = Math.sqrt(width * width + height * height);
  return { maxW: diagonal, maxH: diagonal };
};

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

// NEW: Shared Layout Calculation Function
interface LayoutData {
  centerPositions: Map<string, number>; // X-coordinate of the center of each image, padded from canvas left
  finalCanvasWidth: number;
  finalCanvasHeight: number;
  // contentTotalWidth: number; // Actual width of the laid-out images before canvas padding (not strictly needed by caller now)
  // contentMaxItemHeight: number; // Max height of a rotated item for vertical sizing (not strictly needed by caller now)
}

// --- In app/tool/image-montage/_hooks/useMontageCanvas.ts ---

// ... (constants and other helpers remain the same)

const calculateLayout = (
  images: MontageImage[],
  effectType: MontageEffect
): LayoutData | null => {
  if (images.length === 0) return null;

  let currentLayoutX = 0;
  let totalContentWidth = 0;
  let maxItemHeightForLayout = 0; // Max height of any single rotated item
  const localCenterPositions = new Map<string, number>();

  // First pass: Calculate initial layout, totalContentWidth, and maxItemHeightForLayout
  images.forEach((imgData, index) => {
    let itemRenderWidth = 0;
    let itemRenderHeight = 0;
    if (effectType === 'polaroid') {
      itemRenderWidth = TOTAL_POLAROID_WIDTH;
      itemRenderHeight = TOTAL_POLAROID_HEIGHT;
    } else {
      const fit = calculateAspectRatioFit(
        imgData.originalWidth,
        imgData.originalHeight,
        NATURAL_MAX_DIMENSION,
        NATURAL_MAX_DIMENSION
      );
      itemRenderWidth = fit.width;
      itemRenderHeight = fit.height;
    }
    const { maxH: rotatedItemHeight } = calculateMaxBoundsNeeded(
      itemRenderWidth,
      itemRenderHeight
    );
    maxItemHeightForLayout = Math.max(
      maxItemHeightForLayout,
      rotatedItemHeight
    );

    let currentImageCenterX;
    if (index === 0) {
      currentLayoutX = 0;
      currentImageCenterX = itemRenderWidth / 2;
      totalContentWidth = itemRenderWidth;
    } else {
      const prevImgData = images[index - 1];
      let prevItemRenderWidth = 0;
      if (effectType === 'polaroid') prevItemRenderWidth = TOTAL_POLAROID_WIDTH;
      else {
        const prevFit = calculateAspectRatioFit(
          prevImgData.originalWidth,
          prevImgData.originalHeight,
          NATURAL_MAX_DIMENSION,
          NATURAL_MAX_DIMENSION
        );
        prevItemRenderWidth = prevFit.width;
      }
      const overlapPixels =
        prevItemRenderWidth *
        (Math.max(0, Math.min(MAX_OVERLAP_PERCENT, imgData.overlapPercent)) /
          100);
      currentLayoutX = currentLayoutX + prevItemRenderWidth - overlapPixels;
      currentImageCenterX = currentLayoutX + itemRenderWidth / 2;
      totalContentWidth = currentLayoutX + itemRenderWidth;
    }
    localCenterPositions.set(imgData.imageId, currentImageCenterX);
  });

  // Calculate necessary padding based on potential tilt of end images
  let extraHorizontalPaddingForTilt = 0;
  let extraVerticalPaddingForTilt =
    maxItemHeightForLayout * CANVAS_VERTICAL_PADDING_FACTOR; // Base vertical padding

  if (images.length > 0) {
    const firstImage = images[0];
    const lastImage = images[images.length - 1];

    [firstImage, lastImage].forEach((imgData) => {
      if (!imgData) return;
      let itemRenderWidth = 0;
      let itemRenderHeight = 0;
      if (effectType === 'polaroid') {
        itemRenderWidth = TOTAL_POLAROID_WIDTH;
        itemRenderHeight = TOTAL_POLAROID_HEIGHT;
      } else {
        const fit = calculateAspectRatioFit(
          imgData.originalWidth,
          imgData.originalHeight,
          NATURAL_MAX_DIMENSION,
          NATURAL_MAX_DIMENSION
        );
        itemRenderWidth = fit.width;
        itemRenderHeight = fit.height;
      }
      const tiltRad = imgData.tilt * (Math.PI / 180);
      const absCos = Math.abs(Math.cos(tiltRad));
      const absSin = Math.abs(Math.sin(tiltRad));
      const rotatedWidth = itemRenderWidth * absCos + itemRenderHeight * absSin;
      // const rotatedHeight = itemRenderWidth * absSin + itemRenderHeight * absCos; // already handled by maxItemHeightForLayout

      extraHorizontalPaddingForTilt = Math.max(
        extraHorizontalPaddingForTilt,
        (rotatedWidth - itemRenderWidth) / 2
      );
    });
  }

  const canvasSidePadding =
    CANVAS_LEFT_PADDING + Math.ceil(extraHorizontalPaddingForTilt);
  const canvasVerticalPadding = Math.max(
    20,
    Math.ceil(extraVerticalPaddingForTilt)
  ); // Ensure a minimum padding

  const finalCanvasWidth = Math.ceil(totalContentWidth + canvasSidePadding * 2);
  const finalCanvasHeight = Math.ceil(
    maxItemHeightForLayout + canvasVerticalPadding * 2
  );

  const finalCenterPositions = new Map<string, number>();
  localCenterPositions.forEach((val, key) => {
    finalCenterPositions.set(key, val + canvasSidePadding); // Apply final padding to X positions
  });

  return {
    centerPositions: finalCenterPositions,
    finalCanvasWidth,
    finalCanvasHeight,
  };
};

interface UseMontageCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  generateMontageBlob: () => Promise<Blob | null>;
}

export function useMontageCanvas(
  montageImages: MontageImage[],
  effect: MontageEffect
): UseMontageCanvasReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[MontageCanvas DrawEffect] Failed to get 2D context');
      return;
    }
    // console.log(`[MontageCanvas DrawEffect] Running. Image count: ${montageImages.length}, Effect: ${effect}`);

    const computedStyle = getComputedStyle(document.documentElement);
    const subtleBgColor =
      computedStyle.getPropertyValue('--color-bg-subtle').trim() ||
      '244 244 245';

    if (montageImages.length === 0) {
      canvas.width = 300;
      canvas.height = 200;
      ctx.fillStyle = `rgb(${subtleBgColor})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // console.log(`[MontageCanvas DrawEffect] No images, canvas cleared.`);
      return;
    }

    const layout = calculateLayout(montageImages, effect);
    if (!layout) {
      console.error('[MontageCanvas DrawEffect] Failed to calculate layout.');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const { centerPositions, finalCanvasWidth, finalCanvasHeight } = layout;

    canvas.width = finalCanvasWidth;
    canvas.height = finalCanvasHeight;
    ctx.fillStyle = `rgb(${subtleBgColor})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // console.log(`[MontageCanvas DrawEffect] Layout calculated & canvas sized. Canvas: ${finalCanvasWidth}x${finalCanvasHeight}.`);

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
      const finalCenterX = centerPositions.get(imageId);

      if (finalCenterX === undefined) {
        console.error(
          `[MontageCanvas DrawEffect] Draw: CenterX not found for ${imageId}`
        );
        return;
      }
      const finalCenterY = finalCanvasHeight / 2;

      let currentItemDrawWidth = 0;
      let currentItemDrawHeight = 0;
      if (effect === 'polaroid') {
        currentItemDrawWidth = TOTAL_POLAROID_WIDTH;
        currentItemDrawHeight = TOTAL_POLAROID_HEIGHT;
      } else {
        const fit = calculateAspectRatioFit(
          widthToUse,
          heightToUse,
          NATURAL_MAX_DIMENSION,
          NATURAL_MAX_DIMENSION
        );
        currentItemDrawWidth = fit.width;
        currentItemDrawHeight = fit.height;
      }
      const drawOffsetX = -currentItemDrawWidth / 2;
      const drawOffsetY = -currentItemDrawHeight / 2;

      ctx.save();
      ctx.translate(finalCenterX, finalCenterY);
      ctx.rotate(tiltRad);

      if (effect === 'polaroid') {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = `rgb(${componentBgColor})`;
        ctx.fillRect(
          drawOffsetX,
          drawOffsetY,
          TOTAL_POLAROID_WIDTH,
          TOTAL_POLAROID_HEIGHT
        );
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        const imgAreaX = drawOffsetX + POLAROID_BORDER_PADDING;
        const imgAreaY = drawOffsetY + POLAROID_BORDER_PADDING;
        const targetW = POLAROID_IMAGE_WIDTH;
        const targetH = POLAROID_IMAGE_HEIGHT;

        if (hasValidImageElement && widthToUse > 0 && heightToUse > 0) {
          const imgRatio = widthToUse / heightToUse;
          const targetRatio = targetW / targetH;
          let sX = 0,
            sY = 0,
            sW = widthToUse,
            sH = heightToUse;
          if (imgRatio > targetRatio) {
            sW = heightToUse * targetRatio;
            sX = (widthToUse - sW) / 2;
          } else {
            sH = widthToUse / targetRatio;
            sY = (heightToUse - sH) / 2;
          }
          sW = Math.max(1, Math.floor(sW));
          sH = Math.max(1, Math.floor(sH));
          sX = Math.max(0, Math.floor(sX));
          sY = Math.max(0, Math.floor(sY));
          if (sX + sW > image.naturalWidth) sW = image.naturalWidth - sX;
          if (sY + sH > image.naturalHeight) sH = image.naturalHeight - sY;

          if (sW > 0 && sH > 0) {
            try {
              ctx.drawImage(
                image,
                sX,
                sY,
                sW,
                sH,
                imgAreaX,
                imgAreaY,
                targetW,
                targetH
              );
            } catch (e) {
              console.error(
                `[MontageCanvas DrawEffect Polaroid] drawImage Error ${imageId}:`,
                e
              );
              ctx.fillStyle = '#fcc';
              ctx.fillRect(imgAreaX, imgAreaY, targetW, targetH);
            }
          } else {
            ctx.fillStyle = '#ccc';
            ctx.fillRect(imgAreaX, imgAreaY, targetW, targetH);
          }
        } else {
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
          const dX = drawOffsetX + fit.xOffset;
          const dY = drawOffsetY + fit.yOffset;
          const dW = fit.width;
          const dH = fit.height;
          if (dW > 0 && dH > 0) {
            try {
              ctx.drawImage(image, dX, dY, dW, dH);
            } catch (e) {
              console.error(
                `[MontageCanvas DrawEffect Natural] drawImage Error ${imageId}:`,
                e
              );
              ctx.fillStyle = '#fcc';
              ctx.fillRect(
                drawOffsetX,
                drawOffsetY,
                currentItemDrawWidth,
                currentItemDrawHeight
              );
            }
          } else {
            ctx.fillStyle = '#ccc';
            ctx.fillRect(
              drawOffsetX,
              drawOffsetY,
              currentItemDrawWidth,
              currentItemDrawHeight
            );
          }
        } else {
          ctx.fillStyle = '#ccc';
          ctx.fillRect(
            drawOffsetX,
            drawOffsetY,
            currentItemDrawWidth,
            currentItemDrawHeight
          );
        }
      }
      ctx.restore();
    });
    // console.log(`[MontageCanvas DrawEffect] Drawing complete for ${imagesToDraw.length} images.`);
  }, [montageImages, effect]);

  const generateMontageBlob = useCallback(async (): Promise<Blob | null> => {
    console.log(
      `[MontageCanvas generateBlob] Called. Image count: ${montageImages.length}`
    );

    if (montageImages.length === 0) {
      console.error('[MontageCanvas generateBlob] Bailing: No images.');
      return null;
    }

    // Calculate layout based on current images and effect FOR THIS BLOB GENERATION
    const currentLayout = calculateLayout(montageImages, effect);
    if (!currentLayout) {
      console.error(
        '[MontageCanvas generateBlob] Failed to calculate layout for blob generation.'
      );
      return null;
    }
    console.log(
      '[MontageCanvas generateBlob] Layout calculated for blob generation:',
      JSON.stringify(currentLayout, (k, v) =>
        v instanceof Map ? Array.from(v.entries()) : v
      )
    );

    const { centerPositions, finalCanvasWidth, finalCanvasHeight } =
      currentLayout;

    const tempRenderCanvas = document.createElement('canvas');
    tempRenderCanvas.width = finalCanvasWidth;
    tempRenderCanvas.height = finalCanvasHeight;
    const tempRenderCtx = tempRenderCanvas.getContext('2d');

    if (!tempRenderCtx) {
      console.error(
        '[MontageCanvas generateBlob] Failed to get context for temporary render canvas.'
      );
      return null;
    }

    const computedStyle = getComputedStyle(document.documentElement);
    const subtleBgColor =
      computedStyle.getPropertyValue('--color-bg-subtle').trim() ||
      '244 244 245';
    tempRenderCtx.fillStyle = `rgb(${subtleBgColor})`;
    tempRenderCtx.fillRect(
      0,
      0,
      tempRenderCanvas.width,
      tempRenderCanvas.height
    );

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
      const finalCenterX = centerPositions.get(imageId);

      if (finalCenterX === undefined) {
        console.warn(
          `[MontageCanvas generateBlob] CenterX for ${imageId} was undefined in layout used for blob.`
        );
        return;
      }
      const finalCenterY = finalCanvasHeight / 2;

      let currentItemDrawWidth = 0;
      let currentItemDrawHeight = 0;
      if (effect === 'polaroid') {
        currentItemDrawWidth = TOTAL_POLAROID_WIDTH;
        currentItemDrawHeight = TOTAL_POLAROID_HEIGHT;
      } else {
        const fit = calculateAspectRatioFit(
          widthToUse,
          heightToUse,
          NATURAL_MAX_DIMENSION,
          NATURAL_MAX_DIMENSION
        );
        currentItemDrawWidth = fit.width;
        currentItemDrawHeight = fit.height;
      }
      const drawOffsetX = -currentItemDrawWidth / 2;
      const drawOffsetY = -currentItemDrawHeight / 2;

      tempRenderCtx.save();
      tempRenderCtx.translate(finalCenterX, finalCenterY);
      tempRenderCtx.rotate(tiltRad);

      if (effect === 'polaroid') {
        tempRenderCtx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        tempRenderCtx.shadowBlur = 10;
        tempRenderCtx.shadowOffsetX = 2;
        tempRenderCtx.shadowOffsetY = 3;
        tempRenderCtx.fillStyle = `rgb(${componentBgColor})`;
        tempRenderCtx.fillRect(
          drawOffsetX,
          drawOffsetY,
          TOTAL_POLAROID_WIDTH,
          TOTAL_POLAROID_HEIGHT
        );
        tempRenderCtx.shadowColor = 'transparent';
        tempRenderCtx.shadowBlur = 0;
        tempRenderCtx.shadowOffsetX = 0;
        tempRenderCtx.shadowOffsetY = 0;

        const imgAreaX = drawOffsetX + POLAROID_BORDER_PADDING;
        const imgAreaY = drawOffsetY + POLAROID_BORDER_PADDING;
        const targetW = POLAROID_IMAGE_WIDTH;
        const targetH = POLAROID_IMAGE_HEIGHT;

        if (hasValidImageElement && widthToUse > 0 && heightToUse > 0) {
          const imgRatio = widthToUse / heightToUse;
          const targetRatio = targetW / targetH;
          let sX = 0,
            sY = 0,
            sW = widthToUse,
            sH = heightToUse;
          if (imgRatio > targetRatio) {
            sW = heightToUse * targetRatio;
            sX = (widthToUse - sW) / 2;
          } else {
            sH = widthToUse / targetRatio;
            sY = (heightToUse - sH) / 2;
          }
          sW = Math.max(1, Math.floor(sW));
          sH = Math.max(1, Math.floor(sH));
          sX = Math.max(0, Math.floor(sX));
          sY = Math.max(0, Math.floor(sY));
          if (sX + sW > image.naturalWidth) sW = image.naturalWidth - sX;
          if (sY + sH > image.naturalHeight) sH = image.naturalHeight - sY;
          if (sW > 0 && sH > 0) {
            try {
              tempRenderCtx.drawImage(
                image,
                sX,
                sY,
                sW,
                sH,
                imgAreaX,
                imgAreaY,
                targetW,
                targetH
              );
            } catch (e) {
              tempRenderCtx.fillStyle = '#fcc';
              tempRenderCtx.fillRect(imgAreaX, imgAreaY, targetW, targetH);
            }
          } else {
            tempRenderCtx.fillStyle = '#ccc';
            tempRenderCtx.fillRect(imgAreaX, imgAreaY, targetW, targetH);
          }
        } else {
          tempRenderCtx.fillStyle = '#ccc';
          tempRenderCtx.fillRect(imgAreaX, imgAreaY, targetW, targetH);
        }
      } else {
        if (hasValidImageElement && widthToUse > 0 && heightToUse > 0) {
          const fit = calculateAspectRatioFit(
            widthToUse,
            heightToUse,
            NATURAL_MAX_DIMENSION,
            NATURAL_MAX_DIMENSION
          );
          const dX = drawOffsetX + fit.xOffset;
          const dY = drawOffsetY + fit.yOffset;
          const dW = fit.width;
          const dH = fit.height;
          if (dW > 0 && dH > 0) {
            try {
              tempRenderCtx.drawImage(image, dX, dY, dW, dH);
            } catch (e) {
              tempRenderCtx.fillStyle = '#fcc';
              tempRenderCtx.fillRect(
                drawOffsetX,
                drawOffsetY,
                currentItemDrawWidth,
                currentItemDrawHeight
              );
            }
          } else {
            tempRenderCtx.fillStyle = '#ccc';
            tempRenderCtx.fillRect(
              drawOffsetX,
              drawOffsetY,
              currentItemDrawWidth,
              currentItemDrawHeight
            );
          }
        } else {
          tempRenderCtx.fillStyle = '#ccc';
          tempRenderCtx.fillRect(
            drawOffsetX,
            drawOffsetY,
            currentItemDrawWidth,
            currentItemDrawHeight
          );
        }
      }
      tempRenderCtx.restore();
    });

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    imagesToDraw.forEach((imgData) => {
      const { imageId, tilt } = imgData;
      const finalCenterX = centerPositions.get(imageId);
      const finalCenterY = finalCanvasHeight / 2;
      if (finalCenterX === undefined) return;

      let itemWidth = 0,
        itemHeight = 0;
      if (effect === 'polaroid') {
        itemWidth = TOTAL_POLAROID_WIDTH;
        itemHeight = TOTAL_POLAROID_HEIGHT;
      } else {
        const fit = calculateAspectRatioFit(
          imgData.originalWidth,
          imgData.originalHeight,
          NATURAL_MAX_DIMENSION,
          NATURAL_MAX_DIMENSION
        );
        itemWidth = fit.width;
        itemHeight = fit.height;
      }
      const tiltRad = tilt * (Math.PI / 180);
      const absCos = Math.abs(Math.cos(tiltRad));
      const absSin = Math.abs(Math.sin(tiltRad));
      const rotatedWidth = itemWidth * absCos + itemHeight * absSin;
      const rotatedHeight = itemWidth * absSin + itemHeight * absCos;

      minX = Math.min(minX, finalCenterX - rotatedWidth / 2);
      maxX = Math.max(maxX, finalCenterX + rotatedWidth / 2);
      minY = Math.min(minY, finalCenterY - rotatedHeight / 2);
      maxY = Math.max(maxY, finalCenterY + rotatedHeight / 2);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    if (contentWidth <= 0 || contentHeight <= 0 || minX === Infinity) {
      console.warn(
        '[MontageCanvas generateBlob] Invalid content bounds for cropping from temp canvas. Using full temp canvas.'
      );
      const fullBlob = await new Promise<Blob | null>((resolve) =>
        tempRenderCanvas.toBlob(resolve, 'image/png', 0.95)
      );
      if (!fullBlob)
        console.error(
          '[MontageCanvas generateBlob] Fallback toBlob (from tempRenderCanvas) failed.'
        );
      return fullBlob;
    }

    try {
      const tempCropCanvas = document.createElement('canvas');
      tempCropCanvas.width = Math.ceil(contentWidth + FINAL_OUTPUT_PADDING * 2);
      tempCropCanvas.height = Math.ceil(
        contentHeight + FINAL_OUTPUT_PADDING * 2
      );
      const tempCropCtx = tempCropCanvas.getContext('2d');
      if (!tempCropCtx)
        throw new Error('Failed to get context for final crop canvas.');

      tempCropCtx.fillStyle = `rgb(${subtleBgColor})`;
      tempCropCtx.fillRect(0, 0, tempCropCanvas.width, tempCropCanvas.height);

      tempCropCtx.drawImage(
        tempRenderCanvas,
        minX,
        minY,
        contentWidth,
        contentHeight,
        FINAL_OUTPUT_PADDING,
        FINAL_OUTPUT_PADDING,
        contentWidth,
        contentHeight
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        tempCropCanvas.toBlob(resolve, 'image/png', 0.95)
      );
      if (!blob) {
        console.error(
          '[MontageCanvas generateBlob] final tempCropCanvas.toBlob() returned null.'
        );
        throw new Error('Failed to create blob from final crop canvas.');
      }
      return blob;
    } catch (err) {
      console.error(
        '[MontageCanvas generateBlob] Error during final cropping and blob generation:',
        err
      );
      const fullBlob = await new Promise<Blob | null>((resolve) =>
        tempRenderCanvas.toBlob(resolve, 'image/png', 0.95)
      );
      if (!fullBlob)
        console.error(
          '[MontageCanvas generateBlob] Fallback (from tempRenderCanvas) toBlob also failed after crop error.'
        );
      return fullBlob;
    }
  }, [montageImages, effect]);

  return { canvasRef, generateMontageBlob };
}
