import React from 'react';
import Image from 'next/image';
import type { StoredFile } from '@/src/types/storage';
import { formatBytes } from '@/app/lib/utils';
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import {
  ArrowDownTrayIcon,
  DocumentPlusIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

interface ExtractedMediaItemProps {
  file: StoredFile;
  previewUrl: string | null;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDownload: (file: StoredFile) => void;
  onSave: (file: StoredFile) => void;
  onDelete: (id: string) => void;
}

const ExtractedMediaItem: React.FC<ExtractedMediaItemProps> = React.memo(
  ({
    file,
    previewUrl,
    isSelected,
    onSelect,
    onDownload,
    onSave,
    onDelete,
  }) => {
    return (
      <div className="relative group border rounded-md shadow-sm overflow-hidden bg-white flex flex-col transition-all duration-150 ease-in-out">
        <div className="absolute top-2 left-2 z-10">
          <Checkbox
            checked={isSelected}
            onChange={() => onSelect(file.id)}
            aria-label={`Select ${file.filename}`}
            className="bg-white/70 backdrop-blur-sm rounded-full p-1"
          />
        </div>
        <div className="aspect-video w-full flex items-center justify-center bg-[rgb(var(--color-bg-subtle))] overflow-hidden">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt={file.filename}
              width={300}
              height={169}
              className="max-w-full max-h-full object-contain pointer-events-none"
              unoptimized
            />
          ) : (
            <div className="text-sm text-[rgb(var(--color-text-muted))]">
              Loading...
            </div>
          )}
        </div>
        <div className="p-3 border-t border-[rgb(var(--color-border-base))] flex-grow flex flex-col">
          <p
            className="text-xs font-medium text-[rgb(var(--color-text-emphasis))] truncate"
            title={file.filename}
          >
            {file.filename}
          </p>
          <p className="text-[10px] text-[rgb(var(--color-text-muted))]">
            {formatBytes(file.size)} - {file.type}
          </p>
        </div>
        <div className="p-2 bg-[rgb(var(--color-bg-subtle))] border-t border-[rgb(var(--color-border-base))] flex justify-end items-center gap-1.5">
          <Button
            variant="danger-outline"
            size="sm"
            onClick={() => onDelete(file.id)}
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="primary-outline"
            size="sm"
            onClick={() => onSave(file)}
            title="Save to Library"
            disabled={!file.isTemporary}
          >
            {file.isTemporary ? (
              <DocumentPlusIcon className="h-4 w-4" />
            ) : (
              <CheckIcon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="secondary-outline"
            size="sm"
            onClick={() => onDownload(file)}
            title="Download"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }
);

ExtractedMediaItem.displayName = 'ExtractedMediaItem';

export default ExtractedMediaItem;
