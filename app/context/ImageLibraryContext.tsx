// FILE: app/context/ImageLibraryContext.tsx
'use client';

// Removed unused top-level imports - db and uuidv4 are used within callbacks via closure
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { db, type LibraryImage } from '../lib/db'; // db is needed here for the functions defined below
import { v4 as uuidv4 } from 'uuid'; // uuidv4 is needed here for addImage

interface ImageLibraryContextValue {
  listImages: (limit?: number) => Promise<LibraryImage[]>;
  getImage: (id: string) => Promise<LibraryImage | undefined>;
  addImage: (blob: Blob, name: string, type: string) => Promise<string>;
  deleteImage: (id: string) => Promise<void>;
  clearAllImages: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const ImageLibraryContext = createContext<ImageLibraryContextValue | undefined>(undefined);

export const useImageLibrary = () => {
  const context = useContext(ImageLibraryContext);
  if (!context) {
    throw new Error('useImageLibrary must be used within an ImageLibraryProvider');
  }
  return context;
};

interface ImageLibraryProviderProps {
  children: ReactNode;
}

export const ImageLibraryProvider = ({ children }: ImageLibraryProviderProps) => {
  // This seems like a false positive from the linter, setLoading IS used. Keeping it.
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestPromisesRef = useRef<Map<string, { resolve: (value: unknown) => void, reject: (reason?: unknown) => void }>>(new Map());

  // Define handlers outside useEffect
  const handleWorkerMessage = useCallback((msgEvent: MessageEvent) => {
    const { id, type, payload, error: workerError } = msgEvent.data;
    const promiseFuncs = requestPromisesRef.current.get(id);

    if (promiseFuncs) {
        if (type === 'thumbnailSuccess' && !workerError) { promiseFuncs.resolve(payload); }
        else if (type === 'thumbnailError' || workerError) { promiseFuncs.reject(new Error(workerError || 'Thumbnail generation failed in worker')); }
        else { promiseFuncs.reject(new Error(`Unexpected worker message type: ${type}`)); }
        requestPromisesRef.current.delete(id);
    } else { console.warn(`[ImageCtx] Received worker message for unknown request ID: ${id}`); }
  }, []);

  const handleWorkerError = useCallback((err: ErrorEvent) => {
    console.error('[ImageCtx] Worker Error:', err);
    setError(`Worker error: ${err.message}. Ensure '/thumbnail.worker.js' exists in the public folder or the build correctly generates it.`);
    requestPromisesRef.current.forEach((promiseFuncs, id) => {
      promiseFuncs.reject(new Error(`Worker encountered an unrecoverable error: ${err.message}`));
      requestPromisesRef.current.delete(id);
    });
  }, [setError]);

  // Initialize Web Worker
  useEffect(() => {
    let workerInstance: Worker | null = null;
    if (typeof window !== 'undefined') {
      try {
          workerInstance = new Worker('/thumbnail.worker.js');
          workerRef.current = workerInstance;
          workerInstance.addEventListener('message', handleWorkerMessage);
          workerInstance.addEventListener('error', handleWorkerError);
          console.log('[ImageCtx] Attempting to initialize worker from /thumbnail.worker.js');
      } catch (initError: unknown) {
            console.error('[ImageCtx] Failed to initialize worker:', initError);
            setError(`Failed to load thumbnail generator: ${initError instanceof Error ? initError.message : 'Unknown worker initialization error'}`);
      }
    }
    const currentPromises = requestPromisesRef.current;
    // Cleanup
    return () => {
      if (workerInstance) {
        workerInstance.removeEventListener('message', handleWorkerMessage);
        workerInstance.removeEventListener('error', handleWorkerError);
        workerInstance.terminate();
        workerRef.current = null;
        console.log('[ImageCtx] Worker terminated.');
      }
      currentPromises.forEach((promiseFuncs, id) => {
          promiseFuncs.reject(new Error("ImageLibraryProvider unmounted"));
          currentPromises.delete(id);
      });
    };
  }, [handleWorkerMessage, handleWorkerError]);


  const generateThumbnail = useCallback((id: string, blob: Blob): Promise<Blob | null> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        if(!error) { reject(new Error("Thumbnail worker is not available.")); }
        else { console.warn("[ImageCtx] Thumbnail generation skipped because worker failed to initialize."); resolve(null); }
        return;
      }
      const requestId = `thumb-${id}-${Date.now()}`;
      requestPromisesRef.current.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
      workerRef.current.postMessage({ id: requestId, blob });
    });
  }, [error]);

  // --- DB Operations ---
  const listImages = useCallback(async (limit: number = 50): Promise<LibraryImage[]> => {
    setLoading(true); setError(null);
    try {
      if (!db) throw new Error("Database instance is not available.");
      return await db.images.orderBy('createdAt').reverse().limit(limit).toArray();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error("Error listing images:", err);
      setError(`Failed to list images: ${message}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]); // Added missing dependencies based on usage

  const getImage = useCallback(async (id: string): Promise<LibraryImage | undefined> => {
    setError(null);
    try {
      if (!db) throw new Error("Database instance is not available.");
      return await db.images.get(id);
    } catch (err: unknown) {
       const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error(`Error getting image ${id}:`, err);
      setError(`Failed to get image: ${message}`);
      return undefined;
    }
  }, [setError]); // Added missing dependency based on usage

  const addImage = useCallback(async (blob: Blob, name: string, type: string): Promise<string> => {
    setLoading(true); setError(null);
    const id = uuidv4(); // uuidv4 is needed here
    let thumbnailBlob: Blob | null = null;
    try {
        try {
             thumbnailBlob = await generateThumbnail(id, blob);
             console.log(`[ImageCtx] Thumbnail generated for ${id}:`, thumbnailBlob ? `${thumbnailBlob.size} bytes` : 'null');
        } catch (thumbError: unknown) {
             console.error(`[ImageCtx] Thumbnail generation failed for ${id}:`, thumbError);
             thumbnailBlob = null;
         }
      if (!db) throw new Error("Database instance is not available.");
      const newImage: LibraryImage = { id: id, name: name, type: type, size: blob.size, blob: blob, thumbnailBlob: thumbnailBlob === null ? undefined : thumbnailBlob, createdAt: new Date(), };
      await db.images.add(newImage);
      return id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error("Error adding image:", err);
      setError(`Failed to add image: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
   // generateThumbnail is stable now, remove from deps unless it changes
  }, [setError, setLoading, generateThumbnail]); // Added missing dependencies

  const deleteImage = useCallback(async (id: string): Promise<void> => {
    setLoading(true); setError(null);
    try {
      if (!db) throw new Error("Database instance is not available.");
      await db.images.delete(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error(`Error deleting image ${id}:`, err);
      setError(`Failed to delete image: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]); // Added missing dependencies

  const clearAllImages = useCallback(async (): Promise<void> => {
    setLoading(true); setError(null);
    try {
       if (!db) throw new Error("Database instance is not available.");
      await db.images.clear();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error("Error clearing all images:", err);
      setError(`Failed to clear all images: ${message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]); // Added missing dependencies

  const contextValue = useMemo(() => ({
    listImages,
    getImage,
    addImage,
    deleteImage,
    clearAllImages,
    loading,
    error,
  }), [listImages, getImage, addImage, deleteImage, clearAllImages, loading, error]);

  return (
    <ImageLibraryContext.Provider value={contextValue}>
      {children}
    </ImageLibraryContext.Provider>
  );
};