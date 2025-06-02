import type { TreeNodeData } from './types';
import type Tar from 'js-tar'; // Import Tar type from js-tar
import { getMimeTypeForFile } from '@/app/lib/utils';

// Helper to build tree from TarFile array
export function buildTreeFromTarEntries(tarFiles: Tar.TarFile[]): TreeNodeData[] {
  const tree: TreeNodeData[] = [];
  const map: Record<string, TreeNodeData> = {}; // path -> TreeNodeData

  tarFiles.sort((a, b) => {
    const depthA = a.name.split('/').length;
    const depthB = b.name.split('/').length;
    if (depthA !== depthB) return depthA - depthB;
    return a.name.localeCompare(b.name);
  });

  tarFiles.forEach(tarFile => {
    const path = tarFile.name.replace(/\/$/, '');
    if (!path) return;

    const parts = path.split('/');
    const name = parts[parts.length - 1];
    const type = tarFile.type === 'directory' ? 'folder' : 'file';

    const newNode: TreeNodeData = {
      id: path,
      name: name,
      path: path,
      type: type,
      date: tarFile.header?.mtime ? new Date(tarFile.header.mtime * 1000) : null,
      size: type === 'file' ? tarFile.header?.size || 0 : null,
      children: type === 'folder' ? [] : undefined,
      _tarFile: tarFile,
    };
    map[path] = newNode;

    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join('/');
      const parentNode = map[parentPath];
      if (parentNode && parentNode.children) {
        parentNode.children.push(newNode);
      } else {
        tree.push(newNode);
      }
    } else {
      tree.push(newNode);
    }
  });

  const sortNodes = (nodes: TreeNodeData[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(node => {
      if (node.children) sortNodes(node.children);
    });
  };
  sortNodes(tree);

  return tree;
}

// Helper to build a single-node tree for a non-TAR gzipped file
export function buildTreeFromSingleFile(
  originalFilename: string,
  decompressedData: Uint8Array,
  gzipMtime?: number
): TreeNodeData[] {
  const blob = new Blob([decompressedData], { type: getMimeTypeForFile(originalFilename) });
  const node: TreeNodeData = {
    id: originalFilename,
    name: originalFilename,
    path: originalFilename,
    type: 'file',
    date: gzipMtime ? new Date(gzipMtime * 1000) : new Date(),
    size: blob.size,
    _decompressedBlob: blob,
  };
  return [node];
}