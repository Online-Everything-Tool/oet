// /app/t/zip-file-explorer/TreeNode.tsx
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
    const isExpanded = node.type === 'folder' && expandedFolders.has(node.path); // Use node.path for expansion check
    const isExpandable = node.type === 'folder' && node.children && node.children.length > 0;

    const handleToggle = () => {
        if (node.type === 'folder') {
            onToggle(node.path); // Toggle based on path
        }
    };

    // Prepare data for action handlers (only files have _zipObject directly to act upon)
    // Ensure _zipObject exists before preparing action data
    const actionData = (node.type === 'file' && node._zipObject)
        ? { name: node.path, id: node.id, _zipObject: node._zipObject } // Pass necessary info
        : null; // No actions possible if no zipObject

    return (
        <div>
            {/* Row for the current node */}
            <div
                className={`flex items-center hover:bg-gray-100 p-1 rounded group min-h-[28px] ${node.type === 'folder' ? 'cursor-pointer' : ''}`}
                style={{ paddingLeft: `${level * 1.5}rem` }} // Use rem for better scaling
                onClick={node.type === 'folder' ? handleToggle : undefined}
            >
                {/* Icon & Expand/Collapse Toggle */}
                <span className="w-5 mr-1 inline-block text-center flex-shrink-0">
                    {node.type === 'folder' ? (isExpandable ? (isExpanded ? '▼' : '►') : ' ') : '📄'} {/* Folder or File Icon */}
                </span>
                {/* Name (Clickable area for folders is handled by parent div onClick) */}
                <span className="flex-grow truncate" title={node.path}> {/* Show full path on hover */}
                    {node.name} {/* Display just the node name */}
                </span>
                {/* Action Buttons (Only for files with actionData) */}
                {actionData && (
                     <span className="ml-auto flex-shrink-0 space-x-2 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button
                             onClick={(e) => { e.stopPropagation(); onPreview(actionData); }} // Pass actionData
                             title={`Preview ${node.name}`}
                             className="text-xs text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-100"
                         > 👁️ </button>
                         <button
                             onClick={(e) => { e.stopPropagation(); onDownload(actionData); }} // Pass actionData
                             title={`Download ${node.name}`}
                             className="text-xs text-green-600 hover:text-green-800 p-0.5 rounded hover:bg-green-100"
                         > 💾 </button>
                    </span>
                )}
            </div>

            {/* Children (Render recursively if folder is expanded) */}
            {isExpanded && node.children && node.children.length > 0 && (
                <div className="border-l border-gray-200 ml-[12px]"> {/* Use fixed pixel margin for guide line alignment */}
                    {/* Sort children alphabetically, folders first */}
                    {node.children.sort((a, b) => {
                         if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                         return a.name.localeCompare(b.name);
                     }).map(childNode => (
                        <TreeNode
                            key={childNode.id} // Use unique ID from node data
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
             {/* Display if folder is empty */}
            {isExpanded && node.type === 'folder' && (!node.children || node.children.length === 0) && (
                 <div style={{ paddingLeft: `${(level + 1) * 1.5}rem` }} className="text-xs text-gray-400 italic p-1">
                     (empty)
                 </div>
             )}
        </div>
    );
};

export default TreeNode; // Export the component