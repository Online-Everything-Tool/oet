// FILE: app/context/ImageLibraryContext.tsx
'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { getDbInstance, type OetDatabase } from '../lib/db';
import type { StoredFile } from '@/src/types/storage';
import { v4 as uuidv4 } from 'uuid';

interface ImageLibraryContextValue {
  listImages: (limit?: number) => Promise<StoredFile[]>;
  getImage: (id: string) => Promise<StoredFile | undefined>;
  addImage: (blob: Blob, name: string, type: string) => Promise<string>;
  deleteImage: (id: string) => Promise<void>;
  clearAllImages: () => Promise<void>;
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
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
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
      if (type === 'thumbnailSuccess' && !workerError) {
        promiseFuncs.resolve(payload);
      } else if (type === 'thumbnailError' || workerError) {
        promiseFuncs.reject(
          new Error(workerError || 'Thumbnail generation failed in worker')
        );
      } else {
        promiseFuncs.reject(
          new Error(`Unexpected worker message type: ${type}`)
        );
      }
      requestPromisesRef.current.delete(id);
    } else {
      console.warn(
        `[ImageCtx] Received worker message for unknown request ID: ${id}`
      );
    }
  }, []);

  const handleWorkerError = useCallback(
    (err: ErrorEvent) => {
      console.error('[ImageCtx] Worker Error:', err);
      setError(`Worker error: ${err.message}. Thumbnails may not generate.`);
      requestPromisesRef.current.forEach((promiseFuncs, id) => {
        promiseFuncs.reject(
          new Error(`Worker encountered an unrecoverable error: ${err.message}`)
        );
        requestPromisesRef.current.delete(id);
      });
    },
    [setError] // setError is stable
  );

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
        setError(
          `Failed to load thumbnail generator: ${initError instanceof Error ? initError.message : 'Unknown worker error'}. Thumbnails unavailable.`
        );
        workerRef.current = null;
      }
    }
    const currentPromises = requestPromisesRef.current; // Capture ref value

    return () => {
      if (workerRef.current) {
        workerRef.current.removeEventListener('message', handleWorkerMessage);
        workerRef.current.removeEventListener('error', handleWorkerError);
        workerRef.current.terminate();
        workerRef.current = null;
      }
      currentPromises.forEach((promiseFuncs, id) => {
        // Use captured ref value
        promiseFuncs.reject(new Error('ImageLibraryProvider unmounted'));
        currentPromises.delete(id);
      });
    };
  }, [handleWorkerMessage, handleWorkerError, setError]); // setError is stable

  const generateThumbnail = useCallback(
    (id: string, blob: Blob): Promise<Blob | null> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          if (
            error?.includes('Worker error') ||
            error?.includes('thumbnail generator')
          ) {
            console.warn(
              '[ImageCtx] Thumbnail generation skipped because worker failed to initialize or encountered an error.'
            );
            resolve(null);
          } else {
            // Only reject if there isn't already a persistent worker error message
            reject(new Error('Thumbnail worker not available.'));
          }
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
    [error] // Depends on error state to decide if it should reject or resolve null
  );

  const listImages = useCallback(
    async (limit: number = 50): Promise<StoredFile[]> => {
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e: unknown) {
        console.error('[ImageCtx] listImages: Failed to get DB instance:', e);
        setError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        setLoading(false);
        return [];
      }
      setLoading(true);
      setError(null);
      try {
        if (!db?.files) throw new Error("DB 'files' table not available.");
        return await db.files
          .where('type')
          .startsWith('image/')
          .and((file) => file.isTemporary !== true)
          .reverse()
          .limit(limit)
          .toArray();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        setError(`Failed to list images: ${message}`);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [] // REMOVE [error] and [loading] dependencies. setLoading/setError are stable.
  );

  const getImage = useCallback(
    async (id: string): Promise<StoredFile | undefined> => {
      setError(null);
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e: unknown) {
        setError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        return undefined;
      }
      try {
        if (!db?.files) throw new Error("DB 'files' table not available.");
        const file = await db.files.get(id);
        if (file && !file.type?.startsWith('image/')) {
          return undefined;
        }
        return file;
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : 'Unknown DB error';
        setError(`Failed to get file: ${m}`);
        return undefined;
      }
    },
    [] // REMOVE [error] dependency
  );

  const addImage = useCallback(
    async (blob: Blob, name: string, type: string): Promise<string> => {
      if (!type?.startsWith('image/')) {
        const eMsg = `[ImageCtx] addImage called with non-image type: ${type}`;
        console.error(eMsg);
        setError(eMsg); // Set error
        throw new Error(eMsg);
      }
      setLoading(true);
      setError(null);
      const id = uuidv4();
      let thumbnailBlob: Blob | null = null;
      try {
        thumbnailBlob = await generateThumbnail(id, blob);
      } catch (thumbError: unknown) {
        console.warn(
          `[ImageCtx] Thumbnail generation failed for ${id}:`,
          thumbError
        );
        thumbnailBlob = null;
      }

      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e: unknown) {
        setLoading(false);
        setError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        throw e;
      }

      try {
        if (!db?.files) throw new Error("DB 'files' table not available.");
        const newImageFile: StoredFile = {
          id: id,
          name: name,
          type: type,
          size: blob.size,
          blob: blob,
          thumbnailBlob: thumbnailBlob ?? undefined,
          createdAt: new Date(),
          isTemporary: false,
        };
        await db.files.add(newImageFile);
        return id;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        setError(`Failed to add image: ${message}`); // Set error
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [generateThumbnail] // REMOVE [error]. generateThumbnail depends on error, that's fine.
  );

  const deleteImage = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true);
      setError(null);
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e: unknown) {
        setLoading(false);
        setError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        throw e;
      }
      try {
        if (!db?.files) throw new Error("DB 'files' table not available.");
        const file = await db.files.get(id); // Optional: Check if it's an image
        if (file && !file.type?.startsWith('image/')) {
          throw new Error(
            `Attempted to delete non-image (type: ${file.type}) via ImageLibrary.`
          );
        }
        await db.files.delete(id);
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : 'Unknown DB error';
        setError(`Failed to delete file: ${m}`);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [] // REMOVE [error] dependency
  );

  const clearAllImages = useCallback(
    async (): Promise<void> => {
      setLoading(true);
      setError(null);
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e: unknown) {
        setLoading(false);
        setError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        throw e;
      }
      try {
        if (!db?.files) throw new Error("DB 'files' table not available.");
        const keysToDelete = await db.files
          .where('type')
          .startsWith('image/')
          .and((file) => file.isTemporary !== true)
          .primaryKeys();
        if (keysToDelete.length > 0) {
          await db.files.bulkDelete(keysToDelete);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        setError(`Failed to clear image files: ${message}`);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [] // REMOVE [error] dependency
  );

  const contextValue = useMemo(
    () => ({
      listImages,
      getImage,
      addImage,
      deleteImage,
      clearAllImages,
      loading,
      error,
    }),
    [
      listImages,
      getImage,
      addImage,
      deleteImage,
      clearAllImages,
      loading,
      error, // `loading` and `error` state values ARE dependencies for the context object itself
    ]
  );

  return (
    <ImageLibraryContext.Provider value={contextValue}>
      {children}
    </ImageLibraryContext.Provider>
  );
};
