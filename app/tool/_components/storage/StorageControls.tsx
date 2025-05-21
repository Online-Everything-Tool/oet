// FILE: app/tool/_components/storage/StorageControls.tsx
'use client';

import React from 'react';
import Button from '@/app/tool/_components/form/Button';
import SendToToolButton from '../shared/SendToToolButton';
import type { OutputConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';

import {
  PlusIcon,
  TrashIcon,
  ViewColumnsIcon,
  Bars3Icon,
  FunnelIcon,
} from '@heroicons/react/20/solid';

interface StorageControlsProps {
  isLoading: boolean;
  isDeleting: boolean;
  itemCount: number;
  itemNameSingular: string;
  itemNamePlural: string;
  currentLayout: 'list' | 'grid';

  isFilterSelectedActive: boolean;
  onToggleFilterSelected: () => void;

  onAddClick: () => void;
  onClearAllClick: () => void;
  onLayoutChange: (newLayout: 'list' | 'grid') => void;
  onDeleteSelectedClick: () => void;

  directiveName: string;
  outputConfig: OutputConfig;
  selectedStoredFilesForItde: StoredFile[];
}

export default function StorageControls({
  isLoading,
  isDeleting,
  itemCount,
  itemNameSingular,
  itemNamePlural,
  currentLayout,

  isFilterSelectedActive,
  onToggleFilterSelected,

  onAddClick,
  onClearAllClick,
  onLayoutChange,
  onDeleteSelectedClick,

  directiveName,
  outputConfig,
  selectedStoredFilesForItde,
}: StorageControlsProps) {
  const hasSelection = selectedStoredFilesForItde.length > 0;

  return (
    <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
      {/* Top row: Add, ITDE Send, Delete Selected, Clear All */}
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
          <SendToToolButton
            currentToolDirective={directiveName}
            currentToolOutputConfig={outputConfig}
            selectedOutputItems={selectedStoredFilesForItde}
            buttonText={`Send Selected (${selectedStoredFilesForItde.length})`}
            className={
              isLoading || isDeleting ? 'opacity-50 cursor-not-allowed' : ''
            }
          />
        )}

        {hasSelection && (
          <Button
            variant="danger"
            onClick={onDeleteSelectedClick}
            disabled={isLoading || isDeleting}
            isLoading={isDeleting}
            loadingText="Deleting..."
            iconLeft={<TrashIcon className="h-5 w-5" />}
          >
            Delete Selected ({selectedStoredFilesForItde.length})
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

      {/* Bottom row: Layout, Filter Toggle, Count */}
      <div className="flex flex-wrap gap-3 items-center border-t border-gray-200 pt-3 mt-2">
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-md">
          <Button
            variant={
              currentLayout === 'list' ? 'primary-outline' : 'neutral-outline'
            }
            size="sm"
            onClick={() => onLayoutChange('list')}
            disabled={isLoading}
            title="List View"
            className={
              currentLayout === 'list' ? 'shadow' : 'hover:bg-gray-200'
            }
          >
            <Bars3Icon className="h-4 w-4" />
          </Button>
          <Button
            variant={
              currentLayout === 'grid' ? 'primary-outline' : 'neutral-outline'
            }
            size="sm"
            onClick={() => onLayoutChange('grid')}
            disabled={isLoading}
            title="Grid View"
            className={
              currentLayout === 'grid' ? 'shadow' : 'hover:bg-gray-200'
            }
          >
            <ViewColumnsIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="border-l pl-3 ml-1">
          <Button
            variant={
              isFilterSelectedActive ? 'accent-outline' : 'neutral-outline'
            }
            size="sm"
            onClick={onToggleFilterSelected}
            disabled={isLoading || !hasSelection}
            title={
              isFilterSelectedActive
                ? 'Show all files'
                : 'Show only selected files'
            }
            iconLeft={<FunnelIcon className="h-4 w-4" />}
            className={`${isFilterSelectedActive ? 'shadow' : 'hover:bg-gray-200'} ${!hasSelection && 'opacity-50 cursor-not-allowed'}`}
          >
            {isFilterSelectedActive
              ? `Filtered (${selectedStoredFilesForItde.length})`
              : 'Filter Selected'}
          </Button>
        </div>

        <div className="flex-grow"></div>
        <span className="text-sm text-gray-500">
          {itemCount} {itemCount === 1 ? itemNameSingular : itemNamePlural} in
          library
          {isFilterSelectedActive &&
            ` (${selectedStoredFilesForItde.length} selected shown)`}
        </span>
      </div>
    </div>
  );
}
