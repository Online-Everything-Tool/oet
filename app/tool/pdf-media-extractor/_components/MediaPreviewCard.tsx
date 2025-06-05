'use client';

import React from 'react';
import Image from 'next/image';
import Button from '@/app/tool/_components/form/Button';
import { ArrowDownTrayIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { formatBytesCompact, getFileIconClassName } from '@/app/lib/utils';

interface DisplayMediaFile {
  id: string; // StoredFile.id
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
}

interface MediaPreviewCardProps {
  mediaFile: DisplayMediaFile;
  onDownload: (fileId: string) => void;
  isLoading?: boolean;
}

export default function MediaPreviewCard({
  mediaFile,
  onDownload,
  isLoading,
}: MediaPreviewCardProps) {
  const isImage = mediaFile.type.startsWith('image/');

  return (
    <div className="border border-[rgb(var(--color-border-base))] rounded-md shadow-sm overflow-hidden bg-[rgb(var(--color-bg-component))] flex flex-col">
      <div className="aspect-square w-full flex items-center justify-center bg-[rgb(var(--color-bg-subtle))] p-1 relative">
        {isImage && mediaFile.previewUrl ? (
          <Image
            src={mediaFile.previewUrl}
            alt={`Preview of ${mediaFile.name}`}
            fill
            style={{ objectFit: 'contain' }}
            unoptimized
          />
        ) : (
           <span className="flex items-center justify-center h-full w-full text-3xl text-[rgb(var(--color-text-muted))]">
            <span
              aria-hidden="true"
              className={getFileIconClassName(mediaFile.name)}
              title={mediaFile.type || 'File'}
            ></span>
          </span>
        )}
      </div>
      <div className="p-2 text-sm">
        <p
          className="font-medium text-[rgb(var(--color-text-base))] truncate"
          title={mediaFile.name}
        >
          {mediaFile.name}
        </p>
        <p className="text-xs text-[rgb(var(--color-text-muted))]">
          {mediaFile.type} ({formatBytesCompact(mediaFile.size)})
        </p>
      </div>
      <div className="p-2 border-t border-[rgb(var(--color-border-base))]">
        <Button
          variant="secondary-outline"
          size="sm"
          fullWidth
          onClick={() => onDownload(mediaFile.id)}
          disabled={isLoading}
          iconLeft={<ArrowDownTrayIcon className="h-4 w-4" />}
        >
          Download
        </Button>
      </div>
    </div>
  );
}