// FILE: app/build/tool/_components/GenerateToolResources.tsx
'use client';

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import Link from 'next/link';
import GenerationLoadingModal from './GenerationLoadingModal';
import Button from '@/app/tool/_components/form/Button';
import type {
  ValidationResult,
  GenerationResult,
  ApiGenerationResponseData,
} from '@/src/types/build';
import { ResourceGenerationEpic } from '@/src/types/tools';

interface GenerateToolResourcesProps {
  toolDirective: string;
  validationResult: ValidationResult;
  additionalDescription: string;
  setAdditionalDescription: (value: string) => void;
  availableGenerationModels: string[];
  selectedGenerationModel: string;
  setSelectedGenerationModel: (value: string) => void;
  allAvailableToolDirectives: string[];
  userSelectedDirectives: string[];
  setUserSelectedDirectives: React.Dispatch<React.SetStateAction<string[]>>;
  onGenerationSuccess: (result: GenerationResult) => void;
  onBack: () => void;
  isApiUnavailable: boolean;
}

export default function GenerateToolResources({
  toolDirective,
  validationResult,
  additionalDescription,
  setAdditionalDescription,
  availableGenerationModels,
  selectedGenerationModel,
  setSelectedGenerationModel,
  allAvailableToolDirectives,
  userSelectedDirectives,
  setUserSelectedDirectives,
  onGenerationSuccess,
  onBack,
  isApiUnavailable,
}: GenerateToolResourcesProps) {
  const [isGeneratingMain, setIsGeneratingMain] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'error'>('idle');

  const [isNarrativeModalOpen, setIsNarrativeModalOpen] = useState(false);
  const [narrativeData, setNarrativeData] =
    useState<ResourceGenerationEpic | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isFetchingNarrative, setIsFetchingNarrative] = useState(false);

  const narrativeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_USER_EXAMPLES = 2;

  useEffect(() => {
    if (availableGenerationModels.length > 0) {
      if (
        !selectedGenerationModel ||
        !availableGenerationModels.includes(selectedGenerationModel)
      ) {
        setSelectedGenerationModel(availableGenerationModels[0]);
      }
    } else if (selectedGenerationModel) {
      setSelectedGenerationModel('');
    }
  }, [
    availableGenerationModels,
    selectedGenerationModel,
    setSelectedGenerationModel,
  ]);

  const availableUserChoices = useMemo(() => {
    const aiDirectives = new Set(
      validationResult.generativeRequestedDirectives || []
    );
    return allAvailableToolDirectives
      .filter((dir) => !aiDirectives.has(dir))
      .sort((a, b) => a.localeCompare(b));
  }, [
    allAvailableToolDirectives,
    validationResult.generativeRequestedDirectives,
  ]);

  const handleUserExampleSelectionChange = useCallback(
    (directive: string, isChecked: boolean) => {
      setUserSelectedDirectives((prevSelected) => {
        const currentSet = new Set(prevSelected);
        if (isChecked) {
          if (currentSet.size < MAX_USER_EXAMPLES) {
            currentSet.add(directive);
          } else {
            return prevSelected;
          }
        } else {
          currentSet.delete(directive);
        }
        return Array.from(currentSet);
      });
    },
    [setUserSelectedDirectives, MAX_USER_EXAMPLES]
  );

  useEffect(() => {
    return () => {
      if (narrativeIntervalRef.current) {
        clearInterval(narrativeIntervalRef.current);
      }
    };
  }, []);

  const startNarrativeDisplay = (data: ResourceGenerationEpic) => {
    setNarrativeData(data);
    setCurrentChapterIndex(0);

    if (narrativeIntervalRef.current) {
      clearInterval(narrativeIntervalRef.current);
    }

    narrativeIntervalRef.current = setInterval(() => {
      setCurrentChapterIndex((prevIndex) => {
        if (prevIndex < data.epicNarrative.length - 1) {
          return prevIndex + 1;
        }
        if (narrativeIntervalRef.current)
          clearInterval(narrativeIntervalRef.current);
        return prevIndex;
      });
    }, 8000);
  };

  const handleGenerateClick = async () => {
    setStatus('idle');
    setFeedback(null);
    setIsGeneratingMain(true);

    setNarrativeData(null);
    setCurrentChapterIndex(0);
    setIsFetchingNarrative(true);
    setIsNarrativeModalOpen(true);

    if (narrativeIntervalRef.current)
      clearInterval(narrativeIntervalRef.current);

    if (!selectedGenerationModel) {
      setStatus('error');
      setFeedback('Error: AI model for generation is not selected.');
      setIsGeneratingMain(false);
      setIsNarrativeModalOpen(false);
      setIsFetchingNarrative(false);
      return;
    }
    if (!validationResult.generativeDescription) {
      setStatus('error');
      setFeedback('Error: AI-generated description is missing.');
      setIsGeneratingMain(false);
      setIsNarrativeModalOpen(false);
      setIsFetchingNarrative(false);
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    fetch(`${apiUrl}/api/generate-modal-narrative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolDirective: toolDirective,
        toolDescription: validationResult.generativeDescription,
        generationModelName: selectedGenerationModel,
        userAdditionalDescription: additionalDescription.trim(),
        aiRequestedExamples:
          validationResult.generativeRequestedDirectives || [],
        userSelectedExamples: userSelectedDirectives,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          return res
            .json()
            .then((errData) => {
              throw new Error(
                errData.error || `Narrative API request failed (${res.status})`
              );
            })
            .catch(() => {
              throw new Error(
                `Narrative API request failed (${res.status}) with non-JSON response`
              );
            });
        }
        return res.json();
      })
      .then((narrative: ResourceGenerationEpic | null) => {
        setIsFetchingNarrative(false);
        if (
          narrative &&
          narrative.epicNarrative &&
          narrative.epicNarrative.length > 0
        ) {
          startNarrativeDisplay(narrative);
        } else {
          console.warn(
            'Narrative data was null or empty. Modal will show pre-narrative content or fallback.'
          );
        }
      })
      .catch((err) => {
        console.error('Failed to fetch or process narrative:', err);
        setIsFetchingNarrative(false);
      });

    try {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      const response = await fetch(`${apiUrl}/api/generate-tool-resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolDirective: toolDirective,
          generativeDescription: validationResult.generativeDescription,
          additionalDescription: additionalDescription.trim(),
          modelName: selectedGenerationModel,
          generativeRequestedDirectives:
            validationResult.generativeRequestedDirectives || [],
          userSelectedExampleDirectives: userSelectedDirectives,
        }),
      });

      const data: ApiGenerationResponseData = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || `API request failed (${response.status})`
        );
      }

      if (data.generatedFiles && Object.keys(data.generatedFiles).length > 0) {
        onGenerationSuccess({
          message: data.message,
          generatedFiles: data.generatedFiles,
          identifiedDependencies: data.identifiedDependencies,
          assetInstructions: data.assetInstructions,
        });
        setFeedback(null);
        setStatus('idle');
      } else {
        throw new Error(
          data.message ||
            'Generation failed: API reported success but generated files were missing.'
        );
      }
    } catch (error: unknown) {
      console.error('Tool Resource Generation Error:', error);
      setStatus('error');
      const message =
        error instanceof Error
          ? error.message
          : 'Unexpected error during resource generation.';
      setFeedback(`Generation Error: ${message}`);
    } finally {
      setIsGeneratingMain(false);
      if (narrativeIntervalRef.current)
        clearInterval(narrativeIntervalRef.current);
    }
  };

  const modelDisplayName = (modelName: string | null | undefined) =>
    modelName ? modelName.replace('models/', '') : 'N/A';

  return (
    <>
      <section
        className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isGeneratingMain || isApiUnavailable ? 'opacity-70' : ''} ${status === 'error' ? 'border-[rgb(var(--color-border-error))] ' : 'border-[rgb(var(--color-border-info))] '}`}
      >
        <h3 className="text-md font-semibold mb-4 text-[rgb(var(--color-text-emphasis))] ">
          Refine Details, Select Examples & AI Model for Generation
        </h3>

        <div className="mb-4">
          <span className="block text-sm font-medium text-[rgb(var(--color-text-emphasis))] ext-[rgb(var(--color-text-muted))] mb-1">
            Target Directive:
          </span>
          <div className="px-3 py-2 border border-[rgb(var(--color-border-soft))] rounded-md bg-[rgb(var(--color-bg-subtle-hover))] ">
            <code className="text-[rgb(var(--color-text-emphasis))] text-sm font-mono">
              {toolDirective}
            </code>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-emphasis))] ext-[rgb(var(--color-text-muted))] mb-1">
            AI Generated Description (Review):
          </label>
          <div
            id="genDescDisplay"
            className="block w-full px-3 py-2 border border-[rgb(var(--color-border-soft))] rounded-md shadow-sm bg-[rgb(var(--color-bg-subtle-hover))] text-[rgb(var(--color-text-emphasis))] ext-[rgb(var(--color-text-muted))] sm:text-sm whitespace-pre-wrap"
          >
            {validationResult.generativeDescription || (
              <span className="italic text-[rgb(var(--color-text-muted))] ext-[rgb(var(--color-text-disabled))]">
                No description provided.
              </span>
            )}
          </div>
        </div>

        {(validationResult.generativeRequestedDirectives?.length ?? 0) > 0 && (
          <div className="mb-4 p-3 border-[rgb(var(--color-border-soft))] border rounded">
            <p className="text-sm font-medium mb-1 text-[rgb(var(--color-text-emphasis))] ext-[rgb(var(--color-text-muted))]">
              AI Requested Implementation Examples (
              {validationResult.generativeRequestedDirectives?.length || 0}):
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs columns-2 sm:columns-3 md:columns-4">
              {validationResult.generativeRequestedDirectives?.map(
                (directive) => (
                  <li
                    key={directive}
                    className="text-[rgb(var(--color-text-link))] font-mono break-all"
                  >
                    <Link
                      href={`/tool/${directive}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-[rgb(var(--color-text-link-hover))] "
                    >
                      {directive}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        <div className="mb-4">
          <label
            htmlFor="generationAiModelSelect"
            className="block text-sm font-medium text-[rgb(var(--color-text-emphasis))] ext-[rgb(var(--color-text-muted))] mb-1"
          >
            {availableGenerationModels.length > 1
              ? 'Select AI Model for Generation'
              : 'AI Model for Generation'}
            {availableGenerationModels.length > 1 && (
              <span className="text-[rgb(var(--color-status-error))]">*</span>
            )}
          </label>
          {availableGenerationModels.length === 0 && (
            <div className="h-9 flex items-center">
              <p className="text-sm text-[rgb(var(--color-text-accent2))] ext-orange-400">
                No AI models configured.
              </p>
            </div>
          )}
          {availableGenerationModels.length > 0 && (
            <>
              {availableGenerationModels.length === 1 && (
                <div className="px-3 py-2 border border-[rgb(var(--color-border-soft))] rounded-md bg-[rgb(var(--color-bg-subtle-hover))] text-[rgb(var(--color-text-emphasis))] ext-[rgb(var(--color-text-muted))] sm:text-sm h-9 flex items-center">
                  {modelDisplayName(availableGenerationModels[0])}
                </div>
              )}
              {availableGenerationModels.length > 1 && (
                <select
                  id="generationAiModelSelect"
                  value={selectedGenerationModel}
                  onChange={(e) => setSelectedGenerationModel(e.target.value)}
                  disabled={
                    isGeneratingMain ||
                    isApiUnavailable ||
                    availableGenerationModels.length === 0
                  }
                  className="block w-full px-3 py-2 border border-[rgb(var(--color-border-soft))] bg-white text-[rgb(var(--color-text-base))] rounded-md shadow-sm sm:text-sm disabled:bg-[rgb(var(--color-bg-subtle-hover))] "
                >
                  {availableGenerationModels.map((modelName) => (
                    <option key={modelName} value={modelName}>
                      {modelDisplayName(modelName)}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-emphasis))] ext-[rgb(var(--color-text-muted))] mb-2">
            Select Additional Examples (Optional, Max {MAX_USER_EXAMPLES}):
          </label>
          {availableUserChoices.length > 0 ? (
            <div className="max-h-48 overflow-y-auto border border-[rgb(var(--color-border-base))] rounded p-2 space-y-1 bg-[rgb(var(--color-bg-subtle))] columns-2 sm:columns-3 md:columns-4">
              {availableUserChoices.map((directive) => {
                const isChecked = userSelectedDirectives.includes(directive);
                const isDisabled =
                  !isChecked &&
                  userSelectedDirectives.length >= MAX_USER_EXAMPLES;
                return (
                  <div
                    key={directive}
                    className="flex items-center break-inside-avoid"
                  >
                    <input
                      id={`user-choice-${directive}`}
                      type="checkbox"
                      value={directive}
                      checked={isChecked}
                      disabled={
                        isDisabled || isGeneratingMain || isApiUnavailable
                      }
                      onChange={(e) =>
                        handleUserExampleSelectionChange(
                          directive,
                          e.target.checked
                        )
                      }
                      className="h-3.5 w-3.5 rounded border-[rgb(var(--color-border-soft))] text-[rgb(var(--color-button-accent-bg))] disabled:opacity-50 accent-[rgb(var(--color-button-accent-bg))]"
                    />
                    <label
                      htmlFor={`user-choice-${directive}`}
                      className={`ml-2 block text-xs font-mono ${isDisabled ? 'text-[rgb(var(--color-text-disabled))] ext-[rgb(var(--color-text-muted))] cursor-not-allowed' : 'text-[rgb(var(--color-text-emphasis))] ext-[rgb(var(--color-text-muted))] cursor-pointer'}`}
                    >
                      {directive}
                    </label>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[rgb(var(--color-text-muted))] ext-[rgb(var(--color-text-disabled))] italic">
              (No other tools available for examples)
            </p>
          )}
          <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))] ext-[rgb(var(--color-text-disabled))]">
            Choose up to {MAX_USER_EXAMPLES} tools for AI inspiration.{' '}
            {userSelectedDirectives.length >= MAX_USER_EXAMPLES && (
              <span className="text-[rgb(var(--color-button-accent-bg))] ext-purple-400 font-medium">
                Max {MAX_USER_EXAMPLES} selected.
              </span>
            )}
          </p>
        </div>

        <div className="mb-6">
          <label
            htmlFor="additionalDescription"
            className="block text-sm font-medium text-[rgb(var(--color-text-emphasis))] ext-[rgb(var(--color-text-muted))] mb-1"
          >
            Additional Details / Refinements (Optional):
          </label>
          <textarea
            id="additionalDescription"
            value={additionalDescription}
            onChange={(e) => setAdditionalDescription(e.target.value)}
            rows={4}
            disabled={isGeneratingMain || isApiUnavailable}
            className="block w-full px-3 py-2 border border-[rgb(var(--color-border-soft))] rounded-md shadow-sm placeholder-gray-400 sm:text-sm resize-y disabled:bg-[rgb(var(--color-bg-subtle-hover))] bg-white text-[rgb(var(--color-text-base))] "
            placeholder="Specific UI preferences, libraries to avoid, edge cases..."
          />
          <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))] ext-[rgb(var(--color-text-disabled))]">
            Extra context for the AI.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <Button
            type="button"
            onClick={onBack}
            disabled={isGeneratingMain || isApiUnavailable}
            variant="link"
          >
            Back to Validation
          </Button>
          <div className="flex-grow"></div> {/* Spacer */}
          <Button
            type="button"
            onClick={handleGenerateClick}
            disabled={
              isGeneratingMain ||
              isApiUnavailable ||
              !validationResult.generativeDescription ||
              !selectedGenerationModel
            }
            isLoading={isGeneratingMain}
            loadingText="Generating..."
            variant="primary"
            className="text-base px-6 py-2.5"
          >
            Generate Tool Files
          </Button>
        </div>

        {feedback && !isNarrativeModalOpen && (
          <div
            className={`mt-4 text-sm p-3 rounded ${status === 'error' ? 'bg-[rgb(var(--color-bg-error-subtle))] text-[rgb(var(--color-status-error))] border border-[rgb(var(--color-border-error))] ext-[rgb(var(--color-status-error))] ' : 'bg-[rgb(var(--color-bg-info-subtle))] text-[rgb(var(--color-status-info))] border border-[rgb(var(--color-border-info))] order-blue-700'}`}
          >
            {feedback}
          </div>
        )}
      </section>

      <GenerationLoadingModal
        isOpen={isNarrativeModalOpen}
        onClose={() => {
          setIsNarrativeModalOpen(false);
          if (narrativeIntervalRef.current)
            clearInterval(narrativeIntervalRef.current);
        }}
        narrativeData={narrativeData}
        currentChapterIndex={currentChapterIndex}
        toolDirective={toolDirective}
        isFetchingNarrative={isFetchingNarrative}
      />
    </>
  );
}
