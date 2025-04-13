// /app/t/zip-file-explorer/types.ts
import type JSZip from 'jszip';

// Type for raw data extracted from JSZip
export interface RawZipEntry {
  name: string;
  isDirectory: boolean;
  date: Date | null;
  _zipObject: JSZip.JSZipObject; // Store the original JSZip object
}

// Type for the nodes in our hierarchical tree structure
export interface TreeNodeData {
  id: string; // Unique ID for React keys, often the full path
  name: string; // Display name (usually the last part of the path)
  path: string; // Full path used as ID and for expansion tracking
  type: 'file' | 'folder';
  date: Date | null;
  children?: TreeNodeData[]; // Children for folders
  _zipObject?: JSZip.JSZipObject | null; // Zip object reference (primarily for files)
}

// Type for data passed to action handlers like download/preview
export interface ActionEntryData {
    name: string; // Original full name/path for reference
    id: string; // Path ID
    _zipObject: JSZip.JSZipObject; // Action requires the zip object
}