// FILE: src/types/build.ts

export interface ResouceGenerationEpicChapter {
  chapterEmoji: string;
  chapterStory: string;
}

export interface ResouceGenerationEpic {
  epicCompanyName: string;
  epicCompanyEmoji: string;
  epicCompanyEmployeeName: string;
  epicCompanyJobTitle: string;
  epicCompanyEmployeeEmoji: string;
  epicNarrative: ResouceGenerationEpicChapter[];
}

export interface AiModel {
  name: string;
  displayName: string;
  version: string;
}

export interface ValidationResult {
  generativeDescription: string;
  generativeRequestedDirectives: string[];
}

export interface LibraryDependency {
  packageName: string;
  reason?: string;
  importUsed?: string;
}

export interface GenerationResult {
  message: string;

  generatedFiles: Record<string, string> | null;
  identifiedDependencies: LibraryDependency[] | null;
}

export interface PrSubmissionResult {
  prUrl: string | null;
  message: string;
}

export interface ApiValidationResponseData {
  success: boolean;
  message: string;
  generativeDescription: string | null;
  generativeRequestedDirectives: string[];
}

export interface ApiGenerationResponseData extends GenerationResult {
  success: boolean;
}

export interface ApiPrSubmissionResponseData {
  success: boolean;
  message: string;
  url?: string | null;
}

export interface ApiListModelsResponse {
  models: AiModel[];
  error?: string;
}

export interface ApiListDirectivesResponse {
  directives: string[];
  error?: string;
}
