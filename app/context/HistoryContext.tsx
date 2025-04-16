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

// --- Config & Types ---
const HISTORY_LOCAL_STORAGE_KEY = 'oetHistory_v3';
const SETTINGS_LOCAL_STORAGE_KEY = 'oetSettings_v1';
const MAX_HISTORY_ENTRIES = 100;
const REDACTED_OUTPUT_PLACEHOLDER = "[Output Redacted by Setting]";
const GLOBAL_DEFAULT_LOGGING: LoggingPreference = 'on';

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

interface ToolMetadataFromApi {
    defaultLogging?: LoggingPreference;
    [key: string]: unknown;
}

interface MetadataApiResponse {
    success: boolean;
    metadata?: ToolMetadataFromApi;
    error?: string;
}

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
  setToolLoggingPreference: (toolRoute: string, preference: LoggingPreference) => Promise<void>;
}

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

export const HistoryProvider = ({ children }: HistoryProviderProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isHistoryEnabled, setIsHistoryEnabled] = useState<boolean>(true);
  const [toolPreferences, setToolPreferences] = useState<Record<string, LoggingPreference>>({});
  const [toolDefaults, setToolDefaults] = useState<Record<string, LoggingPreference>>({});
  const fetchingDefaultsRef = useRef<Set<string>>(new Set());

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

  // --- UPDATED fetchToolDefaultPreference ---
  const fetchToolDefaultPreference = useCallback(async (toolRoute: string): Promise<LoggingPreference> => {
      if (!toolRoute || !toolRoute.startsWith('/tool/')) {
          console.warn(`[HistoryCtx] Invalid toolRoute for fetching default: ${toolRoute}`);
          fetchingDefaultsRef.current.delete(toolRoute); // Ensure cleanup if invalid route
          return GLOBAL_DEFAULT_LOGGING;
      }
      if (fetchingDefaultsRef.current.has(toolRoute)) {
          return GLOBAL_DEFAULT_LOGGING;
      }

      fetchingDefaultsRef.current.add(toolRoute);

      // *** FIXED DIRECTIVE EXTRACTION ***
      const directive = toolRoute.substring('/tool/'.length).replace(/\/$/, ''); // Corrected extraction

      // *** ADDED DEFENSIVE CHECK FOR INVALID DIRECTIVE FORMAT ***
       if (!directive || directive.includes('/')) {
           console.warn(`[HistoryCtx] Invalid directive extracted ('${directive}') from route: ${toolRoute}. Using global default.`);
           fetchingDefaultsRef.current.delete(toolRoute);
           // Cache the global default to prevent repeated failed fetches for this bad route
           setToolDefaults(prev => ({ ...prev, [toolRoute]: GLOBAL_DEFAULT_LOGGING }));
           return GLOBAL_DEFAULT_LOGGING;
       }
       // *** END ADDED CHECK ***

      try {
          console.log(`[HistoryCtx] Fetching default preference for: ${directive}`);
          const response = await fetch(`/api/tool-metadata?directive=${encodeURIComponent(directive)}`);
          const data: MetadataApiResponse = await response.json();

          // Check for !data.metadata?.defaultLogging is now correct
          if (!response.ok || !data.success || !data.metadata?.defaultLogging) {
              // Use a slightly more informative default message if API didn't provide one
              const errorMsgFromServer = data.error || `API Error (${response.status}) or missing defaultLogging`;
              throw new Error(`Failed to fetch or parse default preference for ${directive}: ${errorMsgFromServer}`);
          }

          const fetchedDefault = data.metadata.defaultLogging;
          console.log(`[HistoryCtx] Fetched default for ${directive}: ${fetchedDefault}`);
          setToolDefaults(prev => ({ ...prev, [toolRoute]: fetchedDefault }));
          return fetchedDefault;

      } catch (error) {
           // Log the specific error encountered
          console.error(`[HistoryCtx] Error fetching default preference for ${toolRoute} (Directive: ${directive}):`, error);
          setToolDefaults(prev => ({ ...prev, [toolRoute]: GLOBAL_DEFAULT_LOGGING }));
          return GLOBAL_DEFAULT_LOGGING;
      } finally {
           fetchingDefaultsRef.current.delete(toolRoute); // Always remove from fetching set
      }
  }, []); // Dependencies remain empty


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
       if (!defaultPreference && !fetchingDefaultsRef.current.has(toolRoute)) { // Avoid fetch if already fetching
           defaultPreference = await fetchToolDefaultPreference(toolRoute);
       }
       // Handle case where fetch is still in progress or failed
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
                const updatedEntry: HistoryEntry = {
                    ...existingEntry,
                    timestamps: newTimestamps,
                    triggers: newTriggers,
                    output: outputToStore,
                    status: entryData.status,
                };
                updatedHistory.splice(existingEntryIndex, 1);
                updatedHistory.unshift(updatedEntry);
            } else {
                const newEntry: HistoryEntry = {
                    toolName: entryData.toolName,
                    toolRoute: entryData.toolRoute,
                    input: entryData.input,
                    output: outputToStore,
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
    }, [isHistoryEnabled, getToolLoggingPreference]);

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