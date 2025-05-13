// FILE: app/context/FileLibraryContext.tsx
'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { getDbInstance, type OetDatabase } from '../lib/db';
import type { StoredFile } from '@/src/types/storage';
import { v4 as uuidv4 } from 'uuid';

interface FileLibraryFunctions {
  listFiles: (
    limit?: number,
    includeTemporary?: boolean
  ) => Promise<StoredFile[]>;
  getFile: (id: string) => Promise<StoredFile | undefined>;
  addFile: (
    blob: Blob,
    name: string,
    type: string,
    isTemporary?: boolean,
    toolRoute?: string
  ) => Promise<string>;
  deleteFile: (id: string) => Promise<void>;
  clearAllFiles: (includeTemporary?: boolean) => Promise<void>;
  cleanupTemporaryFiles: () => Promise<void>;
  makeFilePermanent: (id: string) => Promise<void>;
  updateFileBlob: (id: string, newBlob: Blob) => Promise<void>;
}

interface FileLibraryContextValue extends FileLibraryFunctions {
  loading: boolean;
  error: string | null;
}

const FileLibraryContext = createContext<FileLibraryContextValue | undefined>(
  undefined
);

export const useFileLibrary = () => {
  const context = useContext(FileLibraryContext);
  if (!context)
    throw new Error('useFileLibrary must be used within a FileLibraryProvider');
  return context;
};

interface FileLibraryProviderProps {
  children: ReactNode;
}

export const FileLibraryProvider = ({ children }: FileLibraryProviderProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const listFiles = useCallback(
    async (
      limit: number = 50,
      includeTemporary: boolean = false
    ): Promise<StoredFile[]> => {
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e: unknown) {
        setError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );

        return [];
      }

      setLoading(true);
      setError(null);
      try {
        if (!db?.files)
          throw new Error("Database 'files' table is not available.");
        let collection = db.files
          .orderBy('createdAt')
          .reverse()
          .filter((file) => file.type !== 'application/x-oet-tool-state+json');
        if (!includeTemporary) {
          collection = collection.filter((file) => file.isTemporary !== true);
        }
        return await collection.limit(limit).toArray();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        setError(`Failed to list files: ${message}`);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getFile = useCallback(
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
        return await db.files.get(id);
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : 'Unknown DB error';
        setError(`Failed to get file: ${m}`);
        return undefined;
      }
    },
    []
  );

  const addFile = useCallback(
    async (
      blob: Blob,
      name: string,
      type: string,
      isTemporary: boolean = false,
      toolRoute?: string
    ): Promise<string> => {
      setLoading(true);
      setError(null);
      const id = uuidv4();
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
        if (!db?.files)
          throw new Error("Database 'files' table is not available.");
        const newFile: StoredFile = {
          id: id,
          name: name,
          type: type,
          size: blob.size,
          blob: blob,
          createdAt: new Date(),
          lastModified: new Date(),
          isTemporary: isTemporary,
          ...(toolRoute && { toolRoute: toolRoute }),
        };
        await db.files.add(newFile);
        return id;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        setError(`Failed to add file: ${message}`);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const makeFilePermanent = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    let db: OetDatabase | null = null;
    try {
      db = getDbInstance();
      if (!db?.files) throw new Error("DB 'files' table not available.");
      const count = await db.files.update(id, {
        isTemporary: false,
        lastModified: new Date(),
      });
      if (count === 0)
        console.warn(`makeFilePermanent: File ID ${id} not found.`);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Unknown DB error';
      setError(`Failed to make file permanent: ${m}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateFileBlob = useCallback(
    async (id: string, newBlob: Blob): Promise<void> => {
      setLoading(true);
      setError(null);
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
        if (!db?.files) throw new Error("DB 'files' table not available.");
        const count = await db.files.update(id, {
          blob: newBlob,
          size: newBlob.size,
          lastModified: new Date(),
        });
        if (count === 0)
          console.warn(`updateFileBlob: File ID ${id} not found.`);
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : 'Unknown DB error';
        setError(`Failed to update file blob: ${m}`);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteFile = useCallback(async (id: string): Promise<void> => {
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

    if (!db) {
      setLoading(false);
      throw new Error(
        'Database instance is null, cannot proceed with deleteFile.'
      );
    }

    try {
      if (!db?.files) throw new Error("DB 'files' table not available.");

      const stateFiles = await db.files
        .where({ type: 'application/x-oet-tool-state+json' })
        .toArray();
      for (const stateFile of stateFiles) {
        try {
          const stateBlob = stateFile.blob;
          if (!stateBlob) continue;
          const stateText = await stateBlob.text();
          const state = JSON.parse(stateText);
          let updated = false;
          const checkAndUpdateIds = (key: string) => {
            /* ... includes logic ... */
            if (Array.isArray(state[key]) && state[key].includes(id)) {
              state[key] = state[key].filter((fileId: string) => fileId !== id);
              updated = true;
            }
          };
          checkAndUpdateIds('inputImageIds');
          checkAndUpdateIds('inputFileIds');
          if (updated) {
            const newStateBlob = new Blob([JSON.stringify(state)], {
              type: 'application/x-oet-tool-state+json',
            });
            await db.files.update(stateFile.id, {
              blob: newStateBlob,
              size: newStateBlob.size,
              lastModified: new Date(),
            });
          }
        } catch (stateErr) {
          console.error(
            `Error processing state file ${stateFile.id}:`,
            stateErr
          );
        }
      }

      await db.files.delete(id);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Unknown DB error';
      setError(`Failed to delete file: ${m}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAllFiles = useCallback(
    async (includeTemporary: boolean = false): Promise<void> => {
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

      if (!db) {
        setLoading(false);
        throw new Error(
          'Database instance is null, cannot proceed with deleteFile.'
        );
      }

      try {
        if (!db?.files) throw new Error("DB 'files' table not available.");

        let collectionToClear = db.files.filter(
          (file) => file.type !== 'application/x-oet-tool-state+json'
        );
        if (!includeTemporary) {
          collectionToClear = collectionToClear.filter(
            (file) => file.isTemporary !== true
          );
        }
        const keysToDelete = await collectionToClear.primaryKeys();

        if (keysToDelete.length > 0) {
          await db.files.bulkDelete(keysToDelete);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        setError(`Failed to clear files: ${message}`);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const cleanupTemporaryFiles = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    let db: OetDatabase | null = null;
    try {
      db = getDbInstance();
      if (!db?.files) throw new Error("DB 'files' table not available.");

      const allTempFiles = await db.files
        .filter((file) => file.isTemporary === true)
        .toArray();
      const tempStateFiles = allTempFiles.filter(
        (file) => file.type === 'application/x-oet-tool-state+json'
      );
      const tempOutputFiles = allTempFiles.filter(
        (file) => file.type !== 'application/x-oet-tool-state+json'
      );
      const outputFilesToDelete = tempOutputFiles.map((file) => file.id);
      const stateFilesToDelete = tempStateFiles.map((file) => file.id);
      const allTempKeysToDelete = [
        ...new Set([...outputFilesToDelete, ...stateFilesToDelete]),
      ];

      if (allTempKeysToDelete.length > 0) {
        await db.files.bulkDelete(allTempKeysToDelete);
        console.log(
          `[Cleanup] Deleted ${allTempKeysToDelete.length} temporary files.`
        );
      } else {
        console.log('[Cleanup] No temporary files needed cleanup.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error('[Cleanup] Error during temporary file cleanup:', message);
    } finally {
      setLoading(false);
    }
  }, []);

  const functions = useMemo(
    () => ({
      listFiles,
      getFile,
      addFile,
      deleteFile,
      clearAllFiles,
      cleanupTemporaryFiles,
      makeFilePermanent,
      updateFileBlob,
    }),
    [
      listFiles,
      getFile,
      addFile,
      deleteFile,
      clearAllFiles,
      cleanupTemporaryFiles,
      makeFilePermanent,
      updateFileBlob,
    ]
  );

  const contextValue = useMemo(
    () => ({
      ...functions,
      loading,
      error,
    }),
    [functions, loading, error]
  );

  return (
    <FileLibraryContext.Provider value={contextValue}>
      {children}
    </FileLibraryContext.Provider>
  );
};
