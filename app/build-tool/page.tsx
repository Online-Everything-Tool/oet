// /app/build-tool/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ValidateDirective from './_components/ValidateDirective';
import GenerateToolResources from './_components/GenerateToolResources';
import CreateAnonymousPr from './_components/CreateAnonymousPr';
import type { AiModel, ValidationResult, GenerationResult, PrSubmissionResult, ApiListModelsResponse } from '@/src/types/build';

interface DirectivesListData {
    directives: string[];
}

type BuildStep = 'validation' | 'generation' | 'submission' | 'complete';

export default function BuildToolPage() {
    // State definitions
    const [currentStep, setCurrentStep] = useState<BuildStep>('validation');
    const [toolDirective, setToolDirective] = useState('');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [availableModels, setAvailableModels] = useState<AiModel[]>([]);
    const [modelsLoading, setModelsLoading] = useState<boolean>(true);
    const [modelsError, setModelsError] = useState<string | null>(null);
    const [allAvailableToolDirectives, setAllAvailableToolDirectives] = useState<string[]>([]);
    const [directivesLoading, setDirectivesLoading] = useState<boolean>(true);
    const [directivesError, setDirectivesError] = useState<string | null>(null);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [additionalDescription, setAdditionalDescription] = useState('');
    const [userSelectedDirectives, setUserSelectedDirectives] = useState<string[]>([]); // Array state
    const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
    const [prSubmissionResult, setPrSubmissionResult] = useState<PrSubmissionResult | null>(null);
    const [isApiUnavailable, setIsApiUnavailable] = useState<boolean>(false);
    const [apiUnavailableMessage, setApiUnavailableMessage] = useState<string>('');

    // useEffect for fetching models
     useEffect(() => {
        const fetchModels = async () => {
            setModelsLoading(true);
            setModelsError(null);
            setIsApiUnavailable(false);
            setApiUnavailableMessage('');
            try {
                const response = await fetch('/api/list-models');
                if (!response.ok) {
                    if (response.status === 404) {
                        setIsApiUnavailable(true);
                        const specificMsg = "The AI model listing API (/api/list-models) was not found. This feature requires server functionality.";
                        setApiUnavailableMessage(specificMsg);
                        setModelsError(specificMsg);
                        console.error(specificMsg);
                        return;
                    }
                    const e = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
                    throw new Error(e.error || `HTTP error ${response.status}`);
                }
                const data: ApiListModelsResponse = await response.json();
                const models: AiModel[] = data.models || [];
                if (models.length === 0) console.warn("API returned an empty list of models.");
                setAvailableModels(models);
                const defaultEnv = process.env.NEXT_PUBLIC_DEFAULT_GEMINI_MODEL_NAME;
                const defaultModel = models.find(m => m.name === defaultEnv)
                                  ?? models.find(m => m.name.includes('flash'))
                                  ?? models.find(m => m.name.includes('pro'))
                                  ?? models[0];
                if (defaultModel) {
                    setSelectedModel(defaultModel.name);
                } else if (models.length > 0) {
                     console.warn("Default model not found, but other models exist.");
                } else {
                     console.warn("No AI models found or loaded.");
                     setModelsError("No compatible AI models were found.");
                }
            } catch (error) {
                console.error("Error fetching AI models:", error);
                 setIsApiUnavailable(true);
                 const specificMsg = "Failed to connect to the AI model API. This feature may require server functionality.";
                 setApiUnavailableMessage(specificMsg);
                 setModelsError(specificMsg);
                 setAvailableModels([]);
            } finally {
                setModelsLoading(false);
            }
          };
          fetchModels();
    }, []);

    // useEffect for fetching directives
    useEffect(() => {
        if (isApiUnavailable) {
            setDirectivesLoading(false);
            setDirectivesError("Skipped fetching directives.");
            return;
        };

        const fetchDirectives = async () => {
            setDirectivesLoading(true);
            setDirectivesError(null);
            try {
                const response = await fetch('/api/directives.json');
                if (!response.ok) {
                    if (response.status === 404) {
                         throw new Error("Directives list file (/api/directives.json) not found. Run the build script.");
                    }
                    throw new Error(`Failed to fetch directives list (${response.status})`);
                }
                const data: DirectivesListData = await response.json();
                if (!Array.isArray(data?.directives)) {
                    throw new Error("Invalid format in directives.json file.");
                }
                setAllAvailableToolDirectives(data.directives);
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
    }, [isApiUnavailable]);

    // Callbacks
     const handleValidationSuccess = useCallback((result: ValidationResult) => {
        console.log("Validation Success:", result);
        setValidationResult(result);
        setUserSelectedDirectives([]);
        setCurrentStep('generation');
    }, []);

    const handleGenerationSuccess = useCallback((result: GenerationResult) => {
        console.log("Generation Success:", result);
        setGenerationResult(result);
        setCurrentStep('submission');
    }, []);

     const handlePrSubmissionSuccess = useCallback((result: PrSubmissionResult) => {
        console.log("PR Submission Success:", result);
        setPrSubmissionResult(result);
        setCurrentStep('complete');
    }, []);

    const handleReset = useCallback(() => {
        console.log("Resetting build flow...");
        setCurrentStep('validation');
        setToolDirective('');
        setValidationResult(null);
        setAdditionalDescription('');
        setUserSelectedDirectives([]);
        setGenerationResult(null);
        setPrSubmissionResult(null);
        // Optionally reset model selection if needed, or keep the last used one
        // if (availableModels.length > 0) setSelectedModel(availableModels[0].name);
    }, []);

    // Render Logic
    const renderCurrentStep = () => {
         if (isApiUnavailable) {
            return (
                 <div className="p-6 border rounded-lg bg-orange-50 border-orange-300 shadow-sm text-center">
                     <h2 className="text-xl font-semibold mb-3 text-orange-800">Feature Unavailable</h2>
                     <p className="text-orange-700 mb-4">
                         The AI-assisted build tool relies on server-side APIs which are not available in this static deployment environment.
                     </p>
                     <p className="text-sm text-orange-600 mb-4">
                         ({apiUnavailableMessage || "Could not connect to required services."})
                     </p>
                     <p className="text-sm text-gray-600">
                         To contribute a new tool, please follow the manual setup instructions in the{' '}
                         <Link href="https://github.com/Online-Everything-Tool/oet/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">CONTRIBUTING.md</Link> file.
                     </p>
                 </div>
             );
         }

        if (modelsLoading || directivesLoading) {
             return <p className="text-center p-4 italic text-gray-500 animate-pulse">Loading build tool prerequisites...</p>;
        }
         if (modelsError && !isApiUnavailable) {
             return <p className="text-center text-red-500 p-4">Error loading AI models: {modelsError}</p>;
         }
         if (directivesError && !isApiUnavailable) {
             return <p className="text-center text-red-500 p-4">Error loading existing tools: {directivesError}</p>;
         }


        switch (currentStep) {
            case 'validation':
                 return (
                    <ValidateDirective
                        {...{ toolDirective, selectedModel, availableModels, modelsLoading, modelsError }} // Pass needed props
                        setToolDirective={setToolDirective}
                        setSelectedModel={setSelectedModel}
                        onValidationSuccess={handleValidationSuccess}
                        onReset={handleReset} // Pass reset if needed inside ValidateDirective
                    />
                );
            case 'generation':
                 if (!validationResult) { handleReset(); return null; }
                 return (
                    <GenerateToolResources
                        {...{
                             toolDirective,
                             validationResult,
                             additionalDescription,
                             selectedModel,
                             allAvailableToolDirectives,
                             userSelectedDirectives,
                             setAdditionalDescription,
                             setUserSelectedDirectives
                        }}
                        onGenerationSuccess={handleGenerationSuccess}
                        onBack={handleReset}
                    />
                );
             case 'submission':
                 // Ensure all necessary data exists before rendering submission step
                 if (!generationResult?.generatedFiles || !toolDirective || !validationResult || !selectedModel) {
                     console.error("Missing data required for submission step, resetting.");
                     handleReset();
                     return null;
                 }
                 return (
                     <CreateAnonymousPr
                         {...{
                             toolDirective,
                             generationResult,
                             validationResult,
                             additionalDescription,
                             userSelectedDirectives,
                             selectedModel // <-- PASS selectedModel HERE
                         }}
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

    // Main Return
     return (
        <div className="max-w-3xl mx-auto p-4 space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Build a New Tool (AI Assisted)</h1>
            {renderCurrentStep()}
             {currentStep !== 'validation' && currentStep !== 'complete' && !isApiUnavailable && (
                 <div className="text-center mt-4">
                     <button type="button" onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
                         Start Over
                     </button>
                 </div>
             )}
        </div>
    );
}