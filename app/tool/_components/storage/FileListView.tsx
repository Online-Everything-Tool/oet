// FILE: app/tool/_components/storage/FileListView.tsx
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

interface FileListViewProps {
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
}

export default function FileListView({
  files,
  isLoading,
  isBulkDeleting,
  selectedIds,
  feedbackState,
  onCopy,
  onDownload,
  onDelete,
  onToggleSelection,
}: FileListViewProps) {
  const handleRowClick = (
    e: React.MouseEvent<HTMLTableRowElement>,
    fileId: string
  ) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-cell="actions"]') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A'
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
            // Combine isLoading and isBulkDeleting for general processing state
            const isProcessing = isLoading || isBulkDeleting;
            const currentFeedback = feedbackState[file.id];
            const isTextFile = isTextBasedMimeType(file.type);
            // Determine if this specific selected row should be dimmed during bulk delete
            const showBulkDeleteOpacity = isBulkDeleting && isSelected;

            return (
              <tr
                key={file.id}
                className={`relative transition-colors duration-100 ${
                  isSelected
                    ? 'bg-blue-50 hover:bg-blue-100'
                    : 'hover:bg-gray-50'
                } ${isProcessing ? 'cursor-default' : 'cursor-pointer'} ${showBulkDeleteOpacity ? 'opacity-50' : ''}`} // Apply opacity if selected during bulk delete
                onClick={(e) => handleRowClick(e, file.id)}
                aria-selected={isSelected}
              >
                {/* Checkbox Cell */}
                <td
                  className="pl-4 pr-2 py-2 whitespace-nowrap"
                  data-cell="checkbox"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelection(file.id)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={isProcessing} // Disable checkbox if any operation is running
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Select file ${file.name}`}
                  />
                </td>
                {/* Data Cells */}
                <td
                  className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-xs"
                  title={file.name}
                >
                  {file.name}
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
                {/* Actions Cell */}
                <td
                  className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium"
                  data-cell="actions"
                >
                  <div
                    className={`flex items-center justify-end gap-1.5 ${isSelected && 'invisible'}`}
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
                      title={
                        isTextFile ? 'Copy file content' : 'Cannot copy content'
                      }
                      className={`p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed ${currentFeedback?.type === 'copy' ? 'bg-green-100 text-green-700' : 'text-green-600 hover:bg-green-100'}`}
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
                      title="Download this file"
                      className={`p-1 rounded disabled:opacity-50 ${currentFeedback?.type === 'download' ? 'bg-indigo-100 text-indigo-700' : 'text-indigo-600 hover:bg-indigo-100'}`}
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
                        isSelected
                          ? "Use 'Delete Selected' button"
                          : 'Delete this file'
                      }
                      className="p-1 text-red-600 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ❌
                    </button>
                  </div>
                </td>
                {/* Error Feedback Overlay */}
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
      {isLoading &&
        !isBulkDeleting && ( // Show general loading only if not bulk deleting
          <p className="text-center text-gray-500 italic py-8 animate-pulse">
            Loading...
          </p>
        )}
      {/* Optional: Specific indicator during bulk delete? */}
      {/* {isBulkDeleting && ( <p className="text-center text-red-500 italic py-8 animate-pulse">Deleting selected items...</p> )} */}
    </div>
  );
}
