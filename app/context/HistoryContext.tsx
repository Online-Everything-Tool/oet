// FILE: app/context/HistoryContext.tsx
'use client';

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  useRef, // <-- Import useRef here
  ReactNode,
} from 'react';
import { v4 as uuidv4 } from 'uuid';

// --- Config & Types ---
const HISTORY_LOCAL_STORAGE_KEY = 'oetHistory_v3';
const SETTINGS_LOCAL_STORAGE_KEY = 'oetSettings_v1';
const MAX_HISTORY_ENTRIES = 100;
const REDACTED_OUTPUT_PLACEHOLDER = "[Output Redacted by Setting]";
const GLOBAL_DEFAULT_LOGGING: LoggingPreference = 'on'; // Global fallback (Updated default)

export type TriggerType = 'click' | 'query' | 'auto' | 'transfer' | 'upload';
export type LoggingPreference = 'on' | 'restrictive' | 'off';

export interface HistoryEntry {
  id: string;
  timestamps: number[];
  toolName: string;
  toolRoute: string;
  triggers: TriggerType[];
  input?: Record<string, unknown> | string | null;
  output?: unknown;
  status?: 'success' | 'error';
}

export type NewHistoryData = Omit<HistoryEntry, 'id' | 'timestamps' | 'triggers'> & {
    trigger: TriggerType;
};

// --- NEW: Metadata type from API ---
interface ToolMetadataFromApi {
    defaultLogging?: LoggingPreference;
    [key: string]: unknown; // Allow other fields like title etc.
}

interface MetadataApiResponse {
    success: boolean;
    metadata?: ToolMetadataFromApi;
    error?: string;
}
// --- END NEW ---

interface HistorySettings {
    isHistoryEnabled: boolean;
    toolPreferences?: Record<string, LoggingPreference>; // User overrides only
}

interface HistoryContextValue {
  history: HistoryEntry[];
  addHistoryEntry: (entryData: NewHistoryData) => void;
  deleteHistoryEntry: (idToDelete: string) => void;
  clearHistory: () => void;
  clearHistoryForTool: (toolRoute: string) => void;
  isLoaded: boolean;
  isHistoryEnabled: boolean;
  toggleHistoryEnabled: () => void;
  getToolLoggingPreference: (toolRoute: string) => LoggingPreference;
  setToolLoggingPreference: (toolRoute: string, preference: LoggingPreference) => Promise<void>; // Now async
}

// --- Helper: areStatesEqual (unchanged) ---
function areStatesEqual(entry1: NewHistoryData, entry2: HistoryEntry): boolean {
    if (entry1.toolRoute !== entry2.toolRoute) return false;
    try {
        const inputEqual = JSON.stringify(entry1.input ?? {}) === JSON.stringify(entry2.input ?? {});
        return inputEqual;
    } catch (e) {
        console.warn("[HistoryCtx] Error comparing history states with JSON.stringify:", e);
        return entry1.input === entry2.input;
    }
}
// --- End Helper ---

const HistoryContext = createContext<HistoryContextValue>({
  history: [],
  addHistoryEntry: () => { console.warn('addHistoryEntry called outside of HistoryProvider'); },
  deleteHistoryEntry: () => { console.warn('deleteHistoryEntry called outside of HistoryProvider'); },
  clearHistory: () => { console.warn('clearHistory called outside of HistoryProvider'); },
  clearHistoryForTool: () => { console.warn('clearHistoryForTool called outside of HistoryProvider'); },
  isLoaded: false,
  isHistoryEnabled: true,
  toggleHistoryEnabled: () => { console.warn('toggleHistoryEnabled called outside of HistoryProvider'); },
  getToolLoggingPreference: () => GLOBAL_DEFAULT_LOGGING, // Use global default initially
  setToolLoggingPreference: async () => { console.warn('setToolLoggingPreference called outside of HistoryProvider'); }, // Mark as async
});

export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (context === undefined) { throw new Error('useHistory must be used within a HistoryProvider'); }
  return context;
};

interface HistoryProviderProps {
  children: ReactNode;
}

export const HistoryProvider = ({ children }: HistoryProviderProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isHistoryEnabled, setIsHistoryEnabled] = useState<boolean>(true);
  const [toolPreferences, setToolPreferences] = useState<Record<string, LoggingPreference>>({});
  // --- NEW State for cached defaults ---
  const [toolDefaults, setToolDefaults] = useState<Record<string, LoggingPreference>>({});
  const fetchingDefaultsRef = useRef<Set<string>>(new Set()); // To prevent concurrent fetches
  // --- END NEW State ---

  // --- Load Settings from Local Storage (useEffect - minor validation change) ---
  useEffect(() => {
    let loadedEnabledState = true;
    let loadedPrefs: Record<string, LoggingPreference> = {};

    try {
        const storedSettings = localStorage.getItem(SETTINGS_LOCAL_STORAGE_KEY);
        if (storedSettings) {
             const parsedSettings: Partial<HistorySettings> = JSON.parse(storedSettings);
             if (typeof parsedSettings.isHistoryEnabled === 'boolean') {
                 loadedEnabledState = parsedSettings.isHistoryEnabled;
             }
             // Validate ONLY the structure, not against defaults yet
             if (typeof parsedSettings.toolPreferences === 'object' && parsedSettings.toolPreferences !== null) {
                  const validPrefs: Record<string, LoggingPreference> = {};
                  const validPrefValues: LoggingPreference[] = ['on', 'restrictive', 'off'];
                  for (const route in parsedSettings.toolPreferences) {
                      const pref = parsedSettings.toolPreferences[route];
                      if (validPrefValues.includes(pref)) { // Basic validation of stored value
                          validPrefs[route] = pref;
                      }
                  }
                  loadedPrefs = validPrefs; // Store only user overrides
             }
        }
    } catch (error) { console.error('[HistoryCtx] Error parsing settings:', error); }

    setIsHistoryEnabled(loadedEnabledState);
    setToolPreferences(loadedPrefs); // Load user preferences

    // History loading remains the same
    try {
      const storedHistory = localStorage.getItem(HISTORY_LOCAL_STORAGE_KEY);
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.every(item =>
             item.id && Array.isArray(item.timestamps) && item.timestamps.length > 0 &&
             item.toolName && item.toolRoute && 'input' in item &&
             Array.isArray(item.triggers)
           )) {
           parsedHistory.sort((a, b) => b.timestamps[0] - a.timestamps[0]);
           setHistory(parsedHistory);
        } else {
            localStorage.removeItem(HISTORY_LOCAL_STORAGE_KEY); setHistory([]);
        }
      } else { setHistory([]); }
    } catch (error) {
      console.error('[HistoryCtx] Error parsing v3 history:', error);
      localStorage.removeItem(HISTORY_LOCAL_STORAGE_KEY); setHistory([]);
    } finally { setIsLoaded(true); }
  }, []);

  // Save History (useEffect - unchanged)
  useEffect(() => {
    if (isLoaded) {
      try {
        const historyString = JSON.stringify(history);
        localStorage.setItem(HISTORY_LOCAL_STORAGE_KEY, historyString);
      } catch (error) { console.error('[HistoryCtx] Error saving history:', error); }
    }
  }, [history, isLoaded]);

  // Save Settings (useEffect - unchanged)
  useEffect(() => {
      if (isLoaded) {
          try {
              const settings: HistorySettings = { isHistoryEnabled, toolPreferences };
              localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(settings));
          } catch (error) { console.error('[HistoryCtx] Error saving settings:', error); }
      }
  }, [isHistoryEnabled, toolPreferences, isLoaded]);

  // --- NEW: Function to fetch and cache default preference ---
  const fetchToolDefaultPreference = useCallback(async (toolRoute: string): Promise<LoggingPreference> => {
      if (!toolRoute || !toolRoute.startsWith('/t/')) {
          console.warn(`[HistoryCtx] Invalid toolRoute for fetching default: ${toolRoute}`);
          return GLOBAL_DEFAULT_LOGGING;
      }
      // Prevent concurrent fetches for the same route
      if (fetchingDefaultsRef.current.has(toolRoute)) {
          // console.log(`[HistoryCtx] Fetch already in progress for ${toolRoute}`);
          // Another process is fetching, rely on the cache update later, return global default now
          return GLOBAL_DEFAULT_LOGGING;
      }

      fetchingDefaultsRef.current.add(toolRoute); // Mark as fetching

      const directive = toolRoute.substring(3); // Extract 'tool-name' from '/t/tool-name'
      if (!directive) {
           console.warn(`[HistoryCtx] Could not extract directive from route: ${toolRoute}`);
           fetchingDefaultsRef.current.delete(toolRoute);
           return GLOBAL_DEFAULT_LOGGING;
      }

      try {
          console.log(`[HistoryCtx] Fetching default preference for: ${directive}`);
          const response = await fetch(`/api/tool-metadata?directive=${encodeURIComponent(directive)}`);
          const data: MetadataApiResponse = await response.json();

          if (!response.ok || !data.success || !data.metadata?.defaultLogging) {
              throw new Error(data.error || `Failed to fetch or parse default preference for ${directive} (${response.status})`);
          }

          const fetchedDefault = data.metadata.defaultLogging;
          console.log(`[HistoryCtx] Fetched default for ${directive}: ${fetchedDefault}`);

          // Update the cache
          setToolDefaults(prev => ({ ...prev, [toolRoute]: fetchedDefault }));
          fetchingDefaultsRef.current.delete(toolRoute); // Unmark fetching
          return fetchedDefault;

      } catch (error) {
          console.error(`[HistoryCtx] Error fetching default preference for ${toolRoute}:`, error);
          // Optionally cache the global default on error to prevent refetching constantly
          setToolDefaults(prev => ({ ...prev, [toolRoute]: GLOBAL_DEFAULT_LOGGING }));
          fetchingDefaultsRef.current.delete(toolRoute); // Unmark fetching
          return GLOBAL_DEFAULT_LOGGING;
      }
  }, []); // useCallback dependencies are empty as it captures state setters implicitly

  // --- UPDATED getToolLoggingPreference ---
  const getToolLoggingPreference = useCallback((toolRoute: string): LoggingPreference => {
      if (!isLoaded) return GLOBAL_DEFAULT_LOGGING; // Return global default if not loaded

      // 1. Check user-set preferences
      if (toolPreferences[toolRoute]) {
          return toolPreferences[toolRoute];
      }

      // 2. Check cached defaults
      if (toolDefaults[toolRoute]) {
          return toolDefaults[toolRoute];
      }

      // 3. Trigger fetch if not cached and not already fetching
      if (!fetchingDefaultsRef.current.has(toolRoute)) {
          fetchToolDefaultPreference(toolRoute); // Fetch in background
      }

      // 4. Return global default while fetch is in progress or if fetch failed previously
      return GLOBAL_DEFAULT_LOGGING;

  }, [isLoaded, toolPreferences, toolDefaults, fetchToolDefaultPreference]);

  // --- UPDATED setToolLoggingPreference ---
  const setToolLoggingPreference = useCallback(async (toolRoute: string, preference: LoggingPreference) => {
       if (!isLoaded) {
           console.warn("[HistoryCtx] Attempted to set preference before settings loaded.");
           return;
       }

       // 1. Ensure we have the default preference (fetch if needed)
       let defaultPreference = toolDefaults[toolRoute];
       if (!defaultPreference) {
           defaultPreference = await fetchToolDefaultPreference(toolRoute);
           // If fetch failed, defaultPreference will be GLOBAL_DEFAULT_LOGGING
       }

       // 2. Compare and update user preferences
       setToolPreferences(prev => {
           const newPrefs = { ...prev };
           if (preference === defaultPreference) {
               // If setting to default, remove the override
               delete newPrefs[toolRoute];
               console.log(`[HistoryCtx] Preference for ${toolRoute} matches default (${defaultPreference}). Removing override.`);
           } else {
               // If setting to non-default, save the override
               newPrefs[toolRoute] = preference;
                console.log(`[HistoryCtx] Setting preference for ${toolRoute} to ${preference} (default: ${defaultPreference}).`);
           }
           return newPrefs;
       });
       // The useEffect for saving settings will persist this change.

   }, [isLoaded, toolDefaults, fetchToolDefaultPreference]); // Dependencies updated


    // --- addHistoryEntry (Logic to check preference moved inside) ---
    const addHistoryEntry = useCallback((entryData: NewHistoryData) => {
        if (!isHistoryEnabled) return; // Global check

        const toolRoute = entryData.toolRoute;
        // --- Get preference at the time of adding ---
        const preference = getToolLoggingPreference(toolRoute);

        if (preference === 'off') {
            // console.log(`[HistoryCtx] Logging OFF for ${toolRoute}. Skipping entry.`);
            return; // Skip logging if preference is 'off'
        }

        let outputToStore = entryData.output;
        if (preference === 'restrictive') {
            outputToStore = REDACTED_OUTPUT_PLACEHOLDER;
        }
        // console.log(`[HistoryCtx] Logging ${preference} for ${toolRoute}. Output stored: ${outputToStore === REDACTED_OUTPUT_PLACEHOLDER ? 'Redacted' : 'Full'}`);

        const now = Date.now();
        const currentTrigger = entryData.trigger;

        setHistory((prevHistory) => {
            const existingEntryIndex = prevHistory.findIndex(entry => areStatesEqual(entryData, entry));
            let updatedHistory = [...prevHistory];

            if (existingEntryIndex > -1) {
                const existingEntry = updatedHistory[existingEntryIndex];
                const newTimestamps = [now, ...existingEntry.timestamps].sort((a,b) => b-a);
                const uniqueTriggers = new Set(existingEntry.triggers);
                uniqueTriggers.add(currentTrigger);
                const newTriggers = Array.from(uniqueTriggers);
                const updatedEntry: HistoryEntry = {
                    ...existingEntry,
                    timestamps: newTimestamps,
                    triggers: newTriggers,
                    output: outputToStore, // Use potentially redacted output
                    status: entryData.status,
                };
                // Move updated entry to the top
                updatedHistory.splice(existingEntryIndex, 1);
                updatedHistory.unshift(updatedEntry);
            } else {
                const newEntry: HistoryEntry = {
                    toolName: entryData.toolName,
                    toolRoute: entryData.toolRoute,
                    input: entryData.input,
                    output: outputToStore, // Use potentially redacted output
                    status: entryData.status,
                    id: uuidv4(),
                    timestamps: [now],
                    triggers: [currentTrigger],
                };
                updatedHistory.unshift(newEntry);
                if (updatedHistory.length > MAX_HISTORY_ENTRIES) {
                     updatedHistory = updatedHistory.slice(0, MAX_HISTORY_ENTRIES);
                }
            }
            return updatedHistory;
        });

    }, [isHistoryEnabled, getToolLoggingPreference]); // Now depends on getToolLoggingPreference

    // --- Other functions (delete, clear, toggle) remain largely unchanged ---
    const deleteHistoryEntry = useCallback((idToDelete: string) => {
      setHistory((prevHistory) =>
        prevHistory.filter((entry) => entry.id !== idToDelete)
      );
    }, []);

    const clearHistory = useCallback(() => {
      setHistory([]);
      localStorage.removeItem(HISTORY_LOCAL_STORAGE_KEY);
    }, []);

    const clearHistoryForTool = useCallback((toolRoute: string) => {
      setHistory(prevHistory => prevHistory.filter(entry => entry.toolRoute !== toolRoute));
    }, []);

    const toggleHistoryEnabled = useCallback(() => {
          setIsHistoryEnabled(prev => !prev);
    }, []);

    // --- Context Value Memo ---
    const value = useMemo(
      () => ({
        history,
        addHistoryEntry,
        deleteHistoryEntry,
        clearHistory,
        clearHistoryForTool,
        isLoaded,
        isHistoryEnabled,
        toggleHistoryEnabled,
        getToolLoggingPreference,
        setToolLoggingPreference, // Now async
      }),
      // Add fetchToolDefaultPreference temporarily if needed, but it's internal
      [history, addHistoryEntry, deleteHistoryEntry, clearHistory, clearHistoryForTool, isLoaded, isHistoryEnabled, toggleHistoryEnabled, getToolLoggingPreference, setToolLoggingPreference]
    );

    return (
      <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
    );
};