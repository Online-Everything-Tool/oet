// FILE: app/context/HistoryContext.tsx
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
import { v4 as uuidv4 } from 'uuid';

// --- Config & Types ---
const HISTORY_LOCAL_STORAGE_KEY = 'oetHistory_v3';
const SETTINGS_LOCAL_STORAGE_KEY = 'oetSettings_v1';
const MAX_HISTORY_ENTRIES = 100;
const REDACTED_OUTPUT_PLACEHOLDER = "[Output Redacted by Setting]";

export type TriggerType = 'click' | 'query' | 'auto' | 'transfer' | 'upload';
// --- UPDATED LoggingPreference Type ---
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

interface HistorySettings {
    isHistoryEnabled: boolean;
    toolPreferences?: Record<string, LoggingPreference>;
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
  setToolLoggingPreference: (toolRoute: string, preference: LoggingPreference) => void;
}

// --- Helper: areStatesEqual ---
function areStatesEqual(entry1: NewHistoryData, entry2: HistoryEntry): boolean {
    if (entry1.toolRoute !== entry2.toolRoute) return false;
    try {
        // Only compare input/options object for equality
        const inputEqual = JSON.stringify(entry1.input ?? {}) === JSON.stringify(entry2.input ?? {});
        return inputEqual;
    } catch (e) {
        console.warn("[HistoryCtx] Error comparing history states with JSON.stringify:", e);
        // Fallback to reference equality or assume not equal on error
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
  // --- UPDATED Default Preference ---
  getToolLoggingPreference: () => 'restrictive',
  setToolLoggingPreference: () => { console.warn('setToolLoggingPreference called outside of HistoryProvider'); },
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
                  // --- VALIDATE Stored Preferences ---
                  const validPrefs: Record<string, LoggingPreference> = {};
                  for (const route in parsedSettings.toolPreferences) {
                      const pref = parsedSettings.toolPreferences[route];
                      if (pref === 'on' || pref === 'restrictive' || pref === 'off' || pref === 'log_all' || pref === 'log_inputs_only' || pref === 'log_nothing') {
                          // --- MAP Old values to New values during load ---
                          let mappedPref: LoggingPreference = 'restrictive'; // Default map
                          if (pref === 'on' || pref === 'log_all') mappedPref = 'on';
                          else if (pref === 'restrictive' || pref === 'log_inputs_only') mappedPref = 'restrictive';
                          else if (pref === 'off' || pref === 'log_nothing') mappedPref = 'off';
                          validPrefs[route] = mappedPref;
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
            localStorage.removeItem(HISTORY_LOCAL_STORAGE_KEY);
            setHistory([]);
        }
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('[HistoryCtx] Error parsing v3 history:', error);
      localStorage.removeItem(HISTORY_LOCAL_STORAGE_KEY); setHistory([]);
    } finally {
        setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        const historyString = JSON.stringify(history);
        localStorage.setItem(HISTORY_LOCAL_STORAGE_KEY, historyString);
      } catch (error) {
        console.error('[HistoryCtx] Error saving history:', error);
      }
    }
  }, [history, isLoaded]);

  useEffect(() => {
      if (isLoaded) {
          try {
              const settings: HistorySettings = { isHistoryEnabled, toolPreferences };
              localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(settings));
          } catch (error) {
               console.error('[HistoryCtx] Error saving settings:', error);
          }
      }
  }, [isHistoryEnabled, toolPreferences, isLoaded]);


  const getToolLoggingPreference = useCallback((toolRoute: string): LoggingPreference => {
      // --- UPDATED Default ---
      return toolPreferences[toolRoute] || 'restrictive';
  }, [toolPreferences]);

  const setToolLoggingPreference = useCallback((toolRoute: string, preference: LoggingPreference) => {
       setToolPreferences(prev => {
           const newPrefs = { ...prev, [toolRoute]: preference };
           return newPrefs;
       });
   }, []);

  const addHistoryEntry = useCallback((entryData: NewHistoryData) => {
      if (!isHistoryEnabled) return;

      const toolRoute = entryData.toolRoute;
      const preference = getToolLoggingPreference(toolRoute);

      // --- UPDATED Check ---
      if (preference === 'off') {
          return;
      }

      let outputToStore = entryData.output;
      // --- UPDATED Check ---
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
              const updatedEntry: HistoryEntry = {
                  ...existingEntry,
                  timestamps: newTimestamps,
                  triggers: newTriggers,
                  output: outputToStore, // Use potentially redacted output
                  status: entryData.status,
              };
              updatedHistory[existingEntryIndex] = updatedEntry;
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

  }, [isHistoryEnabled, getToolLoggingPreference]); // Dependencies unchanged

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