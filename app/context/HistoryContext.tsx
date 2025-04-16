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
// Import shared types
import type { LoggingPreference, ToolMetadata } from '@/src/types/tools';
// Import history-specific types
import type { TriggerType, HistoryEntry, NewHistoryData } from '@/src/types/history'; // Updated import

import { HISTORY_LOCAL_STORAGE_KEY, SETTINGS_LOCAL_STORAGE_KEY, MAX_HISTORY_ENTRIES, REDACTED_OUTPUT_PLACEHOLDER } from '@/src/constants/history';

const GLOBAL_DEFAULT_LOGGING: LoggingPreference = 'on';

interface HistorySettings {
    isHistoryEnabled: boolean;
    toolPreferences?: Record<string, LoggingPreference>;
}

interface HistoryContextValue {
  history: HistoryEntry[]; // Use imported type
  addHistoryEntry: (entryData: NewHistoryData) => void; // Use imported type
  deleteHistoryEntry: (idToDelete: string) => void;
  clearHistory: () => void;
  clearHistoryForTool: (toolRoute: string) => void;
  isLoaded: boolean;
  isHistoryEnabled: boolean;
  toggleHistoryEnabled: () => void;
  getToolLoggingPreference: (toolRoute: string) => LoggingPreference; // Use imported type
  setToolLoggingPreference: (toolRoute: string, preference: LoggingPreference) => Promise<void>; // Use imported type
}

// areStatesEqual uses imported types implicitly via arguments
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

// Context creation uses imported types implicitly
const HistoryContext = createContext<HistoryContextValue>({
  history: [],
  addHistoryEntry: () => { console.warn('addHistoryEntry called outside of HistoryProvider'); },
  deleteHistoryEntry: () => { console.warn('deleteHistoryEntry called outside of HistoryProvider'); },
  clearHistory: () => { console.warn('clearHistory called outside of HistoryProvider'); },
  clearHistoryForTool: () => { console.warn('clearHistoryForTool called outside of HistoryProvider'); },
  isLoaded: false,
  isHistoryEnabled: true,
  toggleHistoryEnabled: () => { console.warn('toggleHistoryEnabled called outside of HistoryProvider'); },
  getToolLoggingPreference: () => GLOBAL_DEFAULT_LOGGING,
  setToolLoggingPreference: async () => { console.warn('setToolLoggingPreference called outside of HistoryProvider'); },
});

export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (context === undefined) { throw new Error('useHistory must be used within a HistoryProvider'); }
  return context;
};

interface HistoryProviderProps {
  children: ReactNode;
}

// HistoryProvider uses imported types implicitly via state and callbacks
export const HistoryProvider = ({ children }: HistoryProviderProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isHistoryEnabled, setIsHistoryEnabled] = useState<boolean>(true);
  const [toolPreferences, setToolPreferences] = useState<Record<string, LoggingPreference>>({});
  const [toolDefaults, setToolDefaults] = useState<Record<string, LoggingPreference>>({});
  const fetchingDefaultsRef = useRef<Set<string>>(new Set());

  // ... (useEffect for loading/saving remains the same) ...
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
             if (typeof parsedSettings.toolPreferences === 'object' && parsedSettings.toolPreferences !== null) {
                  const validPrefs: Record<string, LoggingPreference> = {};
                  const validPrefValues: LoggingPreference[] = ['on', 'restrictive', 'off'];
                  for (const route in parsedSettings.toolPreferences) {
                      const pref = parsedSettings.toolPreferences[route];
                      if (validPrefValues.includes(pref)) {
                          validPrefs[route] = pref;
                      }
                  }
                  loadedPrefs = validPrefs;
             }
        }
    } catch (error) { console.error('[HistoryCtx] Error parsing settings:', error); }
    setIsHistoryEnabled(loadedEnabledState);
    setToolPreferences(loadedPrefs);
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

  useEffect(() => {
    if (isLoaded) {
      try {
        const historyString = JSON.stringify(history);
        localStorage.setItem(HISTORY_LOCAL_STORAGE_KEY, historyString);
      } catch (error) { console.error('[HistoryCtx] Error saving history:', error); }
    }
  }, [history, isLoaded]);

  useEffect(() => {
      if (isLoaded) {
          try {
              const settings: HistorySettings = { isHistoryEnabled, toolPreferences };
              localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(settings));
          } catch (error) { console.error('[HistoryCtx] Error saving settings:', error); }
      }
  }, [isHistoryEnabled, toolPreferences, isLoaded]);

  // ... (fetchToolDefaultPreference, getToolLoggingPreference, setToolLoggingPreference remain the same) ...
   const fetchToolDefaultPreference = useCallback(async (toolRoute: string): Promise<LoggingPreference> => {
      if (!toolRoute || !toolRoute.startsWith('/tool/')) {
          console.warn(`[HistoryCtx] Invalid toolRoute for fetching default: ${toolRoute}`);
          return GLOBAL_DEFAULT_LOGGING;
      }
      if (fetchingDefaultsRef.current.has(toolRoute)) {
           return GLOBAL_DEFAULT_LOGGING;
      }

      fetchingDefaultsRef.current.add(toolRoute);
      const directive = toolRoute.substring('/tool/'.length).replace(/\/$/, '');

       if (!directive || directive.includes('/')) {
           console.warn(`[HistoryCtx] Invalid directive extracted ('${directive}') from route: ${toolRoute}. Using global default.`);
           fetchingDefaultsRef.current.delete(toolRoute);
           setToolDefaults(prev => ({ ...prev, [toolRoute]: GLOBAL_DEFAULT_LOGGING }));
           return GLOBAL_DEFAULT_LOGGING;
       }

      try {
          console.log(`[HistoryCtx] Fetching default preference for directive: ${directive}`);
          const response = await fetch(`/api/tool-metadata/${directive}.json`);

          if (!response.ok) {
               if (response.status === 404) {
                   console.warn(`[HistoryCtx] Metadata file not found for ${directive}. Using global default.`);
               } else {
                   console.error(`[HistoryCtx] Failed to fetch metadata for ${directive}. Status: ${response.status}. Using global default.`);
               }
               setToolDefaults(prev => ({ ...prev, [toolRoute]: GLOBAL_DEFAULT_LOGGING }));
               return GLOBAL_DEFAULT_LOGGING;
           }

           const data: ToolMetadata = await response.json();

           const fetchedDefault = (['on', 'restrictive', 'off'] as LoggingPreference[]).includes(data?.defaultLogging as LoggingPreference)
             ? data.defaultLogging as LoggingPreference
             : GLOBAL_DEFAULT_LOGGING;

           console.log(`[HistoryCtx] Fetched default for ${directive}: ${fetchedDefault}`);
           setToolDefaults(prev => ({ ...prev, [toolRoute]: fetchedDefault }));
           return fetchedDefault;

      } catch (error) {
          console.error(`[HistoryCtx] Error fetching or parsing default preference for ${toolRoute} (Directive: ${directive}):`, error);
          setToolDefaults(prev => ({ ...prev, [toolRoute]: GLOBAL_DEFAULT_LOGGING }));
          return GLOBAL_DEFAULT_LOGGING;
      } finally {
          fetchingDefaultsRef.current.delete(toolRoute);
      }
  }, []);

  const getToolLoggingPreference = useCallback((toolRoute: string): LoggingPreference => {
      if (!isLoaded) return GLOBAL_DEFAULT_LOGGING;
      if (toolPreferences[toolRoute]) { return toolPreferences[toolRoute]; }
      if (toolDefaults[toolRoute]) { return toolDefaults[toolRoute]; }
      if (!fetchingDefaultsRef.current.has(toolRoute)) { fetchToolDefaultPreference(toolRoute); }
      return GLOBAL_DEFAULT_LOGGING;
  }, [isLoaded, toolPreferences, toolDefaults, fetchToolDefaultPreference]);

  const setToolLoggingPreference = useCallback(async (toolRoute: string, preference: LoggingPreference) => {
       if (!isLoaded) {
           console.warn("[HistoryCtx] Attempted to set preference before settings loaded.");
           return;
       }
       let defaultPreference = toolDefaults[toolRoute];
       if (!defaultPreference && !fetchingDefaultsRef.current.has(toolRoute)) {
           defaultPreference = await fetchToolDefaultPreference(toolRoute);
       }
       if (!defaultPreference) defaultPreference = GLOBAL_DEFAULT_LOGGING;

       setToolPreferences(prev => {
           const newPrefs = { ...prev };
           if (preference === defaultPreference) {
               delete newPrefs[toolRoute];
               console.log(`[HistoryCtx] Preference for ${toolRoute} matches default (${defaultPreference}). Removing override.`);
           } else {
               newPrefs[toolRoute] = preference;
                console.log(`[HistoryCtx] Setting preference for ${toolRoute} to ${preference} (default: ${defaultPreference}).`);
           }
           return newPrefs;
       });
   }, [isLoaded, toolDefaults, fetchToolDefaultPreference]);

  // addHistoryEntry uses imported types implicitly via arguments
  const addHistoryEntry = useCallback((entryData: NewHistoryData) => {
      if (!isHistoryEnabled) return;
      const toolRoute = entryData.toolRoute;
      const preference = getToolLoggingPreference(toolRoute);
      if (preference === 'off') { return; }

      let outputToStore = entryData.output;
      if (preference === 'restrictive') {
          outputToStore = REDACTED_OUTPUT_PLACEHOLDER;
      }

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
              const updatedEntry: HistoryEntry = { // Uses imported type
                  ...existingEntry,
                  timestamps: newTimestamps,
                  triggers: newTriggers,
                  output: outputToStore,
                  status: entryData.status,
              };
              updatedHistory.splice(existingEntryIndex, 1);
              updatedHistory.unshift(updatedEntry);
          } else {
              const newEntry: HistoryEntry = { // Uses imported type
                  toolName: entryData.toolName,
                  toolRoute: entryData.toolRoute,
                  input: entryData.input,
                  output: outputToStore,
                  status: entryData.status,
                  id: uuidv4(),
                  timestamps: [now],
                  triggers: [currentTrigger], // Uses imported type
              };
              updatedHistory.unshift(newEntry);
              if (updatedHistory.length > MAX_HISTORY_ENTRIES) {
                   updatedHistory = updatedHistory.slice(0, MAX_HISTORY_ENTRIES);
              }
          }
          return updatedHistory;
      });
  }, [isHistoryEnabled, getToolLoggingPreference]);

  // ... (deleteHistoryEntry, clearHistory, clearHistoryForTool, toggleHistoryEnabled remain the same) ...
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

  // value memoization remains the same
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
        setToolLoggingPreference,
      }),
      [history, addHistoryEntry, deleteHistoryEntry, clearHistory, clearHistoryForTool, isLoaded, isHistoryEnabled, toggleHistoryEnabled, getToolLoggingPreference, setToolLoggingPreference]
    );

  return (
      <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
    );
};

// Export the types from here as well, so consumers don't *have* to import from two places
// Although importing directly from '@/types/history' is cleaner
export type { HistoryEntry, NewHistoryData, TriggerType };