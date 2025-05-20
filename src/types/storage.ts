// FILE: src/types/storage.ts

export interface InlineFile {
  type: string;
  blob: Blob;
}

export interface StoredFile extends InlineFile {
  id: string;
  filename: string;
  size: number;
  thumbnailBlob?: Blob;
  createdAt: Date;
  isTemporary?: boolean;
  toolRoute?: string;
  lastModified?: Date;
}
