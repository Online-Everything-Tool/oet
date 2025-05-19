// FILE: app/tool/zip-file-explorer/_components/TreeNode.tsx
import React from 'react';
import type { TreeNodeData, ActionEntryData } from './types';
import {
  FolderIcon as FolderIconSolid,
  DocumentIcon as DocumentIconSolid,
  EyeIcon,
  ArrowDownTrayIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/20/solid';
import Checkbox from '../../_components/form/Checkbox';
import { getFileIconClassName, formatBytesCompact } from '@/app/lib/utils';

interface TreeNodeProps {
  node: TreeNodeData;
  level: number;
  expandedFolders: Set<string>;
  selectedPaths: Set<string>;
  isPathIndeterminate: (path: string) => boolean;
  onToggle: (path: string) => void;
  onToggleSelection: (path: string) => void;
  onDownload: (entryData: ActionEntryData) => void;
  onPreview: (entryData: ActionEntryData) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  expandedFolders,
  selectedPaths,
  isPathIndeterminate,
  onToggle,
  onToggleSelection,
  onDownload,
  onPreview,
}) => {
  const isExpanded = node.type === 'folder' && expandedFolders.has(node.path);
  const isExpandable =
    node.type === 'folder' && node.children && node.children.length > 0;
  const isSelected = selectedPaths.has(node.path);
  const isNodeIndeterminate =
    node.type === 'folder' ? isPathIndeterminate(node.path) : false;

  const handleToggle = () => {
    if (node.type === 'folder') {
      onToggle(node.path);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleSelection(node.path);
  };

  const actionData =
    node.type === 'file' && node._zipObject
      ? { name: node.path, id: node.id, _zipObject: node._zipObject }
      : null;

  let iconElement: React.ReactNode;
  if (node.type === 'folder') {
    if (isExpandable) {
      iconElement = isExpanded ? (
        <ChevronDownIcon className="h-4 w-4 text-[rgb(var(--color-text-muted))]" />
      ) : (
        <ChevronRightIcon className="h-4 w-4 text-[rgb(var(--color-text-muted))]" />
      );
    } else {
      iconElement = <FolderIconSolid className="h-4 w-4 text-yellow-500" />;
    }
  } else {
    const fileIconClass = getFileIconClassName(node.name);
    if (fileIconClass && !fileIconClass.includes('generic')) {
      iconElement = (
        <span
          className={`${fileIconClass} tree-node-file-icon text-base leading-none w-4 h-4 inline-block align-middle`}
          aria-hidden="true"
        ></span>
      );
    } else {
      iconElement = <DocumentIconSolid className="h-4 w-4 text-blue-500" />;
    }
  }

  const nodeDate = node.date
    ? new Date(node.date).toLocaleDateString(undefined, {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
      })
    : '---';

  const nodeSize =
    node.type === 'file' && node._zipObject
      ? formatBytesCompact(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (node._zipObject as any)._data?.uncompressedSize ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (node._zipObject as any).uncompressedSize ||
            0
        )
      : '---';

  let rowBgClass = '';
  if (isSelected && !isNodeIndeterminate) {
    rowBgClass = 'bg-[rgba(var(--color-text-link)/0.15)]';
  } else if (isNodeIndeterminate) {
    rowBgClass = 'bg-[rgba(var(--color-text-link)/0.05)]';
  }

  return (
    <div>
      <div
        className={`flex items-center hover:bg-[rgba(var(--color-border-base)/0.1)] py-0.5 px-1 rounded group min-h-[28px] ${rowBgClass}`}
        style={{ paddingLeft: `${level * 1.25 + 0.25}rem` }}
        onClick={
          node.type === 'folder'
            ? handleToggle
            : () => onToggleSelection(node.path)
        }
        role={node.type === 'folder' ? 'treeitem' : 'option'}
        tabIndex={0}
        onKeyDown={
          node.type === 'folder'
            ? (e) => (e.key === 'Enter' || e.key === ' ') && handleToggle()
            : (e) =>
                (e.key === 'Enter' || e.key === ' ') &&
                onToggleSelection(node.path)
        }
        aria-expanded={node.type === 'folder' ? isExpanded : undefined}
        aria-selected={isSelected}
      >
        <div
          className="mr-1.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            isIndeterminate={isNodeIndeterminate}
            onChange={handleCheckboxChange}
            aria-label={`Select ${node.type} ${node.name}`}
            inputClassName="cursor-pointer"
          />
        </div>
        <span className="w-5 mr-1.5 inline-flex items-center justify-center flex-shrink-0">
          {iconElement}
        </span>
        <span
          className="flex-grow truncate text-[rgb(var(--color-text-base))]"
          title={node.path}
        >
          {node.name}
        </span>

        {node.type === 'file' && (
          <>
            <span
              className="text-xs text-[rgb(var(--color-text-muted))] w-20 text-right flex-shrink-0 pr-2"
              title={node.date?.toLocaleString()}
            >
              {nodeDate}
            </span>
            <span className="text-xs text-[rgb(var(--color-text-muted))] w-12 text-right flex-shrink-0 pr-2">
              {nodeSize}
            </span>
          </>
        )}
        {node.type === 'folder' && (
          <span className="w-[calc(5rem+3rem)] flex-shrink-0"></span>
        )}

        {actionData && (
          <span className="ml-auto flex-shrink-0 space-x-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(actionData);
              }}
              title={`Preview ${node.name}`}
              className="p-1 rounded text-[rgb(var(--color-text-link))] hover:bg-[rgba(var(--color-text-link)/0.1)] focus:outline-none"
              aria-label={`Preview ${node.name}`}
            >
              {' '}
              <EyeIcon className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(actionData);
              }}
              title={`Download ${node.name}`}
              className="p-1 rounded text-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgba(var(--color-button-secondary-bg)/0.1)] focus:outline-none"
              aria-label={`Download ${node.name}`}
            >
              {' '}
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
          </span>
        )}
      </div>

      {isExpanded && node.children && node.children.length > 0 && (
        <div className="border-l border-[rgba(var(--color-border-base)/0.3)] ml-[calc(0.8rem+2px)]">
          {node.children
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map((childNode) => (
              <TreeNode
                key={childNode.id}
                node={childNode}
                level={level + 1}
                expandedFolders={expandedFolders}
                selectedPaths={selectedPaths}
                isPathIndeterminate={isPathIndeterminate}
                onToggle={onToggle}
                onToggleSelection={onToggleSelection}
                onDownload={onDownload}
                onPreview={onPreview}
              />
            ))}
        </div>
      )}
      {isExpanded &&
        node.type === 'folder' &&
        (!node.children || node.children.length === 0) && (
          <div
            style={{
              paddingLeft: `${(level + 1) * 1.25 + 0.25 + 0.625 + 1.25}rem`,
            }}
            className="text-xs text-[rgb(var(--color-text-muted))] italic p-1 min-h-[28px] flex items-center"
          >
            (empty folder)
          </div>
        )}
    </div>
  );
};

export default TreeNode;
