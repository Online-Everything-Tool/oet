// FILE: app/context/ImageLibraryContext.tsx
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
import { getDbInstance, type OetDatabase } from '../lib/db';
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
  const fileLibrary = useFileLibrary();

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
    console.error('[ImageCtx] Worker Error:', err);

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
      } catch (initError: unknown) {
        console.error('[ImageCtx] Failed to initialize worker:', initError);
        workerRef.current = null;
      }
    }
    const currentPromises = requestPromisesRef.current;
    return () => {
      if (workerRef.current) {
        workerRef.current.removeEventListener('message', handleWorkerMessage);
        workerRef.current.removeEventListener('error', handleWorkerError);
        workerRef.current.terminate();
        workerRef.current = null;
      }
      currentPromises.forEach((p, id) => {
        p.reject(new Error('Provider unmounted'));
        currentPromises.delete(id);
      });
    };
  }, [handleWorkerMessage, handleWorkerError]);

  const generateThumbnail = useCallback(
    (id: string, blob: Blob): Promise<Blob | null> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          console.warn('[ImageCtx] Thumbnail worker not available.');
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
    [fileLibrary.listFiles]
  );

  const getImage = useCallback(
    async (id: string): Promise<StoredFile | undefined> => {
      const file = await fileLibrary.getFile(id);
      if (file && file.type?.startsWith('image/')) return file;
      return undefined;
    },
    [fileLibrary.getFile]
  );

  const addImage = useCallback(
    async (
      blob: Blob,
      name: string,
      type: string,
      isTemporary: boolean = false
    ): Promise<string> => {
      console.log('addImage:', blob, name, type, isTemporary);
      if (!type?.startsWith('image/'))
        throw new Error(`addImage called with non-image type: ${type}`);

      const id = await fileLibrary.addFile(blob, name, type, isTemporary);

      let thumbnailBlob: Blob | null = null;
      try {
        thumbnailBlob = await generateThumbnail(id, blob);
      } catch (thumbError: unknown) {
        console.warn(`[ImageCtx] Thumbnail gen failed for ${id}:`, thumbError);
      }

      if (thumbnailBlob) {
        try {
          let db: OetDatabase | null = null;
          try {
            db = getDbInstance();
            await db.files.update(id, {
              thumbnailBlob: thumbnailBlob,
              lastModified: new Date(),
            });
          } catch (dbError) {
            console.error('Error updating thumbnail directly:', dbError);
          }
        } catch (updateError) {
          console.error(
            `[ImageCtx] Failed to update file ${id} with thumbnail:`,
            updateError
          );
        }
      }
      return id;
    },
    [fileLibrary.addFile, generateThumbnail]
  );

  const deleteImage = useCallback(
    async (id: string): Promise<void> => {
      await fileLibrary.deleteFile(id);
    },
    [fileLibrary.deleteFile]
  );

  const clearAllImages = useCallback(async (): Promise<void> => {
    const images = await listImages(10000);
    const imageIds = images.map((img) => img.id);
    if (imageIds.length > 0) {
      for (const id of imageIds) {
        try {
          await fileLibrary.deleteFile(id);
        } catch (delErr) {
          console.error(
            `Failed to delete image ${id} during clearAllImages:`,
            delErr
          );
        }
      }
    }
  }, [listImages, fileLibrary.deleteFile]);

  const makeImagePermanent = useCallback(
    async (id: string): Promise<void> => {
      const file = await fileLibrary.getFile(id);
      if (!file || !file.type?.startsWith('image/'))
        throw new Error(`File ID ${id} is not an image.`);
      await fileLibrary.makeFilePermanent(id);
    },
    [fileLibrary.getFile, fileLibrary.makeFilePermanent]
  );

  const imageFunctions = useMemo(
    () => ({
      listImages,
      getImage,
      addImage,
      deleteImage,
      clearAllImages,
      makeImagePermanent,
    }),
    [
      listImages,
      getImage,
      addImage,
      deleteImage,
      clearAllImages,
      makeImagePermanent,
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
