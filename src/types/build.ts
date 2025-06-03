// FILE: src/types/build.ts

export interface ToolGenerationInfoFileContent {
  identifiedDependencies: LibraryDependency[] | null;
  assetInstructions: string | null;
  lintFixesAttempted?: boolean;
  npmDependenciesFulfilled?: 'true' | 'false' | 'absent';
}

export interface ToolReconciliationInfo {
  sha: string;
  toolDirective: string;
  identifiedDependencies: LibraryDependency[] | null;
  assetInstructions: string | null;
}

export interface VetDependencyResult {
  packageName: string;
  isLikelySafeAndRelevant: boolean;
  makesExternalNetworkCalls:
    | 'yes'
    | 'no'
    | 'unknown'
    | 'likely_no'
    | 'likely_yes';
  justification: string;
  popularityIndication?: 'high' | 'medium' | 'low' | 'niche' | 'unknown';
  primaryFunction?: string;
  isRelevant?: boolean;
}

export interface ApiVetDependencyResponse {
  success: boolean;
  message: string;
  vettingResult?: VetDependencyResult | null;
  error?: string;
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
  assetInstructions?: string | null;
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

export interface ApiStatusResponse {
  globalStatus: 'operational' | 'degraded' | 'maintenance';
  featureFlags: {
    favoritesEnabled: boolean;
    recentlyUsedEnabled: boolean;
    recentBuildsEnabled: boolean;
    buildToolEnabled: boolean;
  };
  services?: {
    githubApi?: 'operational' | 'degraded' | 'down';
    aiServices?: 'operational' | 'degraded' | 'down';
  };
  message?: string;
  timestamp: string;
}
