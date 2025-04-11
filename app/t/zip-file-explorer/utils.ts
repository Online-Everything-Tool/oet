// app/zip-file-explorer/utils.ts
import type { RawZipEntry, TreeNodeData } from './types';

// Helper function to build the file tree from flat JSZip entries
export function buildFileTree(entries: RawZipEntry[]): TreeNodeData[] {
  const tree: TreeNodeData[] = [];
  // Using Record<string, TreeNodeData> for better type safety than {}
  const map: Record<string, TreeNodeData> = {}; // Helper map for quick lookup by path

  // Sort entries by path length first to ensure parent folders are created before children
  // This simplifies the logic slightly compared to the previous version.
  entries.sort((a, b) => a.name.split('/').length - b.name.split('/').length);

  entries.forEach(entry => {
    // Remove trailing slash for directory entries to standardize paths
    const processedPath = entry.isDirectory ? entry.name.replace(/\/$/, '') : entry.name;
    if (!processedPath) return; // Skip empty root path if present

    const parts = processedPath.split('/');
    const name = parts[parts.length - 1];
    const type = entry.isDirectory ? 'folder' : 'file';

    // Check if this exact node already exists (e.g., folder created implicitly then file added)
    if (map[processedPath]) {
        // If it exists and the current entry is a file, update the type
        if (type === 'file') {
            map[processedPath].type = 'file';
            map[processedPath].date = entry.date; // Update date if file is newer?
            map[processedPath]._zipObject = entry._zipObject;
            map[processedPath].children = undefined; // Files shouldn't have children
        }
        // If it's a folder entry for an existing node, we mostly ignore it,
        // assuming the structure is already handled. We could update the date if needed.
         map[processedPath].date = entry.date > map[processedPath].date ? entry.date : map[processedPath].date;

    } else {
        // Node doesn't exist, create it
        const newNode: TreeNodeData = {
            id: processedPath,
            name: name,
            path: processedPath,
            type: type,
            children: type === 'folder' ? [] : undefined,
            date: entry.date,
            _zipObject: type === 'file' ? entry._zipObject : undefined,
        };

        // Add to map
        map[processedPath] = newNode;

        // Link to parent
        if (parts.length > 1) {
            const parentPath = parts.slice(0, -1).join('/');
            if (map[parentPath] && map[parentPath].children) {
                map[parentPath].children?.push(newNode);
            } else {
                 // This case might happen if sorting doesn't perfectly guarantee parent order,
                 // or if a zip lists a file before its directory. Add to root as fallback?
                 console.warn(`Parent node ${parentPath} not found for ${processedPath}, adding to root.`);
                 tree.push(newNode);
            }
        } else {
            // It's a root node
            tree.push(newNode);
        }
    }
  });

  // Optional: Sort children within each node alphabetically (folders first)
  const sortNodes = (nodes: TreeNodeData[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1; // Folders first
      }
      return a.name.localeCompare(b.name); // Then by name
    });
    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };
  sortNodes(tree);

  return tree;
}

// formatBytes can also live here if it's specific to this tool
export const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';
    if (bytes < 0) return 'Invalid Size';
    if (bytes < 1) return parseFloat(bytes.toFixed(decimals)) + ' Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k));
    const index = Math.min(i, sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + ' ' + sizes[index];
};