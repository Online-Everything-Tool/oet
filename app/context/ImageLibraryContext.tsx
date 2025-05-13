// --- FILE: app/context/ImageLibraryContext.tsx ---
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { useFileLibrary } from './FileLibraryContext';
import { getDbInstance } from '../lib/db';
import type { StoredFile } from '@/src/types/storage';

interface ImageLibraryFunctions {
  listImages: (limit?: number) => Promise<StoredFile[]>;
  getImage: (id: string) => Promise<StoredFile | undefined>;
  addImage: (
    blob: Blob,
    name: string,
    type: string,
    isTemporary?: boolean
  ) => Promise<string>;
  deleteImage: (id: string) => Promise<void>;
  clearAllImages: () => Promise<void>;
  makeImagePermanent: (id: string) => Promise<void>;
  updateBlob: (
    id: string,
    generateThumb: boolean,
    newBlob: Blob
  ) => Promise<void>;
}

interface ImageLibraryContextValue extends ImageLibraryFunctions {
  loading: boolean;
  error: string | null;
}

const ImageLibraryContext = createContext<ImageLibraryContextValue | undefined>(
  undefined
);

export const useImageLibrary = () => {
  const context = useContext(ImageLibraryContext);
  if (!context)
    throw new Error(
      'useImageLibrary must be used within an ImageLibraryProvider'
    );
  return context;
};

interface ImageLibraryProviderProps {
  children: ReactNode;
}

export const ImageLibraryProvider = ({
  children,
}: ImageLibraryProviderProps) => {
  const fileLibrary = useFileLibrary(); // This is the dependency

  const { loading, error } = fileLibrary;

  const workerRef = useRef<Worker | null>(null);
  const requestPromisesRef = useRef<
    Map<
      string,
      { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }
    >
  >(new Map());

  const handleWorkerMessage = useCallback((msgEvent: MessageEvent) => {
    const { id, type, payload, error: workerError } = msgEvent.data;
    const promiseFuncs = requestPromisesRef.current.get(id);
    if (promiseFuncs) {
      if (type === 'thumbnailSuccess' && !workerError)
        promiseFuncs.resolve(payload);
      else
        promiseFuncs.reject(
          new Error(workerError || 'Thumbnail generation failed')
        );
      requestPromisesRef.current.delete(id);
    }
  }, []);

  const handleWorkerError = useCallback((err: ErrorEvent) => {
    console.error('[ImageCtx Worker] Error:', err);
    requestPromisesRef.current.forEach((p, id) => {
      p.reject(new Error(`Worker error: ${err.message}`));
      requestPromisesRef.current.delete(id);
    });
  }, []);

  useEffect(() => {
    let workerInstance: Worker | null = null;
    if (typeof window !== 'undefined' && !workerRef.current) {
      try {
        workerInstance = new Worker(
          new URL('../lib/workers/thumbnail.worker.ts', import.meta.url)
        );
        workerRef.current = workerInstance;
        workerInstance.addEventListener('message', handleWorkerMessage);
        workerInstance.addEventListener('error', handleWorkerError);
        console.log('[ImageCtx Worker] Initialized thumbnail.worker.ts');
      } catch (initError: unknown) {
        console.error(
          '[ImageCtx Worker] Failed to initialize worker:',
          initError
        );
        workerRef.current = null;
      }
    }
    const currentPromises = requestPromisesRef.current;
    return () => {
      if (workerRef.current) {
        console.log('[ImageCtx Worker] Terminating thumbnail.worker.ts');
        workerRef.current.removeEventListener('message', handleWorkerMessage);
        workerRef.current.removeEventListener('error', handleWorkerError);
        workerRef.current.terminate();
        workerRef.current = null;
      }
      currentPromises.forEach((p, id) => {
        p.reject(
          new Error(
            'ImageLibraryProvider unmounted, outstanding thumbnail request cancelled.'
          )
        );
        currentPromises.delete(id);
      });
    };
  }, [handleWorkerMessage, handleWorkerError]);

  const generateThumbnail = useCallback(
    (id: string, blob: Blob): Promise<Blob | null> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          console.warn(
            '[ImageCtx Worker] Thumbnail worker not available for generateThumbnail.'
          );
          resolve(null);
          return;
        }
        const requestId = `thumb-${id}-${Date.now()}`;
        requestPromisesRef.current.set(requestId, {
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        workerRef.current.postMessage({ id: requestId, blob });
      });
    },
    []
  );

  const listImages = useCallback(
    async (limit: number = 50): Promise<StoredFile[]> => {
      const allFiles = await fileLibrary.listFiles(limit * 2, false);
      return allFiles
        .filter((file) => file.type?.startsWith('image/'))
        .slice(0, limit);
    },
    [fileLibrary] // Added fileLibrary
  );

  const getImage = useCallback(
    async (id: string): Promise<StoredFile | undefined> => {
      const file = await fileLibrary.getFile(id);
      if (file && file.type?.startsWith('image/')) return file;
      if (file && !file.type?.startsWith('image/')) {
        console.warn(
          `[ImageCtx] getImage(${id}) found a non-image file. Returning undefined.`
        );
      }
      return undefined;
    },
    [fileLibrary] // Added fileLibrary
  );

  const updateBlob = useCallback(
    async (
      id: string,
      generateThumb: boolean,
      newBlob: Blob
    ): Promise<void> => {
      const file = await fileLibrary.getFile(id);
      if (!file || !file.type?.startsWith('image/')) {
        throw new Error(
          `[ImageCtx updateBlob] File ID ${id} is not an image or does not exist.`
        );
      }
      await fileLibrary.updateFileBlob(id, newBlob);
      console.log(
        `[ImageCtx updateBlob] Main blob updated for ${id}. Regenerate thumbnail: ${generateThumb}`
      );

      if (generateThumb) {
        let newThumbnailBlob: Blob | null = null;
        try {
          newThumbnailBlob = await generateThumbnail(id, newBlob);
        } catch (thumbError) {
          console.warn(
            `[ImageCtx updateBlob] Thumbnail regeneration failed for updated image ${id}:`,
            thumbError
          );
        }

        if (newThumbnailBlob) {
          try {
            const db = getDbInstance();
            await db.files.update(id, {
              thumbnailBlob: newThumbnailBlob,
              lastModified: new Date(),
            });
            console.log(
              `[ImageCtx updateBlob] Thumbnail successfully regenerated and updated for ${id}.`
            );
          } catch (updateError) {
            console.error(
              `[ImageCtx updateBlob] Failed to update file ${id} with new thumbnail blob:`,
              updateError
            );
          }
        } else {
          // console.log(`[ImageCtx updateBlob] No new thumbnail generated for ${id} (or regeneration failed).`)
        }
      }
    },
    [fileLibrary, generateThumbnail] // Added fileLibrary
  );

  const addImage = useCallback(
    async (
      blob: Blob,
      name: string,
      type: string,
      isTemporary: boolean = false
    ): Promise<string> => {
      if (!type?.startsWith('image/')) {
        throw new Error(`addImage called with non-image type: ${type}`);
      }
      const id = await fileLibrary.addFile(blob, name, type, isTemporary);

      let thumbnailBlob: Blob | null = null;
      try {
        thumbnailBlob = await generateThumbnail(id, blob);
      } catch (thumbError: unknown) {
        console.warn(
          `[ImageCtx] Thumbnail generation failed for new image ${id}:`,
          thumbError
        );
      }

      if (thumbnailBlob) {
        try {
          const db = getDbInstance();
          await db.files.update(id, {
            thumbnailBlob: thumbnailBlob,
            lastModified: new Date(),
          });
        } catch (updateError) {
          console.error(
            `[ImageCtx] Failed to update file ${id} with thumbnail blob:`,
            updateError
          );
        }
      }
      return id;
    },
    [fileLibrary, generateThumbnail] // Added fileLibrary
  );

  const deleteImage = useCallback(
    async (id: string): Promise<void> => {
      await fileLibrary.deleteFile(id);
    },
    [fileLibrary] // Added fileLibrary
  );

  const clearAllImages = useCallback(async (): Promise<void> => {
    // Re-fetch listImages inside or pass listImages as dependency
    const currentListImages = fileLibrary.listFiles; // Get a stable reference if listImages itself is memoized
    const images = await currentListImages(100000, false) // Use the stable reference
      .then((files) => files.filter((file) => file.type?.startsWith('image/')));

    const imageIds = images.map((img) => img.id);
    if (imageIds.length > 0) {
      for (const id of imageIds) {
        try {
          await fileLibrary.deleteFile(id);
        } catch (delErr) {
          console.error(
            `[ImageCtx] Failed to delete image ${id} during clearAllImages:`,
            delErr
          );
        }
      }
    }
  }, [fileLibrary]); // Added fileLibrary (covers listFiles and deleteFile)

  const makeImagePermanent = useCallback(
    async (id: string): Promise<void> => {
      const file = await fileLibrary.getFile(id);
      if (!file || !file.type?.startsWith('image/')) {
        throw new Error(
          `File ID ${id} is not an image or does not exist for makeImagePermanent.`
        );
      }
      await fileLibrary.makeFilePermanent(id);
    },
    [fileLibrary] // Added fileLibrary
  );

  const imageFunctions = useMemo(
    () => ({
      listImages,
      getImage,
      addImage,
      deleteImage,
      clearAllImages,
      makeImagePermanent,
      updateBlob,
    }),
    [
      // Add all functions that now depend on fileLibrary (or their stable components)
      listImages,
      getImage,
      addImage,
      deleteImage,
      clearAllImages,
      makeImagePermanent,
      updateBlob,
    ]
  );

  const contextValue = useMemo(
    () => ({
      ...imageFunctions,
      loading,
      error,
    }),
    [imageFunctions, loading, error]
  );

  return (
    <ImageLibraryContext.Provider value={contextValue}>
      {children}
    </ImageLibraryContext.Provider>
  );
};
