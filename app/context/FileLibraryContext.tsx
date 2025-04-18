// FILE: app/context/FileLibraryContext.tsx
'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
// Import the db instance NO LONGER db, but the getDbInstance function
import { getDbInstance, type OetDatabase } from '../lib/db';
import type { StoredFile } from '@/src/types/storage'; // Uses the updated type
import { v4 as uuidv4 } from 'uuid';

// --- Context Value Interface ---
// Removed listFiles filtering by category/isApplication
// Removed promoteToLibrary
interface FileLibraryContextValue {
  listFiles: (limit?: number, includeTemporary?: boolean) => Promise<StoredFile[]>;
  getFile: (id: string) => Promise<StoredFile | undefined>;
  addFile: (blob: Blob, name: string, type: string, isTemporary?: boolean) => Promise<string>;
  deleteFile: (id: string) => Promise<void>;
  clearAllFiles: (includeTemporary?: boolean) => Promise<void>;
  cleanupTemporaryFiles: (ids?: string[]) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const FileLibraryContext = createContext<FileLibraryContextValue | undefined>(undefined);

export const useFileLibrary = () => {
  const context = useContext(FileLibraryContext);
  if (!context) throw new Error('useFileLibrary must be used within a FileLibraryProvider');
  return context;
};

// Removed inferCategory helper function as 'category' is no longer stored

interface FileLibraryProviderProps { children: ReactNode; }

export const FileLibraryProvider = ({ children }: FileLibraryProviderProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // listFiles: Simplified filtering
  const listFiles = useCallback(async (
        limit: number = 50,
        includeTemporary: boolean = false // Default to showing only permanent files
    ): Promise<StoredFile[]> => {

    // Get DB instance client-side
     let db: OetDatabase | null = null;
     try {
         db = getDbInstance();
     } catch (e) {
         console.error("[FileCtx] listFiles: Failed to get DB instance client-side:", e);
         setError(`Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`);
         setLoading(false); // Ensure loading state is false
         return []; // Return empty array on failure
     }

    setLoading(true); setError(null);
    try {
      if (!db?.files) throw new Error("Database 'files' table is not available.");
      let collection = db.files.orderBy('createdAt').reverse();

      // Filter based on the isTemporary flag
      if (!includeTemporary) {
            collection = collection.filter(file => file.isTemporary !== true);
      }
      // No category or isApplication filtering needed here

      return await collection.limit(limit).toArray();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error("Error listing files:", err);
      // If error occurred *after* getting DB instance, don't overwrite potential DB unavailable error
      if (!error?.startsWith('Database unavailable')) {
           setError(`Failed to list files: ${message}`);
      }
      return [];
    } finally { setLoading(false); }
  }, [error]); // Added error dependency

  // getFile remains the same
  const getFile = useCallback(async (id: string): Promise<StoredFile | undefined> => {
    setError(null);
     // Get DB instance client-side
      let db: OetDatabase | null = null;
      try {
          db = getDbInstance();
      } catch (e) {
          console.error("[FileCtx] getFile: Failed to get DB instance client-side:", e);
          setError(`Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`);
          return undefined; // Return undefined on failure
      }
    try {
        if (!db?.files) throw new Error("DB 'files' table not available.");
        const file = await db.files.get(id);
        return file;
    } catch (err: unknown) {
        const m = err instanceof Error ? err.message : 'Unknown DB error';
        console.error(`Error getting file ${id}:`, err);
        // If error occurred *after* getting DB instance, don't overwrite potential DB unavailable error
        if (!error?.startsWith('Database unavailable')) {
             setError(`Failed to get file: ${m}`);
        }
        return undefined;
    }
  }, [error]); // Added error dependency

  // addFile: Simplified - no category, isApplication, toolRoute
  const addFile = useCallback(async (
        blob: Blob,
        name: string,
        type: string,
        isTemporary: boolean = false // Default to permanent
    ): Promise<string> => {
    setLoading(true); setError(null);
    const id = uuidv4();
    // Get DB instance client-side
     let db: OetDatabase | null = null;
     try {
         db = getDbInstance();
     } catch (e) {
         console.error("[FileCtx] addFile: Failed to get DB instance client-side:", e);
         setError(`Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`);
         throw e; // Re-throw
     }

    try {
      if (!db?.files) throw new Error("Database 'files' table is not available.");

      const newFile: StoredFile = {
          id: id,
          name: name,
          type: type,
          size: blob.size,
          blob: blob,
          createdAt: new Date(),
          isTemporary: isTemporary
          // No category, isApplication, toolRoute
          // thumbnailBlob still handled by ImageLibraryContext if needed
      };
      await db.files.add(newFile);
      console.log(`[FileCtx] Added file ${id} (temporary: ${isTemporary}) to 'files' table.`);
      return id;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        console.error("Error adding file to files table:", err);
         // If error occurred *after* getting DB instance, don't overwrite potential DB unavailable error
        if (!error?.startsWith('Database unavailable')) {
            setError(`Failed to add file: ${message}`);
        }
        throw err;
    } finally { setLoading(false); }
  }, [error]); // Added error dependency

  // promoteToLibrary is removed

  // deleteFile remains the same
  const deleteFile = useCallback(async (id: string): Promise<void> => {
    setLoading(true); setError(null);
     // Get DB instance client-side
      let db: OetDatabase | null = null;
      try {
          db = getDbInstance();
      } catch (e) {
          console.error("[FileCtx] deleteFile: Failed to get DB instance client-side:", e);
          setError(`Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`);
          throw e; // Re-throw
      }
    try {
        if (!db?.files) throw new Error("DB 'files' table not available.");
        await db.files.delete(id);
        console.log(`[FileCtx] Deleted file ${id}`);
    } catch (err: unknown) {
        const m = err instanceof Error ? err.message : 'Unknown DB error';
        console.error(`Error deleting file ${id}:`, err);
         // If error occurred *after* getting DB instance, don't overwrite potential DB unavailable error
        if (!error?.startsWith('Database unavailable')) {
             setError(`Failed to delete file: ${m}`);
        }
        throw err;
    } finally { setLoading(false); }
  }, [error]); // Added error dependency

  // clearAllFiles: Simplified - no isApplication logic
  const clearAllFiles = useCallback(async (includeTemporary: boolean = false): Promise<void> => {
    setLoading(true); setError(null);
     // Get DB instance client-side
      let db: OetDatabase | null = null;
      try {
          db = getDbInstance();
      } catch (e) {
          console.error("[FileCtx] clearAllFiles: Failed to get DB instance client-side:", e);
          setError(`Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`);
          throw e; // Re-throw
      }
    try {
       if (!db?.files) throw new Error("Database 'files' table is not available.");
       let collectionToClear = db.files.toCollection();

       if (!includeTemporary) {
            collectionToClear = collectionToClear.filter(file => file.isTemporary !== true);
       }
       // No isApplication filtering

       const keysToDelete = await collectionToClear.primaryKeys();
       if (keysToDelete.length > 0) {
            await db.files.bulkDelete(keysToDelete);
            console.log(`[FileCtx] Cleared ${keysToDelete.length} ${includeTemporary ? 'ALL' : 'permanent'} files.`);
       } else {
            console.log(`[FileCtx] No ${includeTemporary ? 'ALL' : 'permanent'} files found to clear.`);
       }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        console.error(`Error clearing files (includeTemporary: ${includeTemporary}):`, err);
         // If error occurred *after* getting DB instance, don't overwrite potential DB unavailable error
        if (!error?.startsWith('Database unavailable')) {
             setError(`Failed to clear files: ${message}`);
        }
        throw err;
    } finally { setLoading(false); }
  }, [error]); // Added error dependency

  // cleanupTemporaryFiles remains the same (targets isTemporary flag)
  const cleanupTemporaryFiles = useCallback(async (ids?: string[]): Promise<void> => {
      setLoading(true); setError(null);
       // Get DB instance client-side
        let db: OetDatabase | null = null;
        try {
            db = getDbInstance();
        } catch (e) {
            console.error("[FileCtx] cleanupTemporaryFiles: Failed to get DB instance client-side:", e);
            setError(`Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`);
            return; // Cannot proceed
        }
      try {
          if (!db?.files) throw new Error("Database 'files' table is not available.");
          let keysToDelete: string[];
          if (ids && ids.length > 0) {
              const filesToCheck = await db.files.where('id').anyOf(ids).toArray();
              keysToDelete = filesToCheck.filter(f => f.isTemporary === true).map(f => f.id);
          } else {
              keysToDelete = await db.files.where({ isTemporary: true }).primaryKeys();
          }

          if (keysToDelete.length > 0) {
              await db.files.bulkDelete(keysToDelete);
              console.log(`[FileCtx] Cleaned up ${keysToDelete.length} temporary files.`);
          } else {
              console.log(`[FileCtx] No specified temporary files found to clean up.`);
          }
      } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown DB error';
          console.error(`Error cleaning up temporary files:`, err);
           // If error occurred *after* getting DB instance, don't overwrite potential DB unavailable error
          if (!error?.startsWith('Database unavailable')) {
              setError(`Failed to cleanup temporary files: ${message}`);
          }
      } finally { setLoading(false); }
  }, [error]); // Added error dependency

  // Context value memoization updated
  const contextValue = useMemo(() => ({
    listFiles, getFile, addFile, deleteFile, clearAllFiles, cleanupTemporaryFiles, loading, error,
  }), [listFiles, getFile, addFile, deleteFile, clearAllFiles, cleanupTemporaryFiles, loading, error]);

  return ( <FileLibraryContext.Provider value={contextValue}> {children} </FileLibraryContext.Provider> );
};