// FILE: src/types/tools.ts

/**
 * Defines the user's preference for history logging for a tool.
 * - 'on': Log everything (input and output).
 * - 'restrictive': Log input, but redact or summarize output.
 * - 'off': Log nothing for this tool.
 */
export type LoggingPreference = 'on' | 'restrictive' | 'off';

/**
 * Configuration for a URL state parameter that a tool might use.
 */
export interface ParamConfig {
  paramName: string;
  type: 'string' | 'enum' | 'boolean' | 'number' | 'json';
  defaultValue: unknown; // Consider making this more specific if possible, or T based on type
}

// --- Input Configuration ---

/**
 * Base properties for any tool input configuration.
 */
interface BaseInputConfig {
  /** A unique identifier for this input within the tool's inputConfig array.
   *  Useful if a tool has multiple inputs of the same type (e.g., two file inputs).
   */
  id: string;
  /** A user-friendly description of what this input is for. */
  description: string;
  /** The general type of input expected. */
  type: 'file' | 'text' | 'json_object' | 'url_params_object'; // url_params_object for complex state from URL
  /** Is this input required for the tool to function? */
  required: boolean;
}

/**
 * Specific details for an input of type 'file'.
 */
interface FileInputDetails {
  /** Standard HTML accept attribute string (e.g., "image/*", ".json, text/plain"). */
  accept?: string;
  /** Maximum number of files allowed for this input (default is 1 if not 'multiple'). */
  maxCount?: number;
  /** Restriction on where the file can come from (relevant for FileSelectionModal). */
  sourceRestriction?: 'libraryOnly' | 'uploadOnly' | 'any';
  /** Hint for the "Send To..." mechanism: Can this input handle data sent from another tool? */
  canReceiveFromTool?: boolean;
}

/** Placeholder for text input specific details (e.g., min/max length, pattern). */
type TextInputDetails = Record<string, unknown> & {
  placeholder?: string;
  canReceiveFromTool?: boolean; // Can this text input receive output from another tool?
};

/** Placeholder for JSON object input specific details. */
type JsonObjectInputDetails = Record<string, unknown> & {
  schema?: string; // URI to a JSON schema for validation (conceptual)
  canReceiveFromTool?: boolean;
};

/** Placeholder for URL parameters object input specific details. */
type UrlParamsInputDetails = Record<string, unknown>; // Typically handled by direct URL parsing or useToolUrlState

/**
 * Discriminated union for defining a tool's input.
 * A tool can have an array of these in its metadata's `inputConfig`.
 */
export type ToolInputConfig =
  | (BaseInputConfig & { type: 'file'; details?: FileInputDetails })
  | (BaseInputConfig & { type: 'text'; details?: TextInputDetails })
  | (BaseInputConfig & {
      type: 'json_object';
      details?: JsonObjectInputDetails;
    })
  | (BaseInputConfig & {
      type: 'url_params_object';
      details?: UrlParamsInputDetails;
    });

// --- Output Configuration ---

/**
 * Base properties for any tool output configuration.
 */
interface BaseOutputConfig {
  /** A unique identifier for this output within the tool's outputConfig array.
   *  Crucial if a tool can produce multiple distinct outputs.
   */
  id: string;
  /** A user-friendly description of what this output represents. */
  description: string;
  /** The general type of output produced. */
  outputType: 'file' | 'text' | 'json_object' | 'url' | 'none'; // 'url' for things like generated links
  /** For object outputs, which field contains a human-readable summary? (Used for history). */
  summaryField?: string;
  /** If output refers to a file in a library, what kind of ID is it? */
  referenceType?: 'imageLibraryId' | 'fileLibraryId' | 'none';
  /** If referenceType is used, which field in the output object holds this ID? */
  referenceField?: string;
  /** Hint for the "Send To..." mechanism: Can this output be sent to another tool? */
  canSendToTool?: boolean;
}

/**
 * Specific details for an output of type 'file'.
 */
interface FileOutputDetails {
  /** The MIME type of the generated file (e.g., "image/png", "application/json", "text/plain").
   *  Can include profiles like "application/json;profile=oet-tiptap-document".
   */
  mimeType: string;
  /** Suggested filename disposition if downloaded. */
  suggestedFilename?: string; // e.g., "converted-image.png" (tool can add timestamps)
  dispositionHint?: 'inline' | 'attachment'; // Hint for browser if it were a direct link
}

/** Placeholder for text output specific details. */
type TextOutputDetails = Record<string, unknown>;

/** Placeholder for JSON object output specific details. */
type JsonObjectOutputDetails = Record<string, unknown>;

/** Placeholder for URL output specific details (e.g. if it's a shareable link). */
type UrlOutputDetails = Record<string, unknown> & {
  isShortened?: boolean; // Example detail
};

/**
 * Discriminated union for defining a tool's output.
 * A tool can have an array of these in its metadata's `outputConfig`.
 */
export type ToolOutputConfig =
  | (BaseOutputConfig & { outputType: 'file'; details: FileOutputDetails })
  | (BaseOutputConfig & { outputType: 'text'; details?: TextOutputDetails })
  | (BaseOutputConfig & {
      outputType: 'json_object';
      details?: JsonObjectOutputDetails;
    })
  | (BaseOutputConfig & { outputType: 'url'; details?: UrlOutputDetails })
  | (BaseOutputConfig & { outputType: 'none' }); // For tools that don't have a primary "data" output

// --- Tool Metadata ---

/**
 * The structure for a tool's metadata.json file.
 */
export interface ToolMetadata {
  title: string;
  description: string;
  /** Array of input configurations. Allows a tool to accept multiple types/sources of input. */
  inputConfig?: ToolInputConfig[];
  /** Array of output configurations. Allows a tool to produce multiple types/formats of output. */
  outputConfig?: ToolOutputConfig[]; // Changed to an array
  /** For simple URL parameter to state mapping, if not handled by more complex inputConfig. */
  urlStateParams?: ParamConfig[];
  defaultLogging?: LoggingPreference;
  tags?: string[];
  iconName?: string | null; // For display in tool lists, etc.
  includeInSitemap?: boolean;
  status?: 'stable' | 'beta' | 'alpha' | 'deprecated'; // Development status
  version?: string; // Tool version
  [key: string]: unknown; // Allows for other tool-specific metadata
}
