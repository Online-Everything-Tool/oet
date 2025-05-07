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
import { getDbInstance, type OetDatabase } from '../lib/db';
import type { LoggingPreference, ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage'; // Import StoredFile
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

function areInputsEqual(input1: unknown, input2: unknown): boolean {
  if (input1 === null || input1 === undefined) {
    return input2 === null || input2 === undefined;
  }
  if (input2 === null || input2 === undefined) {
    return false;
  }
  try {
    if (typeof input1 !== 'object' || typeof input2 !== 'object') {
      return String(input1) === String(input2);
    }
    return JSON.stringify(input1) === JSON.stringify(input2);
  } catch (e) {
    console.warn(
      '[HistoryCtx] Error comparing history inputs via JSON.stringify:',
      e
    );
    return input1 === input2 || String(input1) === String(input2);
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
        }
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
        if (preference === defaultPreference) delete newPrefs[toolRoute];
        else newPrefs[toolRoute] = preference;
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
    let db: OetDatabase | null = null;
    try {
      db = getDbInstance();
    } catch (e) {
      setHistoryError(
        `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
      );
      setIsLoadingHistory(false);
      setIsHistoryLoaded(true);
      return;
    }

    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const loadedHistory = await db.history
        .orderBy('eventTimestamp')
        .reverse()
        .limit(MAX_HISTORY_ENTRIES + 50)
        .toArray();
      setHistory(loadedHistory);
      setIsHistoryLoaded(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown database error';
      setHistoryError(`Failed to load history: ${message}`);
      setHistory([]);
      setIsHistoryLoaded(true);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistoryFromDb();
  }, [loadHistoryFromDb]);

  const addHistoryEntry = useCallback(
    async (entryData: NewHistoryData): Promise<void> => {
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e) {
        setHistoryError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        return;
      }
      if (!isSettingsLoaded || !isHistoryEnabled) return;

      const toolRoute = entryData.toolRoute;
      const preference = getToolLoggingPreference(toolRoute);

      if (preference === 'off') return;

      let outputToStore = entryData.output;
      if (preference === 'restrictive') {
        outputToStore = REDACTED_OUTPUT_PLACEHOLDER;
      }

      const now = Date.now();
      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        if (!db?.history) throw new Error("DB 'history' table not available.");

        const existingEntriesForTool = await db.history
          .where('toolRoute')
          .equals(toolRoute)
          .toArray();
        const existingEntry = existingEntriesForTool.find((entry) =>
          areInputsEqual(entryData.input, entry.input)
        );

        if (existingEntry) {
          await db.history.update(existingEntry.id, {
            output: outputToStore,
            status: entryData.status,
            trigger: entryData.trigger,
            eventTimestamp: now,
            outputFileIds: entryData.outputFileIds || [],
          });
        } else {
          const newEntry: HistoryEntry = {
            id: uuidv4(),
            toolName: entryData.toolName,
            toolRoute: entryData.toolRoute,
            input: entryData.input,
            output: outputToStore,
            status: entryData.status,
            trigger: entryData.trigger,
            eventTimestamp: now,
            outputFileIds: entryData.outputFileIds || [],
          };
          await db.history.add(newEntry);

          const currentCount = await db.history.count();
          if (currentCount > MAX_HISTORY_ENTRIES) {
            const excessCount = currentCount - MAX_HISTORY_ENTRIES;
            const oldestEntries = await db.history
              .orderBy('eventTimestamp')
              .limit(excessCount)
              .primaryKeys();
            await db.history.bulkDelete(oldestEntries);
          }
        }
        await loadHistoryFromDb();
      } catch (error) {
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
  );

  const deleteHistoryEntry = useCallback(
    async (idToDelete: string): Promise<void> => {
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e) {
        setHistoryError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        return;
      }

      setIsLoadingHistory(true);
      setHistoryError(null);
      let associatedTempFileIds: string[] = [];

      try {
        if (!db?.history || !db?.files)
          throw new Error("DB 'history' or 'files' table not available.");

        const entryToDelete = await db.history.get(idToDelete);
        if (
          entryToDelete?.outputFileIds &&
          entryToDelete.outputFileIds.length > 0
        ) {
          const potentialFiles = await db.files.bulkGet(
            entryToDelete.outputFileIds
          );
          // --- CORRECTED FILTER ---
          associatedTempFileIds = potentialFiles
            .filter(
              (
                file
              ): file is StoredFile => // Use correct type predicate
                file !== undefined && file.isTemporary === true
            )
            .map((file) => file.id); // Map after filtering non-undefined
          // --- END CORRECTION ---
        }

        await db.history.delete(idToDelete);
        console.log(`[HistoryCtx] Deleted history entry ${idToDelete}.`);

        if (associatedTempFileIds.length > 0) {
          await db.files.bulkDelete(associatedTempFileIds);
          console.log(
            `[HistoryCtx] Deleted ${associatedTempFileIds.length} associated temporary files: ${associatedTempFileIds.join(', ')}`
          );
        }

        setHistory((prev) => prev.filter((entry) => entry.id !== idToDelete));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown database error';
        setHistoryError(`Failed to delete entry ${idToDelete}: ${message}`);
        await loadHistoryFromDb();
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [loadHistoryFromDb]
  );

  const clearHistory = useCallback(async (): Promise<void> => {
    let db: OetDatabase | null = null;
    try {
      db = getDbInstance();
    } catch (e) {
      setHistoryError(
        `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
      );
      return;
    }
    setIsLoadingHistory(true);
    setHistoryError(null);
    const allOutputFileIds: string[] = [];

    try {
      if (!db?.history || !db?.files)
        throw new Error("DB 'history' or 'files' table not available.");

      await db.history.each((entry) => {
        if (entry.outputFileIds) {
          allOutputFileIds.push(...entry.outputFileIds);
        }
      });
      const uniqueOutputFileIds = [...new Set(allOutputFileIds)];

      await db.history.clear();
      setHistory([]);
      console.log(`[HistoryCtx] Cleared all history entries.`);

      if (uniqueOutputFileIds.length > 0) {
        const potentialFiles = await db.files.bulkGet(uniqueOutputFileIds);
        // --- CORRECTED FILTER ---
        const tempFilesToDelete = potentialFiles
          .filter(
            (
              file
            ): file is StoredFile => // Use correct type predicate
              file !== undefined && file.isTemporary === true
          )
          .map((file) => file.id); // Map after filtering non-undefined
        // --- END CORRECTION ---

        if (tempFilesToDelete.length > 0) {
          await db.files.bulkDelete(tempFilesToDelete);
          console.log(
            `[HistoryCtx] Cleared ${tempFilesToDelete.length} associated temporary files.`
          );
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown database error';
      setHistoryError(`Failed to clear history: ${message}`);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const clearHistoryForTool = useCallback(
    async (toolRoute: string): Promise<void> => {
      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
      } catch (e) {
        setHistoryError(
          `Database unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        return;
      }

      setIsLoadingHistory(true);
      setHistoryError(null);
      const toolOutputFileIds: string[] = [];

      try {
        if (!db?.history || !db?.files)
          throw new Error("DB 'history' or 'files' table not available.");

        const entriesToDelete = await db.history
          .where('toolRoute')
          .equals(toolRoute)
          .toArray();
        entriesToDelete.forEach((entry) => {
          if (entry.outputFileIds) {
            toolOutputFileIds.push(...entry.outputFileIds);
          }
        });
        const uniqueOutputFileIds = [...new Set(toolOutputFileIds)];

        await db.history.where('toolRoute').equals(toolRoute).delete();
        console.log(`[HistoryCtx] Cleared history for tool ${toolRoute}.`);

        if (uniqueOutputFileIds.length > 0) {
          const potentialFiles = await db.files.bulkGet(uniqueOutputFileIds);
          // --- CORRECTED FILTER ---
          const tempFilesToDelete = potentialFiles
            .filter(
              (
                file
              ): file is StoredFile => // Use correct type predicate
                file !== undefined && file.isTemporary === true
            )
            .map((file) => file.id); // Map after filtering non-undefined
          // --- END CORRECTION ---

          if (tempFilesToDelete.length > 0) {
            await db.files.bulkDelete(tempFilesToDelete);
            console.log(
              `[HistoryCtx] Cleared ${tempFilesToDelete.length} associated temporary files for tool ${toolRoute}.`
            );
          }
        }

        setHistory((prev) =>
          prev.filter((entry) => entry.toolRoute !== toolRoute)
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown database error';
        setHistoryError(
          `Failed to clear history for tool ${toolRoute}: ${message}`
        );
        await loadHistoryFromDb();
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [loadHistoryFromDb]
  );

  const isLoaded = isSettingsLoaded && isHistoryLoaded;

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

export type { HistoryEntry, NewHistoryData, TriggerType };
