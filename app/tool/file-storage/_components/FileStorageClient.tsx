// FILE: app/tool/file-storage/_components/FileStorageClient.tsx
'use client';

import React, {
  useState,
  useCallback,
  // ChangeEvent, // No longer needed here
  useRef,
  useEffect,
} from 'react';
import Image from 'next/image';
import { useHistory, TriggerType } from '../../../context/HistoryContext';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';
import FileStorageControls from './FileStorageControls';
import FileListView from '../../_components/storage/FileListView';
import FileGridView from '../../_components/storage/FileGridView';
import FileSelectionModal from '../../_components/FileSelectionModal'; // Import the modal
import { getFileIconClassName } from '@/app/lib/utils';

interface FileStorageClientProps {
  toolTitle: string;
  toolRoute: string;
}

const isTextBasedMimeType = (mimeType: string | undefined): boolean => {
  if (!mimeType) return false;
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/csv'
  );
};

export default function FileStorageClient({
  toolTitle,
  toolRoute,
}: FileStorageClientProps) {
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [feedbackState, setFeedbackState] = useState<
    Record<
      string,
      { type: 'copy' | 'download' | 'error'; message: string } | null
    >
  >({});
  const [layout, setLayout] = useState<'list' | 'grid'>('grid');
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(
    new Map()
  );
  const managedUrlsRef = useRef<Map<string, string>>(new Map());
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    new Set()
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const { addHistoryEntry } = useHistory();
  const { listFiles, addFile, deleteFile, clearAllFiles, getFile } =
    useFileLibrary();

  const revokeManagedUrls = useCallback(() => {
    managedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    managedUrlsRef.current.clear();
  }, []);

  const updatePreviewUrlsForFilesClient = useCallback(
    // Renamed to avoid conflict if FileSelectionModal is ever merged here
    (filesToDisplay: StoredFile[]) => {
      setPreviewUrls((prevPreviewMap) => {
        const newPreviewMap = new Map<string, string>();
        let mapChanged = false;

        filesToDisplay.forEach((file) => {
          if (!file.id) return;
          const blobToUse =
            file.thumbnailBlob ||
            (file.type?.startsWith('image/') ? file.blob : null);

          if (blobToUse) {
            if (managedUrlsRef.current.has(file.id)) {
              newPreviewMap.set(file.id, managedUrlsRef.current.get(file.id)!);
            } else {
              try {
                const url = URL.createObjectURL(blobToUse);
                newPreviewMap.set(file.id, url);
                managedUrlsRef.current.set(file.id, url);
                mapChanged = true;
              } catch (e) {
                console.error(
                  `[FileStorageClient] Error creating Object URL for file ID ${file.id}:`,
                  e
                );
              }
            }
          }
        });

        if (prevPreviewMap.size !== newPreviewMap.size) {
          mapChanged = true;
        } else {
          for (const [key, value] of newPreviewMap) {
            if (prevPreviewMap.get(key) !== value) {
              mapChanged = true;
              break;
            }
          }
          // Also check if any keys from prev map are missing in new map
          for (const key of prevPreviewMap.keys()) {
            if (!newPreviewMap.has(key)) {
              mapChanged = true;
              break;
            }
          }
        }
        return mapChanged ? newPreviewMap : prevPreviewMap;
      });
    },
    [] // setPreviewUrls is stable
  );

  useEffect(() => {
    return () => {
      revokeManagedUrls();
    };
  }, [revokeManagedUrls]);

  useEffect(() => {
    updatePreviewUrlsForFilesClient(storedFiles);

    const currentFileIds = new Set(storedFiles.map((f) => f.id));
    const urlsToRevokeAndRemove = new Map<string, string>();

    managedUrlsRef.current.forEach((url, id) => {
      if (!currentFileIds.has(id)) {
        urlsToRevokeAndRemove.set(id, url);
      }
    });

    if (urlsToRevokeAndRemove.size > 0) {
      setPreviewUrls((prevPreviewUrls) => {
        const newPreviewMap = new Map(prevPreviewUrls);
        urlsToRevokeAndRemove.forEach((url, id) => {
          URL.revokeObjectURL(url);
          managedUrlsRef.current.delete(id);
          newPreviewMap.delete(id);
        });
        // Only return new map if it actually changed
        if (newPreviewMap.size !== prevPreviewUrls.size) return newPreviewMap;
        for (const [key, value] of newPreviewMap)
          if (prevPreviewUrls.get(key) !== value) return newPreviewMap;
        return prevPreviewUrls;
      });
    }
  }, [storedFiles, updatePreviewUrlsForFilesClient]);

  const setItemFeedback = useCallback(
    (
      id: string,
      type: 'copy' | 'download' | 'error' | null,
      message: string = ''
    ) => {
      setFeedbackState((prev) => ({
        ...prev,
        [id]: type ? { type, message } : null,
      }));
      if (type && type !== 'error') {
        setTimeout(() => {
          setFeedbackState((prev) =>
            prev[id]?.type === type ? { ...prev, [id]: null } : prev
          );
        }, 2000);
      }
    },
    []
  );

  const loadAndDisplayFiles = useCallback(async () => {
    const limit = 100;
    setError(null);
    setIsLoading(true);
    try {
      const files = await listFiles(limit, false);
      setStoredFiles(files);
      // updatePreviewUrlsForFilesClient will be called by the useEffect watching storedFiles
    } catch (err: unknown) {
      console.error('[FileStorage] Error loading files:', err);
      setError('Failed to load stored files.');
      setStoredFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [listFiles]);

  useEffect(() => {
    loadAndDisplayFiles();
  }, [loadAndDisplayFiles]);

  const persistTemporaryFile = useCallback(
    async (tempFile: StoredFile, trigger: TriggerType) => {
      let historyOutput: string | Record<string, unknown> = '';
      let status: 'success' | 'error' = 'success';
      let fileId: string | undefined = undefined;
      const inputDetails: Record<string, unknown> = {
        fileName: tempFile.name,
        fileType: tempFile.type,
        fileSize: tempFile.size,
        source: trigger, // 'upload' if coming from modal's upload tab
      };

      try {
        fileId = await addFile(
          tempFile.blob,
          tempFile.name || `file-${Date.now()}`,
          tempFile.type,
          false
        );
        historyOutput = {
          message: `File "${tempFile.name}" added successfully to library.`,
          fileId: fileId,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error saving file.';
        setError((prev) =>
          prev
            ? `${prev}; Failed to save "${tempFile.name}"`
            : `Failed to save "${tempFile.name}"`
        );
        status = 'error';
        historyOutput = `Error saving "${tempFile.name}": ${message}`;
        inputDetails.error = message;
      } finally {
        addHistoryEntry({
          toolName: toolTitle,
          toolRoute: toolRoute,
          trigger: trigger,
          input: inputDetails,
          output: historyOutput,
          status: status,
          eventTimestamp: Date.now(),
        });
      }
      return fileId;
    },
    [addFile, addHistoryEntry, toolRoute, toolTitle]
  );

  const handleModalFilesSelected = useCallback(
    async (
      filesFromModal: StoredFile[],
      source: 'library' | 'upload',
      saveToLibraryPreference?: boolean // This comes from modal's own checkbox
    ) => {
      setIsModalOpen(false);
      if (!filesFromModal || filesFromModal.length === 0) return;

      setError(null);
      setIsProcessing(true);

      if (source === 'upload') {
        // If source is 'upload', filesFromModal contains StoredFile-like objects.
        // If saveToLibraryPreference was true, the modal already called addFile via its own context.
        // If saveToLibraryPreference was false, filesFromModal are temporary (isTemporary: true, blob is the File).
        // FileStorageClient *always* wants to persist these.
        const filesToPersist = filesFromModal.filter((f) => f.isTemporary);
        if (filesToPersist.length > 0) {
          const persistPromises = filesToPersist.map(
            (tempFile) => persistTemporaryFile(tempFile, 'upload') // 'upload' is the trigger type
          );
          await Promise.all(persistPromises);
        }
      }
      // If source === 'library', files are already in the library, nothing to do here for persistence.

      await loadAndDisplayFiles();
      setIsProcessing(false);
    },
    [persistTemporaryFile, loadAndDisplayFiles]
  );

  const handleAddClick = () => {
    setIsModalOpen(true);
  };

  const handleDeleteSingleFile = useCallback(
    async (fileId: string) => {
      if (isBulkDeleting || selectedFileIds.has(fileId)) return;
      setIsProcessing(true);
      setError(null);
      const fileToDelete = storedFiles.find((f) => f.id === fileId);
      const fileName = fileToDelete?.name || `File ID ${fileId}`;
      try {
        await deleteFile(fileId);
        // loadAndDisplayFiles will be called by the useEffect watching storedFiles if state changes
        // For a more immediate update if loadAndDisplayFiles is slow:
        setStoredFiles((prev) => prev.filter((f) => f.id !== fileId));
        setSelectedFileIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(fileId);
          return newSet;
        });
        addHistoryEntry({
          toolName: toolTitle,
          toolRoute: toolRoute,
          trigger: 'click',
          input: { deletedFileId: fileId, deletedFileName: fileName },
          output: { message: `Deleted "${fileName}"` },
          status: 'success',
          eventTimestamp: Date.now(),
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error deleting file.';
        setError(`Failed to delete "${fileName}". ${message}`);
        addHistoryEntry({
          toolName: toolTitle,
          toolRoute: toolRoute,
          trigger: 'click',
          input: { deletedFileId: fileId, error: message },
          output: `Error deleting "${fileName}": ${message}`,
          status: 'error',
          eventTimestamp: Date.now(),
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [
      isBulkDeleting,
      selectedFileIds,
      storedFiles, // Added storedFiles dependency
      deleteFile,
      // loadAndDisplayFiles, // loadAndDisplayFiles might be too slow for immediate UI feedback
      addHistoryEntry,
      toolRoute,
      toolTitle,
    ]
  );

  const handleClearAll = useCallback(async () => {
    if (
      isLoading ||
      isProcessing ||
      isBulkDeleting ||
      storedFiles.length === 0 ||
      selectedFileIds.size > 0
    )
      return;
    setError(null);
    setIsProcessing(true);
    const count = storedFiles.length;
    const result = confirm(
      `Are you sure you want to delete all ${count} file(s)?`
    );
    if (!result) {
      setIsProcessing(false);
      return;
    }
    try {
      await clearAllFiles(false);
      setStoredFiles([]); // Optimistic update
      setSelectedFileIds(new Set());
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: { clearAllCount: count },
        output: `Cleared all ${count} user files.`,
        status: 'success',
        eventTimestamp: Date.now(),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error clearing files.';
      setError(`Failed to clear all files. ${message}`);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: { clearAllCount: count, error: message },
        output: `Error clearing files: ${message}`,
        status: 'error',
        eventTimestamp: Date.now(),
      });
      await loadAndDisplayFiles(); // Re-fetch on error
    } finally {
      setIsProcessing(false);
    }
  }, [
    isLoading,
    isProcessing,
    isBulkDeleting,
    storedFiles,
    selectedFileIds,
    clearAllFiles,
    addHistoryEntry,
    toolRoute,
    toolTitle,
    loadAndDisplayFiles,
  ]);

  const handleDownloadFile = useCallback(
    async (fileId: string) => {
      setError(null);
      setItemFeedback(fileId, null);
      try {
        const file = await getFile(fileId);
        if (!file?.blob) throw new Error('File data not found.');
        const url = URL.createObjectURL(file.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name || `download-${fileId}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setItemFeedback(fileId, 'download', 'Downloaded!');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown download error.';
        setItemFeedback(fileId, 'error', `Download failed: ${message}`);
      }
    },
    [getFile, setItemFeedback]
  );

  const handleCopyFileContent = useCallback(
    async (fileId: string) => {
      setError(null);
      setItemFeedback(fileId, null);
      try {
        const file = await getFile(fileId);
        if (!file?.blob) throw new Error('File data not found.');
        if (!isTextBasedMimeType(file.type))
          throw new Error('Cannot copy content of this file type.');
        if (!navigator.clipboard?.writeText)
          throw new Error('Clipboard API (writeText) not available.');
        const textContent = await file.blob.text();
        await navigator.clipboard.writeText(textContent);
        setItemFeedback(fileId, 'copy', 'Copied!');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown copy error.';
        setItemFeedback(fileId, 'error', `Copy failed: ${message}`);
      }
    },
    [getFile, setItemFeedback]
  );

  const handleToggleSelection = useCallback((fileId: string) => {
    setSelectedFileIds((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(fileId)) {
        newSelected.delete(fileId);
      } else {
        newSelected.add(fileId);
      }
      return newSelected;
    });
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (
      selectedFileIds.size === 0 ||
      isLoading ||
      isProcessing ||
      isBulkDeleting
    )
      return;

    const count = selectedFileIds.size;
    if (!confirm(`Are you sure you want to delete ${count} selected file(s)?`))
      return;

    setIsBulkDeleting(true);
    setError(null);
    const idsToDelete = Array.from(selectedFileIds);
    const deletedNames: string[] = [];
    const errorsEncountered: string[] = [];

    for (const id of idsToDelete) {
      const file = storedFiles.find((f) => f.id === id);
      const name = file?.name || `File ID ${id}`;
      try {
        await deleteFile(id);
        deletedNames.push(name);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errorsEncountered.push(`Failed to delete "${name}": ${message}`);
      }
    }

    // Optimistically update UI before full reload if desired, then reload for consistency
    setStoredFiles((prev) => prev.filter((f) => !idsToDelete.includes(f.id)));
    setSelectedFileIds(new Set()); // Clear selection

    // Eventually consistent reload
    // await loadAndDisplayFiles(); // Can be slow, optimistic update helps UX

    let historyOutput: Record<string, unknown> | string = {};
    let finalStatus: 'success' | 'error' = 'success';

    if (errorsEncountered.length === 0) {
      historyOutput = {
        message: `Deleted ${count} selected file(s).`,
        deletedCount: count,
        deletedNames: deletedNames,
      };
    } else {
      finalStatus = 'error';
      const errorMessage = `Errors occurred: ${errorsEncountered.join('; ')}`;
      setError(errorMessage);
      historyOutput = {
        message: errorMessage,
        deletedCount: deletedNames.length,
        errorCount: errorsEncountered.length,
        errors: errorsEncountered,
      };
      await loadAndDisplayFiles(); // Force reload if there were errors to ensure UI consistency
    }

    addHistoryEntry({
      toolName: toolTitle,
      toolRoute: toolRoute,
      trigger: 'click',
      input: { deletedFileIds: idsToDelete, requestedCount: count },
      output: historyOutput,
      status: finalStatus,
      eventTimestamp: Date.now(),
    });

    setIsBulkDeleting(false);
  }, [
    selectedFileIds,
    isLoading,
    isProcessing,
    isBulkDeleting,
    storedFiles,
    deleteFile,
    loadAndDisplayFiles, // Keep loadAndDisplayFiles for error cases or eventual consistency
    addHistoryEntry,
    toolRoute,
    toolTitle,
  ]);

  const renderDefaultPreview = useCallback(
    (file: StoredFile): React.ReactNode => {
      const objectUrl = previewUrls.get(file.id);
      const fileType = file.type || '';

      if (objectUrl && fileType.startsWith('image/')) {
        return (
          <Image
            src={objectUrl}
            alt={file.name || 'Stored image preview'}
            width={120} // Adjust as needed for your preview container size
            height={120}
            className="max-w-full max-h-full object-contain pointer-events-none"
            unoptimized
          />
        );
      }

      const iconClassName = getFileIconClassName(file.name);

      return (
        <span className="flex items-center justify-center h-full w-full">
          <span
            aria-hidden="true"
            className={`${iconClassName}`}
            title={file.type || 'File'}
          ></span>
        </span>
      );
    },
    [previewUrls]
  );

  const controlsAreLoading = isLoading || isProcessing || isBulkDeleting;
  const showEmpty =
    !isLoading && storedFiles.length === 0 && !isProcessing && !isBulkDeleting;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <FileStorageControls
        isLoading={controlsAreLoading}
        isDeleting={isBulkDeleting}
        storedFileCount={storedFiles.length}
        currentLayout={layout}
        selectedFileCount={selectedFileIds.size}
        onAddClick={handleAddClick}
        onClearAllClick={handleClearAll}
        onLayoutChange={setLayout}
        onDeleteSelectedClick={handleDeleteSelected}
      />
      {error && (
        <div
          role="alert"
          className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm"
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="border-2 border-dashed border-gray-300 rounded-md min-h-[200px] p-1">
        {isLoading &&
          !isProcessing &&
          !isBulkDeleting &&
          storedFiles.length === 0 && (
            <div className="flex items-center justify-center min-h-[200px]">
              <p className="text-center p-4 text-gray-500 italic animate-pulse">
                Loading stored files...
              </p>
            </div>
          )}
        {showEmpty && (
          <div className="flex items-center justify-center min-h-[200px]">
            <p className="text-center p-4 text-gray-500 italic">
              Your file library is empty. Add files using the button above.
            </p>
          </div>
        )}
        {!isLoading &&
          !showEmpty &&
          (layout === 'list' ? (
            <FileListView
              files={storedFiles}
              isLoading={controlsAreLoading}
              isBulkDeleting={isBulkDeleting}
              selectedIds={selectedFileIds}
              feedbackState={feedbackState}
              onCopy={handleCopyFileContent}
              onDownload={handleDownloadFile}
              onDelete={handleDeleteSingleFile}
              onToggleSelection={handleToggleSelection}
            />
          ) : (
            <FileGridView
              files={storedFiles}
              isLoading={controlsAreLoading}
              isBulkDeleting={isBulkDeleting}
              selectedIds={selectedFileIds}
              feedbackState={feedbackState}
              onCopy={handleCopyFileContent}
              onDownload={handleDownloadFile}
              onDelete={handleDeleteSingleFile}
              renderPreview={renderDefaultPreview}
              onToggleSelection={handleToggleSelection}
            />
          ))}
      </div>

      <FileSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFilesSelected={handleModalFilesSelected} // This handler needs to understand the new onFilesSelected signature
        mode="addNewFiles" // Essential for FileStorageClient's "Add" functionality
        accept="*/*"
        selectionMode="multiple"
        // initialTab="upload" // Not strictly needed if mode is 'addNewFiles' as it forces upload
      />
    </div>
  );
}
