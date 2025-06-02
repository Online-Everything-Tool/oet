import type Tar from 'js-tar'; // Import Tar type from js-tar

export interface TreeNodeData {
  id: string; // Usually the path
  name: string; // Basename
  path: string; // Full path
  type: 'file' | 'folder';
  date: Date | null;
  size: number | null; // Uncompressed size
  children?: TreeNodeData[];
  _tarFile?: Tar.TarFile; // If entry is from a tar archive
  _decompressedBlob?: Blob; // If it's a single gzipped file's content
}

// For actions like preview/download
export interface ActionEntryData {
  name: string; // Full path of the file inside archive or original filename
  id: string;
  _tarFile?: Tar.TarFile; // If entry is from a tar
  _decompressedBlob?: Blob; // If it's a single gzipped file, or if tarFile content is already blobbed
}