// FILE: src/types/history.ts

export type TriggerType = 'click' | 'query' | 'auto' | 'transfer' | 'upload';

export interface HistoryEntry {
  id: string;
  toolName: string;
  toolRoute: string;
  input?: Record<string, unknown> | string | null;
  output?: unknown;
  status?: 'success' | 'error';
  trigger: TriggerType;
  eventTimestamp: number;
}

export type NewHistoryData = Omit<HistoryEntry, 'id'>;