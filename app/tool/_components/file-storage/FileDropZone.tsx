// FILE: app/tool/file-storage/_components/FileDropZone.tsx
'use client';

import React, { useState, useCallback, DragEvent } from 'react';

interface FileDropZoneProps {
  onFilesAdded: (files: File[]) => void;
  children: React.ReactNode;
  className?: string;
  isLoading: boolean;
}

export default function FileDropZone({
  onFilesAdded,
  children,
  className = '',
  isLoading,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isPasting, setIsPasting] = useState<boolean>(false);

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isLoading) setIsDragging(true);
    },
    [isLoading]
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      if (isLoading) return;

      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        onFilesAdded(Array.from(files));
      } else {
        console.warn('[FileDropZone] No files found in drop event.');
      }
    },
    [isLoading, onFilesAdded]
  );

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (isLoading) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      const fileList: File[] = [];
      let foundFile = false;
      setIsPasting(true);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const blob = item.getAsFile();
          if (blob) {
            foundFile = true;
            const file = new File(
              [blob],
              blob.name || `pasted-file-${Date.now()}`,
              { type: blob.type }
            );
            fileList.push(file);
          } else {
            console.warn(
              `[FileDropZone] item.getAsFile() returned null for item type ${item.type}.`
            );
          }
        }
      }

      if (foundFile) {
        onFilesAdded(fileList);
      } else {
        console.warn('[FileDropZone] No file data found in paste event.');
      }

      setTimeout(() => setIsPasting(false), 500);
    },
    [isLoading, onFilesAdded]
  );

  return (
    <div
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-md relative transition-colors duration-200 min-h-[200px] ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-blue-400'
      } ${isPasting ? 'border-blue-500 bg-blue-100' : ''} ${className}`}
      tabIndex={0}
      aria-label="File list and drop/paste zone"
    >
      {isDragging && (
        <div className="absolute inset-0 bg-blue-100 bg-opacity-50 flex items-center justify-center pointer-events-none z-10">
          <p className="text-blue-700 font-semibold text-lg">Drop Here</p>
        </div>
      )}

      {isPasting && !isLoading && (
        <div className="absolute inset-0 bg-blue-100 bg-opacity-50 flex items-center justify-center pointer-events-none z-10">
          <p className="text-blue-700 font-semibold text-lg animate-pulse">
            Processing Paste...
          </p>
        </div>
      )}

      {children}
    </div>
  );
}
