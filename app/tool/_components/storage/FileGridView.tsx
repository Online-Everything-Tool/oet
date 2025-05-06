// FILE: app/tool/_components/storage/FileGridView.tsx
'use client';

import React from 'react';
import type { StoredFile } from '@/src/types/storage';
import { formatBytes } from '@/app/lib/utils';

const isTextBasedMimeType = (mimeType: string | undefined): boolean => {
  if (!mimeType) return false;
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/csv'
  );
};

interface FileGridViewProps {
  files: StoredFile[];
  isLoading: boolean;
  isBulkDeleting: boolean;
  selectedIds: Set<string>;
  feedbackState: Record<
    string,
    { type: 'copy' | 'download' | 'error'; message: string } | null
  >;
  onCopy: (fileId: string) => void;
  onDownload: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onToggleSelection: (fileId: string) => void;
  renderPreview: (file: StoredFile) => React.ReactNode;
}

export default function FileGridView({
  files,
  isLoading,
  isBulkDeleting,
  selectedIds,
  feedbackState,
  onCopy,
  onDownload,
  onDelete,
  onToggleSelection,
  renderPreview,
}: FileGridViewProps) {
  const handleCardClick = (
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
    fileId: string
  ) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-overlay="actions"]') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A'
    ) {
      return;
    }
    if (
      target.closest('[data-element="checkbox"]') ||
      target.tagName === 'INPUT'
    ) {
      return;
    }
    onToggleSelection(fileId);
  };

  // Specific handler for keyboard activation
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    fileId: string
  ) => {
    // Trigger selection on Space or Enter
    if (e.key === ' ' || e.key === 'Enter') {
      // Prevent default behavior like scrolling page on space
      e.preventDefault();
      handleCardClick(e, fileId);
    }
  };

  const handleActionClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  return (
    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 relative z-0">
      {files.map((file) => {
        const isSelected = selectedIds.has(file.id);
        const isProcessing = isLoading;
        const currentFeedback = feedbackState[file.id];
        const isTextFile = isTextBasedMimeType(file.type);

        return (
          <div
            key={file.id}
            className={`relative group border rounded-md shadow-sm overflow-hidden bg-white flex flex-col items-center gap-1 transition-all duration-150 ease-in-out focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-1 ${
              isSelected
                ? 'border-blue-500 ring-2 ring-blue-400 ring-offset-0'
                : 'hover:shadow-md hover:border-gray-300 border-gray-200'
            } ${isProcessing ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
            onClick={(e) => handleCardClick(e, file.id)}
            onKeyDown={(e) => handleKeyDown(e, file.id)} // Use specific keyboard handler
            // role="button" // REMOVED role="button"
            tabIndex={0}
            aria-selected={isSelected} // Keep aria-selected for semantics, even if not strictly supported by default div role
            aria-label={`File: ${file.name || 'Untitled'}`}
          >
            <div className="flex flex-row w-full justify-between items-center px-2">
              <div data-element="checkbox" className="justify-self-start">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelection(file.id)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={isProcessing}
                  className={`h-4 w-4 rounded border-gray-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-opacity duration-150 ${
                    isSelected
                      ? 'opacity-100 text-blue-600 accent-blue-600'
                      : 'opacity-0 group-hover:opacity-100 text-gray-600 accent-gray-600'
                  }`}
                  aria-label={`Select file ${file.name}`}
                  tabIndex={-1}
                />
              </div>
              <div
                data-overlay="actions"
                className={`justify-self-end ${
                  isSelected
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                }`}
              >
                <button
                  onClick={(e) => {
                    handleActionClick(e);
                    onCopy(file.id);
                  }}
                  disabled={
                    !isTextFile ||
                    isProcessing ||
                    currentFeedback?.type === 'copy'
                  }
                  title={isTextFile ? 'Copy content' : 'Cannot copy'}
                  className={`p-1 rounded-full focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed ${currentFeedback?.type === 'copy' ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'text-green-600 hover:bg-green-100 focus:ring-green-400'}`}
                >
                  {currentFeedback?.type === 'copy' ? '✔️' : '📄'}
                </button>
                <button
                  onClick={(e) => {
                    handleActionClick(e);
                    onDownload(file.id);
                  }}
                  disabled={
                    isProcessing || currentFeedback?.type === 'download'
                  }
                  title="Download file"
                  className={`p-1 rounded-full focus:outline-none focus:ring-1 disabled:opacity-50 ${currentFeedback?.type === 'download' ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'text-indigo-600 hover:bg-indigo-100 focus:ring-indigo-400'}`}
                >
                  {currentFeedback?.type === 'download' ? '✔️' : '⬇️'}
                </button>
                <button
                  onClick={(e) => {
                    handleActionClick(e);
                    onDelete(file.id);
                  }}
                  disabled={isProcessing || isSelected}
                  title={
                    isSelected ? "Use 'Delete Selected' button" : 'Delete file'
                  }
                  className="p-1 text-red-600 rounded-full hover:bg-red-100 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ❌
                </button>
              </div>
            </div>

            <div className="w-full flex items-center justify-center bg-gray-50 rounded mb-1 pointer-events-none overflow-hidden">
              {renderPreview(file)}
            </div>

            {/* File Info */}
            <p
              className="text-xs text-center font-medium text-gray-800 truncate w-full px-1 pointer-events-none"
              title={file.name}
            >
              {file.name || 'Untitled'}
            </p>
            <p className="text-[10px] text-gray-500 pointer-events-none mb-1">
              {formatBytes(file.size)}
            </p>

            {/* Deleting Overlay */}
            {isBulkDeleting && isSelected && (
              <div className="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center pointer-events-none z-30">
                <span className="text-red-500 text-xs animate-pulse">
                  Deleting...
                </span>
              </div>
            )}

            {/* Error Feedback Bar */}
            {currentFeedback?.type === 'error' && (
              <div
                className="absolute inset-x-0 bottom-0 p-1 bg-red-100 text-red-700 text-[10px] text-center truncate pointer-events-none z-10"
                title={currentFeedback.message}
              >
                Error: {currentFeedback.message}
              </div>
            )}
          </div>
        );
      })}

      {files.length === 0 && !isLoading && (
        <p className="col-span-full text-center text-gray-500 italic py-16">
          No files found.
        </p>
      )}
      {isLoading && (
        <p className="col-span-full text-center text-gray-500 italic py-16 animate-pulse">
          Loading...
        </p>
      )}
    </div>
  );
}
