// FILE: app/tool/file-storage/_components/FileStorageControls.tsx
'use client';

import React from 'react';

interface FileStorageControlsProps {
  isLoading: boolean; // General loading/processing state
  isDeleting: boolean; // Specific state for bulk delete operation
  storedFileCount: number;
  currentLayout: 'list' | 'grid';
  selectedFileCount: number;
  onAddClick: () => void;
  onClearAllClick: () => void;
  onLayoutChange: (newLayout: 'list' | 'grid') => void;
  onDeleteSelectedClick: () => void;
}

export default function FileStorageControls({
  isLoading,
  isDeleting, // Receive specific bulk delete state
  storedFileCount,
  currentLayout,
  selectedFileCount,
  onAddClick,
  onClearAllClick,
  onLayoutChange,
  onDeleteSelectedClick,
}: FileStorageControlsProps) {
  const hasSelection = selectedFileCount > 0;

  return (
    <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
      {/* Row 1: Main Actions */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        {/* Add File Button */}
        <button
          type="button"
          onClick={onAddClick}
          disabled={isLoading} // Disable on any loading/processing
          className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-button-accent2-bg))] transition-colors duration-150 ease-in-out ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>➕</span> {isLoading ? 'Processing...' : 'Add File(s)'}
        </button>
        {/* Conditional Bulk Actions */}
        {hasSelection && (
          <button
            type="button"
            onClick={onDeleteSelectedClick}
            // Disable if general loading OR specific bulk delete is active
            disabled={isLoading || isDeleting}
            className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-danger-text))] bg-[rgb(var(--color-button-danger-bg))] hover:bg-[rgb(var(--color-button-danger-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>🗑️</span>{' '}
            {isDeleting
              ? 'Deleting...'
              : `Delete Selected (${selectedFileCount})`}
          </button>
        )}
        <div className="flex-grow"></div> {/* Spacer */}
        {/* Clear All Button */}
        <button
          type="button"
          onClick={onClearAllClick}
          // Disable if no files, loading/processing, or selection exists
          disabled={storedFileCount === 0 || isLoading || hasSelection}
          title={
            hasSelection
              ? 'Clear selection before using Clear All'
              : 'Delete all files from library'
          }
          className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>🗑️</span> Clear All ({storedFileCount})
        </button>
      </div>
      {/* Row 2: View Options */}
      <div className="flex flex-wrap gap-4 items-center border-t border-gray-200 pt-3 mt-2">
        {/* Layout Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-md">
          <button
            onClick={() => onLayoutChange('list')}
            disabled={currentLayout === 'list'}
            title="List View"
            className={`p-1.5 rounded disabled:opacity-100 disabled:cursor-default ${currentLayout === 'list' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {' '}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />{' '}
            </svg>
          </button>
          <button
            onClick={() => onLayoutChange('grid')}
            disabled={currentLayout === 'grid'}
            title="Grid View"
            className={`p-1.5 rounded disabled:opacity-100 disabled:cursor-default ${currentLayout === 'grid' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {' '}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />{' '}
            </svg>
          </button>
        </div>
        <div className="flex-grow"></div> {/* Spacer */}
        <span className="text-sm text-gray-500">
          {storedFileCount} item(s) in library
        </span>
      </div>
    </div>
  );
}
