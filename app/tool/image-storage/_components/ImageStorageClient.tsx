// FILE: app/tool/image-storage/_components/ImageStorageClient.tsx
'use client';

import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import GenericStorageClient, {
  StorageHookReturnType,
  DefaultItemActionHandlers,
  FeedbackStateEntry,
  CustomBulkActionConfig,
} from '@/app/tool/_components/storage/GenericStorageClient';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import importedMetadata from '../metadata.json';
import type { ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import Image from 'next/image';
import {
  PhotoIcon,
  EyeIcon,
  PlayCircleIcon,
  ArrowDownTrayIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Button from '@/app/tool/_components/form/Button';
import ImagePreviewModal from './ImagePreviewModal';

interface ImageStorageClientProps {
  toolRoute: string;
}

export default function ImageStorageClient({
  toolRoute,
}: ImageStorageClientProps) {
  const fileLibrary = useFileLibrary();
  const metadata = importedMetadata as ToolMetadata;

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [imageToPreview, setImageToPreview] = useState<StoredFile | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const currentPreviewObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (currentPreviewObjectUrlRef.current) {
        URL.revokeObjectURL(currentPreviewObjectUrlRef.current);
        currentPreviewObjectUrlRef.current = null;
      }
    };
  }, []);

  const handleOpenPreviewModal = (file: StoredFile) => {
    if (currentPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(currentPreviewObjectUrlRef.current);
    }
    if (file.blob) {
      const newUrl = URL.createObjectURL(file.blob);
      currentPreviewObjectUrlRef.current = newUrl;
      setPreviewObjectUrl(newUrl);
    } else {
      console.warn(
        `[ImageStorageClient] Blob missing for file ${file.id} to preview.`
      );
      setPreviewObjectUrl(null);
    }
    setImageToPreview(file);
    setIsPreviewModalOpen(true);
  };

  const handleClosePreviewModal = () => {
    setIsPreviewModalOpen(false);
    setImageToPreview(null);
    if (currentPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(currentPreviewObjectUrlRef.current);
      currentPreviewObjectUrlRef.current = null;
    }
    setPreviewObjectUrl(null);
  };

  const specificListFiles = useCallback(
    async (limit?: number, includeTemporary?: boolean) => {
      const allFiles = await fileLibrary.listFiles(
        limit ? limit * 2 : undefined,
        includeTemporary
      );
      const imageFiles = allFiles.filter((f) => f.type?.startsWith('image/'));
      return limit ? imageFiles.slice(0, limit) : imageFiles;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fileLibrary.listFiles]
  );

  const specificMarkAllFilesAsTemporary = useCallback(async () => {
    const allPermanentImages = await fileLibrary
      .listFiles(undefined, false)
      .then((files) => files.filter((f) => f.type?.startsWith('image/')));

    if (allPermanentImages.length === 0)
      return { markedCount: 0, markedIds: [] };

    const imageIdsToMark = allPermanentImages.map((img) => img.id);
    let markedCount = 0;
    for (const id of imageIdsToMark) {
      const success = await fileLibrary.markFileAsTemporary(id);
      if (success) markedCount++;
    }
    return { markedCount, markedIds: imageIdsToMark };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileLibrary.listFiles, fileLibrary.markFileAsTemporary]);

  const imageStorageHookProvider = useCallback((): StorageHookReturnType => {
    return {
      ...fileLibrary,
      listFiles: specificListFiles,
      markAllFilesAsTemporary: specificMarkAllFilesAsTemporary,
    };
  }, [fileLibrary, specificListFiles, specificMarkAllFilesAsTemporary]);

  const imageGridPreviewRenderer = (
    file: StoredFile,
    previewUrl?: string
  ): React.ReactNode => {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {previewUrl && file.type?.startsWith('image/') ? (
          <Image
            src={previewUrl}
            alt={file.filename || 'Image thumbnail'}
            fill
            style={{ objectFit: 'contain' }}
            unoptimized
          />
        ) : (
          <PhotoIcon className="w-16 h-16 text-[rgb(var(--color-text-muted))]" />
        )}
      </div>
    );
  };

  const itemActionsRenderer = useCallback(
    (
      file: StoredFile,
      defaultActionHandlers: DefaultItemActionHandlers,
      isProcessingItem: boolean,
      _feedbackForItem: FeedbackStateEntry | null
    ): React.ReactNode[] => {
      const actions: React.ReactNode[] = [];

      actions.push(
        <Button
          key={`preview-${file.id}`}
          onClick={() => handleOpenPreviewModal(file)}
          disabled={isProcessingItem || !file.blob}
          title="Preview image"
          variant="neutral-outline"
          size="sm"
          className="!p-1"
        >
          <EyeIcon className="h-5 w-5" />
        </Button>
      );

      actions.push(
        <Button
          key={`download-${file.id}`}
          onClick={defaultActionHandlers.onDownload}
          disabled={isProcessingItem || !file.blob}
          title="Download image"
          variant="neutral-outline"
          size="sm"
          className="!p-1"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
        </Button>
      );

      actions.push(
        <Button
          key={`delete-${file.id}`}
          onClick={defaultActionHandlers.onDelete}
          disabled={isProcessingItem}
          title="Delete image"
          variant="danger-outline"
          size="sm"
          className="!p-1"
        >
          <TrashIcon className="h-5 w-5" />
        </Button>
      );

      return actions;
    },
    [handleOpenPreviewModal]
  );

  const imageCustomBulkActions = useMemo(
    (): CustomBulkActionConfig[] => [
      {
        key: 'slideshow',
        label: 'Slideshow',
        icon: <PlayCircleIcon className="h-5 w-5" />,
        onClick: (selectedItems: StoredFile[]) => {
          const itemsWithBlobs = selectedItems.filter((item) => !!item.blob);
          if (itemsWithBlobs.length < 2) {
            alert(
              'Please select at least two images with available content for a slideshow.'
            );
            return;
          }
          console.log(
            'Start slideshow with:',
            itemsWithBlobs.map((f) => f.filename)
          );
          alert(
            `Starting slideshow for ${itemsWithBlobs.length} images! (Feature WIP)`
          );
        },
        disabled: (selectedItems: StoredFile[]) =>
          selectedItems.filter((item) => !!item.blob).length < 2,
        buttonVariant: 'accent',
      },
    ],
    []
  );

  return (
    <>
      <GenericStorageClient
        toolRoute={toolRoute}
        itemTypeSingular="Image"
        itemTypePlural="Images"
        storageHook={imageStorageHookProvider}
        fileInputAccept="image/*"
        libraryFilterForModal={{ category: 'image' }}
        defaultLayout="grid"
        metadata={metadata}
        renderGridItemPreview={imageGridPreviewRenderer}
        enableCopyContent={() => false}
        renderItemActions={itemActionsRenderer}
        customBulkActions={imageCustomBulkActions}
      />
      <ImagePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={handleClosePreviewModal}
        imageUrl={previewObjectUrl}
        imageName={imageToPreview?.filename}
      />
    </>
  );
}
