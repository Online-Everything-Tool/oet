// FILE: src/types/image.ts

// Define the interface for the data structure stored in the 'images' table
// (Moved from app/lib/db.ts)
export interface LibraryImage {
    id: string; // Primary key (UUID)
    name: string;
    type: string; // MIME type (e.g., 'image/png')
    size: number; // Size in bytes
    blob: Blob; // The original image blob
    thumbnailBlob?: Blob; // Optional thumbnail blob (can be undefined)
    createdAt: Date;
  }