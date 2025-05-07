// FILE: app/context/ImageLibraryContext.tsx
'use client';

import React, {
  createContext,
  useContext,
  // useState, // No longer needed for loading/error
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { useFileLibrary } from './FileLibraryContext'; // Use the base context
import { getDbInstance, type OetDatabase } from '../lib/db'; // Keep for direct DB update if needed
import type { StoredFile } from '@/src/types/storage';

// Define the functions specific to image library or wrapping base functions
interface ImageLibraryFunctions {
  listImages: (limit?: number) => Promise<StoredFile[]>;
  getImage: (id: string) => Promise<StoredFile | undefined>;
  addImage: (
    blob: Blob,
    name: string,
    type: string,
    isTemporary?: boolean // Add isTemporary flag
  ) => Promise<string>;
  deleteImage: (id: string) => Promise<void>;
  clearAllImages: () => Promise<void>;
  makeImagePermanent: (id: string) => Promise<void>;
}

// Context value now includes base loading/error and image functions
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
  // Use the base context for core operations and state
  const fileLibrary = useFileLibrary();
  // Get loading/error state directly from the base context value
  const { loading, error } = fileLibrary;

  // Thumbnail worker logic remains the same
  const workerRef = useRef<Worker | null>(null);
  const requestPromisesRef = useRef<
    Map<
      string,
      { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }
    >
  >(new Map());
  // Local state for worker errors if needed, or rely on base context error
  // const [workerError, setWorkerError] = useState<string | null>(null);

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
    // setWorkerError(`Worker error: ${err.message}`); // Set local state if needed
    requestPromisesRef.current.forEach((p, id) => {
      p.reject(new Error(`Worker error: ${err.message}`));
      requestPromisesRef.current.delete(id);
    });
  }, []); // No dependencies

  useEffect(() => {
    // Worker initialization remains the same
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
    [] // Stable callback
  );
  // --- End Thumbnail Logic ---

  // --- Wrapped/Specialized Functions ---
  const listImages = useCallback(
    async (limit: number = 50): Promise<StoredFile[]> => {
      // Use the stable listFiles from the base context
      const allFiles = await fileLibrary.listFiles(limit * 2, false); // Always get permanent files
      return allFiles
        .filter((file) => file.type?.startsWith('image/'))
        .slice(0, limit);
    },
    [fileLibrary.listFiles] // Depends only on the stable listFiles function
  );

  const getImage = useCallback(
    async (id: string): Promise<StoredFile | undefined> => {
      const file = await fileLibrary.getFile(id);
      if (file && file.type?.startsWith('image/')) return file;
      return undefined;
    },
    [fileLibrary.getFile] // Depends only on the stable getFile function
  );

  const addImage = useCallback(
    async (
      blob: Blob,
      name: string,
      type: string,
      isTemporary: boolean = false // Added isTemporary
    ): Promise<string> => {
      console.log('addImage:', blob, name, type, isTemporary);
      if (!type?.startsWith('image/'))
        throw new Error(`addImage called with non-image type: ${type}`);

      // Use the stable addFile from the base context
      const id = await fileLibrary.addFile(blob, name, type, isTemporary); // Pass isTemporary flag

      // Generate thumbnail after adding (still needs separate update step)
      let thumbnailBlob: Blob | null = null;
      try {
        thumbnailBlob = await generateThumbnail(id, blob);
      } catch (thumbError: unknown) {
        console.warn(`[ImageCtx] Thumbnail gen failed for ${id}:`, thumbError);
      }

      if (thumbnailBlob) {
        try {
          // Use direct DB access for thumbnail update as FileLibraryContext lacks specific method
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
    [fileLibrary.addFile, generateThumbnail] // Depends on stable addFile and local generateThumbnail
  );

  const deleteImage = useCallback(
    async (id: string): Promise<void> => {
      // Optional: Check if it's an image first using getImage?
      await fileLibrary.deleteFile(id); // Delegate to stable base deleteFile
    },
    [fileLibrary.deleteFile] // Depends only on stable deleteFile
  );

  const clearAllImages = useCallback(
    async (): Promise<void> => {
      const images = await listImages(10000); // Use the local listImages
      const imageIds = images.map((img) => img.id);
      if (imageIds.length > 0) {
        // Using base deleteFile iteratively to ensure cleanup logic runs
        for (const id of imageIds) {
          try {
            await fileLibrary.deleteFile(id);
          } catch (delErr) {
            console.error(
              `Failed to delete image ${id} during clearAllImages:`,
              delErr
            );
            // Potentially collect errors and throw at the end?
          }
        }
      }
    },
    [listImages, fileLibrary.deleteFile] // Depends on local listImages and base deleteFile
  );

  const makeImagePermanent = useCallback(
    async (id: string): Promise<void> => {
      const file = await fileLibrary.getFile(id); // Use base getFile
      if (!file || !file.type?.startsWith('image/'))
        throw new Error(`File ID ${id} is not an image.`);
      await fileLibrary.makeFilePermanent(id); // Delegate to stable base function
    },
    [fileLibrary.getFile, fileLibrary.makeFilePermanent] // Depends on stable base functions
  );

  // --- Memoize the specialized functions ---
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

  // --- Create final context value ---
  // Combine the stable image functions with the loading/error state from base context
  const contextValue = useMemo(
    () => ({
      ...imageFunctions,
      loading,
      error,
    }),
    [imageFunctions, loading, error]
  ); // Depends on stable functions object + loading/error

  return (
    <ImageLibraryContext.Provider value={contextValue}>
      {children}
    </ImageLibraryContext.Provider>
  );
};
