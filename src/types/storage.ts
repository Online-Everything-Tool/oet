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
}
