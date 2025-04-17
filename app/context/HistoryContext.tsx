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
import type { OetDatabase } from '../lib/db';
import type { LoggingPreference, ToolMetadata } from '@/src/types/tools';
import type { TriggerType, HistoryEntry, NewHistoryData } from '@/src/types/history';
import { SETTINGS_LOCAL_STORAGE_KEY, MAX_HISTORY_ENTRIES, REDACTED_OUTPUT_PLACEHOLDER } from '@/src/constants/history';

const GLOBAL_DEFAULT_LOGGING: LoggingPreference = 'on';

// --- Fully Defined Interfaces ---

// Describes the structure of settings saved in localStorage
interface HistorySettings {
    isHistoryEnabled: boolean;
    // Key: toolRoute (e.g., "/tool/base64-encoder-decoder/"), Value: preference
    toolPreferences?: Record<string, LoggingPreference>;
}

// Defines the shape of the value provided by the context
interface HistoryContextValue {
  history: HistoryEntry[];
  addHistoryEntry: (entryData: NewHistoryData) => Promise<void>;
  deleteHistoryEntry: (idToDelete: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  clearHistoryForTool: (toolRoute: string) => Promise<void>;
  isLoaded: boolean; // Combined loaded state (settings + history)
  isLoadingHistory: boolean; // Specifically for DB operations
  historyError: string | null;
  isHistoryEnabled: boolean;
  toggleHistoryEnabled: () => void;
  getToolLoggingPreference: (toolRoute: string) => LoggingPreference;
  setToolLoggingPreference: (toolRoute: string, preference: LoggingPreference) => Promise<void>;
}
// --- End Interfaces ---


// Context creation with proper default implementations (warning functions)
const HistoryContext = createContext<HistoryContextValue>({
  history: [],
  addHistoryEntry: async () => { console.warn('HistoryContext: addHistoryEntry called before provider.') },
  deleteHistoryEntry: async () => { console.warn('HistoryContext: deleteHistoryEntry called before provider.') },
  clearHistory: async () => { console.warn('HistoryContext: clearHistory called before provider.') },
  clearHistoryForTool: async () => { console.warn('HistoryContext: clearHistoryForTool called before provider.') },
  isLoaded: false,
  isLoadingHistory: true, // Default to loading initially
  historyError: null,
  isHistoryEnabled: true, // Default enabled state before loading settings
  toggleHistoryEnabled: () => { console.warn('HistoryContext: toggleHistoryEnabled called before provider.') },
  getToolLoggingPreference: () => GLOBAL_DEFAULT_LOGGING,
  setToolLoggingPreference: async () => { console.warn('HistoryContext: setToolLoggingPreference called before provider.') },
});

// --- useHistory Hook Implementation ---
export const useHistory = (): HistoryContextValue => { // Added return type annotation
  const context = useContext(HistoryContext);
  if (context === undefined) {
    // Provide a more informative error message
    throw new Error('useHistory hook must be used within a HistoryProvider component tree.');
  }
  return context; // Return the context value
};
// --- End useHistory Hook ---

// areInputsEqual function remains the same
function areInputsEqual(input1: unknown, input2: unknown): boolean {
    // Simple comparison for null/undefined
    if (input1 === null || input1 === undefined) {
        return input2 === null || input2 === undefined;
    }
    if (input2 === null || input2 === undefined) {
        // input1 is not null/undefined here, so they can't be equal
        return false;
    }

    // Stringify for objects/arrays, basic comparison otherwise
    try {
        if (typeof input1 === 'object' && typeof input2 === 'object') {
            // Use JSON.stringify for deep comparison of object structures
            return JSON.stringify(input1) === JSON.stringify(input2);
        }
        // Handle primitives, allow type coercion for comparison (e.g., '5' vs 5)
        // Using String() handles numbers, booleans, strings appropriately here.
        return String(input1) === String(input2);
    } catch (e) {
        // Catch potential errors during stringification (e.g., circular references)
        console.warn("[HistoryCtx] Error comparing history inputs via JSON.stringify:", e);
        // Fallback to strict equality if stringify fails
        return input1 === input2;
    }
}

interface HistoryProviderProps {
  children: ReactNode;
}

export const HistoryProvider = ({ children }: HistoryProviderProps) => {
  // ... (state, refs, effects, callbacks, value memoization - all as implemented in the previous correct version) ...
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState<boolean>(false);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryEnabled, setIsHistoryEnabled] = useState<boolean>(true);
  const [toolPreferences, setToolPreferences] = useState<Record<string, LoggingPreference>>({});
  const [toolDefaults, setToolDefaults] = useState<Record<string, LoggingPreference>>({});
  const fetchingDefaultsRef = useRef<Set<string>>(new Set());
  const dbRef = useRef<OetDatabase | null>(null);

  // Effect 0: Initialize DB instance on client
  useEffect(() => {
      import('../lib/db').then((dbModule) => {
          dbRef.current = dbModule.db;
          console.log("[HistoryCtx] Dexie DB instance assigned to ref.");
          loadHistoryFromDb(); // Trigger initial load *after* db is set
      }).catch(err => {
           console.error("[HistoryCtx] Failed to dynamically import db:", err);
           setHistoryError("Failed to initialize database.");
           setIsLoadingHistory(false);
           setIsHistoryLoaded(true);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 1: Load Settings from localStorage
  useEffect(() => {
    let loadedEnabledState = true; let loadedPrefs: Record<string, LoggingPreference> = {};
    try { const storedSettings = localStorage.getItem(SETTINGS_LOCAL_STORAGE_KEY); if (storedSettings) { const parsedSettings: Partial<HistorySettings> = JSON.parse(storedSettings); if (typeof parsedSettings.isHistoryEnabled === 'boolean') { loadedEnabledState = parsedSettings.isHistoryEnabled; } if (typeof parsedSettings.toolPreferences === 'object' && parsedSettings.toolPreferences !== null) { const validPrefs: Record<string, LoggingPreference> = {}; const validPrefValues: LoggingPreference[] = ['on', 'restrictive', 'off']; for (const route in parsedSettings.toolPreferences) { if (Object.prototype.hasOwnProperty.call(parsedSettings.toolPreferences, route)) { const pref = parsedSettings.toolPreferences[route]; if (validPrefValues.includes(pref)) { validPrefs[route] = pref; } else { console.warn(`[HistoryCtx] Ignoring invalid stored preference for ${route}: ${pref}`); } } } loadedPrefs = validPrefs; } }
    } catch (error) { console.error('[HistoryCtx] Error parsing settings from localStorage:', error); }
    setIsHistoryEnabled(loadedEnabledState); setToolPreferences(loadedPrefs); setIsSettingsLoaded(true); console.log("[HistoryCtx] Settings loaded from localStorage.", { isHistoryEnabled: loadedEnabledState, toolPreferences: loadedPrefs });
  }, []);

  // Effect 2: Load History from Dexie
  const loadHistoryFromDb = useCallback(async () => {
    if (!dbRef.current) { console.log("[HistoryCtx] loadHistoryFromDb called before DB ref initialized. Skipping."); return; }
    const db = dbRef.current; setIsLoadingHistory(true); setHistoryError(null);
    try { if (!db.historyEntries) throw new Error("Database 'historyEntries' table not available."); const loadedHistory = await db.historyEntries.orderBy('lastUsed').reverse().limit(MAX_HISTORY_ENTRIES + 50).toArray(); setHistory(loadedHistory); console.log(`[HistoryCtx] Loaded ${loadedHistory.length} history entries from Dexie.`); setIsHistoryLoaded(true);
    } catch (error) { console.error("[HistoryCtx] Error loading history from Dexie:", error); const message = error instanceof Error ? error.message : "Unknown database error"; setHistoryError(`Failed to load history: ${message}`); setHistory([]); setIsHistoryLoaded(true); }
    finally { setIsLoadingHistory(false); }
  }, []);

  // Effect 3: Save Settings to localStorage
  useEffect(() => {
      if (isSettingsLoaded) { try { const settings: HistorySettings = { isHistoryEnabled, toolPreferences }; localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(settings)); } catch (error) { console.error('[HistoryCtx] Error saving settings to localStorage:', error); } }
  }, [isHistoryEnabled, toolPreferences, isSettingsLoaded]);

  // --- Preferences Logic ---
  const fetchToolDefaultPreference = useCallback(async (toolRoute: string): Promise<LoggingPreference> => {
      if (!toolRoute || !toolRoute.startsWith('/tool/')) return GLOBAL_DEFAULT_LOGGING; if (toolDefaults[toolRoute]) return toolDefaults[toolRoute]; if (fetchingDefaultsRef.current.has(toolRoute)) return GLOBAL_DEFAULT_LOGGING; fetchingDefaultsRef.current.add(toolRoute); const directive = toolRoute.substring('/tool/'.length).replace(/\/$/, ''); if (!directive || directive.includes('/')) { fetchingDefaultsRef.current.delete(toolRoute); setToolDefaults(prev => ({ ...prev, [toolRoute]: GLOBAL_DEFAULT_LOGGING })); return GLOBAL_DEFAULT_LOGGING; } let fetchedDefault: LoggingPreference = GLOBAL_DEFAULT_LOGGING;
      try { /* ... fetch logic ... */ const response = await fetch(`/api/tool-metadata/${directive}.json`); if(response.ok){ const data: ToolMetadata = await response.json(); const validPrefs: LoggingPreference[] = ['on', 'restrictive', 'off']; const metadataDefault = data?.defaultLogging as LoggingPreference; if(metadataDefault && validPrefs.includes(metadataDefault)) fetchedDefault = metadataDefault; else console.warn(`[HistoryCtx] Metadata for ${directive} missing or has invalid defaultLogging. Using global default.`);} else console.warn(`[HistoryCtx] Metadata not found or failed for ${directive} (Status: ${response.status}). Using global default.`);}
      catch (error) { console.error(`[HistoryCtx] Error fetching/parsing default preference for ${toolRoute}:`, error); } finally { setToolDefaults(prev => ({ ...prev, [toolRoute]: fetchedDefault })); fetchingDefaultsRef.current.delete(toolRoute); } return fetchedDefault;
  }, [toolDefaults]);

  const getToolLoggingPreference = useCallback((toolRoute: string): LoggingPreference => {
      if (!isSettingsLoaded) return GLOBAL_DEFAULT_LOGGING; if (toolPreferences[toolRoute]) return toolPreferences[toolRoute]; if (toolDefaults[toolRoute]) return toolDefaults[toolRoute]; if (!fetchingDefaultsRef.current.has(toolRoute)) { fetchToolDefaultPreference(toolRoute); } return GLOBAL_DEFAULT_LOGGING;
  }, [isSettingsLoaded, toolPreferences, toolDefaults, fetchToolDefaultPreference]);

  const setToolLoggingPreference = useCallback(async (toolRoute: string, preference: LoggingPreference) => {
      if (!isSettingsLoaded) return; let defaultPreference = toolDefaults[toolRoute]; if (!defaultPreference && !fetchingDefaultsRef.current.has(toolRoute)) { defaultPreference = await fetchToolDefaultPreference(toolRoute); } defaultPreference = defaultPreference || GLOBAL_DEFAULT_LOGGING;
      setToolPreferences(prev => { const newPrefs = { ...prev }; if (preference === defaultPreference) { delete newPrefs[toolRoute]; console.log(`[HistoryCtx] Preference for ${toolRoute} matches default (${defaultPreference}). Removing override.`); } else { newPrefs[toolRoute] = preference; console.log(`[HistoryCtx] Setting preference for ${toolRoute} to ${preference} (default: ${defaultPreference}).`); } return newPrefs; });
  }, [isSettingsLoaded, toolDefaults, fetchToolDefaultPreference]);

  // --- History Actions ---
  const addHistoryEntry = useCallback(async (entryData: NewHistoryData): Promise<void> => {
      if (!dbRef.current) { console.error("[HistoryCtx] addHistoryEntry: DB not initialized."); return; } const db = dbRef.current; if (!isSettingsLoaded || !isHistoryEnabled) return; const toolRoute = entryData.toolRoute; const preference = getToolLoggingPreference(toolRoute); if (preference === 'off') return; let outputToStore = entryData.output; if (preference === 'restrictive') outputToStore = REDACTED_OUTPUT_PLACEHOLDER; const now = Date.now(); const currentTrigger = entryData.trigger; setIsLoadingHistory(true); setHistoryError(null);
      try { if (!db.historyEntries) throw new Error("Database 'historyEntries' table not available."); const existingEntriesForTool = await db.historyEntries.where('toolRoute').equals(toolRoute).toArray(); const existingEntry = existingEntriesForTool.find(entry => areInputsEqual(entryData.input, entry.input)); if (existingEntry) { const newTimestamps = [now, ...existingEntry.timestamps].sort((a, b) => b - a).slice(0, 50); const uniqueTriggers = new Set(existingEntry.triggers); uniqueTriggers.add(currentTrigger); await db.historyEntries.update(existingEntry.id, { timestamps: newTimestamps, triggers: Array.from(uniqueTriggers).slice(0, 10), output: outputToStore, status: entryData.status, lastUsed: now }); console.log(`[HistoryCtx] Updated entry ${existingEntry.id} in Dexie.`); } else { const newEntry: HistoryEntry = { toolName: entryData.toolName, toolRoute: entryData.toolRoute, input: entryData.input, output: outputToStore, status: entryData.status, id: uuidv4(), timestamps: [now], triggers: [currentTrigger], lastUsed: now }; await db.historyEntries.add(newEntry); console.log(`[HistoryCtx] Added new entry ${newEntry.id} to Dexie.`); const currentCount = await db.historyEntries.count(); if (currentCount > MAX_HISTORY_ENTRIES) { const excessCount = currentCount - MAX_HISTORY_ENTRIES; const oldestEntries = await db.historyEntries.orderBy('lastUsed').limit(excessCount).primaryKeys(); await db.historyEntries.bulkDelete(oldestEntries); console.log(`[HistoryCtx] Pruned ${oldestEntries.length} oldest history entries.`); } } await loadHistoryFromDb(); }
      catch (error) { console.error("[HistoryCtx] Error adding/updating history entry in Dexie:", error); const message = error instanceof Error ? error.message : "Unknown database error"; setHistoryError(`Failed to save history: ${message}`); } finally { setIsLoadingHistory(false); }
  }, [isSettingsLoaded, isHistoryEnabled, getToolLoggingPreference, loadHistoryFromDb]);

  const deleteHistoryEntry = useCallback(async (idToDelete: string): Promise<void> => {
      if (!dbRef.current) return; const db = dbRef.current; setIsLoadingHistory(true); setHistoryError(null);
      try { if (!db.historyEntries) throw new Error("Table not available."); await db.historyEntries.delete(idToDelete); setHistory(prev => prev.filter(entry => entry.id !== idToDelete)); console.log(`[HistoryCtx] Deleted entry ${idToDelete}.`); }
      catch (error) { console.error(`[HistoryCtx] Error deleting entry ${idToDelete}:`, error); const message = error instanceof Error ? error.message : "Unknown DB error"; setHistoryError(`Failed to delete entry: ${message}`); } finally { setIsLoadingHistory(false); }
  }, []);

  const clearHistory = useCallback(async (): Promise<void> => {
      if (!dbRef.current) return; const db = dbRef.current; setIsLoadingHistory(true); setHistoryError(null);
      try { if (!db.historyEntries) throw new Error("Table not available."); await db.historyEntries.clear(); setHistory([]); console.log(`[HistoryCtx] Cleared all history.`); }
      catch (error) { console.error("[HistoryCtx] Error clearing history:", error); const message = error instanceof Error ? error.message : "Unknown DB error"; setHistoryError(`Failed to clear history: ${message}`); } finally { setIsLoadingHistory(false); }
  }, []);

  const clearHistoryForTool = useCallback(async (toolRoute: string): Promise<void> => {
      if (!dbRef.current) return; const db = dbRef.current; setIsLoadingHistory(true); setHistoryError(null);
      try { if (!db.historyEntries) throw new Error("Table not available."); await db.historyEntries.where('toolRoute').equals(toolRoute).delete(); setHistory(prev => prev.filter(entry => entry.toolRoute !== toolRoute)); console.log(`[HistoryCtx] Cleared history for tool ${toolRoute}.`); }
      catch (error) { console.error(`[HistoryCtx] Error clearing history for tool ${toolRoute}:`, error); const message = error instanceof Error ? error.message : "Unknown DB error"; setHistoryError(`Failed to clear history for tool: ${message}`); } finally { setIsLoadingHistory(false); }
  }, []);

  const toggleHistoryEnabled = useCallback(() => {
    if (!isSettingsLoaded) return; setIsHistoryEnabled(prev => !prev);
  }, [isSettingsLoaded]);

  // --- Combined loaded state & Memoized context value ---
  const isLoaded = isSettingsLoaded && isHistoryLoaded;
  const value = useMemo(
    () => ({ history, addHistoryEntry, deleteHistoryEntry, clearHistory, clearHistoryForTool, isLoaded, isLoadingHistory, historyError, isHistoryEnabled, toggleHistoryEnabled, getToolLoggingPreference, setToolLoggingPreference }),
    [ history, addHistoryEntry, deleteHistoryEntry, clearHistory, clearHistoryForTool, isLoaded, isLoadingHistory, historyError, isHistoryEnabled, toggleHistoryEnabled, getToolLoggingPreference, setToolLoggingPreference ]
  );

  return ( <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider> );
};

export type { HistoryEntry, NewHistoryData, TriggerType };