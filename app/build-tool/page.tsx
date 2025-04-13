// /app/build-tool/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ValidateDirective from './_components/ValidateDirective';
import GenerateToolResources from './_components/GenerateToolResources';
import CreateAnonymousPr from './_components/CreateAnonymousPr';

// Interfaces for data passed between steps and API responses
export interface AiModel {
    name: string;
    displayName: string;
    version: string;
}
export interface ValidationResult {
    generativeDescription: string;
    generativeRequestedDirectives: string[];
}

// --- Updated Types ---
export interface LibraryDependency {
    packageName: string;
    reason?: string;
    importUsed?: string;
}

export interface GenerationResult {
    message: string;
    generatedFiles: { [filePath: string]: string } | null; // Object mapping path to content
    identifiedDependencies: LibraryDependency[] | null; // Array of identified dependencies
}
// --- End Updated Types ---

export interface PrSubmissionResult {
    prUrl: string | null;
    message: string;
}

// Define possible steps in the build flow
type BuildStep = 'validation' | 'generation' | 'submission' | 'complete';

export default function BuildToolPage() {
    // --- Shared State Across Steps ---
    const [currentStep, setCurrentStep] = useState<BuildStep>('validation');
    const [toolDirective, setToolDirective] = useState('');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [availableModels, setAvailableModels] = useState<AiModel[]>([]);
    const [modelsLoading, setModelsLoading] = useState<boolean>(true);
    const [modelsError, setModelsError] = useState<string | null>(null);

    // --- NEW State for Directives List ---
    const [allAvailableToolDirectives, setAllAvailableToolDirectives] = useState<string[]>([]);
    const [directivesLoading, setDirectivesLoading] = useState<boolean>(true);
    const [directivesError, setDirectivesError] = useState<string | null>(null);

    // Data passed between steps
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [additionalDescription, setAdditionalDescription] = useState('');
    // --- NEW State for User Selected Directive ---
    const [userSelectedDirective, setUserSelectedDirective] = useState<string | null>(null);
    const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
    const [prSubmissionResult, setPrSubmissionResult] = useState<PrSubmissionResult | null>(null);

    // --- Fetch AI Models on Mount ---
    useEffect(() => {
        const fetchModels = async () => {
            setModelsLoading(true); setModelsError(null);
            try {
                const response = await fetch('/api/list-models');
                if (!response.ok) { const e = await response.json(); throw new Error(e.error || `HTTP ${response.status}`); }
                const data = await response.json();
                const models: AiModel[] = data.models || [];
                setAvailableModels(models);
                // Default model selection logic (simplified for brevity)
                const defaultEnv = process.env.NEXT_PUBLIC_DEFAULT_GEMINI_MODEL_NAME;
                let defaultModel = models.find(m => m.name === defaultEnv)
                                  ?? models.find(m => m.name.includes('flash'))
                                  ?? models.find(m => m.name.includes('pro'))
                                  ?? models[0];
                if (defaultModel) {
                    setSelectedModel(defaultModel.name);
                    console.log("Set default model to:", defaultModel.name);
                } else {
                    console.warn("No compatible AI models found after fetch.");
                }
            } catch (error) {
                console.error("Error fetching AI models:", error);
                const message = error instanceof Error ? error.message : "Could not load AI models.";
                setModelsError(message);
                setAvailableModels([]);
            } finally {
                setModelsLoading(false);
            }
          };
          fetchModels();
    }, []);

    // --- NEW: Fetch Tool Directives on Mount ---
    useEffect(() => {
        const fetchDirectives = async () => {
            setDirectivesLoading(true); setDirectivesError(null);
            try {
                // NOTE: You need to create this API endpoint
                const response = await fetch('/api/list-directives');
                if (!response.ok) { const e = await response.json(); throw new Error(e.error || `HTTP ${response.status}`); }
                const data = await response.json();
                // Assuming API returns { directives: ["tool1", "tool2"] }
                setAllAvailableToolDirectives(data.directives || []);
            } catch (error) {
                console.error("Error fetching tool directives:", error);
                const message = error instanceof Error ? error.message : "Could not load existing tools.";
                setDirectivesError(message);
                setAllAvailableToolDirectives([]);
            } finally {
                setDirectivesLoading(false);
            }
        };
        fetchDirectives();
    }, []); // Empty dependency array ensures this runs only once on mount

    // --- Callback Handlers Passed Down to Child Components ---
    const handleValidationSuccess = useCallback((result: ValidationResult) => {
        console.log("Validation Success:", result);
        setValidationResult(result);
        // Reset user directive choice when moving past validation
        setUserSelectedDirective(null);
        setCurrentStep('generation'); // Move to generation step
    }, []);

    // Updated handler for Generation success
    const handleGenerationSuccess = useCallback((result: GenerationResult) => {
        // Log new structure
        console.log("Generation Success:", {
            message: result.message,
            filesGenerated: result.generatedFiles ? Object.keys(result.generatedFiles).length : 0,
            dependenciesIdentified: result.identifiedDependencies?.length ?? 0
        });
        setGenerationResult(result);
        setCurrentStep('submission'); // Move to submission step
    }, []);

     const handlePrSubmissionSuccess = useCallback((result: PrSubmissionResult) => {
        console.log("PR Submission Success:", result);
        setPrSubmissionResult(result);
        setCurrentStep('complete'); // Move to final 'complete' state
    }, []);

    // Updated handler for Reset
    const handleReset = useCallback(() => {
        console.log("Resetting build flow...");
        setCurrentStep('validation');
        setToolDirective('');
        setValidationResult(null);
        setAdditionalDescription('');
        setUserSelectedDirective(null); // Reset user choice
        setGenerationResult(null);
        setPrSubmissionResult(null);
        // Intentionally keep: selectedModel, availableModels, allAvailableToolDirectives
    }, []);

    // --- Render Logic: Chooses which step component to display ---
    const renderCurrentStep = () => {
        switch (currentStep) {
            case 'validation':
                return (
                    <ValidateDirective
                        {...{ toolDirective, selectedModel, availableModels, modelsLoading, modelsError, setToolDirective, setSelectedModel }}
                        onValidationSuccess={handleValidationSuccess}
                        onReset={handleReset}
                    />
                );
            case 'generation':
                 // Add checks for directives loading/error
                 if (directivesLoading) return <p className="text-center p-4">Loading existing tools...</p>;
                 if (directivesError) return <p className="text-center text-red-500 p-4">Error loading tools: {directivesError}</p>;
                 if (!validationResult) { handleReset(); return null; } // Existing check

                 return (
                    <GenerateToolResources
                         // Pass down all required props, including new ones
                        {...{
                             toolDirective,
                             validationResult,
                             additionalDescription,
                             selectedModel,
                             allAvailableToolDirectives, // Pass fetched list
                             userSelectedDirective, // Pass current user choice
                             setAdditionalDescription,
                             setUserSelectedDirective // Pass setter for user choice
                        }}
                         // Callbacks
                        onGenerationSuccess={handleGenerationSuccess}
                        onBack={handleReset}
                    />
                );
             case 'submission':
                 // Updated check for generationResult structure
                 if (!generationResult?.generatedFiles || !toolDirective || !validationResult) {
                     handleReset(); return null;
                 }
                 return (
                     <CreateAnonymousPr
                         // Pass generationResult and userSelectedDirective
                         {...{
                             toolDirective,
                             generationResult,
                             validationResult,
                             additionalDescription,
                             userSelectedDirective // Pass user choice for PR context
                         }}
                         // Callbacks
                         onPrSubmissionSuccess={handlePrSubmissionSuccess}
                         onBack={() => setCurrentStep('generation')}
                     />
                 );
            case 'complete':
                 if (!prSubmissionResult) { handleReset(); return null; }
                 return (
                    <div className="p-6 border rounded-lg bg-green-50 border-green-300 shadow-sm text-center">
                        <h2 className="text-xl font-semibold mb-3 text-green-800">Pull Request Submitted!</h2>
                        <p className="text-green-700 mb-4">{prSubmissionResult.message}</p>
                        {prSubmissionResult.prUrl && (
                             <p className="mb-4">
                                <a href={prSubmissionResult.prUrl} target="_blank" rel="noopener noreferrer"
                                   className="inline-block px-6 py-2 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                >
                                    View Pull Request on GitHub
                                </a>
                            </p>
                        )}
                        <button type="button" onClick={handleReset} className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
                            Build Another Tool
                        </button>
                    </div>
                 );
            default:
                return <p className="text-center text-red-500">Error: Invalid build step.</p>;
        }
    };

    // --- Main Return ---
    return (
        <div className="max-w-3xl mx-auto p-4 space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Build a New Tool (AI Assisted)</h1>
            {/* Render loading/error states for models *before* steps if critical */}
            {modelsLoading && <p className="text-center p-4">Loading AI models...</p>}
            {modelsError && <p className="text-center text-red-500 p-4">Error loading AI models: {modelsError}</p>}
            {!modelsLoading && !modelsError && renderCurrentStep()}
            {/* Add Start Over button */}
             {currentStep !== 'validation' && currentStep !== 'complete' && (
                 <div className="text-center mt-4">
                     <button type="button" onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
                         Start Over
                     </button>
                 </div>
             )}
        </div>
    );
}