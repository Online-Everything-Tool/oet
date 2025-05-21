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

const POLAROID_IMAGE_WIDTH = 150;
const POLAROID_IMAGE_HEIGHT = 150;
const POLAROID_BORDER_PADDING = 10;
const POLAROID_BOTTOM_PADDING = 30;
const TOTAL_POLAROID_WIDTH = POLAROID_IMAGE_WIDTH + POLAROID_BORDER_PADDING * 2;
const TOTAL_POLAROID_HEIGHT =
  POLAROID_IMAGE_HEIGHT + POLAROID_BORDER_PADDING + POLAROID_BOTTOM_PADDING;
const NATURAL_MAX_DIMENSION = 170;
const MAX_OVERLAP_PERCENT = 80;
const FINAL_OUTPUT_PADDING = 40;
const CANVAS_LEFT_PADDING = 30;
const CANVAS_VERTICAL_PADDING_FACTOR = 0.15;
const SHADOW_EFFECTIVE_EXTENSION = 20;

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

interface LayoutData {
  centerPositions: Map<string, number>;
  finalCanvasWidth: number;
  finalCanvasHeight: number;
}

const calculateLayout = (
  images: MontageImage[],
  effectType: MontageEffect
): LayoutData | null => {
  if (images.length === 0) return null;

  let currentLayoutX = 0;
  let totalContentWidth = 0;
  let maxItemRotatedHeightForLayout = 0;
  const localCenterPositions = new Map<string, number>();

  images.forEach((imgData, index) => {
    let itemRenderWidthForBounds = 0;
    let itemRenderHeightForBounds = 0;
    let itemActualDrawWidth = 0;

    if (effectType === 'polaroid') {
      itemActualDrawWidth = TOTAL_POLAROID_WIDTH;
      itemRenderWidthForBounds =
        TOTAL_POLAROID_WIDTH + SHADOW_EFFECTIVE_EXTENSION;
      itemRenderHeightForBounds =
        TOTAL_POLAROID_HEIGHT + SHADOW_EFFECTIVE_EXTENSION;
    } else {
      const fit = calculateAspectRatioFit(
        imgData.originalWidth,
        imgData.originalHeight,
        NATURAL_MAX_DIMENSION,
        NATURAL_MAX_DIMENSION
      );
      itemActualDrawWidth = fit.width;
      itemRenderWidthForBounds = fit.width;
      itemRenderHeightForBounds = fit.height;
    }

    const tiltRad = imgData.tilt * (Math.PI / 180);
    const absCos = Math.abs(Math.cos(tiltRad));
    const absSin = Math.abs(Math.sin(tiltRad));
    const rotatedItemHeight =
      itemRenderWidthForBounds * absSin + itemRenderHeightForBounds * absCos;
    maxItemRotatedHeightForLayout = Math.max(
      maxItemRotatedHeightForLayout,
      rotatedItemHeight
    );

    let currentImageCenterX;
    if (index === 0) {
      currentLayoutX = 0;
      currentImageCenterX = itemActualDrawWidth / 2;
      totalContentWidth = itemActualDrawWidth;
    } else {
      const prevImgData = images[index - 1];
      let prevItemActualDrawWidth = 0;
      if (effectType === 'polaroid')
        prevItemActualDrawWidth = TOTAL_POLAROID_WIDTH;
      else {
        const prevFit = calculateAspectRatioFit(
          prevImgData.originalWidth,
          prevImgData.originalHeight,
          NATURAL_MAX_DIMENSION,
          NATURAL_MAX_DIMENSION
        );
        prevItemActualDrawWidth = prevFit.width;
      }
      const overlapPixels =
        prevItemActualDrawWidth *
        (Math.max(0, Math.min(MAX_OVERLAP_PERCENT, imgData.overlapPercent)) /
          100);
      currentLayoutX = currentLayoutX + prevItemActualDrawWidth - overlapPixels;
      currentImageCenterX = currentLayoutX + itemActualDrawWidth / 2;
      totalContentWidth = currentLayoutX + itemActualDrawWidth;
    }
    localCenterPositions.set(imgData.imageId, currentImageCenterX);
  });

  let maxSideExpansionDueToTilt = 0;
  if (images.length > 0) {
    images.forEach((imgData) => {
      let itemRenderWidthForBounds = 0;
      let itemRenderHeightForBounds = 0;
      let itemActualDrawWidth = 0;
      if (effectType === 'polaroid') {
        itemActualDrawWidth = TOTAL_POLAROID_WIDTH;
        itemRenderWidthForBounds =
          TOTAL_POLAROID_WIDTH + SHADOW_EFFECTIVE_EXTENSION;
        itemRenderHeightForBounds =
          TOTAL_POLAROID_HEIGHT + SHADOW_EFFECTIVE_EXTENSION;
      } else {
        const fit = calculateAspectRatioFit(
          imgData.originalWidth,
          imgData.originalHeight,
          NATURAL_MAX_DIMENSION,
          NATURAL_MAX_DIMENSION
        );
        itemActualDrawWidth = fit.width;
        itemRenderWidthForBounds = fit.width;
        itemRenderHeightForBounds = fit.height;
      }
      const tiltRad = imgData.tilt * (Math.PI / 180);
      const absCos = Math.abs(Math.cos(tiltRad));
      const absSin = Math.abs(Math.sin(tiltRad));
      const rotatedWidthWithShadow =
        itemRenderWidthForBounds * absCos + itemRenderHeightForBounds * absSin;
      maxSideExpansionDueToTilt = Math.max(
        maxSideExpansionDueToTilt,
        (rotatedWidthWithShadow - itemActualDrawWidth) / 2
      );
    });
  }

  const canvasSidePadding =
    CANVAS_LEFT_PADDING + Math.ceil(maxSideExpansionDueToTilt);
  const canvasVerticalPadding = Math.max(
    20,
    Math.ceil(maxItemRotatedHeightForLayout * CANVAS_VERTICAL_PADDING_FACTOR)
  );

  const finalCanvasWidth = Math.ceil(totalContentWidth + canvasSidePadding * 2);
  const finalCanvasHeight = Math.ceil(
    maxItemRotatedHeightForLayout + canvasVerticalPadding * 2
  );

  const finalCenterPositions = new Map<string, number>();
  localCenterPositions.forEach((val, key) => {
    finalCenterPositions.set(key, val + canvasSidePadding);
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

  const drawLogic = useCallback(
    (ctx: CanvasRenderingContext2D, forBlobGeneration: boolean) => {
      const computedStyle = getComputedStyle(document.documentElement);
      const subtleBgColor =
        computedStyle.getPropertyValue('--color-bg-subtle').trim() ||
        '244 244 245';
      const componentBgColor =
        computedStyle.getPropertyValue('--color-bg-component').trim() ||
        '255 255 255';

      if (montageImages.length === 0) {
        if (!forBlobGeneration && canvasRef.current) {
          canvasRef.current.width = 300;
          canvasRef.current.height = 200;
          ctx.fillStyle = `rgb(${subtleBgColor})`;
          ctx.fillRect(0, 0, 300, 200);
        }
        return null;
      }

      const layout = calculateLayout(montageImages, effect);
      if (!layout) {
        if (!forBlobGeneration && canvasRef.current)
          ctx.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
        return null;
      }

      const { centerPositions, finalCanvasWidth, finalCanvasHeight } = layout;

      if (!forBlobGeneration && canvasRef.current) {
        canvasRef.current.width = finalCanvasWidth;
        canvasRef.current.height = finalCanvasHeight;
      }

      ctx.fillStyle = `rgb(${subtleBgColor})`;
      ctx.fillRect(0, 0, finalCanvasWidth, finalCanvasHeight);

      const imagesToDraw = [...montageImages].sort(
        (a, b) => a.zIndex - b.zIndex
      );

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
            `[MontageCanvas DrawLogic] CenterX not found for ${imageId}`
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
                  `[MontageCanvas DrawLogic Polaroid] drawImage Error ${imageId}:`,
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
          if (hasValidImageElement && widthToUse > 0 && heightToUse > 0) {
            if (currentItemDrawWidth > 0 && currentItemDrawHeight > 0) {
              try {
                ctx.drawImage(
                  image,
                  0,
                  0,
                  widthToUse,
                  heightToUse,
                  drawOffsetX,
                  drawOffsetY,
                  currentItemDrawWidth,
                  currentItemDrawHeight
                );
              } catch (e) {
                console.error(
                  `[MontageCanvas DrawLogic Natural] drawImage Error ${imageId}:`,
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
      return layout;
    },
    [montageImages, effect]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[MontageCanvas DrawEffect] Failed to get 2D context');
      return;
    }
    drawLogic(ctx, false);
  }, [drawLogic]);

  const generateMontageBlob = useCallback(async (): Promise<Blob | null> => {
    if (montageImages.length === 0) return null;

    const tempRenderCanvas = document.createElement('canvas');
    const tempRenderCtx = tempRenderCanvas.getContext('2d');
    if (!tempRenderCtx) return null;

    const layoutForBlob = drawLogic(tempRenderCtx, true);

    if (!layoutForBlob) {
      console.error(
        '[MontageCanvas generateBlob] drawLogic failed to produce layout for blob.'
      );
      return null;
    }

    const { centerPositions, finalCanvasWidth, finalCanvasHeight } =
      layoutForBlob;
    tempRenderCanvas.width = finalCanvasWidth;
    tempRenderCanvas.height = finalCanvasHeight;
    drawLogic(tempRenderCtx, true);

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const imagesToDraw = [...montageImages].sort((a, b) => a.zIndex - b.zIndex);
    imagesToDraw.forEach((imgData) => {
      const { imageId, tilt } = imgData;
      const finalCenterX = centerPositions.get(imageId);
      const finalCenterY = finalCanvasHeight / 2;
      if (finalCenterX === undefined) return;

      let itemWidthForBounds = 0,
        itemHeightForBounds = 0;
      if (effect === 'polaroid') {
        itemWidthForBounds = TOTAL_POLAROID_WIDTH + SHADOW_EFFECTIVE_EXTENSION;
        itemHeightForBounds =
          TOTAL_POLAROID_HEIGHT + SHADOW_EFFECTIVE_EXTENSION;
      } else {
        const fit = calculateAspectRatioFit(
          imgData.originalWidth,
          imgData.originalHeight,
          NATURAL_MAX_DIMENSION,
          NATURAL_MAX_DIMENSION
        );
        itemWidthForBounds = fit.width;
        itemHeightForBounds = fit.height;
      }

      const tiltRad = tilt * (Math.PI / 180);
      const cos = Math.cos(tiltRad);
      const sin = Math.sin(tiltRad);
      const corners = [
        { x: -itemWidthForBounds / 2, y: -itemHeightForBounds / 2 },
        { x: itemWidthForBounds / 2, y: -itemHeightForBounds / 2 },
        { x: itemWidthForBounds / 2, y: itemHeightForBounds / 2 },
        { x: -itemWidthForBounds / 2, y: itemHeightForBounds / 2 },
      ];
      corners.forEach((corner) => {
        const rotatedX = corner.x * cos - corner.y * sin;
        const rotatedY = corner.x * sin + corner.y * cos;
        const canvasX = finalCenterX + rotatedX;
        const canvasY = finalCenterY + rotatedY;
        minX = Math.min(minX, canvasX);
        maxX = Math.max(maxX, canvasX);
        minY = Math.min(minY, canvasY);
        maxY = Math.max(maxY, canvasY);
      });
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    if (contentWidth <= 0 || contentHeight <= 0 || minX === Infinity) {
      return new Promise<Blob | null>((resolve) =>
        tempRenderCanvas.toBlob(resolve, 'image/png', 0.95)
      );
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

      const computedStyle = getComputedStyle(document.documentElement);
      const subtleBgColor =
        computedStyle.getPropertyValue('--color-bg-subtle').trim() ||
        '244 244 245';
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
      return new Promise<Blob | null>((resolve) =>
        tempCropCanvas.toBlob(resolve, 'image/png', 0.95)
      );
    } catch (_err) {
      return new Promise<Blob | null>((resolve) =>
        tempRenderCanvas.toBlob(resolve, 'image/png', 0.95)
      );
    }
  }, [montageImages, effect, drawLogic]);

  return { canvasRef, generateMontageBlob };
}
