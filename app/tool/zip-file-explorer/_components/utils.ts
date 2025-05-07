// /app/tool/zip-file-explorer/utils.ts
import type { RawZipEntry, TreeNodeData } from './types';

export function buildFileTree(entries: RawZipEntry[]): TreeNodeData[] {
  const tree: TreeNodeData[] = [];
  const map: Record<string, TreeNodeData> = {};

  entries.sort((a, b) => a.name.split('/').length - b.name.split('/').length);

  entries.forEach((entry) => {
    const processedPath = entry.isDirectory
      ? entry.name.replace(/\/$/, '')
      : entry.name;
    if (!processedPath) return;

    const parts = processedPath.split('/');
    const name = parts[parts.length - 1];
    const type = entry.isDirectory ? 'folder' : 'file';

    const existingNode = map[processedPath];

    if (existingNode) {
      if (type === 'file') {
        existingNode.type = 'file';
        existingNode.date = entry.date ?? existingNode.date;
        existingNode._zipObject = entry._zipObject;
        existingNode.children = undefined;
      }

      if (entry.date) {
        if (!existingNode.date || entry.date > existingNode.date) {
          existingNode.date = entry.date;
        }
      }
    } else {
      const newNode: TreeNodeData = {
        id: processedPath,
        name: name,
        path: processedPath,
        type: type,
        children: type === 'folder' ? [] : undefined,
        date: entry.date,

        _zipObject: type === 'file' ? entry._zipObject : undefined,
      };
      map[processedPath] = newNode;

      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join('/');
        const parentNode = map[parentPath];
        if (parentNode && parentNode.children) {
          parentNode.children.push(newNode);
        } else {
          console.warn(
            `Parent node ${parentPath} not found or is not a folder for ${processedPath}, adding to root.`
          );
          tree.push(newNode);
        }
      } else {
        tree.push(newNode);
      }
    }
  });

  const sortNodes = (nodes: TreeNodeData[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children);
    });
  };
  sortNodes(tree);

  return tree;
}
