import React from 'react';
import type { TreeNodeData, ActionEntryData } from './types';

interface TreeNodeProps {
  node: TreeNodeData;
  level: number;
  expandedFolders: Set<string>;
  onToggle: (path: string) => void;
  onDownload: (entryData: ActionEntryData) => void;
  onPreview: (entryData: ActionEntryData) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  expandedFolders,
  onToggle,
  onDownload,
  onPreview,
}) => {
  const isExpanded = node.type === 'folder' && expandedFolders.has(node.path);
  const isExpandable =
    node.type === 'folder' && node.children && node.children.length > 0;

  const handleToggle = () => {
    if (node.type === 'folder') {
      onToggle(node.path);
    }
  };

  const actionData =
    node.type === 'file' && node._zipObject
      ? { name: node.path, id: node.id, _zipObject: node._zipObject }
      : null;

  const icon =
    node.type === 'folder'
      ? isExpandable
        ? isExpanded
          ? '▼'
          : '►'
        : '📁'
      : '📄';

  return (
    <div>
      {/* Row for the current node */}
      <div
        className={`flex items-center hover:bg-[rgba(var(--color-border-base)/0.1)] p-1 rounded group min-h-[28px] ${node.type === 'folder' ? 'cursor-pointer' : ''}`}
        style={{ paddingLeft: `${level * 1.5}rem` }}
        onClick={node.type === 'folder' ? handleToggle : undefined}
      >
        {/* Icon & Expand/Collapse Toggle */}
        <span className="w-5 mr-1 inline-block text-center flex-shrink-0 text-[rgb(var(--color-text-muted))]">
          {icon}
        </span>
        {/* Name */}
        <span
          className="flex-grow truncate text-[rgb(var(--color-text-base))]"
          title={node.path}
        >
          {node.name}
        </span>
        {/* Action Buttons */}
        {actionData && (
          <span className="ml-auto flex-shrink-0 space-x-2 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Preview Button - Use Link Color */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(actionData);
              }}
              title={`Preview ${node.name}`}
              className="text-xs text-[rgb(var(--color-text-link))] hover:underline p-0.5 rounded focus:outline-none"
            >
              {' '}
              👁️{' '}
            </button>
            {/* Download Button - Use Secondary Color */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(actionData);
              }}
              title={`Download ${node.name}`}
              className="text-xs text-[rgb(var(--color-button-secondary-bg))] hover:underline p-0.5 rounded focus:outline-none"
            >
              {' '}
              💾{' '}
            </button>
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && node.children && node.children.length > 0 && (
        <div className="border-l border-[rgba(var(--color-border-base)/0.5)] ml-[12px] pl-1">
          {' '}
          {/* Added pl-1 for spacing */}
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
                onToggle={onToggle}
                onDownload={onDownload}
                onPreview={onPreview}
              />
            ))}
        </div>
      )}
      {/* Empty Folder Indicator */}
      {isExpanded &&
        node.type === 'folder' &&
        (!node.children || node.children.length === 0) && (
          <div
            style={{ paddingLeft: `${(level + 1) * 1.5}rem` }}
            className="text-xs text-[rgb(var(--color-text-muted))] italic p-1"
          >
            (empty)
          </div>
        )}
    </div>
  );
};

export default TreeNode;
