// FILE: app/tool/_components/storage/FileGridView.tsx
'use client';

import React from 'react';
import type { StoredFile } from '@/src/types/storage';
import { formatBytes, isTextBasedMimeType } from '@/app/lib/utils';
import {
  CheckIcon,
  ClipboardDocumentCheckIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  TrashIcon,
} from '@heroicons/react/20/solid';
import Checkbox from '../form/Checkbox';
import type {
  FeedbackStateEntry,

} from './GenericStorageClient';

interface FileGridViewProps {
  files: StoredFile[];
  isLoading: boolean;
  isBulkDeleting: boolean;
  selectedIds: Set<string>;
  feedbackState: Record<string, FeedbackStateEntry | null>;
  renderPreview: (file: StoredFile) => React.ReactNode;
  onToggleSelection: (fileId: string) => void;

  renderItemActions?: (file: StoredFile) => React.ReactNode[];

  onCopy?: (fileId: string) => void;
  onDownload?: (fileId: string) => void;
  onDelete?: (fileId: string) => void;
  canCopyFile?: (file: StoredFile) => boolean;
}

export default function FileGridView({
  files,
  isLoading,
  isBulkDeleting,
  selectedIds,
  feedbackState,
  renderPreview,
  onToggleSelection,
  renderItemActions,
  onCopy,
  onDownload,
  onDelete,
  canCopyFile = (file: StoredFile) => isTextBasedMimeType(file.type),
}: FileGridViewProps) {
  const handleCardClick = (
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
    fileId: string
  ) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-overlay="actions"]') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.closest('button')
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

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    fileId: string
  ) => {
    if (e.key === ' ' || e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (
        target.closest('[data-overlay="actions"]') ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button')
      ) {
        return;
      }
      e.preventDefault();
      handleCardClick(e, fileId);
    }
  };

  const handleActionClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  const renderDefaultActions = (file: StoredFile) => {
    const currentFeedback = feedbackState[file.id];
    const itemIsText = canCopyFile(file);

    return (
      <>
        {onCopy && (
          <button
            onClick={(e) => {
              handleActionClick(e);
              onCopy(file.id);
            }}
            disabled={
              !itemIsText || isLoading || currentFeedback?.type === 'copy'
            }
            title={itemIsText ? 'Copy content' : 'Cannot copy'}
            className={`${!itemIsText && 'invisible'} p-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed ${currentFeedback?.type === 'copy' ? 'bg-green-100 text-green-700' : 'text-green-600 hover:bg-green-100'}`}
          >
            {currentFeedback?.type === 'copy' ? (
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-600" />
            ) : (
              <DocumentDuplicateIcon className="h-5 w-5 text-green-600 group-hover:text-green-700" />
            )}
          </button>
        )}
        {onDownload && (
          <button
            onClick={(e) => {
              handleActionClick(e);
              onDownload(file.id);
            }}
            disabled={isLoading || currentFeedback?.type === 'download'}
            title="Download file"
            className={`p-1 rounded-full disabled:opacity-50 ${currentFeedback?.type === 'download' ? 'bg-indigo-100 text-indigo-700' : 'text-indigo-600 hover:bg-indigo-100'}`}
          >
            {currentFeedback?.type === 'download' ? (
              <CheckIcon className="h-5 w-5 text-indigo-600" />
            ) : (
              <ArrowDownTrayIcon className="h-5 w-5 text-indigo-600 group-hover:text-indigo-700" />
            )}
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              handleActionClick(e);
              onDelete(file.id);
            }}
            disabled={isLoading || selectedIds.has(file.id)}
            title={
              selectedIds.has(file.id) ? "Use 'Delete' button" : 'Delete file'
            }
            className="p-1 text-red-600 rounded-full hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrashIcon className="h-5 w-5 text-red-600 group-hover:text-red-700" />
          </button>
        )}
      </>
    );
  };

  return (
    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 relative z-0">
      {files.map((file) => {
        const isSelected = selectedIds.has(file.id);
        const isProcessingItem = isLoading || (isBulkDeleting && isSelected);
        const currentFeedback = feedbackState[file.id];
        const showBulkDeleteOpacity = isBulkDeleting && isSelected;

        const actionsToRender = renderItemActions
          ? renderItemActions(file)
          : renderDefaultActions(file);

        return (
          <div
            key={file.id}
            className={`relative group border rounded-md shadow-sm overflow-hidden bg-white flex flex-col items-center gap-1 transition-all duration-150 ease-in-out ${
              isSelected
                ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-1'
                : 'hover:shadow-lg hover:border-gray-300 border-gray-200'
            } ${isProcessingItem ? 'opacity-70 cursor-default' : 'cursor-pointer'} ${showBulkDeleteOpacity ? 'opacity-60' : ''}`}
            onClick={(e) => handleCardClick(e, file.id)}
            onKeyDown={(e) => handleKeyDown(e, file.id)}
            tabIndex={0}
            aria-selected={isSelected}
            aria-label={`File: ${file.filename || 'Untitled'}`}
          >
            <div className="w-full px-2 pt-1 flex justify-between items-start">
              <div data-element="checkbox" className="self-start">
                <Checkbox
                  checked={isSelected}
                  onChange={() => onToggleSelection(file.id)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={isProcessingItem}
                  aria-label={`Select file ${file.filename}`}
                  inputClassName="cursor-pointer"
                  tabIndex={-1}
                />
              </div>
              <div
                data-overlay="actions"
                className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
              >
                {/* Iterate over actionsToRender if it's an array */}
                {Array.isArray(actionsToRender)
                  ? actionsToRender.map((action, index) => (
                      <React.Fragment key={index}>{action}</React.Fragment>
                    ))
                  : actionsToRender}
              </div>
            </div>

            <div className="w-full flex-grow flex items-center justify-center bg-gray-50 rounded pointer-events-none overflow-hidden min-h-[100px] px-1 pb-1">
              {renderPreview(file)}
            </div>

            <div className="w-full text-center mt-auto pb-1 px-1">
              <p
                className="text-xs text-center font-medium text-gray-800 truncate w-full pointer-events-none"
                title={file.filename}
              >
                {file.filename || 'Untitled'}
              </p>
              <p className="text-[10px] text-gray-500 pointer-events-none">
                {formatBytes(file.size)}
              </p>
            </div>

            {showBulkDeleteOpacity && !isProcessingItem && (
              <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center pointer-events-none z-10">
                <span className="text-red-500 text-xs animate-pulse">
                  Deleting...
                </span>
              </div>
            )}

            {currentFeedback?.type === 'error' && (
              <div
                className="absolute inset-x-0 bottom-0 p-1 bg-red-100 text-red-700 text-[10px] text-center truncate pointer-events-none z-20"
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
      {isLoading && !isBulkDeleting && (
        <p className="col-span-full text-center text-gray-500 italic py-16 animate-pulse">
          Loading...
        </p>
      )}
    </div>
  );
}
