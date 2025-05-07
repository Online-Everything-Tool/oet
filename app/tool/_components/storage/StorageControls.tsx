// FILE: app/tool/_components/storage/StorageControls.tsx
'use client';

import React from 'react';
import Button from '@/app/tool/_components/form/Button';
// Removed Checkbox import
import {
  PlusIcon,
  TrashIcon,
  ViewColumnsIcon,
  Bars3Icon,
  FunnelIcon, // Import FunnelIcon for filter toggle
} from '@heroicons/react/20/solid';

interface StorageControlsProps {
  isLoading: boolean;
  isDeleting: boolean;
  itemCount: number; // Count of permanent items
  itemNameSingular: string;
  itemNamePlural: string;
  currentLayout: 'list' | 'grid';
  selectedItemCount: number;
  // --- Filter Props ---
  isFilterSelectedActive: boolean;
  onToggleFilterSelected: () => void;
  // --- End Filter Props ---
  onAddClick: () => void;
  onClearAllClick: () => void;
  onLayoutChange: (newLayout: 'list' | 'grid') => void;
  onDeleteSelectedClick: () => void;
}

export default function StorageControls({
  isLoading,
  isDeleting,
  itemCount,
  itemNameSingular,
  itemNamePlural,
  currentLayout,
  selectedItemCount,
  // --- Filter Props ---
  isFilterSelectedActive,
  onToggleFilterSelected,
  // --- End Filter Props ---
  onAddClick,
  onClearAllClick,
  onLayoutChange,
  onDeleteSelectedClick,
}: StorageControlsProps) {
  const hasSelection = selectedItemCount > 0;

  return (
    <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
      {/* Top row: Add, Delete Selected, Clear All (unchanged) */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Button
          variant="accent2"
          onClick={onAddClick}
          disabled={isLoading}
          isLoading={isLoading && !isDeleting}
          loadingText="Processing..."
          iconLeft={<PlusIcon className="h-5 w-5" />}
        >
          {' '}
          Add {itemNameSingular}(s){' '}
        </Button>
        {hasSelection && (
          <Button
            variant="danger"
            onClick={onDeleteSelectedClick}
            disabled={isLoading || isDeleting}
            isLoading={isDeleting}
            loadingText="Deleting..."
            iconLeft={<TrashIcon className="h-5 w-5" />}
          >
            {' '}
            Delete Selected ({selectedItemCount}){' '}
          </Button>
        )}
        <div className="flex-grow"></div>
        <Button
          variant="neutral"
          onClick={onClearAllClick}
          disabled={itemCount === 0 || isLoading || hasSelection}
          title={
            hasSelection
              ? 'Clear selection before using Clear All'
              : `Delete all ${itemCount} ${itemCount === 1 ? itemNameSingular : itemNamePlural} from library`
          }
          iconLeft={<TrashIcon className="h-5 w-5" />}
        >
          {' '}
          Clear All ({itemCount}){' '}
        </Button>
      </div>

      {/* Bottom row: Layout, Filter Toggle, Count */}
      <div className="flex flex-wrap gap-3 items-center border-t border-gray-200 pt-3 mt-2">
        {/* Layout Toggles */}
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-md">
          <Button
            variant={currentLayout === 'list' ? 'primary' : 'neutral'}
            size="sm"
            onClick={() => onLayoutChange('list')}
            disabled={isLoading}
            title="List View"
            className={
              currentLayout === 'list' ? 'shadow' : 'hover:bg-gray-200'
            }
          >
            {' '}
            <Bars3Icon className="h-5 w-5" />{' '}
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
            {' '}
            <ViewColumnsIcon className="h-5 w-5" />{' '}
          </Button>
        </div>

        {/* --- Filter Selected Toggle Button --- */}
        <div className="border-l pl-3 ml-1">
          <Button
            variant={isFilterSelectedActive ? 'accent' : 'neutral'} // Use accent color when active
            size="sm"
            onClick={onToggleFilterSelected}
            disabled={isLoading || !hasSelection} // Disable if loading or nothing selected
            title={
              isFilterSelectedActive
                ? 'Show all files'
                : 'Show only selected files'
            }
            iconLeft={<FunnelIcon className="h-5 w-5" />}
            className={`${isFilterSelectedActive ? 'shadow' : 'hover:bg-gray-200'} ${!hasSelection && 'opacity-50 cursor-not-allowed'}`} // Dim if no selection
          >
            {isFilterSelectedActive
              ? `Filtered (${selectedItemCount})`
              : 'Filter Selected'}
          </Button>
        </div>
        {/* --- End Filter Toggle --- */}

        <div className="flex-grow"></div>
        <span className="text-sm text-gray-500">
          {/* Show total permanent count, indicate if filtered */}
          {itemCount} {itemCount === 1 ? itemNameSingular : itemNamePlural} in
          library
          {isFilterSelectedActive && ` (${selectedItemCount} selected shown)`}
        </span>
      </div>
    </div>
  );
}
