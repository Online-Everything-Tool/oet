// FILE: src/constants/history.ts

// (Moved from app/context/HistoryContext.tsx)
export const HISTORY_LOCAL_STORAGE_KEY = 'oetHistory_v3';
export const SETTINGS_LOCAL_STORAGE_KEY = 'oetSettings_v1';
export const MAX_HISTORY_ENTRIES = 100; // Keep this configurable here if needed
export const REDACTED_OUTPUT_PLACEHOLDER = '[Output Redacted by Setting]';

// Note: GLOBAL_DEFAULT_LOGGING might be better left in HistoryContext
// if it's tightly coupled with the context's logic, or defined here if truly global.
// Let's keep it in HistoryContext for now unless needed elsewhere.
// export const GLOBAL_DEFAULT_LOGGING: LoggingPreference = 'on';
