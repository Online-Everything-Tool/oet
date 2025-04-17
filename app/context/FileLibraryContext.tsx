// FILE: app/context/FileLibraryContext.tsx
'use client';

// Removed useEffect from import
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { db } from '../lib/db';
import type { StoredFile } from '@/src/types/storage';
import { v4 as uuidv4 } from 'uuid';

// --- Context Value Interface ---
interface FileLibraryContextValue {
  listFiles: (limit?: number, categoryFilter?: string, includeTemporary?: boolean) => Promise<StoredFile[]>;
  getFile: (id: string) => Promise<StoredFile | undefined>;
  addFile: (blob: Blob, name: string, type: string, category?: string, isTemporary?: boolean) => Promise<string>;
  promoteToLibrary: (id: string) => Promise<void>;
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

// Helper function to infer category
const inferCategory = (type: string): string => {
    if (!type) return 'other';
    if (type.startsWith('image/')) return 'image';
    if (type === 'application/zip' || type === 'application/x-zip-compressed') return 'archive';
    if (type.startsWith('text/')) return 'text';
    if (type === 'application/pdf') return 'document';
    return 'other';
};

interface FileLibraryProviderProps { children: ReactNode; }

export const FileLibraryProvider = ({ children }: FileLibraryProviderProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const listFiles = useCallback(async (
        limit: number = 50,
        categoryFilter?: string,
        includeTemporary: boolean = false
    ): Promise<StoredFile[]> => {
    setLoading(true); setError(null);
    try {
      if (!db?.files) throw new Error("Database 'files' table is not available."); // Added null check for db
      let collection = db.files.orderBy('createdAt').reverse();

      // Apply filters using Dexie's Collection methods for efficiency
      if (!includeTemporary || categoryFilter) {
            collection = collection.filter(file => {
                const tempCheck = includeTemporary ? true : (file.isTemporary === undefined || file.isTemporary === false);
                const categoryCheck = categoryFilter ? file.category === categoryFilter : true;
                return tempCheck && categoryCheck;
            });
      }
      // Apply limit
      return await collection.limit(limit).toArray();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      console.error("Error listing files:", err);
      setError(`Failed to list files: ${message}`);
      return [];
    } finally { setLoading(false); }
  }, []); // Dependencies are only setError, setLoading which are stable from useState

  const getFile = useCallback(async (id: string): Promise<StoredFile | undefined> => {
    setError(null); // Clear previous errors
    try {
        if (!db?.files) throw new Error("DB 'files' table not available.");
        // Use Dexie's get method - should be type-safe now
        const file = await db.files.get(id);
        return file;
    } catch (err: unknown) {
        const m = err instanceof Error ? err.message : 'Unknown DB error';
        console.error(`Error getting file ${id}:`, err);
        setError(`Failed to get file: ${m}`);
        return undefined;
    }
  }, []); // Dependencies stable

  const addFile = useCallback(async (
        blob: Blob,
        name: string,
        type: string,
        category?: string,
        isTemporary: boolean = false
    ): Promise<string> => {
    setLoading(true); setError(null);
    const id = uuidv4();
    try {
      if (!db?.files) throw new Error("Database 'files' table is not available.");
      const determinedCategory = category || inferCategory(type);

      const newFile: StoredFile = {
          id: id, name: name, type: type, size: blob.size, blob: blob,
          createdAt: new Date(), category: determinedCategory,
          isTemporary: isTemporary
          // thumbnailBlob is intentionally left out here - ImageLibraryContext handles that
      };
      await db.files.add(newFile);
      console.log(`[FileCtx] Added file ${id} (category: ${determinedCategory}, temporary: ${isTemporary}) to 'files' table.`);
      return id;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        console.error("Error adding file to files table:", err);
        setError(`Failed to add file: ${message}`);
        throw err; // Re-throw so the caller knows it failed
    } finally { setLoading(false); }
  }, []); // Dependencies stable

  const promoteToLibrary = useCallback(async (id: string): Promise<void> => {
    setLoading(true); setError(null);
    try {
        if (!db?.files) throw new Error("Database 'files' table is not available.");
        // Update should be type-safe
        const updatedCount = await db.files.update(id, { isTemporary: false });
        if (updatedCount > 0) { console.log(`[FileCtx] Promoted file ${id} to permanent library.`); }
        else { console.warn(`[FileCtx] File ${id} not found during promotion attempt.`); /* Or throw error? */ }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        console.error(`Error promoting file ${id}:`, err); setError(`Failed to promote file: ${message}`); throw err;
    } finally { setLoading(false); }
  }, []); // Dependencies stable

  const deleteFile = useCallback(async (id: string): Promise<void> => {
    setLoading(true); setError(null);
    try {
        if (!db?.files) throw new Error("DB 'files' table not available.");
        // Delete should be type-safe
        await db.files.delete(id);
        console.log(`[FileCtx] Deleted file ${id}`);
    } catch (err: unknown) {
        const m = err instanceof Error ? err.message : 'Unknown DB error';
        console.error(`Error deleting file ${id}:`, err); setError(`Failed to delete file: ${m}`); throw err;
    } finally { setLoading(false); }
  }, []); // Dependencies stable

  const clearAllFiles = useCallback(async (includeTemporary: boolean = false): Promise<void> => {
    setLoading(true); setError(null);
    try {
       if (!db?.files) throw new Error("Database 'files' table is not available.");
       let collectionToClear = db.files.toCollection();
       // Filter based on includeTemporary flag
       if (!includeTemporary) {
            collectionToClear = collectionToClear.filter(file => file.isTemporary !== true);
       }
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
        setError(`Failed to clear files: ${message}`);
        throw err;
    } finally { setLoading(false); }
  }, []); // Dependencies stable

  const cleanupTemporaryFiles = useCallback(async (ids?: string[]): Promise<void> => {
      // This logic seems fine - it finds temporary files (optionally within a specific set) and deletes them
      setLoading(true); setError(null);
      try {
          if (!db?.files) throw new Error("Database 'files' table is not available.");
          let keysToDelete: string[];
          if (ids && ids.length > 0) {
              // Fetch only the specified IDs first
              const filesToCheck = await db.files.where('id').anyOf(ids).toArray();
              // Filter those that are actually temporary
              keysToDelete = filesToCheck.filter(f => f.isTemporary === true).map(f => f.id);
          } else {
              // Get primary keys of *all* temporary files
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
          setError(`Failed to cleanup temporary files: ${message}`);
          // Don't re-throw, cleanup failure is less critical
      } finally { setLoading(false); }
  }, []); // Dependencies stable

  // Context value memoization remains the same
  const contextValue = useMemo(() => ({
    listFiles, getFile, addFile, promoteToLibrary, deleteFile, clearAllFiles, cleanupTemporaryFiles, loading, error,
  }), [listFiles, getFile, addFile, promoteToLibrary, deleteFile, clearAllFiles, cleanupTemporaryFiles, loading, error]);

  return ( <FileLibraryContext.Provider value={contextValue}> {children} </FileLibraryContext.Provider> );
};