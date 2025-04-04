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
  toolRoute: string; // Route path of the tool (e.g., "/json-formatter-validator")
  action?: string; // Optional: Specific action performed (e.g., "format", "validate", "copyEmoji")
  input?: any; // The primary input data (string, object snippet, etc.) - Keep serializable!
  output?: any; // The resulting output/result (string, boolean, object snippet) - Keep serializable!
  status?: 'success' | 'error'; // Optional: Outcome indicator
  options?: Record<string, any>; // Ensure this line exists and is not commented out
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

// Create the context with a default value (prevents errors when used outside provider)
const HistoryContext = createContext<HistoryContextValue>({
  history: [],
  addHistoryEntry: () => {
    console.warn('addHistoryEntry called outside of HistoryProvider');
  },
  deleteHistoryEntry: () => {
    console.warn('deleteHistoryEntry called outside of HistoryProvider');
  },
  clearHistory: () => {
    console.warn('clearHistory called outside of HistoryProvider');
  },
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
        // Basic validation - check if it's an array
        if (Array.isArray(parsedHistory)) {
           console.log(`HistoryProvider: Loaded ${parsedHistory.length} entries.`);
          setHistory(parsedHistory);
        } else {
            console.warn('HistoryProvider: Invalid data found in localStorage, resetting.');
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setHistory([]);
        }
      } else {
        console.log('HistoryProvider: No history found in localStorage.');
        setHistory([]);
      }
    } catch (error) {
      console.error('HistoryProvider: Error parsing history from localStorage:', error);
      // Clear corrupted data
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setHistory([]);
    } finally {
        setIsLoaded(true); // Mark loading as complete
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Persist history to localStorage whenever it changes *after* initial load
  useEffect(() => {
    // Only save after the initial load is complete to prevent overwriting loaded data
    if (isLoaded) {
      try {
        // console.log(`HistoryProvider: Saving ${history.length} entries to localStorage...`);
        const historyString = JSON.stringify(history);
        localStorage.setItem(LOCAL_STORAGE_KEY, historyString);
      } catch (error) {
        console.error('HistoryProvider: Error saving history to localStorage:', error);
      }
    }
  }, [history, isLoaded]); // Re-run whenever history state or loaded status changes

  // --- Context Functions ---

  const addHistoryEntry = useCallback(
    (entryData: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
      const newEntry: HistoryEntry = {
        ...entryData,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Unique enough ID
        timestamp: Date.now(),
      };

      setHistory((prevHistory) => {
        const updatedHistory = [newEntry, ...prevHistory];
        // Enforce size limit
        if (updatedHistory.length > MAX_HISTORY_ENTRIES) {
          return updatedHistory.slice(0, MAX_HISTORY_ENTRIES);
        }
        return updatedHistory;
      });
       console.log('HistoryProvider: Added entry for', newEntry.toolName);
    },
    [] // No dependencies needed as it uses setHistory's functional update form
  );

  const deleteHistoryEntry = useCallback((idToDelete: string) => {
    setHistory((prevHistory) =>
      prevHistory.filter((entry) => entry.id !== idToDelete)
    );
    console.log('HistoryProvider: Deleted entry with ID', idToDelete);
  }, []); // No dependencies

  const clearHistory = useCallback(() => {
    setHistory([]);
    // Also remove from storage immediately for clarity, although the effect would catch it
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    console.log('HistoryProvider: Cleared all history.');
  }, []); // No dependencies

  // Assemble the context value
  const value = useMemo(
    () => ({
      history,
      addHistoryEntry,
      deleteHistoryEntry,
      clearHistory,
      isLoaded,
    }),
    [history, addHistoryEntry, deleteHistoryEntry, clearHistory, isLoaded] // Dependencies for memoization
  );

  return (
    <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
  );
};