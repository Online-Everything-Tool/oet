// FILE: app/lib/db.ts
import Dexie, { type EntityTable } from 'dexie';
// Import the shared type definition
import type { LibraryImage } from '@/src/types/image';

// LibraryImage interface definition removed from here

// Define the Dexie database schema
class ImageDatabase extends Dexie {
  // Use the imported LibraryImage type
  images!: EntityTable<LibraryImage, 'id'>;

  constructor() {
    super('ImageDatabase');
    this.version(1).stores({
      // Schema definition remains the same
      images: 'id, name, type, size, createdAt'
    });
  }
}

// Database instance logic remains the same
let dbInstance: ImageDatabase | null = null;
if (typeof window !== 'undefined') {
    dbInstance = new ImageDatabase();
}
const getDbInstance = (): ImageDatabase => {
    if (!dbInstance) {
        if (typeof window === 'undefined') {
            throw new Error("Dexie database cannot be accessed on the server-side.");
        }
        console.warn("Re-initializing Dexie DB instance unexpectedly.");
        dbInstance = new ImageDatabase();
    }
    return dbInstance;
};
export const db = getDbInstance();
export default db;

// Re-export the type if needed elsewhere, although direct import is better
export type { LibraryImage };