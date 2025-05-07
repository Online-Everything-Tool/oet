// FILE: app/tool/image-storage/_components/ImageStorageClient.tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useHistory, TriggerType } from '../../../context/HistoryContext';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import type { StoredFile } from '@/src/types/storage';
import StorageControls from '../../_components/storage/StorageControls';
import FileListView from '../../_components/storage/FileListView';
import FileGridView from '../../_components/storage/FileGridView';
import FileSelectionModal from '../../_components/FileSelectionModal';
import { getFileIconClassName } from '@/app/lib/utils';

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

  const { addHistoryEntry } = useHistory();
  const { listImages, addImage, deleteImage, clearAllImages, getImage } =
    useImageLibrary();

  const revokeManagedUrls = useCallback(() => {
    managedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    managedUrlsRef.current.clear();
  }, []);

  const updatePreviewUrlsForImagesClient = useCallback(
    // Renamed for clarity
    (imagesToDisplay: StoredFile[]) => {
      setPreviewUrls((prevPreviewMap) => {
        const newPreviewMap = new Map<string, string>();
        let mapChanged = false;

        imagesToDisplay.forEach((image) => {
          if (!image.id) return;
          // For images, always try to use the blob or thumbnailBlob for preview
          const blobToUse = image.thumbnailBlob || image.blob;

          if (blobToUse && image.type?.startsWith('image/')) {
            // Ensure it's an image
            if (managedUrlsRef.current.has(image.id)) {
              newPreviewMap.set(
                image.id,
                managedUrlsRef.current.get(image.id)!
              );
            } else {
              try {
                const url = URL.createObjectURL(blobToUse);
                newPreviewMap.set(image.id, url);
                managedUrlsRef.current.set(image.id, url);
                mapChanged = true;
              } catch (e) {
                console.error(
                  `[ImageStorageClient] Error creating Object URL for image ID ${image.id}:`,
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
    []
  );

  useEffect(() => {
    return () => {
      revokeManagedUrls();
    };
  }, [revokeManagedUrls]);

  useEffect(() => {
    updatePreviewUrlsForImagesClient(storedImages);

    const currentImageIds = new Set(storedImages.map((f) => f.id));
    const urlsToRevokeAndRemove = new Map<string, string>();

    managedUrlsRef.current.forEach((url, id) => {
      if (!currentImageIds.has(id)) {
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
        if (newPreviewMap.size !== prevPreviewUrls.size) return newPreviewMap;
        for (const [key, value] of newPreviewMap)
          if (prevPreviewUrls.get(key) !== value) return newPreviewMap;
        return prevPreviewUrls;
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
        setTimeout(() => {
          setFeedbackState((prev) =>
            prev[id]?.type === type ? { ...prev, [id]: null } : prev
          );
        }, 2000);
      }
    },
    []
  );

  const loadAndDisplayImages = useCallback(async () => {
    const limit = 100;
    setError(null);
    setIsLoading(true);
    try {
      const images = await listImages(limit);
      setStoredImages(images);
    } catch (err: unknown) {
      console.error('[ImageStorage] Error loading images:', err);
      setError('Failed to load stored images.');
      setStoredImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [listImages]);

  useEffect(() => {
    loadAndDisplayImages();
  }, [loadAndDisplayImages]);

  const persistTemporaryImage = useCallback(
    async (tempImageFile: StoredFile, trigger: TriggerType) => {
      let historyOutput: string | Record<string, unknown> = '';
      let status: 'success' | 'error' = 'success';
      let imageId: string | undefined = undefined;
      const inputDetails: Record<string, unknown> = {
        fileName: tempImageFile.name,
        fileType: tempImageFile.type,
        fileSize: tempImageFile.size,
        source: trigger,
      };

      if (!tempImageFile.type?.startsWith('image/')) {
        console.warn(
          `[ImageStorage] Attempted to persist non-image file: ${tempImageFile.name}`
        );
        return undefined;
      }

      try {
        imageId = await addImage(
          tempImageFile.blob,
          tempImageFile.name || `image-${Date.now()}`,
          tempImageFile.type
        );
        historyOutput = {
          message: `Image "${tempImageFile.name}" added successfully to library.`,
          imageId: imageId,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error saving image.';
        setError((prev) =>
          prev
            ? `${prev}; Failed to save "${tempImageFile.name}"`
            : `Failed to save "${tempImageFile.name}"`
        );
        status = 'error';
        historyOutput = `Error saving "${tempImageFile.name}": ${message}`;
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
      return imageId;
    },
    [addImage, addHistoryEntry, toolRoute, toolTitle]
  );

  const handleModalFilesSelected = useCallback(
    async (
      filesFromModal: StoredFile[],
      source: 'library' | 'upload',
      saveUploadedToLibrary?: boolean
    ) => {
      setIsModalOpen(false);
      if (!filesFromModal || filesFromModal.length === 0) return;

      setError(null);
      setIsProcessing(true);

      const imageFilesFromModal = filesFromModal.filter((f) =>
        f.type?.startsWith('image/')
      );

      if (imageFilesFromModal.length !== filesFromModal.length) {
        setError(
          `Some non-image files were filtered out by the modal or selection process.`
        );
      }

      if (imageFilesFromModal.length === 0) {
        setIsProcessing(false);
        return;
      }

      if (source === 'upload' && !saveUploadedToLibrary) {
        console.log(
          '[ImageStorageClient] Persisting temporary images from modal upload...'
        );
        const imagesToPersist = imageFilesFromModal.filter(
          (f) => f.isTemporary
        );
        if (imagesToPersist.length > 0) {
          const persistPromises = imagesToPersist.map((tempImage) =>
            persistTemporaryImage(tempImage, 'upload')
          );
          await Promise.all(persistPromises);
        }
      }
      await loadAndDisplayImages();
      setIsProcessing(false);
    },
    [persistTemporaryImage, loadAndDisplayImages]
  );

  const handleAddClick = () => {
    setIsModalOpen(true);
  };

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
      setStoredImages([]);
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
    // Stays generic, "File" is fine
    async (imageId: string) => {
      setError(null);
      setItemFeedback(imageId, null);
      try {
        const image = await getImage(imageId); // From useImageLibrary
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
    // Image-specific copy
    async (imageId: string) => {
      setError(null);
      setItemFeedback(imageId, null);
      try {
        const image = await getImage(imageId); // From useImageLibrary
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
      if (newSelected.has(imageId)) {
        newSelected.delete(imageId);
      } else {
        newSelected.add(imageId);
      }
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
      const image = storedImages.find((f) => f.id === id); // Use storedImages
      const name = image?.name || `Image ID ${id}`;
      try {
        await deleteImage(id); // From useImageLibrary
        deletedNames.push(name);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errorsEncountered.push(`Failed to delete "${name}": ${message}`);
      }
    }

    setStoredImages((prev) => prev.filter((f) => !idsToDelete.includes(f.id)));
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
      await loadAndDisplayImages();
    }

    addHistoryEntry({
      toolName: toolTitle,
      toolRoute: toolRoute,
      trigger: 'click',
      input: { deletedImageIds: idsToDelete, requestedCount: count },
      output: historyOutput,
      status: finalStatus,
      eventTimestamp: Date.now(),
    });

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

  const renderDefaultPreview = useCallback(
    (file: StoredFile): React.ReactNode => {
      const objectUrl = previewUrls.get(file.id);
      if (objectUrl && file.type?.startsWith('image/')) {
        return (
          <Image
            src={objectUrl}
            alt={file.name || 'Stored image preview'}
            width={120}
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
    !isLoading && storedImages.length === 0 && !isProcessing && !isBulkDeleting;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <StorageControls
        isLoading={controlsAreLoading}
        isDeleting={isBulkDeleting}
        itemCount={storedImages.length}
        currentLayout={layout}
        selectedItemCount={selectedImageIds.size}
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
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="border-2 border-dashed border-gray-300 rounded-md min-h-[200px] p-1">
        {isLoading &&
          !isProcessing &&
          !isBulkDeleting &&
          storedImages.length === 0 && (
            <div className="flex items-center justify-center min-h-[200px]">
              <p className="text-center p-4 text-gray-500 italic animate-pulse">
                Loading stored images...
              </p>
            </div>
          )}
        {showEmpty && (
          <div className="flex items-center justify-center min-h-[200px]">
            <p className="text-center p-4 text-gray-500 italic">
              Your image library is empty. Add images using the button above.
            </p>
          </div>
        )}
        {!isLoading &&
          !showEmpty &&
          (layout === 'list' ? (
            <FileListView
              files={storedImages}
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
              files={storedImages}
              isLoading={controlsAreLoading}
              isBulkDeleting={isBulkDeleting}
              selectedIds={selectedImageIds}
              feedbackState={feedbackState}
              onCopy={handleCopyFileContent}
              onDownload={handleDownloadFile}
              onDelete={handleDeleteSingleImage}
              renderPreview={renderDefaultPreview}
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
      />
    </div>
  );
}
