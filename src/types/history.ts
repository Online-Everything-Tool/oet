// FILE: src/types/history.ts

// (Moved from app/context/HistoryContext.tsx)
export type TriggerType = 'click' | 'query' | 'auto' | 'transfer' | 'upload';

// (Moved from app/context/HistoryContext.tsx)
export interface HistoryEntry {
  id: string;
  timestamps: number[];
  toolName: string;
  toolRoute: string;
  triggers: TriggerType[];
  input?: Record<string, unknown> | string | null;
  output?: unknown; // Keep as unknown for flexibility or define a more specific union type if desired
  status?: 'success' | 'error';
}

// (Moved from app/context/HistoryContext.tsx)
export type NewHistoryData = Omit<HistoryEntry, 'id' | 'timestamps' | 'triggers'> & {
    trigger: TriggerType;
};

// Optional: Define a more structured output type if feasible across tools
// export interface StructuredHistoryOutput {
//   message?: string;
//   imageId?: string;
//   value?: string | number | boolean | object | null;
//   errorMessage?: string;
//   [key: string]: unknown; // Allow extra fields
// }
// // If using the above, you might change HistoryEntry.output to:
// // output?: StructuredHistoryOutput | string | null;