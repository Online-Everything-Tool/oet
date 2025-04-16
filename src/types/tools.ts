// FILE: types/tool.ts

// Define LoggingPreference type (moved from HistoryContext)
export type LoggingPreference = 'on' | 'restrictive' | 'off';

// Define ParamConfig interface (moved from useToolUrlState)
export interface ParamConfig {
    paramName: string;
    type: 'string' | 'enum' | 'boolean' | 'number' | 'json';
    defaultValue: unknown;
}

// Define the consolidated ToolMetadata interface
export interface ToolMetadata {
    // Required fields expected in most metadata.json
    title: string;
    description: string;

    // Optional fields used by various parts of the app
    urlStateParams?: ParamConfig[];
    outputConfig?: {
        summaryField?: string;
        referenceType?: 'imageLibraryId'; // Currently only supports image library
        referenceField?: string;          // Key in the output object holding the ID
    };
    defaultLogging?: LoggingPreference;
    tags?: string[];
    iconName?: string | null;
    includeInSitemap?: boolean;
    status?: string; // e.g., 'stable', 'beta', 'experimental'

    // Allow any other fields that might be present in specific metadata files
    [key: string]: unknown;
}

// Optional: You might want a type for the history output object structure
// if it becomes complex, but for now, keep it inferred or define elsewhere.
// export interface ToolHistoryOutput { ... }