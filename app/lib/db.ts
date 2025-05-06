// FILE: app/lib/db.ts
import Dexie, { type EntityTable } from 'dexie';
import type { StoredFile } from '@/src/types/storage';
import type { HistoryEntry } from '@/src/types/history';

const CURRENT_SCHEMA_VERSION = 9;

export class OetDatabase extends Dexie {
  files!: EntityTable<StoredFile, 'id'>;
  history!: EntityTable<HistoryEntry, 'id'>;

  constructor() {
    super('OetDatabase');

    this.version(CURRENT_SCHEMA_VERSION).stores({
      files: 'id, createdAt, isTemporary, type', // name, size, blob also stored
      history: 'id, toolRoute, eventTimestamp', // Other fields also stored
    });

    this.files.mapToClass(Object as unknown as { new (): StoredFile });
    this.history.mapToClass(Object as unknown as { new (): HistoryEntry });

    console.log(
      `[DB] Initialized Dexie schema version ${CURRENT_SCHEMA_VERSION} with 'files' (indexed 'type') and 'history' tables. No upgrade logic applied.`
    );
  }
}

let dbInstance: OetDatabase | null = null;
const getDbInstance = (): OetDatabase => {
  if (typeof window === 'undefined') {
    // In a real scenario needing SSR, you might return a mock or null here.
    // But for this client-side only DB, throwing is appropriate if accessed server-side.
    // This throw *should only* happen now if getDbInstance is called incorrectly server-side.
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
