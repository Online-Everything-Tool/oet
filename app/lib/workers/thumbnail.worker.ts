// FILE: app/lib/workers/thumbnail.worker.ts

// Ensure this worker has access to necessary browser APIs like OffscreenCanvas, createImageBitmap
// This might require specific configuration or environment setup depending on the bundler/framework.

const MAX_THUMBNAIL_SIZE = 150; // Max width or height in pixels

/**
 * Creates a thumbnail blob from an image blob using OffscreenCanvas.
 * @param imageBlob The original image blob.
 * @returns A Promise resolving to the thumbnail Blob or null if generation fails.
 */
async function createThumbnailBlob(imageBlob: Blob): Promise<Blob | null> {
  try {
    // Check if OffscreenCanvas is supported
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
      console.warn('[ThumbnailWorker] OffscreenCanvas or createImageBitmap not supported.');
      return null; // Fallback: cannot generate thumbnail
    }

    const imageBitmap = await createImageBitmap(imageBlob);
    const { width, height } = imageBitmap;

    let targetWidth = width;
    let targetHeight = height;

    // Calculate new dimensions while maintaining aspect ratio
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

     // Ensure dimensions are at least 1px
     targetWidth = Math.max(1, targetWidth);
     targetHeight = Math.max(1, targetHeight);

    // Create an OffscreenCanvas
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('[ThumbnailWorker] Could not get OffscreenCanvas 2D context.');
      return null;
    }

    // Draw the image scaled down
    ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

    // Convert canvas to blob (WebP is generally good for thumbnails, fallback to PNG)
    const thumbnailBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });

    // Close the bitmap to free memory
    imageBitmap.close();

    return thumbnailBlob;

  } catch (error) {
    console.error('[ThumbnailWorker] Error creating thumbnail:', error);
    return null; // Return null on error
  }
}

// Worker message handler
self.onmessage = async (event) => {
  const { id, blob } = event.data;

  if (!id || !(blob instanceof Blob)) {
    self.postMessage({ id, type: 'thumbnailError', error: 'Invalid message data received by worker.' });
    return;
  }

  try {
    const thumbnailBlob = await createThumbnailBlob(blob);
    if (thumbnailBlob) {
       // Successfully created thumbnail
      self.postMessage({ id, type: 'thumbnailSuccess', payload: thumbnailBlob });
    } else {
       // Failed to create thumbnail (e.g., unsupported format, internal error)
       throw new Error('Thumbnail generation function returned null.');
    }
  } catch (error: unknown) { // Use unknown
    const message = error instanceof Error ? error.message : 'Unknown worker error';
    console.error(`[ThumbnailWorker] Error processing id ${id}:`, error);
    self.postMessage({ id, type: 'thumbnailError', error: `Thumbnail generation failed: ${message}` });
  }
};

// Optional: Add an error handler for the worker itself
self.onerror = (event) => {
  console.error('[ThumbnailWorker] Uncaught worker error:', event);
  // You might want to notify the main thread if a critical worker error occurs
  // self.postMessage({ type: 'workerError', error: event.message });
};

console.log('[ThumbnailWorker] Worker initialized.'); // Log worker start

// Removed unused closeError function