// FILE: src/types/storage.ts

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  thumbnailBlob?: Blob;
  createdAt: Date;
  isTemporary?: boolean;
  toolRoute?: string; // Optional: Used to link state blobs to tools
  lastModified?: Date; // Optional: Track when a state blob was last updated
}
