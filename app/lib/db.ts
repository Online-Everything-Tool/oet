// FILE: app/lib/db.ts
import Dexie, { type EntityTable } from 'dexie';

// Define the interface for the data structure stored in the 'images' table
export interface LibraryImage {
  id: string; // Primary key (UUID)
  name: string;
  type: string; // MIME type (e.g., 'image/png')
  size: number; // Size in bytes
  blob: Blob; // The original image blob
  thumbnailBlob?: Blob; // Optional thumbnail blob (can be undefined)
  createdAt: Date;
}

// Define the Dexie database schema
class ImageDatabase extends Dexie {
  // 'images' is the name of the table (Object Store)
  // EntityTable<Model, PrimaryKeyPropName>
  images!: EntityTable<LibraryImage, 'id'>; // Use 'id' as the Primary Key property name

  constructor() {
    super('ImageDatabase'); // Database name

    // Define the current schema in version 1
    this.version(1).stores({
      // 'id' is the primary key (UUID).
      // Other fields can be indexed for faster lookups if needed.
      // Blobs (blob, thumbnailBlob) are generally not indexed.
      images: 'id, name, type, size, createdAt'
    });

    // Remove previous version definitions and upgrade logic
    // If schema changes are needed later, increment the version number here
    // and either provide an upgrade function or instruct users to clear storage.
  }
}

// Create a singleton instance of the database
// Add extra checks for server-side rendering if necessary, though Dexie is client-side
let dbInstance: ImageDatabase | null = null;

if (typeof window !== 'undefined') {
    dbInstance = new ImageDatabase();
}

// Export the instance, ensuring it's non-null for client-side usage
// Throw an error if accessed server-side where it would be null
const getDbInstance = (): ImageDatabase => {
    if (!dbInstance) {
        // This case should ideally not happen in client components after hydration
        // but provides a safeguard.
        if (typeof window === 'undefined') {
            throw new Error("Dexie database cannot be accessed on the server-side.");
        }
        // Potentially initialize here if hydration issues occur, though constructor should handle client side.
        console.warn("Re-initializing Dexie DB instance unexpectedly.");
        dbInstance = new ImageDatabase();
    }
    return dbInstance;
};

// Export the initialized instance using a named export
export const db = getDbInstance();

// Also provide a default export for compatibility if needed elsewhere (though named is clearer)
export default db;