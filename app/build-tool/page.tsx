// /app/build-tool/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ValidateDirective from './_components/ValidateDirective';
import GenerateToolResources from './_components/GenerateToolResources';
import CreateAnonymousPr from './_components/CreateAnonymousPr';
// Import shared build types
import type { AiModel, ValidationResult, GenerationResult, PrSubmissionResult, ApiListModelsResponse, ApiListDirectivesResponse } from '@/src/types/build'; // Added API response types

// Interfaces moved to src/types/build.ts

// Define possible steps in the build flow
type BuildStep = 'validation' | 'generation' | 'submission' | 'complete';

export default function BuildToolPage() {
    // State definitions remain the same
    const [currentStep, setCurrentStep] = useState<BuildStep>('validation');
    const [toolDirective, setToolDirective] = useState('');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [availableModels, setAvailableModels] = useState<AiModel[]>([]); // Use imported type
    const [modelsLoading, setModelsLoading] = useState<boolean>(true);
    const [modelsError, setModelsError] = useState<string | null>(null);
    const [allAvailableToolDirectives, setAllAvailableToolDirectives] = useState<string[]>([]);
    const [directivesLoading, setDirectivesLoading] = useState<boolean>(true);
    const [directivesError, setDirectivesError] = useState<string | null>(null);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null); // Use imported type
    const [additionalDescription, setAdditionalDescription] = useState('');
    const [userSelectedDirective, setUserSelectedDirective] = useState<string | null>(null);
    const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null); // Use imported type
    const [prSubmissionResult, setPrSubmissionResult] = useState<PrSubmissionResult | null>(null); // Use imported type

    // Fetch AI Models - Update fetch response type
    useEffect(() => {
        const fetchModels = async () => {
            setModelsLoading(true); setModelsError(null);
            try {
                const response = await fetch('/api/list-models');
                if (!response.ok) { const e = await response.json(); throw new Error(e.error || `HTTP ${response.status}`); }
                // Use imported response type
                const data: ApiListModelsResponse = await response.json();
                const models: AiModel[] = data.models || [];
                setAvailableModels(models);
                const defaultEnv = process.env.NEXT_PUBLIC_DEFAULT_GEMINI_MODEL_NAME;
                const defaultModel = models.find(m => m.name === defaultEnv)
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

    // Fetch Tool Directives - Update fetch response type
    useEffect(() => {
        const fetchDirectives = async () => {
            setDirectivesLoading(true); setDirectivesError(null);
            try {
                const response = await fetch('/api/list-directives');
                if (!response.ok) { const e = await response.json(); throw new Error(e.error || `HTTP ${response.status}`); }
                 // Use imported response type
                const data: ApiListDirectivesResponse = await response.json();
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
    }, []);

    // Callbacks use imported types implicitly via arguments
    const handleValidationSuccess = useCallback((result: ValidationResult) => {
        console.log("Validation Success:", result);
        setValidationResult(result);
        setUserSelectedDirective(null);
        setCurrentStep('generation');
    }, []);

    const handleGenerationSuccess = useCallback((result: GenerationResult) => {
        console.log("Generation Success:", {
            message: result.message,
            filesGenerated: result.generatedFiles ? Object.keys(result.generatedFiles).length : 0,
            dependenciesIdentified: result.identifiedDependencies?.length ?? 0
        });
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
        setUserSelectedDirective(null);
        setGenerationResult(null);
        setPrSubmissionResult(null);
    }, []);

    // renderCurrentStep logic remains the same...
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
                  if (directivesLoading) return <p className="text-center p-4">Loading existing tools...</p>;
                  if (directivesError) return <p className="text-center text-red-500 p-4">Error loading tools: {directivesError}</p>;
                  if (!validationResult) { handleReset(); return null; }

                  return (
                     <GenerateToolResources
                         {...{
                              toolDirective,
                              validationResult,
                              additionalDescription,
                              selectedModel,
                              allAvailableToolDirectives,
                              userSelectedDirective,
                              setAdditionalDescription,
                              setUserSelectedDirective
                         }}
                         onGenerationSuccess={handleGenerationSuccess}
                         onBack={handleReset}
                     />
                 );
              case 'submission':
                  if (!generationResult?.generatedFiles || !toolDirective || !validationResult) {
                      handleReset(); return null;
                  }
                  return (
                      <CreateAnonymousPr
                          {...{
                              toolDirective,
                              generationResult,
                              validationResult,
                              additionalDescription,
                              userSelectedDirective
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

    // Main Return remains the same...
     return (
        <div className="max-w-3xl mx-auto p-4 space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Build a New Tool (AI Assisted)</h1>
            {modelsLoading && <p className="text-center p-4">Loading AI models...</p>}
            {modelsError && <p className="text-center text-red-500 p-4">Error loading AI models: {modelsError}</p>}
            {!modelsLoading && !modelsError && renderCurrentStep()}
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