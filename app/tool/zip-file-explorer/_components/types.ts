// /app/tool/zip-file-explorer/types.ts
import type JSZip from 'jszip';

export interface RawZipEntry {
  name: string;
  isDirectory: boolean;
  date: Date | null;
  _zipObject: JSZip.JSZipObject;
}

export interface TreeNodeData {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  date: Date | null;
  children?: TreeNodeData[];
  _zipObject?: JSZip.JSZipObject | null;
}

export interface ActionEntryData {
  name: string;
  id: string;
  _zipObject: JSZip.JSZipObject;
}
