// /app/context/HistoryContext.tsx
'use client'; // Essential for hooks and localStorage

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';

// --- Configuration ---
const LOCAL_STORAGE_KEY = 'oetHistory';
const MAX_HISTORY_ENTRIES = 100; // Limit the number of entries stored

// --- Interfaces ---

/**
 * Defines the structure for a single history log entry.
 */
export interface HistoryEntry {
  id: string; // Unique identifier for the entry
  timestamp: number; // Date.now() when the entry was created
  toolName: string; // User-friendly name of the tool (e.g., "JSON Formatter")
  toolRoute: string; // Route path of the tool (e.g., "/t/json-validator-formatter")
  action?: string; // Optional: Specific action performed (e.g., "format", "validate", "copyEmoji")
  // *** Use specific types or 'unknown' instead of 'any' ***
  input?: string | number | boolean | Record<string, unknown> | null | unknown; // Allow common primitives, objects, or unknown for safety
  output?: string | number | boolean | Record<string, unknown> | null | unknown; // Allow common primitives, objects, or unknown for safety
  status?: 'success' | 'error'; // Optional: Outcome indicator
  // Allow options object with unknown value types
  options?: Record<string, unknown>; // Use unknown for values within options
  // *** End Type Correction ***
}

/**
 * Defines the shape of the value provided by the HistoryContext.
 */
interface HistoryContextValue {
  history: HistoryEntry[];
  addHistoryEntry: (entryData: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  deleteHistoryEntry: (idToDelete: string) => void;
  clearHistory: () => void;
  isLoaded: boolean; // Flag to indicate if history has been loaded from localStorage
}

// --- Context Creation ---

const HistoryContext = createContext<HistoryContextValue>({
  history: [],
  addHistoryEntry: () => { console.warn('addHistoryEntry called outside of HistoryProvider'); },
  deleteHistoryEntry: () => { console.warn('deleteHistoryEntry called outside of HistoryProvider'); },
  clearHistory: () => { console.warn('clearHistory called outside of HistoryProvider'); },
  isLoaded: false,
});

// --- Custom Hook for easy consumption ---
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
  const [isLoaded, setIsLoaded] = useState<boolean>(false); // Track initial load

  // Load history from localStorage on initial mount
  useEffect(() => {
    console.log('HistoryProvider: Attempting to load history from localStorage...');
    try {
      const storedHistory = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
           console.log(`HistoryProvider: Loaded ${parsedHistory.length} entries.`);
          // TODO: Add more validation here if needed (check structure of entries)
          setHistory(parsedHistory);
        } else {
            console.warn('HistoryProvider: Invalid data found in localStorage, resetting.');
            localStorage.removeItem(LOCAL_STORAGE_KEY); setHistory([]);
        }
      } else {
        console.log('HistoryProvider: No history found in localStorage.'); setHistory([]);
      }
    } catch (error) {
      console.error('HistoryProvider: Error parsing history from localStorage:', error);
      localStorage.removeItem(LOCAL_STORAGE_KEY); setHistory([]);
    } finally {
        setIsLoaded(true); // Mark loading as complete
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Persist history to localStorage whenever it changes *after* initial load
  useEffect(() => {
    if (isLoaded) {
      try {
        // Limited logging to avoid spamming console on every history change
        // console.log(`HistoryProvider: Saving ${history.length} entries...`);
        const historyString = JSON.stringify(history);
        localStorage.setItem(LOCAL_STORAGE_KEY, historyString);
      } catch (error) {
        console.error('HistoryProvider: Error saving history to localStorage:', error);
        // Consider notifying user if saving fails repeatedly?
      }
    }
  }, [history, isLoaded]); // Re-run whenever history state or loaded status changes

  // --- Context Functions ---

  // Add a new entry, ensuring it doesn't exceed the max limit
  const addHistoryEntry = useCallback(
    (entryData: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
      const newEntry: HistoryEntry = {
        ...entryData,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Reasonably unique ID
        timestamp: Date.now(),
      };

      setHistory((prevHistory) => {
        const updatedHistory = [newEntry, ...prevHistory];
        // Enforce size limit by slicing the array if it exceeds the max
        return updatedHistory.length > MAX_HISTORY_ENTRIES
               ? updatedHistory.slice(0, MAX_HISTORY_ENTRIES)
               : updatedHistory;
      });
       console.log('HistoryProvider: Added entry for', newEntry.toolName);
    },
    [] // No external dependencies needed for this implementation
  );

  // Delete a specific entry by its ID
  const deleteHistoryEntry = useCallback((idToDelete: string) => {
    setHistory((prevHistory) =>
      prevHistory.filter((entry) => entry.id !== idToDelete)
    );
    console.log('HistoryProvider: Deleted entry with ID', idToDelete);
  }, []);

  // Clear the entire history state and localStorage
  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear storage immediately
    console.log('HistoryProvider: Cleared all history.');
  }, []);

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    () => ({
      history,
      addHistoryEntry,
      deleteHistoryEntry,
      clearHistory,
      isLoaded,
    }),
    [history, addHistoryEntry, deleteHistoryEntry, clearHistory, isLoaded]
  );

  return (
    <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
  );
};