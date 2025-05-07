// FILE: app/tool/image-storage/_components/ImageStorageClient.tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useHistory } from '../../../context/HistoryContext';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import type { StoredFile } from '@/src/types/storage';
import StorageControls from '../../_components/storage/StorageControls';
import FileListView from '../../_components/storage/FileListView';
import FileGridView from '../../_components/storage/FileGridView';
import FileSelectionModal from '../../_components/FileSelectionModal';

import { PhotoIcon } from '@heroicons/react/20/solid';

interface ImageStorageClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function ImageStorageClient({
  toolTitle,
  toolRoute,
}: ImageStorageClientProps) {
  const [storedImages, setStoredImages] = useState<StoredFile[]>([]);
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
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(
    new Set()
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [isFilterSelectedActive, setIsFilterSelectedActive] =
    useState<boolean>(false);

  const { addHistoryEntry } = useHistory();
  const { listImages, deleteImage, clearAllImages, getImage } =
    useImageLibrary();

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
    setIsLoading(true);
    try {
      const images = await listImages(100);
      setStoredImages(images);
    } catch (err) {
      setError(
        `Failed to load stored files: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      setStoredImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [listImages]);

  useEffect(() => {
    loadAndDisplayImages();
  }, [loadAndDisplayImages]);

  const handleAddClick = () => {
    setIsModalOpen(true);
  };

  const handleToggleFilterSelected = useCallback(() => {
    setIsFilterSelectedActive((prev) => !prev);
  }, []);

  const handleModalFilesSelected = useCallback(
    async (
      filesFromModal: StoredFile[],
      _source: 'library' | 'upload',
      _saveUploadedToLibrary?: boolean,
      filterToThese?: boolean
    ) => {
      setIsModalOpen(false);

      const imageFilesToAdd = filesFromModal.filter((f) =>
        f.type?.startsWith('image/')
      );
      if (imageFilesToAdd.length === 0) return;

      setError(null);
      setIsProcessing(true);

      await loadAndDisplayImages();

      if (filterToThese) {
        const addedImageIds = new Set(
          imageFilesToAdd.map((f) => f.id).filter((id) => !!id)
        );
        const currentImageIdSet = new Set(storedImages.map((f) => f.id));
        const validAddedIds = new Set<string>();
        addedImageIds.forEach((id) => {
          if (currentImageIdSet.has(id)) validAddedIds.add(id);
        });
        setSelectedImageIds(validAddedIds);
        setIsFilterSelectedActive(true);
      } else {
        setSelectedImageIds(new Set());
        setIsFilterSelectedActive(false);
      }
      setIsProcessing(false);
    },
    [loadAndDisplayImages, storedImages]
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
        setSelectedImageIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(imageId);
          return newSet;
        });
        addHistoryEntry({
          toolName: toolTitle,
          toolRoute: toolRoute,
          trigger: 'click',
          input: { deletedImageId: imageId, deletedImageName: imageName },
          output: { message: `Deleted "${imageName}"` },
          outputFileIds: [],
          status: 'success',
          eventTimestamp: Date.now(),
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error deleting image.';
        setError(`Failed to delete "${imageName}". ${message}`);
        addHistoryEntry({
          toolName: toolTitle,
          toolRoute: toolRoute,
          trigger: 'click',
          input: { deletedImageId: imageId, error: message },
          output: `Error deleting "${imageName}": ${message}`,
          outputFileIds: [],
          status: 'error',
          eventTimestamp: Date.now(),
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [
      isBulkDeleting,
      selectedImageIds,
      storedImages,
      deleteImage,
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
      storedImages.length === 0 ||
      selectedImageIds.size > 0
    )
      return;
    setError(null);
    setIsProcessing(true);
    const count = storedImages.length;
    try {
      await clearAllImages();
      loadAndDisplayImages();
      setSelectedImageIds(new Set());
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: { clearAllCount: count },
        output: `Cleared all ${count} images.`,
        status: 'success',
        eventTimestamp: Date.now(),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error clearing images.';
      setError(`Failed to clear all images. ${message}`);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: { clearAllCount: count, error: message },
        output: `Error clearing images: ${message}`,
        status: 'error',
        eventTimestamp: Date.now(),
      });
      await loadAndDisplayImages();
    } finally {
      setIsProcessing(false);
    }
  }, [
    isLoading,
    isProcessing,
    isBulkDeleting,
    storedImages,
    selectedImageIds,
    clearAllImages,
    addHistoryEntry,
    toolRoute,
    toolTitle,
    loadAndDisplayImages,
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
  const handleToggleSelection = useCallback((imageId: string) => {
    setSelectedImageIds((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(imageId)) newSelected.delete(imageId);
      else newSelected.add(imageId);
      return newSelected;
    });
  }, []);
  const handleDeleteSelected = useCallback(async () => {
    if (
      selectedImageIds.size === 0 ||
      isLoading ||
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
    setSelectedImageIds(new Set());
    let historyOutput: Record<string, unknown> | string = {};
    let finalStatus: 'success' | 'error' = 'success';
    if (errorsEncountered.length === 0) {
      historyOutput = {
        message: `Deleted ${count} selected image(s).`,
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
    }
    addHistoryEntry({
      toolName: toolTitle,
      toolRoute: toolRoute,
      trigger: 'click',
      input: { deletedImageIds: idsToDelete, requestedCount: count },
      output: historyOutput,
      outputFileIds: [],
      status: finalStatus,
      eventTimestamp: Date.now(),
    });
    await loadAndDisplayImages();
    setIsBulkDeleting(false);
  }, [
    selectedImageIds,
    isLoading,
    isProcessing,
    isBulkDeleting,
    storedImages,
    deleteImage,
    loadAndDisplayImages,
    addHistoryEntry,
    toolRoute,
    toolTitle,
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

  const controlsAreLoading = isLoading || isProcessing || isBulkDeleting;

  const itemsToShow = isFilterSelectedActive
    ? storedImages.filter((img) => selectedImageIds.has(img.id))
    : storedImages;
  const showEmpty =
    !isLoading && itemsToShow.length === 0 && !controlsAreLoading;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      {/* Use StorageControls */}
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
        onLayoutChange={setLayout}
        onDeleteSelectedClick={handleDeleteSelected}
        itemNameSingular={'Image'}
        itemNamePlural={'Images'}
      />
      {error && (
        <div
          role="alert"
          className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm"
        >
          {' '}
          <strong>Error:</strong> {error}{' '}
        </div>
      )}

      <div className="border-2 border-dashed border-gray-300 rounded-md min-h-[200px] p-1">
        {isLoading &&
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
        {/* Pass itemsToShow */}
        {!isLoading &&
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

      {/* Use FileSelectionModal */}
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
