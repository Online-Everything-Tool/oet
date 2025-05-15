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
import { getDbInstance } from '../lib/db';
import type { StoredFile } from '@/src/types/storage';
import { v4 as uuidv4 } from 'uuid';
import { useMetadata } from './MetadataContext';
import type {
  InputConfig,
  StateFiles,
  ToolMetadata,
  TransferableOutputDetails,
} from '@/src/types/tools';

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
  deleteFile: (id: string) => Promise<void>; // For direct, unconditional deletes
  makeFilePermanent: (id: string) => Promise<void>;
  updateFileBlob: (id: string, newBlob: Blob) => Promise<void>;
  cleanupOrphanedTemporaryFiles: (
    fileIdsToPotentiallyDelete?: string[]
  ) => Promise<{ deletedCount: number; candidatesChecked: number }>;
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
  const { toolMetadataMap, isLoading: isLoadingMetadata } = useMetadata();

  const listFiles = useCallback(
    async (
      limit: number = 50,
      includeTemporary: boolean = false
    ): Promise<StoredFile[]> => {
      let db;
      try {
        db = getDbInstance();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Database unavailable: ${msg}`);
        console.error(`[FileLibrary ListFiles] DB Error: ${msg}`, e);
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to list files: ${msg}`);
        console.error(`[FileLibrary ListFiles] Query Error: ${msg}`, err);
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
      let db;
      try {
        db = getDbInstance();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Database unavailable: ${msg}`);
        console.error(`[FileLibrary GetFile] DB Error for ID ${id}: ${msg}`, e);
        return undefined;
      }
      try {
        if (!db?.files)
          throw new Error("Database 'files' table is not available.");
        return await db.files.get(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to get file ID ${id}: ${msg}`);
        console.error(
          `[FileLibrary GetFile] Query Error for ID ${id}: ${msg}`,
          err
        );
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
      let db;
      try {
        db = getDbInstance();
        if (!db?.files)
          throw new Error("Database 'files' table is not available.");
        const newFile: StoredFile = {
          id,
          name,
          type,
          size: blob.size,
          blob,
          createdAt: new Date(),
          lastModified: new Date(),
          isTemporary,
          ...(toolRoute && { toolRoute }),
        };
        await db.files.add(newFile);
        console.log(
          `[FileLibrary AddFile] Added file: ${name} (ID: ${id}), Temporary: ${isTemporary}`
        );
        return id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to add file ${name}: ${msg}`);
        console.error(
          `[FileLibrary AddFile] Error adding file ${name}: ${msg}`,
          err
        );
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
    let db;
    try {
      db = getDbInstance();
      if (!db?.files)
        throw new Error("Database 'files' table is not available.");
      const count = await db.files.update(id, {
        isTemporary: false,
        lastModified: new Date(),
      });
      if (count > 0)
        console.log(`[FileLibrary MakePermanent] File ${id} made permanent.`);
      else
        console.warn(
          `[FileLibrary MakePermanent] File ${id} not found or not updated.`
        );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to make file ${id} permanent: ${msg}`);
      console.error(
        `[FileLibrary MakePermanent] Error for ID ${id}: ${msg}`,
        err
      );
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateFileBlob = useCallback(
    async (id: string, newBlob: Blob): Promise<void> => {
      setLoading(true);
      setError(null);
      let db;
      try {
        db = getDbInstance();
        if (!db?.files)
          throw new Error("Database 'files' table is not available.");
        const count = await db.files.update(id, {
          blob: newBlob,
          size: newBlob.size,
          lastModified: new Date(),
        });
        if (count > 0)
          console.log(`[FileLibrary UpdateBlob] Blob updated for file ${id}.`);
        else
          console.warn(
            `[FileLibrary UpdateBlob] File ${id} not found or not updated.`
          );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to update blob for file ${id}: ${msg}`);
        console.error(
          `[FileLibrary UpdateBlob] Error for ID ${id}: ${msg}`,
          err
        );
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
    let db;
    try {
      db = getDbInstance();
      if (!db?.files)
        throw new Error("Database 'files' table is not available.");
      await db.files.delete(id);
      console.log(`[FileLibrary DeleteFile] Directly deleted file: ${id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to delete file ${id}: ${msg}`);
      console.error(
        `[FileLibrary DeleteFile] Error deleting file ${id}: ${msg}`,
        err
      );
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const cleanupOrphanedTemporaryFiles = useCallback(
    async (
      fileIdsToPotentiallyDelete?: string[]
    ): Promise<{ deletedCount: number; candidatesChecked: number }> => {
      if (isLoadingMetadata) {
        console.warn(
          '[FileLibCleanup] Metadata not loaded yet, skipping cleanup.'
        );
        return { deletedCount: 0, candidatesChecked: 0 };
      }
      if (Object.keys(toolMetadataMap).length === 0 && !isLoadingMetadata) {
        console.warn(
          '[FileLibCleanup] No tool metadata available. Ensure MetadataProvider is above FileLibraryProvider and functional.'
        );
        return { deletedCount: 0, candidatesChecked: 0 };
      }

      console.log(
        '[FileLibCleanup] Starting. Specific IDs to check first (if any):',
        fileIdsToPotentiallyDelete
      );
      setLoading(true);
      setError(null);
      let deletedCount = 0;
      let initialCandidateCount = 0;

      try {
        const db = getDbInstance();
        if (!db?.files)
          throw new Error("Database 'files' table not available.");

        let tempFilesToVerify: StoredFile[];
        if (
          fileIdsToPotentiallyDelete &&
          fileIdsToPotentiallyDelete.length > 0
        ) {
          const validIds = fileIdsToPotentiallyDelete.filter(
            (id) => typeof id === 'string' && id.trim() !== ''
          );
          initialCandidateCount = validIds.length;
          if (initialCandidateCount === 0) {
            console.log(
              '[FileLibCleanup] No valid file IDs provided in fileIdsToPotentiallyDelete.'
            );
            setLoading(false);
            return { deletedCount: 0, candidatesChecked: 0 };
          }
          const potentialFiles = (await db.files.bulkGet(validIds)).filter(
            (f) => f !== undefined
          ) as StoredFile[];
          tempFilesToVerify = potentialFiles.filter(
            (file) =>
              file.isTemporary === true &&
              file.type !== 'application/x-oet-tool-state+json'
          );
          console.log(
            `[FileLibCleanup] From ${initialCandidateCount} provided IDs, found ${tempFilesToVerify.length} temporary files to verify.`
          );
        } else {
          tempFilesToVerify = await db.files
            .where('isTemporary')
            .equals(true as any)
            .and((file) => file.type !== 'application/x-oet-tool-state+json')
            .toArray();
          initialCandidateCount = tempFilesToVerify.length;
          console.log(
            `[FileLibCleanup] Full sweep: Found ${tempFilesToVerify.length} total temporary files to verify.`
          );
        }

        if (tempFilesToVerify.length === 0) {
          console.log(
            '[FileLibCleanup] No temporary file candidates to verify.'
          );
          setLoading(false);
          return { deletedCount: 0, candidatesChecked: initialCandidateCount };
        }

        const orphanedTempFileIds = new Set<string>(
          tempFilesToVerify.map((f) => f.id)
        );
        console.log(
          `[FileLibCleanup] Initial candidates for deletion if not in use: ${orphanedTempFileIds.size} IDs`
        );

        const allToolDirectives = Object.keys(toolMetadataMap);
        for (const directive of allToolDirectives) {
          if (orphanedTempFileIds.size === 0) {
            console.log(
              '[FileLibCleanup] All candidates verified as in use. Short-circuiting state scan.'
            );
            break;
          }

          const metadata: ToolMetadata | undefined = toolMetadataMap[directive];
          if (!metadata?.inputConfig?.stateFiles) continue;

          const stateFileId = `state-/tool/${directive}`;
          try {
            const toolStateFile = await db.files.get(stateFileId);
            if (toolStateFile?.blob) {
              const stateJson = await toolStateFile.blob.text();
              const toolCurrentState = JSON.parse(stateJson) as Record<
                string,
                any
              >;

              for (const stateFileRef of metadata.inputConfig.stateFiles) {
                // stateFiles is StateFiles[]
                if (stateFileRef.dataType === 'none') continue;

                // stateFileRef is InputFileDetails (which extends FileDetails)
                // It always has dataType: 'fileReference'
                if (stateFileRef.arrayStateKey) {
                  // Array of objects, each object containing fileIdStateKey
                  if (
                    Array.isArray(toolCurrentState[stateFileRef.arrayStateKey])
                  ) {
                    (
                      toolCurrentState[stateFileRef.arrayStateKey] as any[]
                    ).forEach((item) => {
                      if (
                        item &&
                        typeof item === 'object' &&
                        item[stateFileRef.fileIdStateKey] &&
                        orphanedTempFileIds.has(
                          item[stateFileRef.fileIdStateKey] as string
                        )
                      ) {
                        orphanedTempFileIds.delete(
                          item[stateFileRef.fileIdStateKey] as string
                        );
                      }
                    });
                  }
                } else {
                  // Single file ID directly in fileIdStateKey
                  if (toolCurrentState[stateFileRef.fileIdStateKey]) {
                    const idInState = toolCurrentState[
                      stateFileRef.fileIdStateKey
                    ] as string;
                    if (idInState && orphanedTempFileIds.has(idInState))
                      orphanedTempFileIds.delete(idInState);
                  }
                }
              }

              const outputContent = metadata.outputConfig?.transferableContent;
              if (outputContent) {
                if (
                  outputContent.dataType === 'fileReference' &&
                  outputContent.fileIdStateKey &&
                  toolCurrentState[outputContent.fileIdStateKey]
                ) {
                  const idInState = toolCurrentState[
                    outputContent.fileIdStateKey
                  ] as string;
                  if (idInState && orphanedTempFileIds.has(idInState))
                    orphanedTempFileIds.delete(idInState);
                } else if (
                  outputContent.dataType === 'selectionReferenceList' &&
                  outputContent.selectionStateKey &&
                  Array.isArray(
                    toolCurrentState[outputContent.selectionStateKey]
                  )
                ) {
                  (
                    toolCurrentState[
                      outputContent.selectionStateKey
                    ] as string[]
                  ).forEach((id) => {
                    if (id && orphanedTempFileIds.has(id))
                      orphanedTempFileIds.delete(id);
                  });
                }
              }
            }
          } catch (e) {
            console.warn(
              `[FileLibCleanup] Error processing state for tool ${directive}:`,
              e
            );
          }
        }
        console.log(
          `[FileLibCleanup] After checking all states, ${orphanedTempFileIds.size} IDs remain as potential orphans.`
        );

        if (orphanedTempFileIds.size > 0) {
          const idsToDeleteArray = Array.from(orphanedTempFileIds);
          await db.files.bulkDelete(idsToDeleteArray);
          deletedCount = idsToDeleteArray.length;
          console.log(
            `[FileLibCleanup] Successfully deleted ${deletedCount} orphaned temporary files:`,
            idsToDeleteArray
          );
        } else {
          console.log(
            '[FileLibCleanup] No orphaned temporary files from candidates were ultimately deleted.'
          );
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unknown DB error during cleanup';
        setError(`Cleanup failed: ${message}`);
        console.error('[FileLibCleanup] Error:', err);
      } finally {
        setLoading(false);
      }
      return { deletedCount, candidatesChecked: initialCandidateCount };
    },
    [toolMetadataMap, isLoadingMetadata]
  );

  const functions = useMemo(
    () => ({
      listFiles,
      getFile,
      addFile,
      deleteFile,
      makeFilePermanent,
      updateFileBlob,
      cleanupOrphanedTemporaryFiles,
    }),
    [
      listFiles,
      getFile,
      addFile,
      deleteFile,
      makeFilePermanent,
      updateFileBlob,
      cleanupOrphanedTemporaryFiles,
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
