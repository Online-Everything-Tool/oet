// FILE: app/tool/_components/storage/StorageControls.tsx
'use client';

import React from 'react';
import Button from '@/app/tool/_components/form/Button';
import SendToToolButton from '../shared/SendToToolButton';
import type { OutputConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import type {
  CustomPrimaryCreateConfig,
  CustomBulkActionConfig,
} from './GenericStorageClient';

import {
  PlusIcon,
  TrashIcon,
  ViewColumnsIcon,
  Bars3Icon,
  FunnelIcon,
  ArrowUpOnSquareIcon,
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

  onAddViaUploadClick: () => void;
  onClearAllClick: () => void;
  onLayoutChange: (newLayout: 'list' | 'grid') => void;
  onDeleteSelectedClick: () => void;

  directiveName: string;
  outputConfig: OutputConfig;
  selectedStoredFilesForItde: StoredFile[];

  customPrimaryCreateConfig?: CustomPrimaryCreateConfig | null;
  customFilterControls?: React.ReactNode;
  customBulkActions?: CustomBulkActionConfig[];
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
  onAddViaUploadClick,
  onClearAllClick,
  onLayoutChange,
  onDeleteSelectedClick,
  directiveName,
  outputConfig,
  selectedStoredFilesForItde,
  customPrimaryCreateConfig,
  customFilterControls,
  customBulkActions = [],
}: StorageControlsProps) {
  const hasSelection = selectedStoredFilesForItde.length > 0;

  const primaryAddButton = customPrimaryCreateConfig ? (
    <Button
      variant={customPrimaryCreateConfig.buttonVariant || 'accent2'}
      onClick={customPrimaryCreateConfig.onClick}
      disabled={isLoading}
      isLoading={isLoading && !isDeleting}
      loadingText="Processing..."
      iconLeft={
        customPrimaryCreateConfig.icon || <PlusIcon className="h-5 w-5" />
      }
    >
      {customPrimaryCreateConfig.label}
    </Button>
  ) : (
    <Button
      variant="accent2"
      onClick={onAddViaUploadClick}
      disabled={isLoading}
      isLoading={isLoading && !isDeleting}
      loadingText="Processing..."
      iconLeft={<PlusIcon className="h-5 w-5" />}
    >
      Add {itemNameSingular}(s)
    </Button>
  );

  const uploadExistingButton = customPrimaryCreateConfig ? (
    <Button
      variant="primary-outline"
      onClick={onAddViaUploadClick}
      disabled={isLoading}
      isLoading={isLoading && !isDeleting}
      loadingText="Loading..."
      iconLeft={<ArrowUpOnSquareIcon className="h-5 w-5" />}
      title={`Upload existing ${itemNamePlural.toLowerCase()} from your device`}
    >
      Upload Existing
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          {primaryAddButton}
          {uploadExistingButton}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {hasSelection && (
            <SendToToolButton
              currentToolDirective={directiveName}
              currentToolOutputConfig={outputConfig}
              selectedOutputItems={selectedStoredFilesForItde}
              buttonText={`Send (${selectedStoredFilesForItde.length})`}
              className={
                isLoading || isDeleting ? 'opacity-50 cursor-not-allowed' : ''
              }
            />
          )}

          {customBulkActions.map((action) => (
            <Button
              key={action.key}
              variant={action.buttonVariant || 'neutral'}
              onClick={() => action.onClick(selectedStoredFilesForItde)}
              disabled={
                isLoading ||
                isDeleting ||
                (action.disabled
                  ? action.disabled(selectedStoredFilesForItde)
                  : !hasSelection)
              }
              iconLeft={action.icon}
              title={action.label}
            >
              {action.label}
              {hasSelection && ` (${selectedStoredFilesForItde.length})`}
            </Button>
          ))}

          {hasSelection && (
            <Button
              variant="danger"
              onClick={onDeleteSelectedClick}
              disabled={isLoading || isDeleting}
              isLoading={isDeleting}
              loadingText="Deleting..."
              iconLeft={<TrashIcon className="h-5 w-5" />}
            >
              Delete ({selectedStoredFilesForItde.length})
            </Button>
          )}
        </div>
        <div className="flex-grow sm:flex-grow-0">
          {' '}
          {/* Adjusted for better wrapping */}
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
            className="w-full sm:w-auto"
          >
            Clear All ({itemCount})
          </Button>
        </div>
      </div>

      {/* Custom Filter Controls Area */}
      {customFilterControls && (
        <div className="border-t border-[rgb(var(--color-border-base))] pt-3 mt-2">
          {customFilterControls}
        </div>
      )}

      {/* Bottom row: Layout, Filter Toggle, Count */}
      <div className="flex flex-wrap gap-3 items-center border-t border-[rgb(var(--color-border-base))] pt-3 mt-2">
        <div className="flex items-center gap-1 bg-[rgb(var(--color-bg-subtle-hover))] p-0.5 rounded-md">
          <Button
            variant={currentLayout === 'list' ? 'primary' : 'neutral'}
            size="sm"
            onClick={() => onLayoutChange('list')}
            disabled={isLoading}
            title="List View"
            className={
              currentLayout === 'list'
                ? 'shadow-md'
                : 'hover:bg-[rgb(var(--color-bg-neutral))]'
            }
          >
            <Bars3Icon className="h-4 w-4" />
          </Button>
          <Button
            variant={currentLayout === 'grid' ? 'primary' : 'neutral'}
            size="sm"
            onClick={() => onLayoutChange('grid')}
            disabled={isLoading}
            title="Grid View"
            className={
              currentLayout === 'grid'
                ? 'shadow-md'
                : 'hover:bg-[rgb(var(--color-bg-neutral))]'
            }
          >
            <ViewColumnsIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="border-l pl-3 ml-1">
          <Button
            variant={isFilterSelectedActive ? 'accent' : 'neutral'}
            size="sm"
            onClick={onToggleFilterSelected}
            disabled={isLoading || !hasSelection}
            title={
              isFilterSelectedActive
                ? 'Show all files'
                : 'Show only selected files'
            }
            iconLeft={<FunnelIcon className="h-4 w-4" />}
            className={`${isFilterSelectedActive ? 'shadow-md' : 'hover:bg-[rgb(var(--color-bg-neutral))]'} ${!hasSelection && 'opacity-50 cursor-not-allowed'}`}
          >
            {isFilterSelectedActive
              ? `Filtered (${selectedStoredFilesForItde.length})`
              : 'Filter Selected'}
          </Button>
        </div>

        <div className="flex-grow"></div>
        <span className="text-sm text-[rgb(var(--color-text-muted))]">
          {itemCount} {itemCount === 1 ? itemNameSingular : itemNamePlural} in
          library
          {isFilterSelectedActive &&
            ` (${selectedStoredFilesForItde.length} selected shown)`}
        </span>
      </div>
    </div>
  );
}
