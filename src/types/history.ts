// FILE: src/types/history.ts

export type TriggerType = 'click' | 'query' | 'auto' | 'transfer' | 'upload';

export interface HistoryEntry {
  id: string;
  toolName: string;
  toolRoute: string;
  input?: Record<string, unknown> | string | null;
  // Output now primarily stores non-file metadata. File links go in outputFileIds.
  output?: unknown;
  status?: 'success' | 'error';
  trigger: TriggerType;
  eventTimestamp: number;
  // New field to link to StoredFile entries (permanent or temporary)
  outputFileIds?: string[];
}

// NewHistoryData needs to accommodate outputFileIds if known at creation time,
// but usually it will be populated by the addHistoryEntry logic.
// Making it optional here.
export type NewHistoryData = Omit<HistoryEntry, 'id'>;
