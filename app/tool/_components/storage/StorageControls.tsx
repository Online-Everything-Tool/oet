// FILE: app/tool/_components/storage/StorageControls.tsx
'use client';

import React from 'react';
import Button from '@/app/tool/_components/form/Button';
import {
  PlusIcon,
  TrashIcon,
  ViewColumnsIcon,
  Bars3Icon,
} from '@heroicons/react/20/solid';

interface StorageControlsProps {
  isLoading: boolean;
  isDeleting: boolean;
  itemCount: number;
  itemNameSingular: string;
  itemNamePlural: string;
  currentLayout: 'list' | 'grid';
  selectedItemCount: number;
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
  onAddClick,
  onClearAllClick,
  onLayoutChange,
  onDeleteSelectedClick,
}: StorageControlsProps) {
  const hasSelection = selectedItemCount > 0;

  return (
    <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Button
          variant="accent2"
          onClick={onAddClick}
          disabled={isLoading}
          isLoading={isLoading && !isDeleting}
          loadingText="Processing..."
          iconLeft={<PlusIcon className="h-5 w-5" />}
        >
          Add {itemNameSingular}(s)
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
            Delete Selected ({selectedItemCount})
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
          Clear All ({itemCount})
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center border-t border-gray-200 pt-3 mt-2">
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
        <div className="flex-grow"></div>
        <span className="text-sm text-gray-500">
          {itemCount} {itemCount === 1 ? itemNameSingular : itemNamePlural} in
          library
        </span>
      </div>
    </div>
  );
}
