// FILE: src/types/tools.ts
export type LoggingPreference = 'on' | 'restrictive' | 'off';

export interface ParamConfig {
  paramName: string;
  type: 'string' | 'enum' | 'boolean' | 'number' | 'json';
  defaultValue: unknown;
}

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

type TextInputDetails = Record<string, unknown>;
type JsonObjectInputDetails = Record<string, unknown>;
type UrlParamsInputDetails = Record<string, unknown>;

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

interface BaseOutputConfig {
  summaryField?: string;
  outputType: 'file' | 'text' | 'json_object' | 'url' | 'none';
  referenceType?: 'imageLibraryId' | 'fileLibraryId' | 'none';
  referenceField?: string;
}

interface FileOutputDetails {
  mimeType: string;
  disposition?: 'inline' | 'attachment';
}

type TextOutputDetails = Record<string, unknown>;
type JsonObjectOutputDetails = Record<string, unknown>;
type UrlOutputDetails = Record<string, unknown>;

export type ToolOutputConfig =
  | (BaseOutputConfig & { outputType: 'file'; details: FileOutputDetails })
  | (BaseOutputConfig & { outputType: 'text'; details?: TextOutputDetails })
  | (BaseOutputConfig & {
      outputType: 'json_object';
      details?: JsonObjectOutputDetails;
    })
  | (BaseOutputConfig & { outputType: 'url'; details?: UrlOutputDetails })
  | (BaseOutputConfig & { outputType: 'none' });

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
