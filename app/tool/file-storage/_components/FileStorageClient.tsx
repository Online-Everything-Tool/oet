// FILE: app/tool/file-storage/_components/FileStorageClient.tsx
'use client';

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import Image from 'next/image';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';
import StorageControls from '../../_components/file-storage/StorageControls';
import FileListView from '../../_components/file-storage/FileListView';
import FileGridView from '../../_components/file-storage/FileGridView';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import { getFileIconClassName, isTextBasedMimeType } from '@/app/lib/utils';
import useToolState from '../../_hooks/useToolState'; // Import useToolState

interface FileStorageClientProps {
  toolTitle: string;
  toolRoute: string;
}

// Define the state structure for persistence
interface PersistedFileStorageState {
  selectedFileIds: string[];
  layout: 'list' | 'grid';
  isFilterSelectedActive: boolean;
}

const DEFAULT_FILE_STORAGE_STATE: PersistedFileStorageState = {
  selectedFileIds: [],
  layout: 'grid', // Default to grid view
  isFilterSelectedActive: false,
};

export default function FileStorageClient({
  toolTitle,
  toolRoute,
}: FileStorageClientProps) {
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [clientIsLoading, setClientIsLoading] = useState<boolean>(true); // Renamed from isLoading to avoid conflict
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [feedbackState, setFeedbackState] = useState<
    Record<
      string,
      { type: 'copy' | 'download' | 'error'; message: string } | null
    >
  >({});
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(
    new Map()
  );
  const managedUrlsRef = useRef<Map<string, string>>(new Map());
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const { listFiles, deleteFile, clearAllFiles, getFile } = useFileLibrary();

  // --- Integrate useToolState ---
  const {
    state: persistentState,
    setState: setPersistentState,
    isLoadingState: isLoadingToolState,
    errorLoadingState: toolStateError,
    // clearState: clearToolSavedState, // We can use this if needed
    // isPersistent, // Can be used to show persistence status or allow toggling
    // togglePersistence,
  } = useToolState<PersistedFileStorageState>(
    toolRoute,
    DEFAULT_FILE_STORAGE_STATE
  );

  // Derive state from persistentState
  const selectedFileIds = useMemo(
    () => new Set(persistentState.selectedFileIds),
    [persistentState.selectedFileIds]
  );
  const layout = persistentState.layout;
  const isFilterSelectedActive = persistentState.isFilterSelectedActive;

  // --- End useToolState Integration ---

  const revokeManagedUrls = useCallback(() => {
    managedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    managedUrlsRef.current.clear();
  }, []);

  const updatePreviewUrlsForFilesClient = useCallback(
    (filesToDisplay: StoredFile[]) => {
      setPreviewUrls((prevMap) => {
        const newMap = new Map<string, string>();
        let changed = false;
        filesToDisplay.forEach((file) => {
          if (!file.id) return;
          const blob =
            file.thumbnailBlob ||
            (file.type?.startsWith('image/') ? file.blob : null);
          if (blob) {
            if (managedUrlsRef.current.has(file.id)) {
              newMap.set(file.id, managedUrlsRef.current.get(file.id)!);
            } else {
              try {
                const url = URL.createObjectURL(blob);
                newMap.set(file.id, url);
                managedUrlsRef.current.set(file.id, url);
                changed = true;
              } catch (e) {
                console.error(`Error creating URL for ${file.id}:`, e);
              }
            }
          }
        });
        if (prevMap.size !== newMap.size) changed = true;
        else {
          for (const [k, v] of newMap)
            if (prevMap.get(k) !== v) {
              changed = true;
              break;
            }
          if (!changed)
            for (const k of prevMap.keys())
              if (!newMap.has(k)) {
                changed = true;
                break;
              }
        }
        return changed ? newMap : prevMap;
      });
    },
    []
  );

  useEffect(() => {
    return () => {
      revokeManagedUrls();
    };
  }, [revokeManagedUrls]);

  useEffect(() => {
    updatePreviewUrlsForFilesClient(storedFiles);
    const currentIds = new Set(storedFiles.map((f) => f.id));
    const toRevoke = new Map<string, string>();
    managedUrlsRef.current.forEach((url, id) => {
      if (!currentIds.has(id)) toRevoke.set(id, url);
    });
    if (toRevoke.size > 0) {
      setPreviewUrls((prev) => {
        const newMap = new Map(prev);
        toRevoke.forEach((url, id) => {
          URL.revokeObjectURL(url);
          managedUrlsRef.current.delete(id);
          newMap.delete(id);
        });
        return newMap;
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
        setTimeout(
          () =>
            setFeedbackState((prev) =>
              prev[id]?.type === type ? { ...prev, [id]: null } : prev
            ),
          2000
        );
      }
    },
    []
  );

  const loadAndDisplayFiles = useCallback(async () => {
    setError(null);
    setClientIsLoading(true);
    try {
      const files = await listFiles(500, false); // Only load permanent files
      setStoredFiles(files);
    } catch (err) {
      setError(
        `Failed to load stored files: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      setStoredFiles([]);
    } finally {
      setClientIsLoading(false);
    }
  }, [listFiles]);

  useEffect(() => {
    if (!isLoadingToolState) {
      // Only load files after tool state is loaded
      loadAndDisplayFiles();
    }
  }, [loadAndDisplayFiles, isLoadingToolState]);

  const handleAddClick = () => {
    setIsModalOpen(true);
  };

  // Update setPersistentState for layout and filter toggle
  const handleLayoutChange = useCallback(
    (newLayout: 'list' | 'grid') => {
      setPersistentState({ layout: newLayout });
    },
    [setPersistentState]
  );

  const handleToggleFilterSelected = useCallback(() => {
    setPersistentState((prev) => ({
      isFilterSelectedActive: !prev.isFilterSelectedActive,
    }));
  }, [setPersistentState]);

  const handleModalFilesSelected = useCallback(
    async (
      filesFromModal: StoredFile[],
      _source: 'library' | 'upload',
      filterToThese?: boolean
    ) => {
      setIsModalOpen(false);
      if (!filesFromModal || filesFromModal.length === 0) return;

      setError(null);
      setIsProcessing(true);

      await loadAndDisplayFiles();

      const addedFileIdsArray = filesFromModal
        .map((f) => f.id)
        .filter((id): id is string => !!id);

      if (filterToThese) {
        setPersistentState({
          selectedFileIds: addedFileIdsArray,
          isFilterSelectedActive: true,
        });
        console.log('[FileStorageClient] Filtering view to newly added files.');
      } else {
        // Optionally clear selection or keep existing if not filtering to new
        // setPersistentState({ selectedFileIds: [], isFilterSelectedActive: false });
      }
      setIsProcessing(false);
    },
    [loadAndDisplayFiles, setPersistentState]
  );

  const handleDeleteSingleFile = useCallback(
    async (fileId: string) => {
      if (isBulkDeleting || selectedFileIds.has(fileId)) return;
      setIsProcessing(true);
      setError(null);
      const fileToDelete = storedFiles.find((f) => f.id === fileId);
      const fileName = fileToDelete?.name || `File ID ${fileId}`;
      try {
        await deleteFile(fileId);
        setStoredFiles((prev) => prev.filter((f) => f.id !== fileId));
        // Update persistent state for selectedFileIds
        setPersistentState((prev) => ({
          selectedFileIds: prev.selectedFileIds.filter((id) => id !== fileId),
        }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error deleting file.';
        setError(`Failed to delete "${fileName}". ${message}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [
      isBulkDeleting,
      selectedFileIds,
      storedFiles,
      deleteFile,
      toolRoute,
      toolTitle,
      setPersistentState, // Added
    ]
  );

  const handleClearAll = useCallback(async () => {
    if (
      clientIsLoading || // Use clientIsLoading
      isLoadingToolState || // And isLoadingToolState
      isProcessing ||
      isBulkDeleting ||
      storedFiles.length === 0 ||
      selectedFileIds.size > 0
    )
      return;
    setError(null);
    setIsProcessing(true);
    const count = storedFiles.length;
    try {
      await clearAllFiles(false); // false means only permanent files (non-temporary)
      loadAndDisplayFiles();
      // Clear selectedFileIds in persistent state
      setPersistentState({
        selectedFileIds: [],
        isFilterSelectedActive: false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error clearing files.';
      setError(`Failed to clear permanent files. ${message}`);
      await loadAndDisplayFiles();
    } finally {
      setIsProcessing(false);
    }
  }, [
    clientIsLoading,
    isLoadingToolState,
    isProcessing,
    isBulkDeleting,
    storedFiles,
    selectedFileIds,
    clearAllFiles,
    toolRoute,
    toolTitle,
    loadAndDisplayFiles,
    setPersistentState, // Added
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

  // Update to use setPersistentState for selectedFileIds
  const handleToggleSelection = useCallback(
    (fileId: string) => {
      setPersistentState((prev) => {
        const newSelected = new Set(prev.selectedFileIds);
        if (newSelected.has(fileId)) newSelected.delete(fileId);
        else newSelected.add(fileId);
        return { selectedFileIds: Array.from(newSelected) };
      });
    },
    [setPersistentState]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (
      selectedFileIds.size === 0 ||
      clientIsLoading || // Use clientIsLoading
      isLoadingToolState || // And isLoadingToolState
      isProcessing ||
      isBulkDeleting
    )
      return;
    const count = selectedFileIds.size;
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
    // Clear selectedFileIds in persistent state
    setPersistentState({ selectedFileIds: [], isFilterSelectedActive: false });

    if (errorsEncountered.length !== 0) {
      const errorMessage = `Errors occurred: ${errorsEncountered.join('; ')}`;
      setError(errorMessage);
    }
    await loadAndDisplayFiles();
    setIsBulkDeleting(false);
  }, [
    selectedFileIds,
    clientIsLoading,
    isLoadingToolState,
    isProcessing,
    isBulkDeleting,
    storedFiles,
    deleteFile,
    loadAndDisplayFiles,
    toolRoute,
    toolTitle,
    setPersistentState, // Added
  ]);

  const renderDefaultPreview = useCallback(
    (file: StoredFile): React.ReactNode => {
      const objectUrl = previewUrls.get(file.id);
      const fileType = file.type || '';
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          {objectUrl && fileType.startsWith('image/') ? (
            <Image
              src={objectUrl}
              alt={file.name || 'Preview'}
              layout="fill"
              objectFit="contain"
              unoptimized
            />
          ) : (
            <span className="flex items-center justify-center h-full w-full text-3xl">
              <span
                aria-hidden="true"
                className={getFileIconClassName(file.name)}
                title={file.type || 'File'}
              ></span>
            </span>
          )}
        </div>
      );
    },
    [previewUrls]
  );

  // Combine loading states
  const combinedClientAndViewLoading = clientIsLoading || isLoadingToolState;
  const controlsAreLoading =
    combinedClientAndViewLoading || isProcessing || isBulkDeleting;

  const itemsToShow = isFilterSelectedActive
    ? storedFiles.filter((file) => selectedFileIds.has(file.id))
    : storedFiles;
  const showEmpty =
    !combinedClientAndViewLoading &&
    itemsToShow.length === 0 &&
    !controlsAreLoading;

  const currentError = error || toolStateError;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <StorageControls
        isLoading={controlsAreLoading}
        isDeleting={isBulkDeleting}
        itemCount={storedFiles.length}
        currentLayout={layout}
        selectedItemCount={selectedFileIds.size}
        isFilterSelectedActive={isFilterSelectedActive}
        onToggleFilterSelected={handleToggleFilterSelected}
        onAddClick={handleAddClick}
        onClearAllClick={handleClearAll}
        onLayoutChange={handleLayoutChange} // Use the new handler
        onDeleteSelectedClick={handleDeleteSelected}
        itemNameSingular={'File'}
        itemNamePlural={'Files'}
      />
      {currentError && (
        <div
          role="alert"
          className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm"
        >
          {' '}
          <strong>Error:</strong> {currentError}{' '}
        </div>
      )}

      <div className="border-2 border-dashed border-gray-300 rounded-md min-h-[200px] p-1">
        {combinedClientAndViewLoading && // Use combined loading state
          !isProcessing &&
          !isBulkDeleting &&
          storedFiles.length === 0 && (
            <div className="flex items-center justify-center min-h-[200px]">
              {' '}
              <p className="text-center p-4 text-gray-500 italic animate-pulse">
                {' '}
                Loading stored files...{' '}
              </p>{' '}
            </div>
          )}
        {showEmpty && (
          <div className="flex items-center justify-center min-h-[200px]">
            <p className="text-center p-4 text-gray-500 italic">
              {isFilterSelectedActive
                ? 'No files currently selected.'
                : 'Your file library is empty. Add files using the button above.'}
            </p>
          </div>
        )}
        {!combinedClientAndViewLoading && // Use combined loading state
          !showEmpty &&
          (layout === 'list' ? (
            <FileListView
              files={itemsToShow}
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
              files={itemsToShow}
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
        onFilesSelected={handleModalFilesSelected}
        mode="addNewFiles" // Or "selectExistingOrUploadNew" if you want library tab
        accept="*/*" // Or be more specific e.g. "image/*,application/pdf"
        selectionMode="multiple" // Or "single"
        showFilterAfterUploadCheckbox={true}
        // libraryFilter={{ category: "image" }} // Example if you add library tab
      />
    </div>
  );
}
