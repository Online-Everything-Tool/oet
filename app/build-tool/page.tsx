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
export interface GenerationResult {
    generatedCode: string;
    message: string;
}
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

    // Data passed between steps
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [additionalDescription, setAdditionalDescription] = useState('');
    const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
    const [prSubmissionResult, setPrSubmissionResult] = useState<PrSubmissionResult | null>(null);

    // --- Fetch AI Models on Mount ---
    useEffect(() => {
        const fetchModels = async () => {
            setModelsLoading(true); setModelsError(null);
            try {
                const response = await fetch('/api/list-models');
                if (!response.ok) { const e = await response.json(); throw new Error(e.error || `E ${response.status}`); }
                const data = await response.json(); const models: AiModel[] = data.models || []; setAvailableModels(models);
                const defaultEnv = process.env.NEXT_PUBLIC_DEFAULT_GEMINI_MODEL_NAME; let defaultSet = false;
                if (models.length > 0) {
                    if (defaultEnv) { const found = models.find(m => m.name === defaultEnv); if (found) { setSelectedModel(found.name); defaultSet = true; console.log("Set default model from ENV:", found.name); } else { console.warn(`Default model "${defaultEnv}" from env not found.`);} }
                    if (!defaultSet) { const flash = models.find(m => m.name.includes('flash')); const pro = models.find(m => m.name.includes('pro')); if (flash) { setSelectedModel(flash.name); console.log("Set default model to Flash:", flash.name); } else if (pro) { setSelectedModel(pro.name); console.log("Set default model to Pro:", pro.name); } else { setSelectedModel(models[0].name); console.log("Set default model to first available:", models[0].name); } }
                } else { console.warn("No compatible AI models found after fetch."); }
            } catch (error) { console.error("Error fetching AI models:", error); const message = error instanceof Error ? error.message : "Could not load AI models."; setModelsError(message); setAvailableModels([]); }
            finally { setModelsLoading(false); }
          };
          fetchModels();
    }, []); // Empty dependency array ensures this runs only once on mount

    // --- Callback Handlers Passed Down to Child Components ---
    const handleValidationSuccess = useCallback((result: ValidationResult) => {
        console.log("Validation Success:", result);
        setValidationResult(result);
        setCurrentStep('generation'); // Move to generation step
    }, []);

    const handleGenerationSuccess = useCallback((result: GenerationResult) => {
        console.log("Generation Success:", { message: result.message, codeLength: result.generatedCode?.length });
        setGenerationResult(result);
        setCurrentStep('submission'); // Move to submission step
    }, []);

     const handlePrSubmissionSuccess = useCallback((result: PrSubmissionResult) => {
        console.log("PR Submission Success:", result);
        setPrSubmissionResult(result);
        setCurrentStep('complete'); // Move to final 'complete' state
    }, []);

    const handleReset = useCallback(() => {
        console.log("Resetting build flow...");
        setCurrentStep('validation');
        setToolDirective('');
        setValidationResult(null);
        setAdditionalDescription('');
        setGenerationResult(null);
        setPrSubmissionResult(null);
        // Note: Intentionally keeping selectedModel and availableModels
    }, []);

    // --- Render Logic: Chooses which step component to display ---
    const renderCurrentStep = () => {
        switch (currentStep) {
            case 'validation':
                return (
                    <ValidateDirective
                        // State Props passed concisely
                        {...{ toolDirective, selectedModel, availableModels, modelsLoading, modelsError, setToolDirective, setSelectedModel }}
                        // Callbacks passed explicitly
                        onValidationSuccess={handleValidationSuccess}
                        onReset={handleReset}
                    />
                );
            case 'generation':
                if (!validationResult) { handleReset(); return null; }
                return (
                    <GenerateToolResources
                         // State Props
                        {...{ toolDirective, validationResult, additionalDescription, selectedModel, setAdditionalDescription }}
                         // Callbacks
                        onGenerationSuccess={handleGenerationSuccess}
                        onBack={handleReset} // Or: () => setCurrentStep('validation')
                    />
                );
             case 'submission':
                 if (!generationResult || !toolDirective || !validationResult) { handleReset(); return null; }
                 return (
                     <CreateAnonymousPr
                         // State Props
                         {...{ toolDirective, generationResult, validationResult, additionalDescription }}
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
            {renderCurrentStep()}
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