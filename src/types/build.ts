// FILE: src/types/build.ts

// (Moved from app/build-tool/page.tsx)
export interface AiModel {
    name: string;
    displayName: string;
    version: string;
}

// (Moved from app/build-tool/page.tsx)
export interface ValidationResult {
    generativeDescription: string;
    generativeRequestedDirectives: string[];
}

// (Moved from app/build-tool/page.tsx)
export interface LibraryDependency {
    packageName: string;
    reason?: string;
    importUsed?: string;
}

// (Moved from app/build-tool/page.tsx)
export interface GenerationResult {
    message: string;
    // Map of filepath (string) to file content (string)
    generatedFiles: Record<string, string> | null;
    identifiedDependencies: LibraryDependency[] | null;
}

// (Moved from app/build-tool/page.tsx)
export interface PrSubmissionResult {
    prUrl: string | null;
    message: string;
}

// Type for API response from /api/validate-directive
// (Derived from app/build-tool/_components/ValidateDirective.tsx)
export interface ApiValidationResponseData {
    success: boolean; // Changed from 'valid' for consistency
    message: string;
    generativeDescription: string | null;
    generativeRequestedDirectives: string[];
}

// Type for API response from /api/generate-tool-resources
// (Derived from app/build-tool/_components/GenerateToolResources.tsx)
// Extends GenerationResult and adds success flag
export interface ApiGenerationResponseData extends GenerationResult {
    success: boolean;
}

// Type for API response from /api/create-anonymous-pr
// (Derived from app/build-tool/_components/CreateAnonymousPr.tsx)
export interface ApiPrSubmissionResponseData {
    success: boolean;
    message: string;
    url?: string | null; // PR URL
}

// Type for API response from /api/list-models
export interface ApiListModelsResponse {
    models: AiModel[];
    error?: string;
}

// Type for API response from /api/list-directives
export interface ApiListDirectivesResponse {
    directives: string[];
    error?: string;
}