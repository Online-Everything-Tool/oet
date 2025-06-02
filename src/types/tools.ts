// FILE: src/types/tools.ts

import type { RecentToolEntry } from '@/app/context/RecentlyUsedContext';

export interface ParamConfig {
  paramName: string;
  type: 'string' | 'enum' | 'boolean' | 'number' | 'json';
  defaultValue: unknown;
}

export interface DiscoveredTarget {
  title: string;
  route: string;
  directive: string;
  description: string;
}

export interface StateFile {
  stateKey: string;
  arrayStateKey?: string;
}

export interface ReferenceDetails extends StateFile {
  dataType: 'reference';
}

export interface InputConfig {
  acceptsMimeTypes: string[];
  stateFiles: StateFile[] | 'none';
}

export interface InlineDetails {
  dataType: 'inline';
  stateKey: string;
  mimeType: string;
}

export interface OutputConfig {
  transferableContent: (ReferenceDetails | InlineDetails)[] | 'none';
}

export interface ToolMetadata {
  title: string;
  directive: string;
  description: string;
  inputConfig: InputConfig;
  outputConfig: OutputConfig;
  urlStateParams?: ParamConfig[];
  tags?: string[];
  includeInSitemap?: boolean;
  status?: string;
  [key: string]: unknown;
}

export type CustomRecentActivityPreviewFn = (
  currentState: Record<string, unknown>,
  metadata: ToolMetadata
) => Partial<RecentToolEntry> | null;

export interface ResourceGenerationEpicChapter {
  chapterEmoji: string;
  chapterStory: string;
}

export interface ResourceGenerationEpic {
  epicCompanyName: string;
  epicCompanyEmoji: string;
  epicCompanyEmployeeName: string;
  epicCompanyEmployeeGithub: string | null;
  epicCompanyJobTitle: string;
  epicCompanyEmployeeEmoji: string;
  epicNarrative: ResourceGenerationEpicChapter[];
}
