// FILE: app/build/tool/_components/ValidateDirective.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { ValidationResult } from '@/src/types/build';
import Button from '@/app/tool/_components/form/Button';
import { LightBulbIcon } from '@heroicons/react/24/solid';

interface ValidateDirectiveProps {
  toolDirective: string;
  setToolDirective: (value: string) => void;

  validationModelOptions: string[];
  defaultModelName: string;

  onValidationSuccess: (result: ValidationResult) => void;
  onReset: () => void;
  isApiUnavailable: boolean;

  analysisSuggestions?: string[];
  analysisModelNameUsed?: string | null;
}

interface ApiValidationResponseData {
  success: boolean;
  message: string;
  generativeDescription: string | null;
  generativeRequestedDirectives: string[];
}

export default function ValidateDirective({
  toolDirective,
  setToolDirective,
  validationModelOptions,
  defaultModelName,
  onValidationSuccess,
  isApiUnavailable,
  analysisSuggestions = [],
  analysisModelNameUsed,
}: ValidateDirectiveProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'error'>('idle');

  const [
    currentSelectedModelForValidation,
    setCurrentSelectedModelForValidation,
  ] = useState<string>('');

  const [fallbackModelsApi, setFallbackModelsApi] = useState<string[]>([]);
  const [fallbackModelsLoading, setFallbackModelsLoading] = useState(false);
  const [fallbackModelsError, setFallbackModelsError] = useState<string | null>(
    null
  );

  const finalModelOptionsForUI = useMemo(() => {
    if (validationModelOptions.length > 0) {
      return validationModelOptions;
    }
    if (fallbackModelsApi.length > 0) {
      return fallbackModelsApi;
    }
    return [];
  }, [validationModelOptions, fallbackModelsApi]);

  const showModelDropdown = useMemo(
    () => finalModelOptionsForUI.length > 1,
    [finalModelOptionsForUI]
  );

  const modelToDisplayOrUse = useMemo(() => {
    if (finalModelOptionsForUI.length === 1) {
      return finalModelOptionsForUI[0];
    }
    if (finalModelOptionsForUI.length === 0 && !fallbackModelsLoading) {
      return defaultModelName;
    }
    return null;
  }, [finalModelOptionsForUI, fallbackModelsLoading, defaultModelName]);

  useEffect(() => {
    if (validationModelOptions.length === 0 && !isApiUnavailable) {
      setFallbackModelsLoading(true);
      setFallbackModelsError(null);
      fetch('/api/list-models?filterExcluded=true&latestOnly=true')
        .then((res) => {
          if (!res.ok) {
            return res.json().then((err) => {
              throw new Error(
                err.error || `Failed to fetch models: ${res.status}`
              );
            });
          }
          return res.json();
        })
        .then((data) => {
          if (data.error) {
            throw new Error(data.error);
          }
          const modelNames = (data.models || []).map(
            (m: { name: string }) => m.name
          );
          setFallbackModelsApi(modelNames.length > 0 ? modelNames : []);
        })
        .catch((err) => {
          console.error('Error fetching fallback models for validation:', err);
          setFallbackModelsError(err.message || 'Could not load AI models.');
          setFallbackModelsApi([]);
        })
        .finally(() => {
          setFallbackModelsLoading(false);
        });
    } else if (validationModelOptions.length > 0) {
      setFallbackModelsApi([]);
      setFallbackModelsError(null);
    }
  }, [validationModelOptions, isApiUnavailable]);

  useEffect(() => {
    let modelToSet = '';
    if (finalModelOptionsForUI.length > 0) {
      modelToSet = finalModelOptionsForUI[0];
    } else if (!fallbackModelsLoading) {
      modelToSet = defaultModelName;
    }

    if (modelToSet && currentSelectedModelForValidation !== modelToSet) {
      setCurrentSelectedModelForValidation(modelToSet);
    }
  }, [
    finalModelOptionsForUI,
    defaultModelName,
    fallbackModelsLoading,
    currentSelectedModelForValidation,
  ]);

  const formatSlug = useCallback((value: string): string => {
    if (typeof value !== 'string') return '';
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }, []);

  const handleSuggestionClick = (suggestedDirective: string) => {
    setToolDirective(formatSlug(suggestedDirective));
    setFeedback(null);
    setStatus('idle');
  };

  const handleValidateClick = async () => {
    setStatus('idle');
    setFeedback(null);

    const finalDirective = formatSlug(toolDirective);
    if (!finalDirective) {
      setFeedback('Please enter a valid tool directive name.');
      setStatus('error');
      return;
    }
    setToolDirective(finalDirective);

    setIsValidating(true);
    setFeedback('Validating directive with AI...');

    if (!currentSelectedModelForValidation && !modelToDisplayOrUse) {
      setStatus('error');
      setFeedback(
        'AI model for validation is not determined. Please wait or check configuration.'
      );
      setIsValidating(false);
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      const response = await fetch(`${apiUrl}/api/validate-directive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolDirective: finalDirective,
          modelName:
            currentSelectedModelForValidation ||
            modelToDisplayOrUse ||
            defaultModelName,
        }),
      });

      const data: ApiValidationResponseData = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || `Validation failed (${response.status})`
        );
      }

      if (data.generativeDescription) {
        onValidationSuccess({
          generativeDescription: data.generativeDescription,
          generativeRequestedDirectives:
            data.generativeRequestedDirectives || [],
        });
        setFeedback(null);
        setStatus('idle');
      } else {
        throw new Error('Validation succeeded but description was missing.');
      }
    } catch (error: unknown) {
      setStatus('error');
      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.';
      setFeedback(`Validation Error: ${message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const modelDisplayName = (modelName: string | null | undefined) =>
    modelName ? modelName.replace('models/', '') : 'N/A';

  const renderModelSelector = () => {
    if (validationModelOptions.length === 0 && fallbackModelsLoading) {
      return (
        <div className="h-9 flex items-center">
          <p className="text-sm text-[rgb(var(--color-text-muted))] animate-pulse">
            Loading AI models...
          </p>
        </div>
      );
    }
    if (validationModelOptions.length === 0 && fallbackModelsError) {
      return (
        <div className="h-9 flex items-center" title={fallbackModelsError}>
          <p className="text-sm text-[rgb(var(--color-status-error))]">
            Error loading models. Using default:{' '}
            {modelDisplayName(defaultModelName)}
          </p>
        </div>
      );
    }

    if (showModelDropdown) {
      return (
        <select
          id="validationAiModel"
          value={currentSelectedModelForValidation}
          onChange={(e) => setCurrentSelectedModelForValidation(e.target.value)}
          disabled={
            isValidating ||
            isApiUnavailable ||
            finalModelOptionsForUI.length === 0
          }
          className="block w-full px-3 py-2 border border-[rgb(var(--color-border-soft))] bg-white rounded-md shadow-sm sm:text-sm disabled:bg-[rgb(var(--color-bg-subtle-hover))]"
        >
          {finalModelOptionsForUI.length > 0 &&
            !currentSelectedModelForValidation && (
              <option value="" disabled>
                -- Select Model --
              </option>
            )}
          {finalModelOptionsForUI.map((modelName) => (
            <option key={modelName} value={modelName}>
              {modelDisplayName(modelName)}
            </option>
          ))}
        </select>
      );
    }

    const displayModel =
      modelToDisplayOrUse ||
      currentSelectedModelForValidation ||
      defaultModelName;
    return (
      <div className="px-3 py-2 border border-[rgb(var(--color-border-soft))] rounded-md bg-[rgb(var(--color-bg-subtle-hover))] text-[rgb(var(--color-text-emphasis))] sm:text-sm h-9 flex items-center">
        {modelDisplayName(displayModel)}
      </div>
    );
  };

  return (
    <section
      className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isValidating || isApiUnavailable ? 'opacity-70' : ''} ${status === 'error' ? 'border-[rgb(var(--color-border-error))]' : 'border-[rgb(var(--color-border-base))]'}`}
    >
      <h3 className="text-md font-semibold mb-4 text-[rgb(var(--color-text-emphasis))]">
        Define Tool Name & Configure Validation
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-4">
        <div>
          <label
            htmlFor="toolDirective"
            className="block text-sm font-medium text-[rgb(var(--color-text-emphasis))] mb-1"
          >
            Tool Directive{' '}
            <span className="text-[rgb(var(--color-status-error))]">*</span>
          </label>
          <input
            type="text"
            id="toolDirective"
            value={toolDirective}
            onChange={(e) => {
              setToolDirective(e.target.value);
              if (feedback) setFeedback(null);
              if (status === 'error') setStatus('idle');
            }}
            onBlur={(e) => setToolDirective(formatSlug(e.target.value))}
            disabled={isValidating || isApiUnavailable}
            className="block w-full px-3 py-2 border border-[rgb(var(--color-border-soft))] rounded-md shadow-sm sm:text-sm disabled:bg-[rgb(var(--color-bg-subtle-hover))]"
            placeholder="e.g., json-formatter"
            aria-describedby="directive-format-hint"
          />
          <p
            id="directive-format-hint"
            className="mt-1 text-xs text-[rgb(var(--color-text-muted))]"
          >
            Preview URL: <code>/tool/{formatSlug(toolDirective) || '...'}</code>
          </p>
        </div>

        <div>
          <label
            htmlFor="validationAiModel"
            className="block text-sm font-medium text-[rgb(var(--color-text-emphasis))] mb-1"
          >
            {showModelDropdown
              ? 'Select AI Model for Validation'
              : 'AI Model for Validation'}
            {showModelDropdown && (
              <span className="text-[rgb(var(--color-status-error))]">*</span>
            )}
          </label>
          {renderModelSelector()}
          <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">
            Used by AI for name validation and initial description.
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <Button
          type="button"
          onClick={handleValidateClick}
          disabled={
            isValidating ||
            isApiUnavailable ||
            !toolDirective.trim() ||
            (!currentSelectedModelForValidation && !modelToDisplayOrUse) ||
            (validationModelOptions.length === 0 && fallbackModelsLoading)
          }
          variant="primary"
          className="text-base px-6 py-2.5"
          isLoading={isValidating}
          loadingText="Validating..."
        >
          Validate Directive & Continue
        </Button>
      </div>

      {feedback && (
        <div
          className={`mt-4 text-sm p-3 rounded ${status === 'error' ? 'bg-[rgb(var(--color-bg-error-subtle))] text-[rgb(var(--color-status-error))] border border-[rgb(var(--color-border-error))]' : 'bg-[rgb(var(--color-bg-info-subtle))] text-[rgb(var(--color-status-info))] border border-[rgb(var(--color-border-info))]'}`}
        >
          {feedback}
        </div>
      )}

      {/* AI Suggestions Section (Conditional from project_analysis.json) */}
      {analysisSuggestions &&
        analysisSuggestions.length > 0 &&
        currentSelectedModelForValidation && (
          <div className="mt-6 pt-4 border-t border-[rgb(var(--color-border-base))]">
            <h4 className="text-sm font-semibold text-[rgb(var(--color-text-subtle))] mb-3 flex items-center">
              <LightBulbIcon className="h-4 w-4 mr-1.5 text-[rgb(var(--color-icon-accent-yellow-hover))]" />
              AI-Generated Tool Ideas:
            </h4>
            <ul className="flex flex-row flex-wrap gap-x-2.5 gap-y-1.5">
              {analysisSuggestions.map((directive) => (
                <li key={directive}>
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick(directive)}
                    title={`Use '${directive}'`}
                    disabled={isValidating || isApiUnavailable}
                    className="transition-colors text-[rgb(var(--color-icon-brand))] hover:text-[rgb(var(--color-text-link-hover))] disabled:text-[rgb(var(--color-text-disabled))] disabled:cursor-not-allowed"
                  >
                    <code className="bg-[rgb(var(--color-bg-info-subtle))] text-[rgb(var(--color-text-link))] group-hover:bg-[rgb(var(--color-status-info))]/10 px-2 py-1 rounded text-xs font-mono hover:bg-[rgb(var(--color-status-info))]/10 disabled:bg-[rgb(var(--color-bg-subtle-hover))] disabled:text-[rgb(var(--color-text-muted))]">
                      {directive}
                    </code>
                  </button>
                </li>
              ))}
            </ul>
            {analysisModelNameUsed && (
              <p className="text-xs text-[rgb(var(--color-text-muted))] mt-3">
                (Suggestions based on project analysis using{' '}
                {analysisModelNameUsed.replace('models/', '')})
              </p>
            )}
          </div>
        )}
    </section>
  );
}
