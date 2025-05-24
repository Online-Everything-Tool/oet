// FILE: app/build-tool/_components/BuildToolClient.tsx
'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ValidateDirective from './ValidateDirective';
import GenerateToolResources from './GenerateToolResources';
import CreateAnonymousPr from './CreateAnonymousPr';
import Button from '../../tool/_components/form/Button';

import type {
  AiModel,
  ValidationResult,
  GenerationResult,
  ApiListModelsResponse,
} from '@/src/types/build';
import { useMetadata } from '@/app/context/MetadataContext';

type BuildStep = 'validation' | 'generation' | 'submission';
type BuildMode = 'building' | 'monitoring';

export default function BuildToolClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const getInitialModeAndPr = useCallback(() => {
    const prNumberFromUrlStr = searchParams.get('prNumber');
    if (prNumberFromUrlStr) {
      const prNum = parseInt(prNumberFromUrlStr, 10);
      if (!isNaN(prNum) && prNum > 0) {
        return { mode: 'monitoring' as BuildMode, pr: prNum };
      }
    }
    return { mode: 'building' as BuildMode, pr: null };
  }, [searchParams]);

  const initialDataRef = useRef(getInitialModeAndPr());

  const [currentStep, setCurrentStep] = useState<BuildStep>(
    initialDataRef.current.mode === 'monitoring' ? 'submission' : 'validation'
  );
  const [currentMode, setCurrentMode] = useState<BuildMode>(
    initialDataRef.current.mode
  );
  const [monitoredPrNumber, setMonitoredPrNumber] = useState<number | null>(
    initialDataRef.current.pr
  );

  const [toolDirective, setToolDirective] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<AiModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState<boolean>(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const {
    toolMetadataMap,
    isLoading: metadataLoadingHook,
    error: metadataErrorHook,
  } = useMetadata();
  const [allAvailableToolDirectives, setAllAvailableToolDirectives] = useState<
    string[]
  >([]);

  const [isApiUnavailable, setIsApiUnavailable] = useState<boolean>(false);
  const [apiUnavailableMessage, setApiUnavailableMessage] =
    useState<string>('');

  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [additionalDescription, setAdditionalDescription] = useState('');
  const [userSelectedDirectives, setUserSelectedDirectives] = useState<
    string[]
  >([]);
  const [generationResult, setGenerationResult] =
    useState<GenerationResult | null>(null);

  const [modelsFetched, setModelsFetched] = useState(false);
  const [metadataContextLoaded, setMetadataContextLoaded] = useState(false);
  const [
    componentInitializationStateDone,
    setComponentInitializationStateDone,
  ] = useState(false);

  const getDefaultSelectedModel = useCallback(() => {
    if (availableModels.length === 0) return '';
    const defaultEnvModelName =
      process.env.NEXT_PUBLIC_DEFAULT_GEMINI_MODEL_NAME;
    const defaultModel =
      availableModels.find((m) => m.name === defaultEnvModelName) ??
      availableModels.find((m) => m.name.includes('flash')) ??
      availableModels.find((m) => m.name.includes('pro')) ??
      availableModels[0];
    return defaultModel?.name || '';
  }, [availableModels]);

  useEffect(() => {
    let isMounted = true;
    const { mode: initialMode, pr: initialPr } = getInitialModeAndPr();

    if (isMounted) {
      console.log(
        `[BuildToolClient] Initial mode determination: ${initialMode}, PR: ${initialPr}`
      );
      setCurrentMode(initialMode);

      if (initialMode === 'monitoring' && initialPr) {
        setMonitoredPrNumber(initialPr);
        setCurrentStep('submission');
        if (!validationResult)
          setValidationResult({
            generativeDescription: `Details for PR #${initialPr}`,
            generativeRequestedDirectives: [],
          });
        if (!generationResult)
          setGenerationResult({
            message: `Monitoring PR #${initialPr}`,
            generatedFiles: {},
            identifiedDependencies: [],
          });
      } else {
        setCurrentMode('building');
        setCurrentStep('validation');
        setMonitoredPrNumber(null);
        if (
          searchParams.get('prNumber') &&
          initialMode !== 'monitoring' &&
          router
        ) {
          router.replace('/build-tool', { scroll: false });
        }
      }
    }
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isMounted = true;
    console.log('[BuildToolClient] Attempting to fetch models...');
    setModelsLoading(true);
    setModelsError(null);
    setIsApiUnavailable(false);
    setApiUnavailableMessage('');

    fetch('/api/list-models')
      .then(async (res) => {
        if (!isMounted) return null;
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({
            error: `HTTP error ${res.statusText} (status: ${res.status})`,
          }));
          if (
            res.status === 503 ||
            res.status === 502 ||
            res.status === 504 ||
            res.status === 404
          ) {
            if (isMounted) {
              setIsApiUnavailable(true);
              setApiUnavailableMessage(
                errorData.error ||
                  'The AI model listing service is temporarily down.'
              );
            }
          } else if (res.status === 429) {
            if (isMounted)
              setModelsError(
                errorData.error ||
                  'API request limit reached. Please try again later.'
              );
          } else {
            if (isMounted)
              setModelsError(
                errorData.error ||
                  `Failed to retrieve models (status: ${res.status}).`
              );
          }
          return null;
        }
        return res.json() as Promise<ApiListModelsResponse>;
      })
      .then((data) => {
        if (!isMounted || data === null) return;
        if (data.error && !isApiUnavailable) {
          if (isMounted) {
            setModelsError(data.error);
            setAvailableModels([]);
          }
          return;
        }
        const models: AiModel[] = data.models || [];
        if (isMounted) setAvailableModels(models);
        if (models.length === 0 && !data.error) {
          if (isMounted)
            setModelsError('No compatible AI models were found from the API.');
        } else if (models.length > 0) {
          if (isMounted) setModelsError(null);
        }
        if (isMounted && models.length > 0 && !selectedModel) {
          setSelectedModel(getDefaultSelectedModel());
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error(
          '[BuildToolClient] Network or unexpected error fetching AI models:',
          err
        );
        if (isMounted) {
          setModelsError(
            err.message || 'A network error occurred while fetching models.'
          );
          setAvailableModels([]);
          setIsApiUnavailable(true);
          setApiUnavailableMessage(
            'Failed to connect to the AI model API due to a network issue.'
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setModelsLoading(false);
          setModelsFetched(true);
        }
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!metadataLoadingHook) {
      if (toolMetadataMap && Object.keys(toolMetadataMap).length > 0) {
        setAllAvailableToolDirectives(Object.keys(toolMetadataMap).sort());
      } else if (metadataErrorHook) {
        console.error(
          '[BuildToolClient] Error from MetadataContext:',
          metadataErrorHook
        );
        setAllAvailableToolDirectives([]);
      }
      setMetadataContextLoaded(true);
    }
  }, [metadataLoadingHook, toolMetadataMap, metadataErrorHook]);

  useEffect(() => {
    if (modelsFetched && metadataContextLoaded) {
      setComponentInitializationStateDone(true);
      if (!selectedModel && availableModels.length > 0) {
        setSelectedModel(getDefaultSelectedModel());
      }
    }
  }, [
    modelsFetched,
    metadataContextLoaded,
    selectedModel,
    availableModels,
    getDefaultSelectedModel,
  ]);

  useEffect(() => {
    if (!componentInitializationStateDone) return;

    const prNumberFromUrlStr = searchParams.get('prNumber');
    const prNumInUrl = prNumberFromUrlStr
      ? parseInt(prNumberFromUrlStr, 10)
      : null;

    if (prNumInUrl && !isNaN(prNumInUrl) && prNumInUrl > 0) {
      if (currentMode !== 'monitoring' || monitoredPrNumber !== prNumInUrl) {
        console.log(
          `[BuildToolClient] URL Nav: Switching to monitor PR #${prNumInUrl}.`
        );
        setToolDirective('');
        setValidationResult(null);
        setGenerationResult(null);
        setAdditionalDescription('');
        setUserSelectedDirectives([]);
        setCurrentMode('monitoring');
        setMonitoredPrNumber(prNumInUrl);
        setCurrentStep('submission');
        if (!validationResult)
          setValidationResult({
            generativeDescription: `Details for PR #${prNumInUrl}`,
            generativeRequestedDirectives: [],
          });
        if (!generationResult)
          setGenerationResult({
            message: `Monitoring PR #${prNumInUrl}`,
            generatedFiles: {},
            identifiedDependencies: [],
          });
      }
    } else {
      if (currentMode === 'monitoring') {
        console.log(
          '[BuildToolClient] URL Nav: prNumber removed. Resetting to build mode.'
        );
        handleReset();
      } else if (prNumberFromUrlStr && router) {
        router.replace('/build-tool', { scroll: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchParams,
    componentInitializationStateDone,
    currentMode,
    monitoredPrNumber,
    router,
  ]);

  const handleReset = useCallback(() => {
    console.log('[BuildToolClient] handleReset: Triggered.');
    const currentPrNumber = searchParams.get('prNumber');
    if (router && currentPrNumber) {
      router.replace('/build-tool', { scroll: false });
    }

    setCurrentMode('building');
    setCurrentStep('validation');
    setToolDirective('');
    setValidationResult(null);
    setAdditionalDescription('');
    setUserSelectedDirectives([]);
    setGenerationResult(null);
    setMonitoredPrNumber(null);

    setSelectedModel(getDefaultSelectedModel());
    setModelsError(null);
  }, [router, searchParams, getDefaultSelectedModel]);

  const handleValidationSuccess = useCallback((result: ValidationResult) => {
    setValidationResult(result);
    setUserSelectedDirectives(result.generativeRequestedDirectives || []);
    setCurrentStep('generation');
    setCurrentMode('building');
  }, []);

  const handleGenerationSuccess = useCallback((result: GenerationResult) => {
    setGenerationResult(result);
    setCurrentStep('submission');
    setCurrentMode('building');
  }, []);

  const effectiveGenerationResultForMonitoring = useMemo(() => {
    if (currentMode === 'monitoring') {
      return (
        generationResult || {
          message: `Monitoring PR #${monitoredPrNumber || '...'}`,
          generatedFiles: {},
          identifiedDependencies: [],
        }
      );
    }
    return generationResult;
  }, [currentMode, generationResult, monitoredPrNumber]);

  const effectiveValidationResultForMonitoring = useMemo(() => {
    if (currentMode === 'monitoring') {
      return (
        validationResult || {
          generativeDescription: `Details for PR #${monitoredPrNumber || '...'}`,
          generativeRequestedDirectives: [],
        }
      );
    }
    return validationResult;
  }, [currentMode, validationResult, monitoredPrNumber]);

  const renderCurrentStep = () => {
    if (!componentInitializationStateDone) {
      return (
        <p className="text-center p-4 italic text-gray-500 animate-pulse">
          Initializing Build Tool...
        </p>
      );
    }

    if (isApiUnavailable) {
      return (
        <div className="p-6 border rounded-lg bg-orange-50 border-orange-300 shadow-sm text-center">
          <h2 className="text-xl font-semibold mb-3 text-orange-800">
            Build Feature Temporarily Unavailable
          </h2>
          <p className="text-orange-700 mb-4">
            {apiUnavailableMessage ||
              'The AI-assisted build tool relies on backend services which appear to be unavailable at the moment.'}
          </p>
          <p className="text-sm text-gray-600">
            To contribute a new tool manually, please see the{' '}
            <a
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

    if (currentMode === 'building') {
      if (modelsLoading && availableModels.length === 0 && !modelsError) {
        return (
          <p className="text-center p-4 italic text-gray-500 animate-pulse">
            Loading AI Models...
          </p>
        );
      }
      if (modelsError && availableModels.length === 0) {
        return (
          <p className="text-center text-red-500 p-4">
            Error: {modelsError}. Build tool cannot proceed.
          </p>
        );
      }
      if (metadataLoadingHook && allAvailableToolDirectives.length === 0) {
        return (
          <p className="text-center p-4 italic text-gray-500 animate-pulse">
            Loading Tool Metadata...
          </p>
        );
      }
      if (metadataErrorHook && allAvailableToolDirectives.length === 0) {
        return (
          <p className="text-center text-red-500 p-4">
            Error loading existing tools list: {metadataErrorHook}
          </p>
        );
      }
      if (availableModels.length === 0 && !modelsLoading && !modelsError) {
        return (
          <p className="text-center text-red-500 p-4">
            No AI Models available for building. Please check configuration or
            try again later.
          </p>
        );
      }
    }

    if (currentMode === 'monitoring') {
      if (!monitoredPrNumber) {
        handleReset();
        return (
          <p className="text-center p-4 italic">Resetting to build mode...</p>
        );
      }

      let modelForMonitoring = selectedModel;
      if (!modelForMonitoring && availableModels.length > 0) {
        modelForMonitoring =
          getDefaultSelectedModel() || availableModels[0].name;
      }
      if (
        !modelForMonitoring &&
        (modelsLoading || modelsError) &&
        availableModels.length === 0
      ) {
        modelForMonitoring = 'models/gemini-1.5-flash-latest';
      }
      if (
        !modelForMonitoring &&
        !modelsLoading &&
        !modelsError &&
        availableModels.length === 0
      ) {
        return (
          <p className="text-center text-red-500 p-4">
            AI Model list is empty. Cannot properly display monitoring
            information.
          </p>
        );
      }
      if (!modelForMonitoring)
        modelForMonitoring = 'models/gemini-1.5-flash-latest';

      return (
        <CreateAnonymousPr
          toolDirective={toolDirective || `tool-for-pr-${monitoredPrNumber}`}
          generationResult={effectiveGenerationResultForMonitoring!}
          validationResult={effectiveValidationResultForMonitoring!}
          additionalDescription={''}
          userSelectedDirectives={[]}
          selectedModel={modelForMonitoring}
          onBack={handleReset}
          initialPrNumber={monitoredPrNumber}
          currentMode="monitoring"
          monitoredPrNumberForPolling={monitoredPrNumber}
          onFlowComplete={() =>
            console.log(
              '[BuildToolClient] PR monitoring flow (polling) complete.'
            )
          }
        />
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
            modelsLoading={modelsLoading && !componentInitializationStateDone}
            modelsError={modelsError}
            onValidationSuccess={handleValidationSuccess}
            onReset={handleReset}
          />
        );
      case 'generation':
        if (!validationResult) {
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
            currentMode="building"
            onFlowComplete={() =>
              console.log(
                '[BuildToolClient] Build and PR submission flow complete.'
              )
            }
          />
        );
      default:
        const exhaustiveCheck: never = currentStep;
        console.error(
          `[BuildToolClient] Unhandled build step: ${exhaustiveCheck}`
        );
        handleReset();
        return (
          <p className="text-center text-red-500">
            Error: Invalid build step: {currentStep}. Resetting...
          </p>
        );
    }
  };

  const showStartOverButton = useMemo(() => {
    if (isApiUnavailable) return false;
    if (!componentInitializationStateDone) return false;
    if (currentMode === 'monitoring') return true;
    if (currentMode === 'building' && currentStep !== 'validation') return true;
    return false;
  }, [
    currentMode,
    currentStep,
    isApiUnavailable,
    componentInitializationStateDone,
  ]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center mb-2 pb-2 border-b">
        <h1 className="text-2xl font-bold text-gray-800">
          Build a New Tool (AI Assisted)
          {currentMode === 'monitoring' &&
            monitoredPrNumber &&
            ` - Monitoring PR #${monitoredPrNumber}`}
        </h1>
        {showStartOverButton && (
          <Button
            variant="neutral-outline"
            size="sm"
            onClick={handleReset}
            className="text-sm"
          >
            Start Over / Build New
          </Button>
        )}
      </div>
      {renderCurrentStep()}
    </div>
  );
}
