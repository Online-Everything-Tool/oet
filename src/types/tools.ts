// FILE: src/types/tools.ts
export type LoggingPreference = 'on' | 'restrictive' | 'off';

export interface ParamConfig {
  paramName: string;
  type: 'string' | 'enum' | 'boolean' | 'number' | 'json';
  defaultValue: unknown;
}

// --- Input Configuration ---
interface BaseInputConfig {
  id: string;
  description: string;
  type: 'file' | 'text' | 'json_object' | 'url_params_object';
  required: boolean;
}

interface FileInputDetails {
  accept?: string;
  maxCount?: number;
  sourceRestriction?: 'libraryOnly' | 'uploadOnly' | 'any';
}

// Replace empty interface with Record<string, unknown> or keep empty if truly intended as placeholder for future specifics
// Using Record<string, unknown> is generally safer if it should accept *some* object eventually.
// Let's use Record<string, unknown> for now.
type TextInputDetails = Record<string, unknown>; // Was: interface TextInputDetails {}
type JsonObjectInputDetails = Record<string, unknown>; // Was: interface JsonObjectInputDetails {}
type UrlParamsInputDetails = Record<string, unknown>; // Was: interface UrlParamsInputDetails {}

export type ToolInputConfig =
  | (BaseInputConfig & { type: 'file'; details?: FileInputDetails })
  | (BaseInputConfig & { type: 'text'; details?: TextInputDetails }) // Uses type alias
  | (BaseInputConfig & {
      type: 'json_object';
      details?: JsonObjectInputDetails;
    }) // Uses type alias
  | (BaseInputConfig & {
      type: 'url_params_object';
      details?: UrlParamsInputDetails;
    }); // Uses type alias
// --- END: Input Configuration ---

// --- Output Configuration ---
interface BaseOutputConfig {
  summaryField?: string;
  outputType: 'file' | 'text' | 'json_object' | 'url' | 'none';
}

interface FileOutputDetails {
  mimeType: string;
  disposition?: 'inline' | 'attachment';
}

// Replace empty interfaces with Record<string, unknown>
type TextOutputDetails = Record<string, unknown>; // Was: interface TextOutputDetails {}
type JsonObjectOutputDetails = Record<string, unknown>; // Was: interface JsonObjectOutputDetails {}
type UrlOutputDetails = Record<string, unknown>; // Was: interface UrlOutputDetails {}

export type ToolOutputConfig =
  | (BaseOutputConfig & { outputType: 'file'; details: FileOutputDetails })
  | (BaseOutputConfig & { outputType: 'text'; details?: TextOutputDetails }) // Uses type alias
  | (BaseOutputConfig & {
      outputType: 'json_object';
      details?: JsonObjectOutputDetails;
    }) // Uses type alias
  | (BaseOutputConfig & { outputType: 'url'; details?: UrlOutputDetails }) // Uses type alias
  | (BaseOutputConfig & { outputType: 'none' });
// --- END: Output Configuration ---

// --- Main ToolMetadata Interface ---
export interface ToolMetadata {
  title: string;
  description: string;
  inputConfig?: ToolInputConfig[];
  outputConfig?: ToolOutputConfig;
  urlStateParams?: ParamConfig[];
  defaultLogging?: LoggingPreference;
  tags?: string[];
  iconName?: string | null;
  includeInSitemap?: boolean;
  status?: string;
  [key: string]: unknown;
}
