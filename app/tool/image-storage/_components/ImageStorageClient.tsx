// FILE: app/tool/image-storage/_components/ImageStorageClient.tsx
'use client';

import React, { useCallback } from 'react';
import GenericStorageClient, {
  StorageHookReturnType,
} from '../../_components/file-storage/GenericStorageClient';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import importedMetadata from '../metadata.json';
import type { ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import Image from 'next/image';
import { PhotoIcon } from '@heroicons/react/24/outline';

interface ImageStorageClientProps {
  toolRoute: string;
}

export default function ImageStorageClient({
  toolRoute,
}: ImageStorageClientProps) {
  const fileLibrary = useFileLibrary();
  const metadata = importedMetadata as ToolMetadata;

  const imageSpecificStorageHook = useCallback((): StorageHookReturnType => {
    return {
      ...fileLibrary,
      listFiles: async (limit?: number, includeTemporary?: boolean) => {
        const allFiles = await fileLibrary.listFiles(
          limit ? limit * 2 : undefined,
          includeTemporary
        );
        const imageFiles = allFiles.filter((f) => f.type?.startsWith('image/'));
        return limit ? imageFiles.slice(0, limit) : imageFiles;
      },
      markAllFilesAsTemporary: async () => {
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
      },
    };
  }, [fileLibrary]);

  const imagePreviewRenderer = (
    file: StoredFile,
    previewUrl?: string
  ): React.ReactNode => {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {previewUrl && file.type?.startsWith('image/') ? (
          <Image
            src={previewUrl}
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
  };

  return (
    <GenericStorageClient
      toolRoute={toolRoute}
      itemTypeSingular="Image"
      itemTypePlural="Images"
      storageHook={imageSpecificStorageHook}
      fileInputAccept="image/*"
      libraryFilterForModal={{ category: 'image' }}
      defaultLayout="grid"
      metadata={metadata}
      renderGridItemPreview={imagePreviewRenderer}
      enableCopyContent={() => false}
    />
  );
}
