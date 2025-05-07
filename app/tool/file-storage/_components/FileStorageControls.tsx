// FILE: app/tool/file-storage/_components/FileStorageControls.tsx
'use client';

import React from 'react';
import Button from '@/app/tool/_components/form/Button'; // Import the new Button
import {
  PlusIcon,
  TrashIcon,
  ViewColumnsIcon, // Or Squares2X2Icon
  Bars3Icon, // Or ListBulletIcon
} from '@heroicons/react/20/solid'; // Using 20px solid icons for density

interface FileStorageControlsProps {
  isLoading: boolean;
  isDeleting: boolean;
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
  isDeleting,
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
      <div className="flex flex-wrap gap-3 items-center justify-between">
        {/* Add File Button */}
        <Button
          variant="accent2"
          onClick={onAddClick}
          disabled={isLoading}
          isLoading={isLoading && !isDeleting} // Show loading only if not bulk deleting
          loadingText="Processing..."
          iconLeft={<PlusIcon className="h-5 w-5" />}
        >
          Add File(s)
        </Button>
        {/* Conditional Bulk Actions */}
        {hasSelection && (
          <Button
            variant="danger"
            onClick={onDeleteSelectedClick}
            disabled={isLoading || isDeleting}
            isLoading={isDeleting}
            loadingText="Deleting..."
            iconLeft={<TrashIcon className="h-5 w-5" />}
          >
            Delete Selected ({selectedFileCount})
          </Button>
        )}
        <div className="flex-grow"></div> {/* Spacer */}
        {/* Clear All Button */}
        <Button
          variant="neutral"
          onClick={onClearAllClick}
          disabled={storedFileCount === 0 || isLoading || hasSelection}
          title={
            hasSelection
              ? 'Clear selection before using Clear All'
              : 'Delete all files from library'
          }
          iconLeft={<TrashIcon className="h-5 w-5" />}
        >
          Clear All ({storedFileCount})
        </Button>
      </div>

      {/* Row 2: View Options */}
      <div className="flex flex-wrap gap-3 items-center border-t border-gray-200 pt-3 mt-2">
        {/* Layout Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-md">
          <Button
            variant={currentLayout === 'list' ? 'primary' : 'neutral'}
            size="sm" // Use smaller buttons for toggles
            onClick={() => onLayoutChange('list')}
            disabled={isLoading} // Disable while loading, but not if it's the current layout
            title="List View"
            className={
              currentLayout === 'list'
                ? 'shadow' // Add shadow to active
                : 'hover:bg-gray-200' // Standard hover for inactive
            }
          >
            <Bars3Icon className="h-5 w-5" />
          </Button>
          <Button
            variant={currentLayout === 'grid' ? 'primary' : 'neutral'}
            size="sm"
            onClick={() => onLayoutChange('grid')}
            disabled={isLoading}
            title="Grid View"
            className={
              currentLayout === 'grid' ? 'shadow' : 'hover:bg-gray-200'
            }
          >
            <ViewColumnsIcon className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-grow"></div> {/* Spacer */}
        <span className="text-sm text-gray-500">
          {storedFileCount} item(s) in library
        </span>
      </div>
    </div>
  );
}
