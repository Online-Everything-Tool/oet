// /app/tool/zip-file-explorer/utils.ts
import type { RawZipEntry, TreeNodeData } from './types';

// Helper function to build the file tree from flat JSZip entries
export function buildFileTree(entries: RawZipEntry[]): TreeNodeData[] {
  const tree: TreeNodeData[] = [];
  const map: Record<string, TreeNodeData> = {};

  entries.sort((a, b) => a.name.split('/').length - b.name.split('/').length);

  entries.forEach(entry => {
    const processedPath = entry.isDirectory ? entry.name.replace(/\/$/, '') : entry.name;
    if (!processedPath) return;

    const parts = processedPath.split('/');
    const name = parts[parts.length - 1];
    const type = entry.isDirectory ? 'folder' : 'file';

    // Check if this exact node already exists
    const existingNode = map[processedPath]; // Use a variable for readability

    if (existingNode) {
        // If it exists and the current entry is a file, update relevant details
        if (type === 'file') {
            existingNode.type = 'file';
            existingNode.date = entry.date ?? existingNode.date; // Keep existing date if new one is null
            existingNode._zipObject = entry._zipObject;
            existingNode.children = undefined;
        }
        // If it's a folder or file, potentially update the date
        // Only update if the new date is valid AND is later than the existing valid date
        // *** CORRECTED DATE UPDATE LOGIC ***
        if (entry.date) { // Only proceed if the new date is valid
            if (!existingNode.date || entry.date > existingNode.date) { // Update if current is null or new is later
                existingNode.date = entry.date;
            }
        }
        // *** END CORRECTION ***

    } else {
        // Node doesn't exist, create it
        const newNode: TreeNodeData = {
            id: processedPath,
            name: name,
            path: processedPath,
            type: type,
            children: type === 'folder' ? [] : undefined,
            date: entry.date, // Assign date (can be null)
            // Assign zipObject only if it's a file type
            _zipObject: type === 'file' ? entry._zipObject : undefined,
        };
        map[processedPath] = newNode;

        // Link to parent
        if (parts.length > 1) {
            const parentPath = parts.slice(0, -1).join('/');
            const parentNode = map[parentPath]; // Find parent in map
            if (parentNode && parentNode.children) { // Ensure parent exists and is a folder
                parentNode.children.push(newNode);
            } else {
                 console.warn(`Parent node ${parentPath} not found or is not a folder for ${processedPath}, adding to root.`);
                 tree.push(newNode);
            }
        } else {
            tree.push(newNode); // Root node
        }
    }
  });

  // Recursive sort function
  const sortNodes = (nodes: TreeNodeData[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(node => { if (node.children) sortNodes(node.children); });
  };
  sortNodes(tree); // Sort the final tree

  return tree;
}