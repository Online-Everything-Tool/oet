// FILE: app/context/HistoryContext.tsx
'use client';

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
// Import the db instance NO LONGER db, but the getDbInstance function
import { getDbInstance, type OetDatabase } from '../lib/db'; // Import the getter function and DB class type
import type { LoggingPreference, ToolMetadata } from '@/src/types/tools';
// Import the specific History types needed
import type {
  TriggerType,
  HistoryEntry,
  NewHistoryData,
} from '@/src/types/history';
import {
  SETTINGS_LOCAL_STORAGE_KEY,
  MAX_HISTORY_ENTRIES,
  REDACTED_OUTPUT_PLACEHOLDER,
} from '@/src/constants/history';

const GLOBAL_DEFAULT_LOGGING: LoggingPreference = 'on';

// --- Interfaces ---
interface HistorySettings {
  isHistoryEnabled: boolean;
  toolPreferences?: Record<string, LoggingPreference>;
}

interface HistoryContextValue {
  history: HistoryEntry[];
  addHistoryEntry: (entryData: NewHistoryData) => Promise<void>;
  deleteHistoryEntry: (idToDelete: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  clearHistoryForTool: (toolRoute: string) => Promise<void>;
  isLoaded: boolean;
  isLoadingHistory: boolean;
  historyError: string | null;
  isHistoryEnabled: boolean;
  toggleHistoryEnabled: () => void;
  getToolLoggingPreference: (toolRoute: string) => LoggingPreference;
  setToolLoggingPreference: (
    toolRoute: string,
    preference: LoggingPreference
  ) => Promise<void>;
}
// --- End Interfaces ---

const HistoryContext = createContext<HistoryContextValue>({
  history: [],
  addHistoryEntry: async () => {
    console.warn('HistoryContext: addHistoryEntry called before provider.');
  },
  deleteHistoryEntry: async () => {
    console.warn('HistoryContext: deleteHistoryEntry called before provider.');
  },
  clearHistory: async () => {
    console.warn('HistoryContext: clearHistory called before provider.');
  },
  clearHistoryForTool: async () => {
    console.warn('HistoryContext: clearHistoryForTool called before provider.');
  },
  isLoaded: false,
  isLoadingHistory: true,
  historyError: null,
  isHistoryEnabled: true,
  toggleHistoryEnabled: () => {
    console.warn(
      'HistoryContext: toggleHistoryEnabled called before provider.'
    );
  },
  getToolLoggingPreference: () => GLOBAL_DEFAULT_LOGGING,
  setToolLoggingPreference: async () => {
    console.warn(
      'HistoryContext: setToolLoggingPreference called before provider.'
    );
  },
});

export const useHistory = (): HistoryContextValue => {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error(
      'useHistory hook must be used within a HistoryProvider component tree.'
    );
  }
  return context;
};

// Comparison function needed for finding duplicate inputs
function areInputsEqual(input1: unknown, input2: unknown): boolean {
  if (input1 === null || input1 === undefined) {
    return input2 === null || input2 === undefined;
  }
  if (input2 === null || input2 === undefined) {
    return false;
  }
  try {
    if (typeof input1 === 'object' && typeof input2 === 'object') {
      return JSON.stringify(input1) === JSON.stringify(input2);
    }
    return String(input1) === String(input2);
  } catch (e) {
    console.warn(
      '[HistoryCtx] Error comparing history inputs via JSON.stringify:',
      e
    );
    return input1 === input2;
  }
}

interface HistoryProviderProps {
  children: ReactNode;
}

export const HistoryProvider = ({ children }: HistoryProviderProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState<boolean>(false);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryEnabled, setIsHistoryEnabled] = useState<boolean>(true);
  const [toolPreferences, setToolPreferences] = useState<
    Record<string, LoggingPreference>
  >({});
  const [toolDefaults, setToolDefaults] = useState<
    Record<string, LoggingPreference>
  >({});
  const fetchingDefaultsRef = useRef<Set<string>>(new Set());
  // Removed dbRef needed, just import and use `db` directly

  // --- Settings Management (Unchanged) ---
  useEffect(() => {
    let loadedEnabledState = true;
    let loadedPrefs: Record<string, LoggingPreference> = {};
    try {
      const storedSettings = localStorage.getItem(SETTINGS_LOCAL_STORAGE_KEY);
      if (storedSettings) {
        const parsedSettings: Partial<HistorySettings> =
          JSON.parse(storedSettings);
        if (typeof parsedSettings.isHistoryEnabled === 'boolean') {
          loadedEnabledState = parsedSettings.isHistoryEnabled;
        }
        if (
          typeof parsedSettings.toolPreferences === 'object' &&
          parsedSettings.toolPreferences !== null
        ) {
          const validPrefs: Record<string, LoggingPreference> = {};
          const validPrefValues: LoggingPreference[] = [
            'on',
            'restrictive',
            'off',
          ];
          for (const route in parsedSettings.toolPreferences) {
            if (
              Object.prototype.hasOwnProperty.call(
                parsedSettings.toolPreferences,
                route
              )
            ) {
              const pref = parsedSettings.toolPreferences[route];
              if (validPrefValues.includes(pref)) {
                validPrefs[route] = pref;
              } else {
                console.warn(
                  `[HistoryCtx] Ignoring invalid stored preference for ${route}: ${pref}`
                );
              }
            }
          }
          loadedPrefs = validPrefs;
        }
      }
    } catch (error) {
      console.error(
        '[HistoryCtx] Error parsing settings from localStorage:',
        error
      );
    }
    setIsHistoryEnabled(loadedEnabledState);
    setToolPreferences(loadedPrefs);
    setIsSettingsLoaded(true);
    console.log('[HistoryCtx] Settings loaded from localStorage.', {
      isHistoryEnabled: loadedEnabledState,
      toolPreferences: loadedPrefs,
    });
  }, []);

  useEffect(() => {
    if (isSettingsLoaded) {
      try {
        const settings: HistorySettings = { isHistoryEnabled, toolPreferences };
        localStorage.setItem(
          SETTINGS_LOCAL_STORAGE_KEY,
          JSON.stringify(settings)
        );
      } catch (error) {
        console.error(
          '[HistoryCtx] Error saving settings to localStorage:',
          error
        );
      }
    }
  }, [isHistoryEnabled, toolPreferences, isSettingsLoaded]);

  const fetchToolDefaultPreference = useCallback(
    async (toolRoute: string): Promise<LoggingPreference> => {
      if (!toolRoute || !toolRoute.startsWith('/tool/'))
        return GLOBAL_DEFAULT_LOGGING;
      if (toolDefaults[toolRoute]) return toolDefaults[toolRoute];
      if (fetchingDefaultsRef.current.has(toolRoute))
        return GLOBAL_DEFAULT_LOGGING;
      fetchingDefaultsRef.current.add(toolRoute);
      const directive = toolRoute.substring('/tool/'.length).replace(/\/$/, '');
      if (!directive || directive.includes('/')) {
        fetchingDefaultsRef.current.delete(toolRoute);
        setToolDefaults((prev) => ({
          ...prev,
          [toolRoute]: GLOBAL_DEFAULT_LOGGING,
        }));
        return GLOBAL_DEFAULT_LOGGING;
      }
      let fetchedDefault: LoggingPreference = GLOBAL_DEFAULT_LOGGING;
      try {
        const response = await fetch(`/api/tool-metadata/${directive}.json`);
        if (response.ok) {
          const data: ToolMetadata = await response.json();
          const validPrefs: LoggingPreference[] = ['on', 'restrictive', 'off'];
          const metadataDefault = data?.defaultLogging as LoggingPreference;
          if (metadataDefault && validPrefs.includes(metadataDefault))
            fetchedDefault = metadataDefault;
          else
            console.warn(
              `[HistoryCtx] Metadata for ${directive} missing or has invalid defaultLogging. Using global default.`
            );
        } else
          console.warn(
            `[HistoryCtx] Metadata not found or failed for ${directive} (Status: ${response.status}). Using global default.`
          );
      } catch (error) {
        console.error(
          `[HistoryCtx] Error fetching/parsing default preference for ${toolRoute}:`,
          error
        );
      } finally {
        setToolDefaults((prev) => ({ ...prev, [toolRoute]: fetchedDefault }));
        fetchingDefaultsRef.current.delete(toolRoute);
      }
      return fetchedDefault;
    },
    [toolDefaults]
  );

  const getToolLoggingPreference = useCallback(
    (toolRoute: string): LoggingPreference => {
      if (!isSettingsLoaded) return GLOBAL_DEFAULT_LOGGING;
      if (toolPreferences[toolRoute]) return toolPreferences[toolRoute];
      if (toolDefaults[toolRoute]) return toolDefaults[toolRoute];
      if (!fetchingDefaultsRef.current.has(toolRoute)) {
        fetchToolDefaultPreference(toolRoute);
      }
      return GLOBAL_DEFAULT_LOGGING;
    },
    [
      isSettingsLoaded,
      toolPreferences,
      toolDefaults,
      fetchToolDefaultPreference,
    ]
  );

  const setToolLoggingPreference = useCallback(
    async (toolRoute: string, preference: LoggingPreference) => {
      if (!isSettingsLoaded) return;
      let defaultPreference = toolDefaults[toolRoute];
      if (!defaultPreference && !fetchingDefaultsRef.current.has(toolRoute)) {
        defaultPreference = await fetchToolDefaultPreference(toolRoute);
      }
      defaultPreference = defaultPreference || GLOBAL_DEFAULT_LOGGING;
      setToolPreferences((prev) => {
        const newPrefs = { ...prev };
        if (preference === defaultPreference) {
          delete newPrefs[toolRoute];
          console.log(
            `[HistoryCtx] Preference for ${toolRoute} matches default (${defaultPreference}). Removing override.`
          );
        } else {
          newPrefs[toolRoute] = preference;
          console.log(
            `[HistoryCtx] Setting preference for ${toolRoute} to ${preference} (default: ${defaultPreference}).`
          );
        }
        return newPrefs;
      });
    },
    [isSettingsLoaded, toolDefaults, fetchToolDefaultPreference]
  );

  const toggleHistoryEnabled = useCallback(() => {
    if (!isSettingsLoaded) return;
    setIsHistoryEnabled((prev) => !prev);
  }, [isSettingsLoaded]);
  // --- End Settings Management ---

  // --- History DB Operations ---
  const loadHistoryFromDb = useCallback(async () => {
    // Use the imported `getDbInstance` function here
    let db: OetDatabase | null = null;
    try {
      db = getDbInstance(); // Get instance client-side
    } catch (e) {
      console.error(
        '[HistoryCtx] loadHistoryFromDb: Failed to get DB instance client-side:',
        e
      );
      setHistoryError(
        `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
      );
      setIsLoadingHistory(false);
      setIsHistoryLoaded(true); // Mark as loaded even on failure to avoid infinite loading
      return;
    }

    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      // Query the renamed 'history' table
      const loadedHistory = await db.history // Access table from instance
        .orderBy('eventTimestamp') // Sort by event time
        .reverse() // Newest first
        .limit(MAX_HISTORY_ENTRIES + 50) // Load slightly more for pruning check
        .toArray();
      setHistory(loadedHistory);
      console.log(
        `[HistoryCtx] Loaded ${loadedHistory.length} history entries from 'history' table.`
      );
      setIsHistoryLoaded(true);
    } catch (error) {
      console.error(
        "[HistoryCtx] Error loading history from Dexie 'history' table:",
        error
      );
      const message =
        error instanceof Error ? error.message : 'Unknown database error';
      setHistoryError(`Failed to load history: ${message}`);
      setHistory([]);
      setIsHistoryLoaded(true); // Still mark as loaded, even if empty due to error
    } finally {
      setIsLoadingHistory(false);
    }
  }, []); // No dependencies needed here

  // Load history on mount
  useEffect(() => {
    // db instance is initialized synchronously now in db.ts if on client
    loadHistoryFromDb();
  }, [loadHistoryFromDb]); // Depend on the memoized load function

  const addHistoryEntry = useCallback(
    async (entryData: NewHistoryData): Promise<void> => {
      // Get DB instance client-side
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e) {
        console.error(
          '[HistoryCtx] addHistoryEntry: Failed to get DB instance client-side:',
          e
        );
        setHistoryError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        return; // Cannot proceed without DB
      }

      if (!isSettingsLoaded || !isHistoryEnabled) return; // Check settings loaded and history enabled

      const toolRoute = entryData.toolRoute;
      const preference = getToolLoggingPreference(toolRoute);

      if (preference === 'off') {
        console.log(
          `[HistoryCtx] Skipping history add for ${toolRoute} due to 'off' preference.`
        );
        return; // Don't log if preference is off
      }

      let outputToStore = entryData.output;
      if (preference === 'restrictive') {
        outputToStore = REDACTED_OUTPUT_PLACEHOLDER; // Redact if restrictive
      }

      const now = Date.now(); // Use a single timestamp for the event
      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        // Check if an entry with the same toolRoute and input already exists
        const existingEntriesForTool = await db.history
          .where('toolRoute')
          .equals(toolRoute)
          .toArray();
        const existingEntry = existingEntriesForTool.find((entry) =>
          areInputsEqual(entryData.input, entry.input)
        );

        if (existingEntry) {
          // Update existing entry: Just update output, status, trigger and timestamp
          await db.history.update(existingEntry.id, {
            output: outputToStore,
            status: entryData.status,
            trigger: entryData.trigger, // Overwrite with the latest trigger
            eventTimestamp: now, // Update timestamp to now (makes it most recent)
          });
          console.log(
            `[HistoryCtx] Updated existing history entry ${existingEntry.id} for tool ${toolRoute}.`
          );
        } else {
          // Add new entry
          const newEntry: HistoryEntry = {
            ...entryData, // Spread fields from NewHistoryData (toolName, toolRoute, input, output, status, trigger)
            id: uuidv4(),
            output: outputToStore, // Ensure potentially redacted output is used
            eventTimestamp: now,
            // Removed timestamps, triggers array, lastUsed
          };
          await db.history.add(newEntry);
          console.log(
            `[HistoryCtx] Added new history entry ${newEntry.id} for tool ${toolRoute}.`
          );

          // Pruning logic (check after adding)
          const currentCount = await db.history.count();
          if (currentCount > MAX_HISTORY_ENTRIES) {
            const excessCount = currentCount - MAX_HISTORY_ENTRIES;
            // Find the oldest entries based on eventTimestamp
            const oldestEntries = await db.history
              .orderBy('eventTimestamp')
              .limit(excessCount)
              .primaryKeys();
            await db.history.bulkDelete(oldestEntries);
            console.log(
              `[HistoryCtx] Pruned ${oldestEntries.length} oldest history entries.`
            );
          }
        }
        // Reload history state after add/update
        // Note: This might cause flickering if updates are very frequent.
        // An alternative is to optimistically update the local state and handle sync errors.
        await loadHistoryFromDb();
      } catch (error) {
        console.error(
          '[HistoryCtx] Error adding/updating history entry:',
          error
        );
        const message =
          error instanceof Error ? error.message : 'Unknown database error';
        setHistoryError(`Failed to save history: ${message}`);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [
      isSettingsLoaded,
      isHistoryEnabled,
      getToolLoggingPreference,
      loadHistoryFromDb,
    ]
  ); // Dependencies

  const deleteHistoryEntry = useCallback(
    async (idToDelete: string): Promise<void> => {
      // Get DB instance client-side
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e) {
        console.error(
          '[HistoryCtx] deleteHistoryEntry: Failed to get DB instance client-side:',
          e
        );
        setHistoryError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        return; // Cannot proceed without DB
      }

      setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        await db.history.delete(idToDelete);
        // Update local state optimistically or reload
        setHistory((prev) => prev.filter((entry) => entry.id !== idToDelete));
        console.log(`[HistoryCtx] Deleted history entry ${idToDelete}.`);
      } catch (error) {
        console.error(
          `[HistoryCtx] Error deleting history entry ${idToDelete}:`,
          error
        );
        const message =
          error instanceof Error ? error.message : 'Unknown DB error';
        setHistoryError(`Failed to delete entry: ${message}`);
        await loadHistoryFromDb(); // Reload on error
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [loadHistoryFromDb]
  ); // Added loadHistoryFromDb dependency

  const clearHistory = useCallback(async (): Promise<void> => {
    // Get DB instance client-side
    let db: OetDatabase | null = null;
    try {
      db = getDbInstance();
    } catch (e) {
      console.error(
        '[HistoryCtx] clearHistory: Failed to get DB instance client-side:',
        e
      );
      setHistoryError(
        `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
      );
      return; // Cannot proceed without DB
    }
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      await db.history.clear();
      setHistory([]); // Clear local state
      console.log(`[HistoryCtx] Cleared all history entries.`);
    } catch (error) {
      console.error('[HistoryCtx] Error clearing history:', error);
      const message =
        error instanceof Error ? error.message : 'Unknown DB error';
      setHistoryError(`Failed to clear history: ${message}`);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const clearHistoryForTool = useCallback(
    async (toolRoute: string): Promise<void> => {
      // Get DB instance client-side
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e) {
        console.error(
          '[HistoryCtx] clearHistoryForTool: Failed to get DB instance client-side:',
          e
        );
        setHistoryError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        return; // Cannot proceed without DB
      }

      setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        // Query and delete entries for the specific toolRoute
        await db.history.where('toolRoute').equals(toolRoute).delete();
        // Update local state optimistically or reload
        setHistory((prev) =>
          prev.filter((entry) => entry.toolRoute !== toolRoute)
        );
        console.log(`[HistoryCtx] Cleared history for tool ${toolRoute}.`);
      } catch (error) {
        console.error(
          `[HistoryCtx] Error clearing history for tool ${toolRoute}:`,
          error
        );
        const message =
          error instanceof Error ? error.message : 'Unknown DB error';
        setHistoryError(`Failed to clear history for tool: ${message}`);
        await loadHistoryFromDb(); // Reload on error
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [loadHistoryFromDb]
  ); // Added loadHistoryFromDb dependency

  // --- Combined loaded state & Memoized context value ---
  const isLoaded = isSettingsLoaded && isHistoryLoaded; // Both settings and DB history must be loaded

  const value = useMemo(
    () => ({
      history,
      addHistoryEntry,
      deleteHistoryEntry,
      clearHistory,
      clearHistoryForTool,
      isLoaded,
      isLoadingHistory,
      historyError,
      isHistoryEnabled,
      toggleHistoryEnabled,
      getToolLoggingPreference,
      setToolLoggingPreference,
    }),
    [
      history,
      addHistoryEntry,
      deleteHistoryEntry,
      clearHistory,
      clearHistoryForTool,
      isLoaded,
      isLoadingHistory,
      historyError,
      isHistoryEnabled,
      toggleHistoryEnabled,
      getToolLoggingPreference,
      setToolLoggingPreference,
    ]
  );

  return (
    <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
  );
};

// Re-export relevant types if needed by consumers
export type { HistoryEntry, NewHistoryData, TriggerType };
