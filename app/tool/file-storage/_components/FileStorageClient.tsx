// FILE: app/tool/file-storage/_components/FileStorageClient.tsx
'use client';

import React from 'react';
import GenericStorageClient from '../../_components/file-storage/GenericStorageClient';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import importedMetadata from '../metadata.json';
import type { ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { getFileIconClassName, isTextBasedMimeType } from '@/app/lib/utils';
import Image from 'next/image';

interface FileStorageClientProps {
  toolRoute: string;
}

export default function FileStorageClient({
  toolRoute,
}: FileStorageClientProps) {
  const fileLibraryHook = useFileLibrary;
  const metadata = importedMetadata as ToolMetadata;

  const defaultFilePreview = (
    file: StoredFile,
    previewUrl?: string
  ): React.ReactNode => {
    const fileType = file.type || '';
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {previewUrl && fileType.startsWith('image/') ? (
          <Image
            src={previewUrl}
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
  };

  return (
    <GenericStorageClient
      toolRoute={toolRoute}
      itemTypeSingular="File"
      itemTypePlural="Files"
      storageHook={fileLibraryHook}
      fileInputAccept="*/*"
      libraryFilterForModal={{}}
      defaultLayout="grid"
      metadata={metadata}
      renderGridItemPreview={defaultFilePreview}
      enableCopyContent={(file) => isTextBasedMimeType(file.type)}
    />
  );
}
