// app/lib/hooks/useImageThumbnailer.ts
import { useCallback, useEffect, useRef } from 'react';
import { getDbInstance } from '@/app/lib/db';
import type { StoredFile } from '@/src/types/storage';

export function useImageThumbnailer() {
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
      if (
        type === 'thumbnailSuccess' &&
        !workerError &&
        payload instanceof Blob
      ) {
        promiseFuncs.resolve(payload);
      } else {
        promiseFuncs.reject(
          new Error(
            workerError || 'Thumbnail generation failed or invalid payload'
          )
        );
      }
      requestPromisesRef.current.delete(id);
    }
  }, []);

  const handleWorkerError = useCallback((err: ErrorEvent) => {
    console.error('[useImageThumbnailer Worker] Error:', err);
    requestPromisesRef.current.forEach((p, id) => {
      p.reject(new Error(`Worker error: ${err.message}`));
      requestPromisesRef.current.delete(id);
    });
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !workerRef.current) {
      try {
        const workerInstance = new Worker(
          new URL('../workers/thumbnail.worker.ts', import.meta.url)
        );
        workerRef.current = workerInstance;
        workerInstance.addEventListener('message', handleWorkerMessage);
        workerInstance.addEventListener('error', handleWorkerError);
      } catch (e) {
        console.error('Failed to init thumbnail worker', e);
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
        p.reject(new Error('useImageThumbnailer unmounted'));
        currentPromises.delete(id);
      });
    };
  }, [handleWorkerMessage, handleWorkerError]);

  /**
   * Generates a thumbnail for a StoredFile and updates its record in Dexie.
   * @param inputFile The StoredFile object (must contain id and blob).
   * @returns Promise<boolean> True if thumbnail was generated and DB updated, false otherwise.
   */
  const generateAndSaveThumbnail = useCallback(
    async (inputFile: StoredFile): Promise<boolean> => {
      if (
        !inputFile ||
        !inputFile.id ||
        !inputFile.blob ||
        !inputFile.type?.startsWith('image/')
      ) {
        console.warn(
          '[useImageThumbnailer] Invalid parameters: inputFile must be an image StoredFile with id and blob.',
          inputFile
        );
        return false;
      }

      let thumbnailBlob: Blob | null = null;
      try {
        thumbnailBlob = await new Promise<Blob | null>((resolve, reject) => {
          if (!workerRef.current) {
            console.warn(
              '[useImageThumbnailer] Thumbnail worker not available for generation.'
            );
            resolve(null);
            return;
          }
          const requestId = `thumb-${inputFile.id}-${Date.now()}`;
          requestPromisesRef.current.set(requestId, {
            resolve: (value) => resolve(value as Blob | null),
            reject,
          });
          workerRef.current.postMessage({
            id: requestId,
            blob: inputFile.blob,
          });
        });
      } catch (error) {
        console.error(
          `[useImageThumbnailer] Error in worker communication for ${inputFile.id}:`,
          error
        );
        return false;
      }

      if (thumbnailBlob) {
        try {
          const db = getDbInstance();
          const updateCount = await db.files.update(inputFile.id, {
            thumbnailBlob: thumbnailBlob,
            lastModified: new Date(),
          } as Partial<StoredFile>);
          if (updateCount > 0) {
            console.log(
              `[useImageThumbnailer] Thumbnail saved to Dexie for ${inputFile.id}`
            );
            return true;
          } else {
            console.warn(
              `[useImageThumbnailer] Thumbnail generated but failed to update Dexie record for ${inputFile.id}. File not found?`
            );
            return false;
          }
        } catch (dbError) {
          console.error(
            `[useImageThumbnailer] Dexie update error for ${inputFile.id}:`,
            dbError
          );
          return false;
        }
      } else {
        console.warn(
          `[useImageThumbnailer] Thumbnail generation returned null for ${inputFile.id}`
        );
        return false;
      }
    },
    []
  );

  return { generateAndSaveThumbnail };
}
