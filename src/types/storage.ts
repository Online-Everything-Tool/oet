// FILE: src/types/storage.ts

/**
 * Represents a file stored in the user's local Dexie database (Library).
 * This can be an image, archive, document, etc.
 */
export interface StoredFile {
    id: string;
    name: string;
    type: string;
    size: number;
    blob: Blob;
    thumbnailBlob?: Blob;
    createdAt: Date;
    category?: string;
    isTemporary?: boolean;                            
}