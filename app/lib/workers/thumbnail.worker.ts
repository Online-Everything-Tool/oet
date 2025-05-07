// FILE: app/lib/workers/thumbnail.worker.ts

const MAX_THUMBNAIL_SIZE = 150;

/**
 * Creates a thumbnail blob from an image blob using OffscreenCanvas.
 * @param imageBlob The original image blob.
 * @returns A Promise resolving to the thumbnail Blob or null if generation fails.
 */
async function createThumbnailBlob(imageBlob: Blob): Promise<Blob | null> {
  try {
    if (
      typeof OffscreenCanvas === 'undefined' ||
      typeof createImageBitmap === 'undefined'
    ) {
      console.warn(
        '[ThumbnailWorker] OffscreenCanvas or createImageBitmap not supported.'
      );
      return null;
    }

    const imageBitmap = await createImageBitmap(imageBlob);
    const { width, height } = imageBitmap;

    let targetWidth = width;
    let targetHeight = height;

    if (width > height) {
      if (width > MAX_THUMBNAIL_SIZE) {
        targetHeight = Math.round(height * (MAX_THUMBNAIL_SIZE / width));
        targetWidth = MAX_THUMBNAIL_SIZE;
      }
    } else {
      if (height > MAX_THUMBNAIL_SIZE) {
        targetWidth = Math.round(width * (MAX_THUMBNAIL_SIZE / height));
        targetHeight = MAX_THUMBNAIL_SIZE;
      }
    }

    targetWidth = Math.max(1, targetWidth);
    targetHeight = Math.max(1, targetHeight);

    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error(
        '[ThumbnailWorker] Could not get OffscreenCanvas 2D context.'
      );
      return null;
    }

    ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

    const thumbnailBlob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.8,
    });

    imageBitmap.close();

    return thumbnailBlob;
  } catch (error) {
    console.error('[ThumbnailWorker] Error creating thumbnail:', error);
    return null;
  }
}

self.onmessage = async (event) => {
  const { id, blob } = event.data;

  if (!id || !(blob instanceof Blob)) {
    self.postMessage({
      id,
      type: 'thumbnailError',
      error: 'Invalid message data received by worker.',
    });
    return;
  }

  try {
    const thumbnailBlob = await createThumbnailBlob(blob);
    if (thumbnailBlob) {
      self.postMessage({
        id,
        type: 'thumbnailSuccess',
        payload: thumbnailBlob,
      });
    } else {
      throw new Error('Thumbnail generation function returned null.');
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown worker error';
    console.error(`[ThumbnailWorker] Error processing id ${id}:`, error);
    self.postMessage({
      id,
      type: 'thumbnailError',
      error: `Thumbnail generation failed: ${message}`,
    });
  }
};

self.onerror = (event) => {
  console.error('[ThumbnailWorker] Uncaught worker error:', event);
};

console.log('[ThumbnailWorker] Worker initialized.');
