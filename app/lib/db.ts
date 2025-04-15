// FILE: app/lib/db.ts
import Dexie, { type Table } from 'dexie';

// Define the structure of the data we'll store in the 'images' table
export interface LibraryImage {
  id?: number; // Auto-incrementing primary key (optional on input)
  name: string;
  type: string;
  blob: Blob; // Store the actual image Blob
  lastUpdated: number; // Timestamp of when it was added/updated
  // Add other metadata as needed later (e.g., dimensions, sourceTool)
}

// Define the Database class using Dexie
// We extend Dexie and define our tables/stores within the constructor.
export class ImageLibraryDB extends Dexie {
  // 'images' is the name of our object store (table).
  // The Table type generics define the shape of the data and the type of the primary key.
  images!: Table<LibraryImage, number>; // number is the type of the primary key 'id'

  constructor() {
    // Database name: 'ImageLibraryDB'
    super('ImageLibraryDB');
    // Define database schema. Version 1 has one table: 'images'.
    // '++id' means auto-incrementing primary key.
    // 'name,lastUpdated' are indexed properties for potential querying/sorting.
    this.version(1).stores({
      images: '++id, name, lastUpdated', // Schema declaration
    });
  }
}

// Create a singleton instance of the database to be used throughout the app.
export const db = new ImageLibraryDB();

// Optional: Helper functions could be added here later if needed,
// but the context will primarily handle interactions.