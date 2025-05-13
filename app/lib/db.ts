// FILE: app/lib/db.ts
import Dexie, { type EntityTable } from 'dexie';
import type { StoredFile } from '@/src/types/storage';

const CURRENT_SCHEMA_VERSION = 10;

export class OetDatabase extends Dexie {
  files!: EntityTable<StoredFile, 'id'>;

  constructor() {
    super('OetDatabase');

    this.version(CURRENT_SCHEMA_VERSION).stores({
      files: 'id, createdAt, isTemporary, type, toolRoute',
    });

    this.files.mapToClass(Object as unknown as { new (): StoredFile });

    console.log(
      `[DB] Initialized Dexie schema version ${CURRENT_SCHEMA_VERSION}.`
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

export type { StoredFile };
export { getDbInstance };
