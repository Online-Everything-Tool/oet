// FILE: app/tool/_components/storage/FileListView.tsx
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
import type { FeedbackStateEntry } from './GenericStorageClient';

interface FileListViewProps {
  files: StoredFile[];
  isLoading: boolean;
  isBulkDeleting: boolean;
  selectedIds: Set<string>;
  feedbackState: Record<string, FeedbackStateEntry | null>;
  onToggleSelection: (fileId: string) => void;

  renderItemActions?: (file: StoredFile) => React.ReactNode[];

  onCopy?: (fileId: string) => void;
  onDownload?: (fileId: string) => void;
  onDelete?: (fileId: string) => void;
  canCopyFile?: (file: StoredFile) => boolean;
}

export default function FileListView({
  files,
  isLoading,
  isBulkDeleting,
  selectedIds,
  feedbackState,
  onToggleSelection,
  renderItemActions,
  onCopy,
  onDownload,
  onDelete,
  canCopyFile = (file: StoredFile) => isTextBasedMimeType(file.type),
}: FileListViewProps) {
  const handleRowClick = (
    e: React.MouseEvent<HTMLTableRowElement>,
    fileId: string
  ) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-cell="actions"]') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.closest('button')
    ) {
      return;
    }
    if (
      target.closest('[data-cell="checkbox"]') ||
      target.tagName === 'INPUT'
    ) {
      return;
    }
    onToggleSelection(fileId);
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
            title={itemIsText ? 'Copy file content' : 'Cannot copy content'}
            className={`${!itemIsText && 'invisible'} p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed ${currentFeedback?.type === 'copy' ? 'bg-green-100 text-green-700' : 'text-green-600 hover:bg-green-100'}`}
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
            title="Download this file"
            className={`p-1 rounded disabled:opacity-50 ${currentFeedback?.type === 'download' ? 'bg-indigo-100 text-indigo-700' : 'text-indigo-600 hover:bg-indigo-100'}`}
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
              selectedIds.has(file.id)
                ? "Use 'Delete' button"
                : 'Delete this file'
            }
            className="p-1 text-red-600 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrashIcon className="h-5 w-5 text-red-600 group-hover:text-red-700" />
          </button>
        )}
      </>
    );
  };

  return (
    <div className="overflow-x-auto relative z-0 border border-gray-200 rounded-md">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="pl-4 pr-2 py-2 w-4">
              <span className="sr-only">Select</span>
            </th>
            <th
              scope="col"
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Name
            </th>
            <th
              scope="col"
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Type
            </th>
            <th
              scope="col"
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Size
            </th>
            <th
              scope="col"
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Added
            </th>
            <th
              scope="col"
              className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {files.map((file) => {
            const isSelected = selectedIds.has(file.id);
            const isProcessingItem =
              isLoading || (isBulkDeleting && isSelected);
            const currentFeedback = feedbackState[file.id];
            const showBulkDeleteOpacity = isBulkDeleting && isSelected;

            const actionsToRender = renderItemActions
              ? renderItemActions(file)
              : renderDefaultActions(file);

            return (
              <tr
                key={file.id}
                className={`relative transition-colors duration-100 ${
                  isSelected
                    ? 'bg-blue-50 hover:bg-blue-100'
                    : 'hover:bg-gray-50'
                } ${isProcessingItem ? 'cursor-default' : 'cursor-pointer'} ${showBulkDeleteOpacity ? 'opacity-50' : ''}`}
                onClick={(e) => handleRowClick(e, file.id)}
                aria-selected={isSelected}
              >
                <td
                  className="pl-4 pr-2 py-2 whitespace-nowrap"
                  data-cell="checkbox"
                >
                  <Checkbox
                    checked={isSelected}
                    onChange={() => onToggleSelection(file.id)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={isProcessingItem}
                    aria-label={`Select file ${file.filename}`}
                    inputClassName="cursor-pointer"
                  />
                </td>
                <td
                  className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-xs"
                  title={file.filename}
                >
                  {file.filename}
                </td>
                <td
                  className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs"
                  title={file.type}
                >
                  {file.type || 'N/A'}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {formatBytes(file.size)}
                </td>
                <td
                  className="px-4 py-2 whitespace-nowrap text-sm text-gray-500"
                  title={file.createdAt.toLocaleString()}
                >
                  {file.createdAt.toLocaleDateString()}
                </td>
                <td
                  className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium"
                  data-cell="actions"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Iterate over actionsToRender if it's an array */}
                    {Array.isArray(actionsToRender)
                      ? actionsToRender.map((action, index) => (
                          <React.Fragment key={index}>{action}</React.Fragment>
                        ))
                      : actionsToRender}
                  </div>
                </td>
                {currentFeedback?.type === 'error' && (
                  <tr
                    className="absolute inset-0 pointer-events-none"
                    aria-hidden="true"
                  >
                    <td colSpan={6}>
                      <div
                        className="absolute inset-x-0 bottom-0 p-1 bg-red-100 text-red-700 text-[10px] text-center truncate border-t border-red-200"
                        title={currentFeedback.message}
                      >
                        Error: {currentFeedback.message}
                      </div>
                    </td>
                  </tr>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {files.length === 0 && !isLoading && (
        <p className="text-center text-gray-500 italic py-8">No files found.</p>
      )}
      {isLoading && !isBulkDeleting && (
        <p className="text-center text-gray-500 italic py-8 animate-pulse">
          Loading...
        </p>
      )}
    </div>
  );
}
