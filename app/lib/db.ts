// FILE: app/lib/db.ts
import Dexie, { type EntityTable } from 'dexie';
import type { StoredFile } from '@/src/types/storage';
import type { HistoryEntry } from '@/src/types/history';

const CURRENT_SCHEMA_VERSION = 5;

// Export the class definition
export class OetDatabase extends Dexie {
  files!: EntityTable<StoredFile, 'id'>;
  historyEntries!: EntityTable<HistoryEntry, 'id'>;

  constructor() {
    super('OetDatabase');
    this.version(CURRENT_SCHEMA_VERSION).stores({
      files: 'id, name, type, size, category, createdAt, isTemporary',
      historyEntries: 'id, toolRoute, lastUsed'
    });
    this.files.mapToClass(Object as unknown as { new(): StoredFile });
    this.historyEntries.mapToClass(Object as unknown as { new(): HistoryEntry });
    console.log(`[DB] Initialized Dexie schema version ${CURRENT_SCHEMA_VERSION}.`);
  }
}

// --- DB Instance Singleton ---
let dbInstance: OetDatabase | null = null;

// Correct implementation of the singleton getter
const getDbInstance = (): OetDatabase => {
    if (!dbInstance) {
        // Check if running in a browser environment
        if (typeof window === 'undefined') {
            // This error prevents accidental server-side usage
            throw new Error("Dexie Database cannot be accessed on the server-side.");
        }
        // Initialize only if on the client and not already initialized
        console.log("[DB] Initializing Dexie DB instance...");
        dbInstance = new OetDatabase();
    }
    return dbInstance;
};

// Export the initialized instance (using the getter)
export const db = getDbInstance();
// Keep default export if needed elsewhere
export default db;

// Re-export types
export type { StoredFile, HistoryEntry };

// Removed the incorrect placeholder comment and function