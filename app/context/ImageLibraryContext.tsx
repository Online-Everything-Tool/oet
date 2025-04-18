// FILE: app/context/ImageLibraryContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
// Import the db instance NO LONGER db, but the getDbInstance function
import { getDbInstance, type OetDatabase } from '../lib/db'; // Uses the updated db instance
import type { StoredFile } from '@/src/types/storage'; // Uses the updated type
import { v4 as uuidv4 } from 'uuid';

// Context value interface remains conceptually the same
interface ImageLibraryContextValue {
  listImages: (limit?: number) => Promise<StoredFile[]>;
  getImage: (id: string) => Promise<StoredFile | undefined>;
  addImage: (blob: Blob, name: string, type: string) => Promise<string>; // Type is crucial here
  deleteImage: (id: string) => Promise<void>;
  clearAllImages: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const ImageLibraryContext = createContext<ImageLibraryContextValue | undefined>(undefined);

export const useImageLibrary = () => {
  const context = useContext(ImageLibraryContext);
  if (!context) throw new Error('useImageLibrary must be used within an ImageLibraryProvider');
  return context;
};

interface ImageLibraryProviderProps { children: ReactNode; }

export const ImageLibraryProvider = ({ children }: ImageLibraryProviderProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestPromisesRef = useRef<Map<string, { resolve: (value: unknown) => void, reject: (reason?: unknown) => void }>>(new Map());

  // --- Worker Setup & Thumbnail Generation (Unchanged from previous correct version) ---
  const handleWorkerMessage = useCallback((msgEvent: MessageEvent) => {
    const { id, type, payload, error: workerError } = msgEvent.data;
    const promiseFuncs = requestPromisesRef.current.get(id);
    if (promiseFuncs) {
      if (type === 'thumbnailSuccess' && !workerError) {
        promiseFuncs.resolve(payload);
      } else if (type === 'thumbnailError' || workerError) {
        promiseFuncs.reject(new Error(workerError || 'Thumbnail generation failed in worker'));
      } else {
        promiseFuncs.reject(new Error(`Unexpected worker message type: ${type}`));
      }
      requestPromisesRef.current.delete(id);
    } else {
      console.warn(`[ImageCtx] Received worker message for unknown request ID: ${id}`);
    }
  }, []);

  const handleWorkerError = useCallback((err: ErrorEvent) => {
    console.error('[ImageCtx] Worker Error:', err);
    setError(`Worker error: ${err.message}. Thumbnails may not generate.`);
    requestPromisesRef.current.forEach((promiseFuncs, id) => {
      promiseFuncs.reject(new Error(`Worker encountered an unrecoverable error: ${err.message}`));
      requestPromisesRef.current.delete(id);
    });
  }, [setError]);

  useEffect(() => {
    let workerInstance: Worker | null = null;
    if (typeof window !== 'undefined' && !workerRef.current) {
      try {
        workerInstance = new Worker(new URL('../lib/workers/thumbnail.worker.ts', import.meta.url));
        workerRef.current = workerInstance;
        workerInstance.addEventListener('message', handleWorkerMessage);
        workerInstance.addEventListener('error', handleWorkerError);
        console.log('[ImageCtx] Thumbnail worker initialized.');
      } catch (initError: unknown) {
        console.error('[ImageCtx] Failed to initialize worker:', initError);
        setError(`Failed to load thumbnail generator: ${initError instanceof Error ? initError.message : 'Unknown worker error'}. Thumbnails unavailable.`);
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
        console.log('[ImageCtx] Thumbnail worker terminated.');
      }
      currentPromises.forEach((promiseFuncs, id) => {
        promiseFuncs.reject(new Error("ImageLibraryProvider unmounted"));
        currentPromises.delete(id);
      });
    };
  }, [handleWorkerMessage, handleWorkerError, setError]);

  const generateThumbnail = useCallback((id: string, blob: Blob): Promise<Blob | null> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        if (error?.includes('Worker error') || error?.includes('thumbnail generator')) {
          console.warn("[ImageCtx] Thumbnail generation skipped because worker failed to initialize or encountered an error.");
          resolve(null);
        } else {
          reject(new Error("Thumbnail worker not available."));
        }
        return;
      }
      const requestId = `thumb-${id}-${Date.now()}`;
      requestPromisesRef.current.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
      workerRef.current.postMessage({ id: requestId, blob });
    });
  }, [error]);
  // --- End Worker Logic ---

  // --- Modified DB Operations ---

  // listImages: Filters by type instead of category
  const listImages = useCallback(async (limit: number = 50): Promise<StoredFile[]> => {
    // Get DB instance client-side
     let db: OetDatabase | null = null;
     try {
         db = getDbInstance();
     } catch (e) {
         console.error("[ImageCtx] listImages: Failed to get DB instance client-side:", e);
         setError(`Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`);
         setLoading(false); // Ensure loading state is false
         return []; // Return empty array on failure
     }

    setLoading(true); setError(null);
    try {
      if (!db?.files) throw new Error("DB 'files' table not available.");
      // Query the 'files' table, filtering by type prefix and non-temporary
      // NOTE: Dexie's startsWith is case-sensitive. MIME types are generally lowercase.
      return await db.files
        .where('type').startsWith('image/') // Filter based on MIME type prefix
        .and(file => file.isTemporary !== true) // Exclude temporary files
        .reverse() // Shows newest first based on primary key (createdAt index)
        .limit(limit)
        .toArray();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error("Error listing images from 'files' table:", err);
      setError(`Failed to list images: ${message}`);
      return [];
    } finally { setLoading(false); }
  }, []); // Stable dependencies

  // getImage: Checks type after fetching
  const getImage = useCallback(async (id: string): Promise<StoredFile | undefined> => {
      // Get DB instance client-side
       let db: OetDatabase | null = null;
       try {
           db = getDbInstance();
       } catch (e) {
           console.error("[ImageCtx] getImage: Failed to get DB instance client-side:", e);
           setError(`Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`);
           return undefined; // Return undefined on failure
       }

      setError(null);
      try {
          if (!db?.files) throw new Error("DB 'files' table not available.");
          const file = await db.files.get(id);
          // Ensure the retrieved file is actually an image based on type
          if (file && !file.type?.startsWith('image/')) {
              console.warn(`[ImageCtx] getImage requested file ${id}, but its type is not image/* (${file.type}).`);
              return undefined; // Return undefined if it's not an image
          }
          return file;
      } catch (err: unknown) {
          const m = err instanceof Error ? err.message : 'Unknown DB error';
          console.error(`Error getting file ${id}:`, err);
          setError(`Failed to get file: ${m}`);
          return undefined;
      }
  }, []); // Stable dependencies

  // addImage: No category field set
  const addImage = useCallback(async (blob: Blob, name: string, type: string): Promise<string> => {
    // Input validation now relies solely on the type parameter
    if (!type?.startsWith('image/')) {
        const e = `[ImageCtx] addImage called with non-image type: ${type}`;
        console.error(e); setError(e); throw new Error(e);
    }
    setLoading(true); setError(null);
    const id = uuidv4();
    let thumbnailBlob: Blob | null = null;
    try {
      // Attempt thumbnail generation first
      try {
          thumbnailBlob = await generateThumbnail(id, blob);
      } catch (thumbError: unknown) {
          console.error(`[ImageCtx] Thumbnail generation failed for ${id}:`, thumbError);
          thumbnailBlob = null;
      }

      // Get DB instance client-side
       let db: OetDatabase | null = null;
       try {
           db = getDbInstance();
       } catch (e) {
           console.error("[ImageCtx] addImage: Failed to get DB instance client-side:", e);
           setError(`Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`);
           throw e; // Re-throw the error
       }

      if (!db?.files) throw new Error("DB 'files' table not available.");

      const newImageFile: StoredFile = {
        id: id,
        name: name,
        type: type, // Use the provided MIME type
        size: blob.size,
        blob: blob,
        thumbnailBlob: thumbnailBlob ?? undefined,
        createdAt: new Date(),
        isTemporary: false // Assume images added via ImageLibrary are permanent
        // No category field to set
      };
      await db.files.add(newImageFile);
      console.log(`[ImageCtx] Added image ${id} (type: ${type}) to 'files' table.`);
      return id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error("Error adding image:", err);
      // If error occurred *after* getting DB instance, don't overwrite potential DB unavailable error
      if (!error?.startsWith('Database unavailable')) {
          setError(`Failed to add image: ${message}`);
      }
      throw err;
    } finally { setLoading(false); }
  }, [generateThumbnail, setError, error]); // Added setError dependency

  // deleteImage: Needs to ensure it only deletes images (optional check)
  const deleteImage = useCallback(async (id: string): Promise<void> => {
    setLoading(true); setError(null);
    // Get DB instance client-side
     let db: OetDatabase | null = null;
     try {
         db = getDbInstance();
     } catch (e) {
         console.error("[ImageCtx] deleteImage: Failed to get DB instance client-side:", e);
         setError(`Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`);
         throw e; // Re-throw
     }

    try {
        if (!db?.files) throw new Error("DB 'files' table not available.");
        // Optional: Verify it's an image before deleting
        const file = await db.files.get(id);
        if (file && !file.type?.startsWith('image/')) {
          throw new Error(`Attempted to delete non-image file (type: ${file.type}) with ID ${id} via ImageLibraryContext.`);
        }
        // Proceed with deletion if it is an image or if the file doesn't exist (delete is idempotent)
        await db.files.delete(id);
        console.log(`[ImageCtx] Deleted file ${id}`);
    } catch (err: unknown) {
        const m = err instanceof Error ? err.message : 'Unknown DB error';
        console.error(`Error deleting file ${id}:`, err);
        // If error occurred *after* getting DB instance, don't overwrite potential DB unavailable error
        if (!error?.startsWith('Database unavailable')) {
             setError(`Failed to delete file: ${m}`);
        }
        throw err;
    } finally { setLoading(false); }
  }, [setError, error]); // Added setError, error dependency

  // clearAllImages: Filters by type prefix
  const clearAllImages = useCallback(async (): Promise<void> => {
    setLoading(true); setError(null);
    // Get DB instance client-side
     let db: OetDatabase | null = null;
     try {
         db = getDbInstance();
     } catch (e) {
         console.error("[ImageCtx] clearAllImages: Failed to get DB instance client-side:", e);
         setError(`Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`);
         throw e; // Re-throw
     }

    try {
      if (!db?.files) throw new Error("DB 'files' table not available.");
      // Get keys of non-temporary image files using type prefix
      const keysToDelete = await db.files
        .where('type').startsWith('image/')
        .and(file => file.isTemporary !== true)
        .primaryKeys();

      if (keysToDelete.length > 0) {
        await db.files.bulkDelete(keysToDelete);
        console.log(`[ImageCtx] Cleared ${keysToDelete.length} permanent image files.`);
      } else {
        console.log(`[ImageCtx] No permanent image files found to clear.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error("Error clearing image files:", err);
       // If error occurred *after* getting DB instance, don't overwrite potential DB unavailable error
       if (!error?.startsWith('Database unavailable')) {
            setError(`Failed to clear image files: ${message}`);
       }
      throw err;
    } finally { setLoading(false); }
  }, [setError, error]); // Added setError, error dependency

  // --- Context Value ---
  const contextValue = useMemo(() => ({
    listImages, getImage, addImage, deleteImage, clearAllImages, loading, error,
  }), [listImages, getImage, addImage, deleteImage, clearAllImages, loading, error]);

  return ( <ImageLibraryContext.Provider value={contextValue}> {children} </ImageLibraryContext.Provider> );
};