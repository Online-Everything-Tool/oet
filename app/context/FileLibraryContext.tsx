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

import { useImageThumbnailer } from '../lib/hooks/useImageThumbnailer';
import { ToolMetadata } from '@/src/types/tools';

export interface FileLibraryFunctions {
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
  markFileAsTemporary: (id: string) => Promise<boolean>;
  markAllFilesAsTemporary: (
    excludeToolState?: boolean,
    excludeAlreadyTemporary?: boolean
  ) => Promise<{ markedCount: number; markedIds: string[] }>;
  makeFilePermanent: (id: string) => Promise<void>;
  updateFileBlob: (
    id: string,
    newBlob: Blob,
    regenerateThumbnailIfImage?: boolean
  ) => Promise<void>;
  cleanupOrphanedTemporaryFiles: (
    fileIdsToPotentiallyDelete?: string[]
  ) => Promise<{ deletedCount: number; candidatesChecked: number }>;
  deleteFilePermanently: (id: string) => Promise<void>;
}

interface FileLibraryContextValue extends FileLibraryFunctions {
  loading: boolean;
  error: string | null;
}

const FileLibraryContext = createContext<FileLibraryContextValue | undefined>(
  undefined
);

export const useFileLibrary = (): FileLibraryContextValue => {
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
  const { generateAndSaveThumbnail } = useImageThumbnailer();

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

        let collection = db.files.orderBy('createdAt').reverse();
        collection = collection.filter(
          (file) => file.type !== 'application/x-oet-tool-state+json'
        );
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
      isTemporary: boolean = true,
      toolRoute?: string
    ): Promise<string> => {
      setLoading(true);
      setError(null);
      const id = uuidv4();
      const now = new Date();
      const newFileRecord: StoredFile = {
        id,
        name,
        type,
        size: blob.size,
        blob,
        createdAt: now,
        lastModified: now,
        isTemporary,
        ...(toolRoute && { toolRoute }),
      };

      let db;
      try {
        db = getDbInstance();
        if (!db?.files)
          throw new Error("Database 'files' table not available.");
        await db.files.add(newFileRecord);
        console.log(
          `[FileLibrary AddFile] Added file record: ${name} (ID: ${id}), Type: ${type}, Temp: ${isTemporary}`
        );

        if (type.startsWith('image/')) {
          console.log(
            `[FileLibrary AddFile] Image detected, calling generateAndSaveThumbnail for ${id}`
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          generateAndSaveThumbnail(newFileRecord).catch((thumbError: any) => {
            console.error(
              `[FileLibrary AddFile] Thumbnail processing failed for ${id} after add:`,
              thumbError
            );
          });
        }
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
    [generateAndSaveThumbnail]
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
    async (
      id: string,
      newBlob: Blob,
      regenerateThumbnailIfImage: boolean = true
    ): Promise<void> => {
      setLoading(true);
      setError(null);
      let db;
      try {
        db = getDbInstance();
        if (!db?.files)
          throw new Error("Database 'files' table is not available.");
        const existingFile = await db.files.get(id);
        if (!existingFile) {
          throw new Error(`File ${id} not found for update.`);
        }

        const mainUpdates: Partial<StoredFile> = {
          blob: newBlob,
          size: newBlob.size,
          lastModified: new Date(),
        };
        await db.files.update(id, mainUpdates);
        console.log(`[FileLibrary UpdateBlob] Main blob updated for ${id}.`);

        if (
          existingFile.type.startsWith('image/') &&
          regenerateThumbnailIfImage
        ) {
          console.log(
            `[FileLibrary UpdateBlob] Image detected, calling generateAndSaveThumbnail for ${id} with new blob.`
          );
          const updatedFileForThumbnailing: StoredFile = {
            ...existingFile,
            blob: newBlob,
            size: newBlob.size,
            lastModified: mainUpdates.lastModified!,
          };
          generateAndSaveThumbnail(updatedFileForThumbnailing).catch(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (thumbError: any) => {
              console.error(
                `[FileLibrary UpdateBlob] Thumbnail regeneration failed for ${id} after update:`,
                thumbError
              );
            }
          );
        }
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
    [generateAndSaveThumbnail]
  );

  const markFileAsTemporary = useCallback(
    async (id: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      let db;
      try {
        db = getDbInstance();
        if (!db?.files)
          throw new Error("Database 'files' table is not available.");
        const count = await db.files.update(id, {
          isTemporary: true,
          lastModified: new Date(),
        });
        if (count > 0) {
          console.log(`[FileLibrary MarkTemp] Marked file ${id} as temporary.`);
          return true;
        }
        console.warn(
          `[FileLibrary MarkTemp] File ${id} not found or not updated to temporary.`
        );
        return false;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to mark file ${id} as temporary: ${msg}`);
        console.error(
          `[FileLibrary MarkTemp] Error for file ${id}: ${msg}`,
          err
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const markAllFilesAsTemporary = useCallback(
    async (
      excludeToolState: boolean = true,
      excludeAlreadyTemporary: boolean = true
    ): Promise<{ markedCount: number; markedIds: string[] }> => {
      setLoading(true);
      setError(null);
      let db;
      try {
        db = getDbInstance();
      } catch (e: unknown) {
        setLoading(false);
        const errorMsg = `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`;
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      if (!db?.files) {
        setLoading(false);
        throw new Error("DB 'files' table not available.");
      }

      try {
        let collectionToMark = db.files.toCollection();
        if (excludeToolState) {
          collectionToMark = collectionToMark.filter(
            (file) => file.type !== 'application/x-oet-tool-state+json'
          );
        }
        if (excludeAlreadyTemporary) {
          collectionToMark = collectionToMark.filter(
            (file) => file.isTemporary !== true
          );
        }

        const filesToUpdate = await collectionToMark.toArray();
        if (filesToUpdate.length === 0) {
          return { markedCount: 0, markedIds: [] };
        }

        const updates = filesToUpdate.map((file) => ({
          key: file.id,
          changes: { isTemporary: true, lastModified: new Date() },
        }));

        await db.files.bulkUpdate(updates);
        const markedIds = filesToUpdate.map((f) => f.id);
        console.log(
          `[FileLibrary MarkAllTemp] Marked ${filesToUpdate.length} files as temporary.`
        );
        return { markedCount: filesToUpdate.length, markedIds };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown DB error';
        setError(`Failed to mark all files as temporary: ${message}`);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteFilePermanently = useCallback(
    async (id: string): Promise<void> => {
      let db;
      try {
        db = getDbInstance();
        if (!db?.files)
          throw new Error("Database 'files' table is not available.");
        await db.files.delete(id);
        console.log(
          `[FileLibrary DeletePermanent] Permanently deleted file: ${id}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[FileLibrary DeletePermanent] Error deleting file ${id}: ${msg}`,
          err
        );
        throw err;
      }
    },
    []
  );

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
        console.warn('[FileLibCleanup] No tool metadata available.');
        return { deletedCount: 0, candidatesChecked: 0 };
      }

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
          if (initialCandidateCount === 0)
            return { deletedCount: 0, candidatesChecked: 0 };

          const potentialFiles = (await db.files.bulkGet(validIds)).filter(
            (f) => f !== undefined
          ) as StoredFile[];
          tempFilesToVerify = potentialFiles.filter(
            (file) =>
              file.isTemporary === true &&
              file.type !== 'application/x-oet-tool-state+json'
          );
        } else {
          tempFilesToVerify = await db.files
            .where('isTemporary')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .equals(true as any)
            .and((file) => file.type !== 'application/x-oet-tool-state+json')
            .toArray();
          initialCandidateCount = tempFilesToVerify.length;
        }

        if (tempFilesToVerify.length === 0)
          return { deletedCount: 0, candidatesChecked: initialCandidateCount };

        const orphanedTempFileIds = new Set<string>(
          tempFilesToVerify.map((f) => f.id)
        );

        const allToolStateFiles = await db.files
          .where('type')
          .equals('application/x-oet-tool-state+json')
          .toArray();

        for (const toolStateFile of allToolStateFiles) {
          if (orphanedTempFileIds.size === 0) break;
          if (!toolStateFile.blob) continue;

          const directive = toolStateFile.toolRoute;
          if (!directive) continue;

          const metadataForTool: ToolMetadata | undefined =
            toolMetadataMap[directive.replace('/tool/', '')];
          if (!metadataForTool) continue;

          try {
            const stateJson = await toolStateFile.blob.text();

            // prettier-ignore
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolCurrentState = JSON.parse(stateJson) as Record<string, any>;

            metadataForTool.inputConfig?.stateFiles?.forEach(
              (stateFileRefConfig) => {
                if (stateFileRefConfig.dataType === 'none') return;
                if (stateFileRefConfig.arrayStateKey) {
                  const fileArray =
                    toolCurrentState[stateFileRefConfig.arrayStateKey];
                  if (Array.isArray(fileArray)) {
                    fileArray.forEach((item) => {
                      if (
                        item &&
                        typeof item === 'object' &&
                        item[stateFileRefConfig.fileIdStateKey]
                      ) {
                        const idInState = item[
                          stateFileRefConfig.fileIdStateKey
                        ] as string;
                        if (idInState && orphanedTempFileIds.has(idInState))
                          orphanedTempFileIds.delete(idInState);
                      }
                    });
                  }
                } else {
                  const idInState = toolCurrentState[
                    stateFileRefConfig.fileIdStateKey
                  ] as string;
                  if (idInState && orphanedTempFileIds.has(idInState))
                    orphanedTempFileIds.delete(idInState);
                }
              }
            );

            const outputContent =
              metadataForTool.outputConfig?.transferableContent;
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
                Array.isArray(toolCurrentState[outputContent.selectionStateKey])
              ) {
                (
                  toolCurrentState[outputContent.selectionStateKey] as string[]
                ).forEach((id) => {
                  if (id && orphanedTempFileIds.has(id))
                    orphanedTempFileIds.delete(id);
                });
              }
            }
          } catch (e) {
            console.warn(
              `[FileLibCleanup] Error processing state for ${directive}:`,
              e
            );
          }
        }

        if (orphanedTempFileIds.size > 0) {
          const idsToDeleteArray = Array.from(orphanedTempFileIds);
          for (const idToDelete of idsToDeleteArray) {
            await deleteFilePermanently(idToDelete);
          }
          deletedCount = idsToDeleteArray.length;
          console.log(
            `[FileLibCleanup] Successfully deleted ${deletedCount} orphaned temporary files:`,
            idsToDeleteArray
          );
        }
      } catch (err: unknown) {
        console.error('[FileLibCleanup] Error:', err);
      }
      return { deletedCount, candidatesChecked: initialCandidateCount };
    },
    [toolMetadataMap, isLoadingMetadata, deleteFilePermanently]
  );

  const functions = useMemo(
    () => ({
      listFiles,
      getFile,
      addFile,
      markFileAsTemporary,
      markAllFilesAsTemporary,
      makeFilePermanent,
      updateFileBlob,
      cleanupOrphanedTemporaryFiles,
      deleteFilePermanently,
    }),
    [
      listFiles,
      getFile,
      addFile,
      markFileAsTemporary,
      markAllFilesAsTemporary,
      makeFilePermanent,
      updateFileBlob,
      cleanupOrphanedTemporaryFiles,
      deleteFilePermanently,
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
