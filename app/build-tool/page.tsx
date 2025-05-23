// /app/build-tool/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ValidateDirective from './_components/ValidateDirective';
import GenerateToolResources from './_components/GenerateToolResources';
import CreateAnonymousPr from './_components/CreateAnonymousPr';
import Button from '../tool/_components/form/Button'; // Assuming Button is here now

import type {
  AiModel,
  ValidationResult, // Includes generativeDescription, generativeRequestedDirectives, and potentially ResouceGenerationEpic
  GenerationResult, // Includes generatedFiles, identifiedDependencies, message
  ApiListModelsResponse,
  // ApiPrSubmissionResponseData, // This is handled within CreateAnonymousPr
} from '@/src/types/build'; // Ensure your types are correctly defined and exported

// This type might be defined in a shared location if also used by /api/directives.json
interface DirectivesListData {
  directives: string[];
}

type BuildStep = 'validation' | 'generation' | 'submission'; // Simplified steps

export default function BuildToolPage() {
  const [currentStep, setCurrentStep] = useState<BuildStep>('validation');

  // --- State for API data and user inputs ---
  const [toolDirective, setToolDirective] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<AiModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState<boolean>(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [allAvailableToolDirectives, setAllAvailableToolDirectives] = useState<
    string[]
  >([]);
  const [directivesLoading, setDirectivesLoading] = useState<boolean>(true);
  const [directivesError, setDirectivesError] = useState<string | null>(null);

  const [isApiUnavailable, setIsApiUnavailable] = useState<boolean>(false);
  const [apiUnavailableMessage, setApiUnavailableMessage] =
    useState<string>('');

  // --- State to pass between steps ---
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [additionalDescription, setAdditionalDescription] = useState('');
  const [userSelectedDirectives, setUserSelectedDirectives] = useState<
    string[]
  >([]);
  const [generationResult, setGenerationResult] =
    useState<GenerationResult | null>(null);

  // --- Fetch AI Models ---
  useEffect(() => {
    const fetchModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      setIsApiUnavailable(false);
      setApiUnavailableMessage('');
      try {
        const response = await fetch('/api/list-models');
        if (!response.ok) {
          if (
            response.status === 404 ||
            response.status === 502 ||
            response.status === 504
          ) {
            // Common for unavailable API
            setIsApiUnavailable(true);
            const specificMsg =
              'The AI model listing API (/api/list-models) is currently unavailable. This build feature requires server functionality.';
            setApiUnavailableMessage(specificMsg);
            setModelsError(specificMsg); // Also set modelsError for immediate display
            console.error(specificMsg);
            return;
          }
          const e = await response
            .json()
            .catch(() => ({ error: `HTTP error ${response.status}` }));
          throw new Error(e.error || `HTTP error ${response.status}`);
        }
        const data: ApiListModelsResponse = await response.json();
        const models: AiModel[] = data.models || [];
        if (models.length === 0) {
          console.warn('[BuildToolPage] API returned an empty list of models.');
          setModelsError('No compatible AI models were found from the API.');
        }
        setAvailableModels(models);

        const defaultEnvModelName =
          process.env.NEXT_PUBLIC_DEFAULT_GEMINI_MODEL_NAME;
        const defaultModel =
          models.find((m) => m.name === defaultEnvModelName) ??
          models.find((m) => m.name.includes('flash')) ?? // Prefer flash
          models.find((m) => m.name.includes('pro')) ?? // Then pro
          (models.length > 0 ? models[0] : null); // Then first available

        if (defaultModel) {
          setSelectedModel(defaultModel.name);
        } else if (models.length > 0) {
          console.warn(
            '[BuildToolPage] Default model not found, but other models exist. User must select.'
          );
          // No default selected, user will have to pick from the dropdown
        }
        // If models.length is 0, modelsError is already set.
      } catch (error: any) {
        console.error('[BuildToolPage] Error fetching AI models:', error);
        setIsApiUnavailable(true); // Assume API is down if fetch fails
        const specificMsg =
          'Failed to connect to the AI model API. This build feature may require server functionality.';
        setApiUnavailableMessage(specificMsg);
        setModelsError(error.message || specificMsg);
        setAvailableModels([]);
      } finally {
        setModelsLoading(false);
      }
    };
    fetchModels();
  }, []);

  // --- Fetch Existing Tool Directives ---
  useEffect(() => {
    if (isApiUnavailable) {
      // Don't fetch if API already marked as unavailable
      setDirectivesLoading(false);
      setDirectivesError(
        'Skipped fetching directives due to API unavailability.'
      );
      return;
    }

    const fetchDirectives = async () => {
      setDirectivesLoading(true);
      setDirectivesError(null);
      try {
        const response = await fetch('/api/directives.json'); // This is a static file
        if (!response.ok) {
          throw new Error(
            `Failed to fetch directives list (/api/directives.json - ${response.status})`
          );
        }
        const data: DirectivesListData = await response.json();
        if (!Array.isArray(data?.directives)) {
          throw new Error('Invalid format in directives.json file.');
        }
        setAllAvailableToolDirectives(data.directives);
      } catch (error: any) {
        console.error('[BuildToolPage] Error fetching tool directives:', error);
        setDirectivesError(
          error.message || 'Could not load existing tools list.'
        );
        setAllAvailableToolDirectives([]);
      } finally {
        setDirectivesLoading(false);
      }
    };
    fetchDirectives();
  }, [isApiUnavailable]); // Re-run if isApiUnavailable changes (though unlikely to recover in same session)

  // --- Step Navigation Callbacks ---
  const handleValidationSuccess = useCallback((result: ValidationResult) => {
    setValidationResult(result);
    // Pre-fill userSelectedDirectives with AI suggestions, or empty if none
    setUserSelectedDirectives(result.generativeRequestedDirectives || []);
    setCurrentStep('generation');
  }, []);

  const handleGenerationSuccess = useCallback((result: GenerationResult) => {
    setGenerationResult(result);
    setCurrentStep('submission');
  }, []);

  const handleReset = useCallback(() => {
    setCurrentStep('validation');
    setToolDirective('');
    // Keep selectedModel as is, user might want to use it again
    setValidationResult(null);
    setAdditionalDescription('');
    setUserSelectedDirectives([]);
    setGenerationResult(null);
    // Note: availableModels, modelsLoading, modelsError are not reset here
    // as they are fetched once on page load.
  }, []);

  // --- Render Logic ---
  const renderCurrentStep = () => {
    if (isApiUnavailable) {
      return (
        <div className="p-6 border rounded-lg bg-orange-50 border-orange-300 shadow-sm text-center">
          <h2 className="text-xl font-semibold mb-3 text-orange-800">
            Build Feature Temporarily Unavailable
          </h2>
          <p className="text-orange-700 mb-4">
            The AI-assisted build tool relies on backend services which appear
            to be unavailable at the moment.
          </p>
          <p className="text-sm text-orange-600 mb-4">
            Details:{' '}
            {apiUnavailableMessage || 'Could not connect to required services.'}
          </p>
          <p className="text-sm text-gray-600">
            To contribute a new tool manually, please see the{' '}
            <a // Changed to <a> for external link
              href="https://github.com/Online-Everything-Tool/oet/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              CONTRIBUTING.md
            </a>{' '}
            file.
          </p>
        </div>
      );
    }
    if (modelsLoading || directivesLoading) {
      return (
        <p className="text-center p-4 italic text-gray-500 animate-pulse">
          Loading build tool prerequisites...
        </p>
      );
    }
    if (modelsError && availableModels.length === 0) {
      // Only show fatal model error if no models loaded
      return (
        <p className="text-center text-red-500 p-4">
          Error loading AI models: {modelsError}
        </p>
      );
    }
    // Non-fatal model error (e.g. default not found but list populated) is handled in ValidateDirective
    if (directivesError) {
      return (
        <p className="text-center text-red-500 p-4">
          Error loading existing tools: {directivesError}
        </p>
      );
    }

    switch (currentStep) {
      case 'validation':
        return (
          <ValidateDirective
            toolDirective={toolDirective}
            setToolDirective={setToolDirective}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            availableModels={availableModels}
            modelsLoading={modelsLoading} // Will be false here, but pass for consistency
            modelsError={modelsError} // Pass non-fatal model errors
            onValidationSuccess={handleValidationSuccess}
            onReset={handleReset} // Allows ValidateDirective to have a reset button if desired
          />
        );
      case 'generation':
        if (!validationResult) {
          console.warn(
            "[BuildToolPage] In 'generation' step but validationResult is null. Resetting."
          );
          handleReset();
          return null;
        }
        return (
          <GenerateToolResources
            toolDirective={toolDirective}
            validationResult={validationResult}
            additionalDescription={additionalDescription}
            setAdditionalDescription={setAdditionalDescription}
            selectedModel={selectedModel}
            allAvailableToolDirectives={allAvailableToolDirectives}
            userSelectedDirectives={userSelectedDirectives}
            setUserSelectedDirectives={setUserSelectedDirectives}
            onGenerationSuccess={handleGenerationSuccess}
            onBack={() => setCurrentStep('validation')}
          />
        );
      case 'submission':
        if (
          !generationResult ||
          !validationResult ||
          !toolDirective ||
          !selectedModel
        ) {
          console.warn(
            "[BuildToolPage] In 'submission' step but critical data missing. Resetting."
          );
          handleReset();
          return null;
        }
        return (
          <CreateAnonymousPr
            toolDirective={toolDirective}
            generationResult={generationResult}
            validationResult={validationResult}
            additionalDescription={additionalDescription}
            userSelectedDirectives={userSelectedDirectives}
            selectedModel={selectedModel}
            onBack={() => setCurrentStep('generation')}
          />
        );
      default:
        const exhaustiveCheck: never = currentStep;
        console.error(
          `[BuildToolPage] Unhandled build step: ${exhaustiveCheck}`
        );
        return (
          <p className="text-center text-red-500">
            Error: Invalid build step: {currentStep}
          </p>
        );
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center mb-2 pb-2 border-b">
        <h1 className="text-2xl font-bold text-gray-800">
          Build a New Tool (AI Assisted)
        </h1>
        {currentStep !== 'validation' && !isApiUnavailable && (
          <Button
            variant="neutral-outline"
            size="sm"
            onClick={handleReset}
            className="text-sm"
          >
            Start Over
          </Button>
        )}
      </div>
      {renderCurrentStep()}
    </div>
  );
}
