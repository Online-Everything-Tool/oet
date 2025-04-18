// FILE: app/lib/db.ts
import Dexie, { type EntityTable } from 'dexie';
import type { StoredFile } from '@/src/types/storage';
import type { HistoryEntry } from '@/src/types/history';

// Increment version number AGAIN because we are changing the schema
const CURRENT_SCHEMA_VERSION = 9; // Assuming previous was 8

export class OetDatabase extends Dexie {
  files!: EntityTable<StoredFile, 'id'>;
  history!: EntityTable<HistoryEntry, 'id'>;

  constructor() {
    super('OetDatabase');

    this.version(CURRENT_SCHEMA_VERSION).stores({
      files: 'id, createdAt, isTemporary, type', // name, size, blob also stored

      history: 'id, toolRoute, eventTimestamp', // Other fields also stored
    });
    // No .upgrade() block

    this.files.mapToClass(Object as unknown as { new(): StoredFile });
    this.history.mapToClass(Object as unknown as { new(): HistoryEntry });

    console.log(`[DB] Initialized Dexie schema version ${CURRENT_SCHEMA_VERSION} with 'files' (indexed 'type') and 'history' tables. No upgrade logic applied.`);
  }
}

// --- DB Instance Singleton (Remains the same) ---
let dbInstance: OetDatabase | null = null;
const getDbInstance = (): OetDatabase => {
    if (!dbInstance) {
        if (typeof window === 'undefined') {
            throw new Error("Dexie Database cannot be accessed on the server-side.");
        }
        console.log("[DB] Initializing Dexie DB instance...");
        dbInstance = new OetDatabase();
    }
    return dbInstance;
};
export const db = getDbInstance();
export default db;
export type { StoredFile, HistoryEntry };