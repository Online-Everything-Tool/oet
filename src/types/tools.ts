// FILE: src/types/tools.ts
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

interface FileDetails {
  dataType: 'fileReference';
  fileIdStateKey: string;
}

interface InputFileDetails extends FileDetails {
  arrayStateKey?: string;
}

export type StateFiles = InputFileDetails | { dataType: 'none' };

export interface InputConfig {
  acceptsMimeTypes: string[];
  stateFiles: StateFiles[];
}

interface OutputFileDetails extends FileDetails {
  fileCategory: 'image' | 'text' | 'document' | 'archive' | 'other' | '*';
}

interface OutputSelectionDetails {
  dataType: 'selectionReferenceList';
  selectionStateKey: string;
  selectionFileCategory:
    | 'image'
    | 'text'
    | 'document'
    | 'archive'
    | 'other'
    | '*';
}

interface OutputTextDetails {
  dataType: 'text';
  textStateKey: string;
}

interface OutputJsonObjectDetails {
  dataType: 'jsonObject';
  jsonStateKey: string;
}

export type TransferableOutputDetails =
  | OutputFileDetails
  | OutputSelectionDetails
  | OutputTextDetails
  | OutputJsonObjectDetails
  | { dataType: 'none' };

export interface OutputConfig {
  transferableContent: TransferableOutputDetails;
}

export interface ToolMetadata {
  title: string;
  description: string;
  inputConfig: InputConfig;
  outputConfig: OutputConfig;
  urlStateParams?: ParamConfig[];
  tags?: string[];
  includeInSitemap?: boolean;
  status?: string;
  [key: string]: unknown;
}
