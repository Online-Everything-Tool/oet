// app/zip-file-explorer/TreeNode.tsx
import React from 'react';
import type { TreeNodeData, ActionEntryData } from './types'; // Import types from the new file

interface TreeNodeProps {
    node: TreeNodeData;
    level: number;
    expandedFolders: Set<string>; // Pass the whole set down
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
    onPreview
}) => {
    const indent = level * 20; // Indentation in pixels
    const isExpanded = node.type === 'folder' && expandedFolders.has(node.path);

    const handleToggle = () => {
        if (node.type === 'folder') {
            onToggle(node.path);
        }
    };

    // Prepare data for action handlers (only files have _zipObject directly)
    const actionData = (node.type === 'file' && node._zipObject)
        ? { name: node.path, _zipObject: node._zipObject }
        : null;

    return (
        <div>
            {/* Row for the current node */}
            <div
                className={`flex items-center hover:bg-gray-100 p-1 rounded ${node.type === 'folder' ? 'cursor-pointer' : ''} min-h-[28px]`} // Added min-height
                style={{ paddingLeft: `${indent}px` }}
                onClick={node.type === 'folder' ? handleToggle : undefined}
            >
                {/* Icon */}
                <span className="w-5 inline-block mr-1 flex-shrink-0 text-center"> {/* Centered icon */}
                    {node.type === 'folder' ? (isExpanded ? '▼' : '▶') : '📄'}
                </span>
                {/* Name */}
                <span className="flex-grow truncate" title={node.name}>
                    {node.name}
                </span>
                {/* Date */}
                 <span className="text-xs text-gray-500 px-2 hidden md:inline flex-shrink-0">
                     {node.date.toLocaleDateString()}
                 </span>
                {/* Actions */}
                {actionData && (
                     <span className="ml-auto flex-shrink-0 space-x-2 pr-1">
                         <button
                             onClick={(e) => { e.stopPropagation(); onDownload(actionData); }}
                             title={`Download ${node.name}`}
                             className="text-blue-600 hover:text-blue-800 text-xs font-medium p-0.5 rounded hover:bg-blue-50"
                         > DL </button>
                         <button
                             onClick={(e) => { e.stopPropagation(); onPreview(actionData); }}
                             title={`Preview ${node.name}`}
                             className="text-green-600 hover:text-green-800 text-xs font-medium p-0.5 rounded hover:bg-green-50"
                         > PV </button>
                    </span>
                )}
            </div>

            {/* Children (Render recursively if folder is expanded) */}
            {isExpanded && node.children && node.children.length > 0 && (
                // Removed border/margin for simpler nesting, rely on padding of rows
                <div>
                    {node.children.map(childNode => (
                        <TreeNode
                            key={childNode.id}
                            node={childNode}
                            level={level + 1}
                            expandedFolders={expandedFolders} // Pass the set down
                            onToggle={onToggle}
                            onDownload={onDownload}
                            onPreview={onPreview}
                        />
                    ))}
                </div>
            )}
            {/* Display if folder is empty */}
            {isExpanded && node.type === 'folder' && (!node.children || node.children.length === 0) && (
                 <div style={{ paddingLeft: `${indent + 20}px` }} className="text-xs text-gray-400 italic p-1">
                     (empty folder)
                 </div>
             )}
        </div>
    );
};

export default TreeNode; // Export the component