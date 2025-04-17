// FILE: app/context/ImageLibraryContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { db } from '../lib/db';
import type { StoredFile } from '@/src/types/storage';
import { v4 as uuidv4 } from 'uuid';

// Context value interface uses StoredFile
interface ImageLibraryContextValue {
  listImages: (limit?: number) => Promise<StoredFile[]>;
  getImage: (id: string) => Promise<StoredFile | undefined>;
  addImage: (blob: Blob, name: string, type: string) => Promise<string>;
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

  // --- Worker Setup & Communication ---
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
  }, []); // Stable function

  const handleWorkerError = useCallback((err: ErrorEvent) => {
    console.error('[ImageCtx] Worker Error:', err);
    // Set context error state
    setError(`Worker error: ${err.message}. Thumbnails may not generate.`);
    // Reject any pending promises associated with this worker instance
    requestPromisesRef.current.forEach((promiseFuncs, id) => {
      promiseFuncs.reject(new Error(`Worker encountered an unrecoverable error: ${err.message}`));
      requestPromisesRef.current.delete(id);
    });
    // Potentially try to re-initialize or signal a permanent failure state?
    // For now, just setting the error might be sufficient.
  }, [setError]); // Depends on setError

  useEffect(() => {
    let workerInstance: Worker | null = null;
    if (typeof window !== 'undefined' && !workerRef.current) { // Avoid re-initializing if already exists
      try {
        // Ensure the path is correct relative to the worker's context when bundled
        workerInstance = new Worker(new URL('../lib/workers/thumbnail.worker.ts', import.meta.url));
        workerRef.current = workerInstance;
        workerInstance.addEventListener('message', handleWorkerMessage);
        workerInstance.addEventListener('error', handleWorkerError);
        console.log('[ImageCtx] Thumbnail worker initialized.');
      } catch (initError: unknown) {
        console.error('[ImageCtx] Failed to initialize worker:', initError);
        setError(`Failed to load thumbnail generator: ${initError instanceof Error ? initError.message : 'Unknown worker error'}. Thumbnails unavailable.`);
        workerRef.current = null; // Ensure ref is null on failure
      }
    }
    const currentPromises = requestPromisesRef.current; // Capture ref for cleanup

    // Cleanup function
    return () => {
      if (workerRef.current) { // Check ref before accessing
        workerRef.current.removeEventListener('message', handleWorkerMessage);
        workerRef.current.removeEventListener('error', handleWorkerError);
        workerRef.current.terminate();
        workerRef.current = null;
        console.log('[ImageCtx] Thumbnail worker terminated.');
      }
      // Reject any promises still pending on unmount
      currentPromises.forEach((promiseFuncs, id) => {
        promiseFuncs.reject(new Error("ImageLibraryProvider unmounted"));
        currentPromises.delete(id);
      });
    };
  }, [handleWorkerMessage, handleWorkerError, setError]); // Effect dependencies

  const generateThumbnail = useCallback((id: string, blob: Blob): Promise<Blob | null> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        // If there's already a context error related to the worker, resolve null silently
        if (error?.includes('Worker error') || error?.includes('thumbnail generator')) {
          console.warn("[ImageCtx] Thumbnail generation skipped because worker failed to initialize or encountered an error.");
          resolve(null);
        } else {
          // Otherwise, reject as the worker should be available but isn't
          reject(new Error("Thumbnail worker not available."));
        }
        return;
      }
      const requestId = `thumb-${id}-${Date.now()}`;
      requestPromisesRef.current.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
      // Post message to the worker
      workerRef.current.postMessage({ id: requestId, blob });
    });
  }, [error]); // Depends on error state


  // --- Modified DB Operations ---

  const listImages = useCallback(async (limit: number = 50): Promise<StoredFile[]> => {
    setLoading(true); setError(null);
    try {
      if (!db?.files) throw new Error("DB 'files' table not available.");
      // Query the 'files' table, filtering by category and non-temporary
      return await db.files
        .where({ category: 'image' })
        .and(file => file.isTemporary !== true)
        .reverse() // Shows newest first based on primary key or first index if no specific order is set
        // .orderBy('createdAt').reverse() // Alternative: explicitly sort by creation date
        .limit(limit)
        .toArray();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error("Error listing images from 'files' table:", err);
      setError(`Failed to list images: ${message}`);
      return [];
    } finally { setLoading(false); }
  }, []); // Stable dependencies

  // getImage - Checks category after fetching
  const getImage = useCallback(async (id: string): Promise<StoredFile | undefined> => {
      setError(null);
      try {
          if (!db?.files) throw new Error("DB 'files' table not available.");
          const file = await db.files.get(id);
          // Ensure the retrieved file is actually an image
          if (file && file.category !== 'image') {
              console.warn(`[ImageCtx] getImage requested file ${id}, but it is not categorized as an image (${file.category}).`);
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

  // addImage - Generates thumbnail before adding to 'files'
  const addImage = useCallback(async (blob: Blob, name: string, type: string): Promise<string> => {
    if (!type?.startsWith('image/')) { const e = `[ImageCtx] addImage called with non-image type: ${type}`; console.error(e); setError(e); throw new Error(e); }
    setLoading(true); setError(null);
    const id = uuidv4();
    let thumbnailBlob: Blob | null = null;
    try {
      // Attempt thumbnail generation first
      try {
          thumbnailBlob = await generateThumbnail(id, blob);
      } catch (thumbError: unknown) {
          // Log the error but continue without a thumbnail
          console.error(`[ImageCtx] Thumbnail generation failed for ${id}:`, thumbError);
          thumbnailBlob = null;
      }

      if (!db?.files) throw new Error("DB 'files' table not available.");

      const newImageFile: StoredFile = {
        id: id, name: name, type: type, size: blob.size, blob: blob,
        thumbnailBlob: thumbnailBlob ?? undefined, // Use undefined if null
        createdAt: new Date(),
        category: 'image',
        isTemporary: false // Assume images added via this context are permanent
      };
      await db.files.add(newImageFile);
      console.log(`[ImageCtx] Added image ${id} to 'files' table.`);
      return id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error("Error adding image:", err);
      setError(`Failed to add image: ${message}`);
      throw err; // Re-throw
    } finally { setLoading(false); }
  }, [generateThumbnail]); // Depends on generateThumbnail

  // deleteImage - Simple delete by ID
  const deleteImage = useCallback(async (id: string): Promise<void> => {
    setLoading(true); setError(null);
    try {
        if (!db?.files) throw new Error("DB 'files' table not available.");
        // Consider ensuring it's an image before deleting? Or let delete fail if ID not found?
        // const file = await db.files.get(id);
        // if (file && file.category !== 'image') {
        //   throw new Error(`Attempted to delete non-image file ${id} via ImageLibraryContext.`);
        // }
        await db.files.delete(id);
        console.log(`[ImageCtx] Deleted file ${id}`);
    } catch (err: unknown) {
        const m = err instanceof Error ? err.message : 'Unknown DB error';
        console.error(`Error deleting file ${id}:`, err); setError(`Failed to delete file: ${m}`); throw err; // Re-throw
    } finally { setLoading(false); }
  }, []); // Stable dependencies

  // clearAllImages - Deletes only non-temporary images
  const clearAllImages = useCallback(async (): Promise<void> => {
    setLoading(true); setError(null);
    try {
      if (!db?.files) throw new Error("DB 'files' table not available.");
      // Get keys of non-temporary image files
      const keysToDelete = await db.files
        .where({ category: 'image' })
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
      setError(`Failed to clear image files: ${message}`);
      throw err; // Re-throw
    } finally { setLoading(false); }
  }, []); // Stable dependencies

  // --- Context Value ---
  const contextValue = useMemo(() => ({
    listImages, getImage, addImage, deleteImage, clearAllImages, loading, error,
  }), [listImages, getImage, addImage, deleteImage, clearAllImages, loading, error]);

  return ( <ImageLibraryContext.Provider value={contextValue}> {children} </ImageLibraryContext.Provider> );
};