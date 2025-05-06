// /app/build-tool/_components/ValidateDirective.tsx
'use client';

import React, { useState } from 'react';
import type { AiModel, ValidationResult } from '@/src/types/build'; // Import shared types from parent page

// Props expected by this component
interface ValidateDirectiveProps {
  // Renamed Props Interface
  toolDirective: string;
  setToolDirective: (value: string) => void;
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  availableModels: AiModel[];
  modelsLoading: boolean;
  modelsError: string | null;
  onValidationSuccess: (result: ValidationResult) => void; // Callback remains the same
  onReset: () => void;
}

// Interface for the expected API response structure
interface ApiValidationResponseData {
  success: boolean;
  message: string;
  generativeDescription: string | null; // Field name from API
  generativeRequestedDirectives: string[]; // Field name from API
}

// Component renamed to match the core action/API
export default function ValidateDirective({
  toolDirective,
  setToolDirective,
  selectedModel,
  setSelectedModel,
  availableModels,
  modelsLoading,
  modelsError,
  onValidationSuccess,
  // onReset, // Include if used
}: ValidateDirectiveProps) {
  // Use renamed Props Interface

  // Local state for component's operation
  const [isValidating, setIsValidating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'error'>('idle');

  // Helper to format slug
  const formatSlug = (value: string): string => {
    if (typeof value !== 'string') return '';
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  // Handler for the button click - initiates the validation API call
  const handleValidateClick = async () => {
    setStatus('idle');
    setFeedback(null);
    setIsValidating(true);
    setFeedback('Validating directive with AI...');
    const finalDirective = formatSlug(toolDirective);

    if (!finalDirective) {
      setStatus('error');
      setFeedback('Please enter a valid tool directive.');
      setIsValidating(false);
      return;
    }
    if (!selectedModel) {
      setStatus('error');
      setFeedback('Please select an AI model.');
      setIsValidating(false);
      return;
    }

    try {
      // API endpoint name matches component purpose
      const response = await fetch('/api/validate-directive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolDirective: finalDirective,
          modelName: selectedModel,
        }),
      });

      const data: ApiValidationResponseData = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || `Validation failed (${response.status})`
        );
      }

      // Validation Successful
      if (data.generativeDescription) {
        // Pass results up using the agreed structure
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
      console.error('Directive Validation Error:', error);
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

  // JSX remains structurally the same, just uses the new component name context
  return (
    <section
      className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isValidating ? 'opacity-70' : ''} ${status === 'error' ? 'border-red-300' : 'border-gray-200'}`}
    >
      {/* Title reflects the step/purpose */}
      <h2 className="text-lg font-semibold mb-3 text-gray-700">
        Step 1: Validate Directive
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Enter a unique, URL-friendly directive and select the AI model for
        validation.
      </p>

      {/* Inputs for Directive and Model */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label
            htmlFor="toolDirective"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Tool Directive <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            id="toolDirective"
            value={toolDirective}
            onChange={(e) => setToolDirective(e.target.value)}
            disabled={isValidating}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
            placeholder="e.g., json-formatter"
          />
          <p className="mt-1 text-xs text-gray-500">
            URL: `/tool/{formatSlug(toolDirective) || '...'}`
          </p>
        </div>
        <div>
          <label
            htmlFor="aiModelSelect"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Select AI Model <span className="text-red-600">*</span>
          </label>
          {modelsLoading && (
            <p className="text-sm text-gray-500 animate-pulse h-9 flex items-center">
              Loading...
            </p>
          )}
          {modelsError && (
            <p className="text-sm text-red-600 h-9 flex items-center">
              Error: {modelsError}
            </p>
          )}
          {!modelsLoading && !modelsError && availableModels.length === 0 && (
            <p className="text-sm text-orange-600 h-9 flex items-center">
              No models.
            </p>
          )}
          {!modelsLoading && !modelsError && availableModels.length > 0 && (
            <select
              id="aiModelSelect"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={
                isValidating || modelsLoading || availableModels.length === 0
              }
              className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
            >
              {selectedModel === '' && (
                <option value="" disabled>
                  -- Select --
                </option>
              )}
              {availableModels.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.displayName} ({model.name.replace('models/', '')})
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Model used for validation & generation.
          </p>
        </div>
      </div>

      {/* Button to trigger the validation */}
      <button
        type="button"
        onClick={handleValidateClick}
        disabled={
          isValidating ||
          !toolDirective.trim() ||
          modelsLoading ||
          !selectedModel
        }
        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isValidating ? 'Validating...' : 'Validate Directive'}
      </button>

      {/* Feedback Area */}
      {feedback && (
        <div
          className={`mt-4 text-sm p-3 rounded ${status === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}
        >
          {feedback}
        </div>
      )}
    </section>
  );
}
