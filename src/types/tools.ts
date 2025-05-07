// FILE: types/tool.ts

export type LoggingPreference = 'on' | 'restrictive' | 'off';

export interface ParamConfig {
  paramName: string;
  type: 'string' | 'enum' | 'boolean' | 'number' | 'json';
  defaultValue: unknown;
}

export interface ToolMetadata {
  title: string;
  description: string;

  urlStateParams?: ParamConfig[];
  outputConfig?: {
    summaryField?: string;
    referenceType?: 'imageLibraryId';
    referenceField?: string;
  };
  defaultLogging?: LoggingPreference;
  tags?: string[];
  iconName?: string | null;
  includeInSitemap?: boolean;
  status?: string;

  [key: string]: unknown;
}
