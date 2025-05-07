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

interface FileLibraryContextValue {
  listFiles: (
    limit?: number,
    includeTemporary?: boolean
  ) => Promise<StoredFile[]>;
  getFile: (id: string) => Promise<StoredFile | undefined>;
  addFile: (
    blob: Blob,
    name: string,
    type: string,
    isTemporary?: boolean
  ) => Promise<string>;
  deleteFile: (id: string) => Promise<void>;
  clearAllFiles: (includeTemporary?: boolean) => Promise<void>;
  cleanupTemporaryFiles: (ids?: string[]) => Promise<void>;
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
        console.error(
          '[FileCtx] listFiles: Failed to get DB instance client-side:',
          e
        );
        setError(
          // This is fine, as it's an exceptional path
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        setLoading(false);
        return [];
      }

      setLoading(true);
      setError(null); // THIS IS LINE 107 - or setLoading(true) just above it
      try {
        if (!db?.files)
          throw new Error("Database 'files' table is not available.");
        let collection = db.files.orderBy('createdAt').reverse();

        if (!includeTemporary) {
          collection = collection.filter((file) => file.isTemporary !== true);
        }

        return await collection.limit(limit).toArray();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        console.error('Error listing files:', err);
        setError(`Failed to list files: ${message}`); // Fine to set error here
        return [];
      } finally {
        setLoading(false);
      }
    },
    [] // REMOVE [error] dependency. setLoading and setError are stable.
  );

  const getFile = useCallback(
    async (id: string): Promise<StoredFile | undefined> => {
      setError(null); // Clear previous specific errors for this action
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e: unknown) {
        console.error(
          '[FileCtx] getFile: Failed to get DB instance client-side:',
          e
        );
        setError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        return undefined;
      }
      try {
        if (!db?.files) throw new Error("DB 'files' table not available.");
        const file = await db.files.get(id);
        return file;
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : 'Unknown DB error';
        console.error(`Error getting file ${id}:`, err);
        setError(`Failed to get file: ${m}`);
        return undefined;
      }
    },
    [] // REMOVE [error] dependency
  );

  const addFile = useCallback(
    async (
      blob: Blob,
      name: string,
      type: string,
      isTemporary: boolean = false
    ): Promise<string> => {
      setLoading(true);
      setError(null);
      const id = uuidv4();
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e: unknown) {
        console.error(
          '[FileCtx] addFile: Failed to get DB instance client-side:',
          e
        );
        setLoading(false); // Ensure loading is reset
        setError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        throw e;
      }

      try {
        if (!db?.files)
          throw new Error("Database 'files' table is not available.");

        const newFile: StoredFile = {
          id: id,
          name: name,
          type: type,
          size: blob.size,
          blob: blob,
          createdAt: new Date(),
          isTemporary: isTemporary,
        };
        await db.files.add(newFile);
        return id;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        console.error('Error adding file to files table:', err);
        setError(`Failed to add file: ${message}`);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [] // REMOVE [error] dependency
  );

  const deleteFile = useCallback(
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
      try {
        if (!db?.files)
          throw new Error("Database 'files' table is not available.");
        let collectionToClear = db.files.toCollection();
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
    [] // REMOVE [error] dependency
  );

  const cleanupTemporaryFiles = useCallback(
    async (ids?: string[]): Promise<void> => {
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
        return;
      }
      try {
        if (!db?.files)
          throw new Error("Database 'files' table is not available.");
        let keysToDelete: string[];
        if (ids && ids.length > 0) {
          const filesToCheck = await db.files.where('id').anyOf(ids).toArray();
          keysToDelete = filesToCheck
            .filter((f) => f.isTemporary === true)
            .map((f) => f.id);
        } else {
          keysToDelete = await db.files
            .where({ isTemporary: true })
            .primaryKeys();
        }
        if (keysToDelete.length > 0) {
          await db.files.bulkDelete(keysToDelete);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        setError(`Failed to cleanup temporary files: ${message}`);
      } finally {
        setLoading(false);
      }
    },
    [] // REMOVE [error] dependency
  );

  const contextValue = useMemo(
    () => ({
      listFiles,
      getFile,
      addFile,
      deleteFile,
      clearAllFiles,
      cleanupTemporaryFiles,
      loading,
      error,
    }),
    [
      listFiles,
      getFile,
      addFile,
      deleteFile,
      clearAllFiles,
      cleanupTemporaryFiles,
      loading,
      error, // loading and error ARE dependencies for the contextValue itself
    ]
  );

  return (
    <FileLibraryContext.Provider value={contextValue}>
      {children}
    </FileLibraryContext.Provider>
  );
};
