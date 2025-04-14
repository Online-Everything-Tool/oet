// /app/context/HistoryContext.tsx
'use client';

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { v4 as uuidv4 } from 'uuid'; // Use UUID for more robust IDs

// --- Configuration ---
const LOCAL_STORAGE_KEY = 'oetHistory_v2'; // Increment version for new structure
const MAX_HISTORY_ENTRIES = 100;

// --- Interfaces ---

/**
 * Represents a unique operation state that might have been executed multiple times.
 */
export interface HistoryEntry {
  id: string; // Unique identifier for this specific state combination (generated once)
  firstTimestamp: number; // When this state was first encountered
  lastUsedTimestamp: number; // Timestamp of the most recent execution/reload
  timestamps: number[]; // Array of all execution timestamps (includes first and last)
  executionCount: number; // How many times this exact state was executed/reloaded
  toolName: string;
  toolRoute: string;
  action?: string; // Action of the *last* execution
  input?: unknown; // Input state (could be string, object, etc.)
  output?: unknown; // Output of the *last* execution
  status?: 'success' | 'error'; // Status of the *last* execution
  options?: Record<string, unknown>; // Options used
}

/**
 * Data passed to addHistoryEntry (doesn't include generated fields like id, timestamps).
 */
export type NewHistoryData = Omit<
    HistoryEntry,
    'id' | 'firstTimestamp' | 'lastUsedTimestamp' | 'timestamps' | 'executionCount'
>;


interface HistoryContextValue {
  history: HistoryEntry[]; // Array of unique history states
  addHistoryEntry: (entryData: NewHistoryData) => void;
  deleteHistoryEntry: (idToDelete: string) => void;
  clearHistory: () => void;
  clearHistoryForTool: (toolRoute: string) => void; // Keep per-tool clear
  // TODO: Add state/functions for global/per-tool enable/disable later
  isLoaded: boolean;
}

// --- Helper: Deep Equality Check (Simple version, enhance if needed) ---
// NOTE: This simple JSON.stringify comparison might fail for complex objects
// with different key orders or Date objects, Maps, Sets, etc.
// Consider a library like 'fast-deep-equal' for more robustness if needed.
function areStatesEqual(entry1: NewHistoryData, entry2: HistoryEntry): boolean {
    if (entry1.toolRoute !== entry2.toolRoute) return false;

    // Basic comparison for primitives/simple objects via JSON stringify
    try {
        const inputEqual = JSON.stringify(entry1.input) === JSON.stringify(entry2.input);
        const optionsEqual = JSON.stringify(entry1.options ?? {}) === JSON.stringify(entry2.options ?? {});
        return inputEqual && optionsEqual;
    } catch (e) {
        console.warn("Error comparing history states with JSON.stringify:", e);
        // Fallback to reference equality or assume not equal on error
        return entry1.input === entry2.input && entry1.options === entry2.options;
    }
}
// --- End Helper ---


// --- Context Creation ---
const HistoryContext = createContext<HistoryContextValue>({
  history: [],
  addHistoryEntry: () => { console.warn('addHistoryEntry called outside of HistoryProvider'); },
  deleteHistoryEntry: () => { console.warn('deleteHistoryEntry called outside of HistoryProvider'); },
  clearHistory: () => { console.warn('clearHistory called outside of HistoryProvider'); },
  clearHistoryForTool: () => { console.warn('clearHistoryForTool called outside of HistoryProvider'); },
  isLoaded: false,
});

export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};

// --- Provider Component ---
interface HistoryProviderProps {
  children: ReactNode;
}

export const HistoryProvider = ({ children }: HistoryProviderProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load history from localStorage
  useEffect(() => {
    console.log(`[HistoryCtx] Attempting load from ${LOCAL_STORAGE_KEY}...`);
    try {
      const storedHistory = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        // Basic validation for the new structure
        if (Array.isArray(parsedHistory) && parsedHistory.every(item => item.id && Array.isArray(item.timestamps) && item.lastUsedTimestamp && item.executionCount >= 1)) {
           console.log(`[HistoryCtx] Loaded ${parsedHistory.length} entries from v2 storage.`);
           // Sort loaded history by last used timestamp descending
           parsedHistory.sort((a, b) => b.lastUsedTimestamp - a.lastUsedTimestamp);
           setHistory(parsedHistory);
        } else {
            console.warn('[HistoryCtx] Invalid v2 data found, resetting.');
            localStorage.removeItem(LOCAL_STORAGE_KEY); setHistory([]);
            // TODO: Add migration logic from old format if needed
        }
      } else {
        console.log('[HistoryCtx] No v2 history found.'); setHistory([]);
      }
    } catch (error) {
      console.error('[HistoryCtx] Error parsing history:', error);
      localStorage.removeItem(LOCAL_STORAGE_KEY); setHistory([]);
    } finally {
        setIsLoaded(true);
    }
  }, []);

  // Persist history to localStorage
  useEffect(() => {
    if (isLoaded) {
      try {
        // No need to sort here, we sort on load and add
        const historyString = JSON.stringify(history);
        localStorage.setItem(LOCAL_STORAGE_KEY, historyString);
      } catch (error) {
        console.error('[HistoryCtx] Error saving history:', error);
      }
    }
  }, [history, isLoaded]);

  // --- Context Functions ---

  // ADD HISTORY ENTRY (Refactored Logic)
  const addHistoryEntry = useCallback((entryData: NewHistoryData) => {
      // TODO: Add global/per-tool enable check here later

      const now = Date.now();

      setHistory((prevHistory) => {
          // Find existing entry matching route, input, and options
          const existingEntryIndex = prevHistory.findIndex(entry => areStatesEqual(entryData, entry));

          let updatedHistory = [...prevHistory]; // Create a mutable copy

          if (existingEntryIndex > -1) {
              // --- Update Existing Entry ---
              console.log(`[HistoryCtx] Updating existing entry for ${entryData.toolName}`);
              const existingEntry = updatedHistory[existingEntryIndex];
              const updatedEntry: HistoryEntry = {
                  ...existingEntry,
                  lastUsedTimestamp: now,
                  timestamps: [...existingEntry.timestamps, now].sort((a,b) => b-a), // Add new timestamp, keep sorted desc
                  executionCount: existingEntry.executionCount + 1,
                  // Update fields to reflect the *latest* execution
                  action: entryData.action,
                  output: entryData.output,
                  status: entryData.status,
                  // Keep original id and firstTimestamp
              };
              // Replace the old entry with the updated one
              updatedHistory[existingEntryIndex] = updatedEntry;
              // Move the updated entry to the top (most recent)
              updatedHistory.splice(existingEntryIndex, 1); // Remove from original position
              updatedHistory.unshift(updatedEntry); // Add to beginning

          } else {
              // --- Add New Entry ---
              console.log(`[HistoryCtx] Adding new entry for ${entryData.toolName}`);
              const newEntry: HistoryEntry = {
                  ...entryData,
                  id: uuidv4(), // Generate unique ID for this state
                  firstTimestamp: now,
                  lastUsedTimestamp: now,
                  timestamps: [now],
                  executionCount: 1,
              };
              // Add to the beginning of the array
              updatedHistory.unshift(newEntry);

              // Enforce size limit *only* when adding new entries
              if (updatedHistory.length > MAX_HISTORY_ENTRIES) {
                  updatedHistory = updatedHistory.slice(0, MAX_HISTORY_ENTRIES);
                  console.log(`[HistoryCtx] History limit reached, oldest entry removed.`);
              }
          }

          return updatedHistory; // Return the modified array
      });

  }, []); // Empty dependency array - relies on setHistory's functional update

  // Delete a specific entry by its ID
  const deleteHistoryEntry = useCallback((idToDelete: string) => {
    setHistory((prevHistory) =>
      prevHistory.filter((entry) => entry.id !== idToDelete)
    );
    console.log('[HistoryCtx] Deleted entry with ID', idToDelete);
  }, []);

  // Clear the entire history state and localStorage
  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    console.log('[HistoryCtx] Cleared all history.');
  }, []);

  // Clear history for a specific tool route
  const clearHistoryForTool = useCallback((toolRoute: string) => {
    setHistory(prevHistory => prevHistory.filter(entry => entry.toolRoute !== toolRoute));
     console.log(`[HistoryCtx] Cleared history for tool: ${toolRoute}`);
  }, []);


  // Memoize the context value
  const value = useMemo(
    () => ({
      history, // Already sorted by lastUsedTimestamp on load/add
      addHistoryEntry,
      deleteHistoryEntry,
      clearHistory,
      clearHistoryForTool,
      isLoaded,
    }),
    [history, addHistoryEntry, deleteHistoryEntry, clearHistory, clearHistoryForTool, isLoaded]
  );

  return (
    <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
  );
};