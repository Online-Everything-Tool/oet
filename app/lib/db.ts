// FILE: app/lib/db.ts
import Dexie, { type EntityTable } from 'dexie';
import type { StoredFile } from '@/src/types/storage';
import type { HistoryEntry } from '@/src/types/history';

// Increment schema version to trigger upgrade/creation
const CURRENT_SCHEMA_VERSION = 10; // <-- Incremented from 9

export class OetDatabase extends Dexie {
  files!: EntityTable<StoredFile, 'id'>;
  history!: EntityTable<HistoryEntry, 'id'>;

  constructor() {
    super('OetDatabase');

    this.version(CURRENT_SCHEMA_VERSION).stores({
      // Updated 'files' schema: Added 'toolRoute' index.
      // Existing indices: id, createdAt, isTemporary, type
      files: 'id, createdAt, isTemporary, type, toolRoute',

      // Updated 'history' schema: Added '*outputFileIds' multi-entry index.
      history: 'id, toolRoute, eventTimestamp, *outputFileIds',
    });

    // Map classes (no change needed here unless using actual classes)
    this.files.mapToClass(Object as unknown as { new (): StoredFile });
    this.history.mapToClass(Object as unknown as { new (): HistoryEntry });

    console.log(
      `[DB] Initialized Dexie schema version ${CURRENT_SCHEMA_VERSION}. Added 'toolRoute' index to 'files', '*outputFileIds' index to 'history'.`
    );
  }
}

let dbInstance: OetDatabase | null = null;
const getDbInstance = (): OetDatabase => {
  if (typeof window === 'undefined') {
    throw new Error(
      'Dexie Database cannot be accessed on the server-side. Ensure getDbInstance is called client-side.'
    );
  }
  if (!dbInstance) {
    console.log('[DB] Initializing Dexie DB instance...');
    dbInstance = new OetDatabase();
  }
  return dbInstance;
};

export type { StoredFile, HistoryEntry };
export { getDbInstance };
