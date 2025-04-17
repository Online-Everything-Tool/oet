// FILE: src/types/history.ts

export type TriggerType = 'click' | 'query' | 'auto' | 'transfer' | 'upload';

export interface HistoryEntry {
  id: string;
  timestamps: number[]; // Array of timestamps, latest first recommended
  toolName: string;
  toolRoute: string;
  triggers: TriggerType[];
  input?: Record<string, unknown> | string | null;
  output?: unknown;
  status?: 'success' | 'error';
  lastUsed: number; // Added: Timestamp of the most recent interaction (for sorting/indexing)
}

export type NewHistoryData = Omit<HistoryEntry, 'id' | 'timestamps' | 'triggers' | 'lastUsed'> & { // Omit lastUsed here too
    trigger: TriggerType;
};