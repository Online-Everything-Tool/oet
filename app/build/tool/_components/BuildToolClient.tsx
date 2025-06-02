// FILE: app/build/tool/_components/BuildToolClient.tsx
'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { Swiper as SwiperCore } from 'swiper/types';

import ValidateDirective from './ValidateDirective';
import GenerateToolResources from './GenerateToolResources';
import CreateAnonymousPr from './CreateAnonymousPr';
import BuildToolInfoCarousel from './BuildToolInfoCarousel';
import Button from '@/app/tool/_components/form/Button';

import type { ValidationResult, GenerationResult } from '@/src/types/build';
import { useMetadata } from '@/app/context/MetadataContext';

interface ProjectAnalysisData {
  siteTagline: string;
  siteDescription: string;
  siteBenefits: string[];
  suggestedNewToolDirectives: string[];
  modelNameUsed: string;
  generatedAt: string;
}

type BuildStep = 'validation' | 'generation' | 'submission';
type BuildMode = 'building' | 'monitoring';

const parseModelsFromEnv = (
  envVarValue: string | undefined,
  fallbackEnvVarValue?: string | undefined
): string[] => {
  const valueToParse = envVarValue?.trim() || fallbackEnvVarValue?.trim();
  if (!valueToParse) return [];
  return valueToParse
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name);
};

export default function BuildToolClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const defaultModelName =
    process.env.NEXT_PUBLIC_DEFAULT_GEMINI_MODEL_NAME ||
    'models/gemini-1.5-flash-latest';

  const validationModelOptions = useMemo(
    () =>
      parseModelsFromEnv(
        process.env.NEXT_PUBLIC_VALIDATE_GEMINI_MODEL_NAME,
        defaultModelName
      ),
    [defaultModelName]
  );

  const generationModelOptions = useMemo(
    () =>
      parseModelsFromEnv(
        process.env.NEXT_PUBLIC_GENERATE_GEMINI_MODEL_NAME,
        defaultModelName
      ),
    [defaultModelName]
  );

  const getInitialToolDirectiveFromUrl = useCallback(() => {
    return searchParams.get('directive') || '';
  }, [searchParams]);

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
  const initialDirectiveFromUrlRef = useRef(getInitialToolDirectiveFromUrl());

  const [currentStep, setCurrentStep] = useState<BuildStep>(
    initialDataRef.current.mode === 'monitoring' ? 'submission' : 'validation'
  );
  const [currentMode, setCurrentMode] = useState<BuildMode>(
    initialDataRef.current.mode
  );
  const [monitoredPrNumber, setMonitoredPrNumber] = useState<number | null>(
    initialDataRef.current.pr
  );

  const [toolDirective, setToolDirective] = useState(
    initialDirectiveFromUrlRef.current
  );

  const [selectedGenerationModel, setSelectedGenerationModel] =
    useState<string>('');

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

  const [metadataContextLoaded, setMetadataContextLoaded] = useState(false);
  const [
    componentInitializationStateDone,
    setComponentInitializationStateDone,
  ] = useState(false);

  const [swiperInstance, setSwiperInstance] = useState<SwiperCore | null>(null);

  const [projectAnalysisSuggestions, setProjectAnalysisSuggestions] = useState<
    string[]
  >([]);
  const [projectAnalysisModel, setProjectAnalysisModel] = useState<
    string | null
  >(null);

  useEffect(() => {
    const fetchProjectAnalysis = async () => {
      try {
        const response = await fetch('/data/project_analysis.json');
        if (!response.ok) {
          console.warn(
            `Failed to fetch project_analysis.json: ${response.status}`
          );
          return;
        }
        const data: ProjectAnalysisData = await response.json();
        if (data && data.suggestedNewToolDirectives) {
          setProjectAnalysisSuggestions(data.suggestedNewToolDirectives);
          setProjectAnalysisModel(data.modelNameUsed || null);
        }
      } catch (error) {
        console.warn('Error fetching or parsing project_analysis.json:', error);
      }
    };
    fetchProjectAnalysis();
  }, []);

  useEffect(() => {
    if (generationModelOptions.length > 0 && !selectedGenerationModel) {
      setSelectedGenerationModel(generationModelOptions[0]);
    } else if (
      generationModelOptions.length === 0 &&
      !selectedGenerationModel &&
      defaultModelName
    ) {
      setSelectedGenerationModel(defaultModelName);
    }
  }, [generationModelOptions, selectedGenerationModel, defaultModelName]);

  useEffect(() => {
    let isMounted = true;
    const { mode: initialMode, pr: initialPr } = getInitialModeAndPr();

    if (isMounted) {
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
        if (searchParams.get('directive')) {
          const newSearchParams = new URLSearchParams(searchParams.toString());
          newSearchParams.delete('directive');
          router.replace(`${pathname}?${newSearchParams.toString()}`, {
            scroll: false,
          });
        }
      } else {
        setCurrentMode('building');
        setCurrentStep('validation');
        setMonitoredPrNumber(null);
        if (searchParams.get('prNumber')) {
          const newSearchParams = new URLSearchParams(searchParams.toString());
          newSearchParams.delete('prNumber');
          router.replace(`${pathname}?${newSearchParams.toString()}`, {
            scroll: false,
          });
        }
        const directiveFromUrl = searchParams.get('directive');
        if (directiveFromUrl) {
          setToolDirective(directiveFromUrl);
        }
      }
    }
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
        setAllAvailableToolDirectives([]);
      }
      setMetadataContextLoaded(true);
    }
  }, [metadataLoadingHook, toolMetadataMap, metadataErrorHook]);

  useEffect(() => {
    if (metadataContextLoaded) {
      setComponentInitializationStateDone(true);
      if (!selectedGenerationModel && generationModelOptions.length > 0) {
        setSelectedGenerationModel(generationModelOptions[0]);
      } else if (
        !selectedGenerationModel &&
        generationModelOptions.length === 0 &&
        defaultModelName
      ) {
        setSelectedGenerationModel(defaultModelName);
      }
    }
  }, [
    metadataContextLoaded,
    selectedGenerationModel,
    generationModelOptions,
    defaultModelName,
  ]);

  useEffect(() => {
    if (!componentInitializationStateDone) return;

    const prNumberFromUrlStr = searchParams.get('prNumber');
    const directiveFromUrl = searchParams.get('directive');
    const prNumInUrl = prNumberFromUrlStr
      ? parseInt(prNumberFromUrlStr, 10)
      : null;

    if (prNumInUrl && !isNaN(prNumInUrl) && prNumInUrl > 0) {
      if (currentMode !== 'monitoring' || monitoredPrNumber !== prNumInUrl) {
        setToolDirective('');
        setValidationResult({
          generativeDescription: `Details for PR #${prNumInUrl}`,
          generativeRequestedDirectives: [],
        });
        setGenerationResult({
          message: `Monitoring PR #${prNumInUrl}`,
          generatedFiles: {},
          identifiedDependencies: [],
        });
        setAdditionalDescription('');
        setUserSelectedDirectives([]);
        setCurrentMode('monitoring');
        setMonitoredPrNumber(prNumInUrl);
        setCurrentStep('submission');
        if (directiveFromUrl) {
          const newSearchParams = new URLSearchParams(searchParams.toString());
          newSearchParams.delete('directive');
          router.replace(`${pathname}?${newSearchParams.toString()}`, {
            scroll: false,
          });
        }
      }
    } else {
      if (currentMode === 'monitoring') {
        handleReset(false);
      }
      if (
        directiveFromUrl &&
        directiveFromUrl !== toolDirective &&
        currentMode === 'building' &&
        currentStep === 'validation'
      ) {
        setToolDirective(directiveFromUrl);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchParams,
    componentInitializationStateDone,
    currentMode,
    monitoredPrNumber,
    pathname,
    router,
  ]);

  useEffect(() => {
    if (swiperInstance && !swiperInstance.destroyed) {
      let targetSlideIndex = 0;
      if (currentMode === 'building') {
        if (currentStep === 'generation') {
          targetSlideIndex = 1;
        } else if (currentStep === 'submission') {
          targetSlideIndex = 2;
        }
      } else if (currentMode === 'monitoring') {
        targetSlideIndex = 2;
      }

      if (swiperInstance.activeIndex !== targetSlideIndex) {
        swiperInstance.slideTo(targetSlideIndex);
      }
    }
  }, [currentStep, currentMode, swiperInstance]);

  const handleReset = useCallback(
    (clearUrlParams = true) => {
      if (clearUrlParams) {
        const currentPrNumber = searchParams.get('prNumber');
        const currentDirective = searchParams.get('directive');
        if (router && (currentPrNumber || currentDirective)) {
          router.replace(pathname, { scroll: false });
        }
      }
      setCurrentMode('building');
      setCurrentStep('validation');
      setToolDirective(
        clearUrlParams ? '' : searchParams.get('directive') || ''
      );
      setValidationResult(null);
      setAdditionalDescription('');
      setUserSelectedDirectives([]);
      setGenerationResult(null);
      setMonitoredPrNumber(null);
      if (generationModelOptions.length > 0) {
        setSelectedGenerationModel(generationModelOptions[0]);
      } else if (defaultModelName) {
        setSelectedGenerationModel(defaultModelName);
      } else {
        setSelectedGenerationModel('');
      }
      setIsApiUnavailable(false);
      setApiUnavailableMessage('');

      if (swiperInstance && !swiperInstance.destroyed) {
        swiperInstance.slideTo(0);
      }
    },
    [
      router,
      searchParams,
      pathname,
      generationModelOptions,
      defaultModelName,
      swiperInstance,
    ]
  );

  const handleValidationSuccess = useCallback(
    (result: ValidationResult) => {
      setValidationResult(result);
      setUserSelectedDirectives([]);
      setCurrentStep('generation');
      setCurrentMode('building');
      const currentDirective = searchParams.get('directive');
      if (currentDirective && router) {
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete('directive');

        const prNum = newSearchParams.get('prNumber');
        if (prNum) {
          router.replace(`${pathname}?${newSearchParams.toString()}`, {
            scroll: false,
          });
        } else {
          router.replace(pathname, { scroll: false });
        }
      }
    },
    [searchParams, router, pathname]
  );

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

  const formatSlug = useCallback((value: string): string => {
    if (typeof value !== 'string') return '';
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }, []);

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
    }

    if (currentMode === 'monitoring') {
      if (!monitoredPrNumber) {
        handleReset();
        return (
          <p className="text-center p-4 italic">Resetting to build mode...</p>
        );
      }
      const modelForMonitoringDisplay =
        selectedGenerationModel || defaultModelName;

      return (
        <CreateAnonymousPr
          toolDirective={toolDirective || `tool-for-pr-${monitoredPrNumber}`}
          generationResult={effectiveGenerationResultForMonitoring!}
          validationResult={effectiveValidationResultForMonitoring!}
          additionalDescription={''}
          userSelectedDirectives={[]}
          selectedModel={modelForMonitoringDisplay}
          onBack={() => handleReset(true)}
          initialPrNumber={monitoredPrNumber}
          currentMode="monitoring"
          monitoredPrNumberForPolling={monitoredPrNumber}
          onFlowComplete={() => {
            /* Flow complete */
          }}
        />
      );
    }

    switch (currentStep) {
      case 'validation':
        return (
          <ValidateDirective
            toolDirective={toolDirective}
            setToolDirective={setToolDirective}
            validationModelOptions={validationModelOptions}
            defaultModelName={defaultModelName}
            onValidationSuccess={handleValidationSuccess}
            onReset={() => handleReset(true)}
            isApiUnavailable={isApiUnavailable}
            analysisSuggestions={projectAnalysisSuggestions}
            analysisModelNameUsed={projectAnalysisModel}
          />
        );
      case 'generation':
        if (!validationResult) {
          handleReset(true);
          return null;
        }
        return (
          <GenerateToolResources
            toolDirective={toolDirective}
            validationResult={validationResult}
            additionalDescription={additionalDescription}
            setAdditionalDescription={setAdditionalDescription}
            availableGenerationModels={
              generationModelOptions.length > 0
                ? generationModelOptions
                : [defaultModelName]
            }
            selectedGenerationModel={selectedGenerationModel}
            setSelectedGenerationModel={setSelectedGenerationModel}
            allAvailableToolDirectives={allAvailableToolDirectives}
            userSelectedDirectives={userSelectedDirectives}
            setUserSelectedDirectives={setUserSelectedDirectives}
            onGenerationSuccess={handleGenerationSuccess}
            onBack={() => setCurrentStep('validation')}
            isApiUnavailable={isApiUnavailable}
          />
        );
      case 'submission':
        if (
          !generationResult ||
          !validationResult ||
          !toolDirective ||
          !selectedGenerationModel
        ) {
          handleReset(true);
          return null;
        }
        return (
          <CreateAnonymousPr
            toolDirective={toolDirective}
            generationResult={generationResult}
            validationResult={validationResult}
            additionalDescription={additionalDescription}
            userSelectedDirectives={userSelectedDirectives}
            selectedModel={selectedGenerationModel}
            onBack={() => setCurrentStep('generation')}
            currentMode="building"
            onFlowComplete={() => {
              /* Flow complete */
            }}
          />
        );
      default:
        handleReset(true);
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
    if (
      currentMode === 'building' &&
      currentStep === 'validation' &&
      toolDirective !== initialDirectiveFromUrlRef.current &&
      toolDirective !== ''
    )
      return true;
    if (
      currentMode === 'building' &&
      currentStep === 'validation' &&
      toolDirective === '' &&
      initialDirectiveFromUrlRef.current !== ''
    )
      return true;

    return false;
  }, [
    currentMode,
    currentStep,
    isApiUnavailable,
    componentInitializationStateDone,
    toolDirective,
  ]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
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
            onClick={() => handleReset(true)}
            className="text-sm"
          >
            Start Over / Build New
          </Button>
        )}
      </div>

      {currentMode === 'building' && componentInitializationStateDone && (
        <BuildToolInfoCarousel
          onSwiperReady={setSwiperInstance}
          formatSlug={formatSlug}
          toolDirective={toolDirective}
        />
      )}
      {renderCurrentStep()}
    </div>
  );
}
