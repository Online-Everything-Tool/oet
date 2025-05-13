// FILE: app/tool/image-storage/_components/ImageStorageClient.tsx
'use client';

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import Image from 'next/image';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import type { StoredFile } from '@/src/types/storage';
import StorageControls from '../../_components/file-storage/StorageControls';
import FileListView from '../../_components/file-storage/FileListView';
import FileGridView from '../../_components/file-storage/FileGridView';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import useToolState from '../../_hooks/useToolState'; // Import useToolState

import { PhotoIcon } from '@heroicons/react/20/solid';

interface ImageStorageClientProps {
  toolTitle: string;
  toolRoute: string;
}

// Define the state structure for persistence
interface PersistedImageStorageState {
  selectedImageIds: string[];
  layout: 'list' | 'grid';
  isFilterSelectedActive: boolean;
}

const DEFAULT_IMAGE_STORAGE_STATE: PersistedImageStorageState = {
  selectedImageIds: [],
  layout: 'grid', // Default to grid view
  isFilterSelectedActive: false,
};

export default function ImageStorageClient({
  toolTitle,
  toolRoute,
}: ImageStorageClientProps) {
  const [storedImages, setStoredImages] = useState<StoredFile[]>([]);
  const [clientIsLoading, setClientIsLoading] = useState<boolean>(true);
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

  const { listImages, deleteImage, clearAllImages, getImage } =
    useImageLibrary();

  // --- Integrate useToolState ---
  const {
    state: persistentState,
    setState: setPersistentState,
    isLoadingState: isLoadingToolState,
    errorLoadingState: toolStateError,
  } = useToolState<PersistedImageStorageState>(
    toolRoute,
    DEFAULT_IMAGE_STORAGE_STATE
  );

  // Derive state from persistentState
  const selectedImageIds = useMemo(
    () => new Set(persistentState.selectedImageIds),
    [persistentState.selectedImageIds]
  );
  const layout = persistentState.layout;
  const isFilterSelectedActive = persistentState.isFilterSelectedActive;
  // --- End useToolState Integration ---

  const revokeManagedUrls = useCallback(() => {
    managedUrlsRef.current.forEach(URL.revokeObjectURL);
    managedUrlsRef.current.clear();
  }, []);

  const updatePreviewUrlsForImagesClient = useCallback(
    (imagesToDisplay: StoredFile[]) => {
      setPreviewUrls((prevMap) => {
        const newMap = new Map<string, string>();
        let changed = false;
        imagesToDisplay.forEach((image) => {
          if (!image.id) return;
          const blob = image.thumbnailBlob || image.blob;
          if (blob && image.type?.startsWith('image/')) {
            if (managedUrlsRef.current.has(image.id)) {
              newMap.set(image.id, managedUrlsRef.current.get(image.id)!);
            } else {
              try {
                const url = URL.createObjectURL(blob);
                newMap.set(image.id, url);
                managedUrlsRef.current.set(image.id, url);
                changed = true;
              } catch (e) {
                console.error(
                  `[ImageStorage] Error creating URL for ${image.id}:`,
                  e
                );
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
    updatePreviewUrlsForImagesClient(storedImages);
    const currentIds = new Set(storedImages.map((f) => f.id));
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
  }, [storedImages, updatePreviewUrlsForImagesClient]);

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

  const loadAndDisplayImages = useCallback(async () => {
    setError(null);
    setClientIsLoading(true);
    try {
      const images = await listImages(100); // listImages only gets permanent images
      setStoredImages(images);
    } catch (err) {
      setError(
        `Failed to load stored images: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      setStoredImages([]);
    } finally {
      setClientIsLoading(false);
    }
  }, [listImages]);

  useEffect(() => {
    if (!isLoadingToolState) {
      // Only load after tool state is ready
      loadAndDisplayImages();
    }
  }, [loadAndDisplayImages, isLoadingToolState]);

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

      const imageFilesToAdd = filesFromModal.filter((f) =>
        f.type?.startsWith('image/')
      );
      if (imageFilesToAdd.length === 0) return;

      setError(null);
      setIsProcessing(true);

      await loadAndDisplayImages(); // Refresh the list

      if (filterToThese) {
        const addedImageIdsArray = imageFilesToAdd
          .map((f) => f.id)
          .filter((id): id is string => !!id);
        setPersistentState({
          selectedImageIds: addedImageIdsArray,
          isFilterSelectedActive: true,
        });
      }
      setIsProcessing(false);
    },
    [loadAndDisplayImages, setPersistentState]
  );

  const handleDeleteSingleImage = useCallback(
    async (imageId: string) => {
      if (isBulkDeleting || selectedImageIds.has(imageId)) return;
      setIsProcessing(true);
      setError(null);
      const imageToDelete = storedImages.find((f) => f.id === imageId);
      const imageName = imageToDelete?.name || `Image ID ${imageId}`;
      try {
        await deleteImage(imageId);
        setStoredImages((prev) => prev.filter((f) => f.id !== imageId));
        // Update persistent state
        setPersistentState((prev) => ({
          selectedImageIds: prev.selectedImageIds.filter(
            (id) => id !== imageId
          ),
        }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error deleting image.';
        setError(`Failed to delete "${imageName}". ${message}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [
      isBulkDeleting,
      selectedImageIds,
      storedImages,
      deleteImage,
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
      storedImages.length === 0 ||
      selectedImageIds.size > 0
    )
      return;
    setError(null);
    setIsProcessing(true);
    const count = storedImages.length;
    try {
      await clearAllImages(); // This should only clear images now
      loadAndDisplayImages();
      // Clear selectedImageIds in persistent state
      setPersistentState({
        selectedImageIds: [],
        isFilterSelectedActive: false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error clearing images.';
      setError(`Failed to clear all images. ${message}`);
      await loadAndDisplayImages();
    } finally {
      setIsProcessing(false);
    }
  }, [
    clientIsLoading,
    isLoadingToolState,
    isProcessing,
    isBulkDeleting,
    storedImages,
    selectedImageIds,
    clearAllImages,
    toolRoute,
    toolTitle,
    loadAndDisplayImages,
    setPersistentState, // Added
  ]);

  const handleDownloadFile = useCallback(
    async (imageId: string) => {
      setError(null);
      setItemFeedback(imageId, null);
      try {
        const image = await getImage(imageId);
        if (!image?.blob) throw new Error('Image data not found.');
        const url = URL.createObjectURL(image.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = image.name || `download-${imageId}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setItemFeedback(imageId, 'download', 'Downloaded!');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown download error.';
        setItemFeedback(imageId, 'error', `Download failed: ${message}`);
      }
    },
    [getImage, setItemFeedback]
  );

  const handleCopyFileContent = useCallback(
    async (imageId: string) => {
      setError(null);
      setItemFeedback(imageId, null);
      try {
        const image = await getImage(imageId);
        if (!image?.blob) throw new Error('Image data not found.');
        if (!image.type?.startsWith('image/'))
          throw new Error('Not an image file.');
        if (!navigator.clipboard?.write)
          throw new Error('Clipboard API (write) not available.');
        const clipboardItem = new ClipboardItem({
          [image.blob.type]: image.blob,
        });
        await navigator.clipboard.write([clipboardItem]);
        setItemFeedback(imageId, 'copy', 'Copied!');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown copy error.';
        setItemFeedback(imageId, 'error', `Copy failed: ${message}`);
      }
    },
    [getImage, setItemFeedback]
  );

  // Update to use setPersistentState
  const handleToggleSelection = useCallback(
    (imageId: string) => {
      setPersistentState((prev) => {
        const newSelected = new Set(prev.selectedImageIds);
        if (newSelected.has(imageId)) newSelected.delete(imageId);
        else newSelected.add(imageId);
        return { selectedImageIds: Array.from(newSelected) };
      });
    },
    [setPersistentState]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (
      selectedImageIds.size === 0 ||
      clientIsLoading || // Use clientIsLoading
      isLoadingToolState || // And isLoadingToolState
      isProcessing ||
      isBulkDeleting
    )
      return;
    const count = selectedImageIds.size;
    setIsBulkDeleting(true);
    setError(null);
    const idsToDelete = Array.from(selectedImageIds);
    const deletedNames: string[] = [];
    const errorsEncountered: string[] = [];
    for (const id of idsToDelete) {
      const image = storedImages.find((f) => f.id === id);
      const name = image?.name || `Image ID ${id}`;
      try {
        await deleteImage(id);
        deletedNames.push(name);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errorsEncountered.push(`Failed to delete "${name}": ${message}`);
      }
    }
    // Clear selectedImageIds in persistent state
    setPersistentState({ selectedImageIds: [], isFilterSelectedActive: false });

    if (errorsEncountered.length !== 0) {
      const errorMessage = `Errors occurred: ${errorsEncountered.join('; ')}`;
      setError(errorMessage);
    }
    await loadAndDisplayImages();
    setIsBulkDeleting(false);
  }, [
    selectedImageIds,
    clientIsLoading,
    isLoadingToolState,
    isProcessing,
    isBulkDeleting,
    storedImages,
    deleteImage,
    loadAndDisplayImages,
    toolRoute,
    toolTitle,
    setPersistentState, // Added
  ]);

  const renderPreview = useCallback(
    (file: StoredFile): React.ReactNode => {
      const objectUrl = previewUrls.get(file.id);
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          {objectUrl && file.type?.startsWith('image/') ? (
            <Image
              src={objectUrl}
              alt={file.name || 'Preview'}
              layout="fill"
              objectFit="contain"
              unoptimized
            />
          ) : (
            <PhotoIcon className="w-16 h-16 text-gray-300" />
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
    ? storedImages.filter((img) => selectedImageIds.has(img.id))
    : storedImages;
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
        itemCount={storedImages.length}
        currentLayout={layout}
        selectedItemCount={selectedImageIds.size}
        isFilterSelectedActive={isFilterSelectedActive}
        onToggleFilterSelected={handleToggleFilterSelected}
        onAddClick={handleAddClick}
        onClearAllClick={handleClearAll}
        onLayoutChange={handleLayoutChange} // Use the new handler
        onDeleteSelectedClick={handleDeleteSelected}
        itemNameSingular={'Image'}
        itemNamePlural={'Images'}
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
          storedImages.length === 0 && (
            <div className="flex items-center justify-center min-h-[200px]">
              {' '}
              <p className="text-center p-4 text-gray-500 italic animate-pulse">
                {' '}
                Loading stored images...{' '}
              </p>{' '}
            </div>
          )}
        {showEmpty && (
          <div className="flex items-center justify-center min-h-[200px]">
            <p className="text-center p-4 text-gray-500 italic">
              {isFilterSelectedActive
                ? 'No images currently selected.'
                : 'Your image library is empty. Add images using the button above.'}
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
              selectedIds={selectedImageIds}
              feedbackState={feedbackState}
              onCopy={handleCopyFileContent}
              onDownload={handleDownloadFile}
              onDelete={handleDeleteSingleImage}
              onToggleSelection={handleToggleSelection}
            />
          ) : (
            <FileGridView
              files={itemsToShow}
              isLoading={controlsAreLoading}
              isBulkDeleting={isBulkDeleting}
              selectedIds={selectedImageIds}
              feedbackState={feedbackState}
              onCopy={handleCopyFileContent}
              onDownload={handleDownloadFile}
              onDelete={handleDeleteSingleImage}
              renderPreview={renderPreview}
              onToggleSelection={handleToggleSelection}
            />
          ))}
      </div>

      <FileSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFilesSelected={handleModalFilesSelected}
        mode="addNewFiles"
        accept="image/*"
        selectionMode="multiple"
        libraryFilter={{ category: 'image' }}
        showFilterAfterUploadCheckbox={true}
      />
    </div>
  );
}
