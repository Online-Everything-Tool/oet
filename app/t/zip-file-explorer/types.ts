// app/zip-file-explorer/types.ts
import type { JSZipObject } from 'jszip';

// Represents the raw data extracted directly from JSZip entry
export interface RawZipEntry {
  name: string; // Full path
  isDirectory: boolean;
  date: Date;
  _zipObject: JSZipObject;
}

// Represents a node in our hierarchical file tree
export interface TreeNodeData {
  id: string; // Typically the full path, used as React key
  name: string; // The display name (last part of the path)
  path: string; // Full path from zip root
  type: 'file' | 'folder';
  children?: TreeNodeData[]; // Nested children for folders
  date: Date; // Modification date
  _zipObject?: JSZipObject; // Reference to the original JSZip object (only for files)
}

// Types for sorting (can stay here or move to a more global types file if needed)
export type SortKey = 'name' | 'date';
export type SortDirection = 'asc' | 'desc';

// Type for data passed to action handlers from TreeNode
export interface ActionEntryData {
    name: string; // Full path
    _zipObject: JSZipObject;
}