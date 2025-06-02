// FILE: app/build/tool/_components/CreatePrForm.tsx
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type {
  GenerationResult,
  ValidationResult,
  ApiPrSubmissionResponseData,
} from '@/src/types/build';
import Button from '@/app/tool/_components/form/Button'; // Adjusted path
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface CreatePrFormProps {
  toolDirective: string;
  generationResult: GenerationResult; // Must not be null here
  validationResult: ValidationResult; // Must not be null here
  additionalDescription: string;
  userSelectedDirectives: string[];
  selectedModel: string; // AI model used for generation
  onBack: () => void; // To go back to the generation step
  onPrCreated: (
    prNumber: number,
    prUrl: string,
    createdToolDirective: string
  ) => void; // Callback with PR details
}

export default function CreatePrForm({
  toolDirective,
  generationResult,
  validationResult,
  additionalDescription,
  userSelectedDirectives,
  selectedModel,
  onBack,
  onPrCreated,
}: CreatePrFormProps) {
  const [isSubmittingPr, setIsSubmittingPr] = useState(false);
  const [prCreationFeedback, setPrCreationFeedback] = useState<string | null>(
    null
  );
  const [prCreationStatus, setPrCreationStatus] = useState<
    'idle' | 'error' | 'success' // Success here means API call succeeded, parent handles next step
  >('idle');

  const [expandedFilePath, setExpandedFilePath] = useState<string | null>(null);

  const filesToDisplayInPreview = useMemo(() => {
    return generationResult.generatedFiles || {};
  }, [generationResult.generatedFiles]);

  const sortedFilePaths = useMemo(() => {
    const files = filesToDisplayInPreview;
    if (!files || Object.keys(files).length === 0) return [];

    const metadataPath = `app/tool/${toolDirective}/metadata.json`;
    const pagePath = `app/tool/${toolDirective}/page.tsx`;
    // Client component path might vary if AI named it differently, try to find it
    const clientComponentPattern = new RegExp(
      `app/tool/${toolDirective}/_components/.*Client\\.tsx$`
    );
    const clientComponentPath =
      Object.keys(files).find((path) => clientComponentPattern.test(path)) ||
      '';

    const preferredOrder = [metadataPath, pagePath, clientComponentPath].filter(
      (p) => p
    );

    return Object.keys(files).sort((a, b) => {
      const indexA = preferredOrder.indexOf(a);
      const indexB = preferredOrder.indexOf(b);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      // Fallback sorting for other files (e.g., hooks, sub-components)
      if (a.includes('/_hooks/') && !b.includes('/_hooks/')) return -1; // Hooks first
      if (!a.includes('/_hooks/') && b.includes('/_hooks/')) return 1;
      if (a.includes('/_components/') && !b.includes('/_components/'))
        return -1; // Then components
      if (!a.includes('/_components/') && b.includes('/_components/')) return 1;

      return a.localeCompare(b);
    });
  }, [filesToDisplayInPreview, toolDirective]);

  // Effect to auto-expand the first relevant file for preview
  useEffect(() => {
    if (sortedFilePaths.length > 0 && !expandedFilePath) {
      const metadataPath = `app/tool/${toolDirective}/metadata.json`;
      const pagePath = `app/tool/${toolDirective}/page.tsx`;
      const clientComponentPattern = new RegExp(
        `app/tool/${toolDirective}/_components/.*Client\\.tsx$`
      );
      const clientComponentPath = Object.keys(filesToDisplayInPreview).find(
        (path) => clientComponentPattern.test(path)
      );

      if (clientComponentPath && filesToDisplayInPreview[clientComponentPath]) {
        setExpandedFilePath(clientComponentPath);
      } else if (filesToDisplayInPreview[pagePath]) {
        setExpandedFilePath(pagePath);
      } else if (filesToDisplayInPreview[metadataPath]) {
        setExpandedFilePath(metadataPath);
      } else {
        setExpandedFilePath(sortedFilePaths[0]);
      }
    }
  }, [
    sortedFilePaths,
    expandedFilePath,
    toolDirective,
    filesToDisplayInPreview,
  ]);

  const handleAnonymousSubmitClick = async () => {
    setPrCreationStatus('idle');
    setPrCreationFeedback(null);

    if (
      !generationResult?.generatedFiles ||
      Object.keys(generationResult.generatedFiles).length === 0
    ) {
      setPrCreationStatus('error');
      setPrCreationFeedback(
        `Error: No generated files found for ${toolDirective}. Cannot submit.`
      );
      return;
    }
    setIsSubmittingPr(true);
    setPrCreationFeedback('Submitting Pull Request to GitHub (anonymously)...');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      const response = await fetch(`${apiUrl}/api/create-anonymous-pr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolDirective: toolDirective,
          generatedFiles: generationResult.generatedFiles,
          identifiedDependencies: generationResult.identifiedDependencies || [],
          assetInstructions: generationResult.assetInstructions || null,
          generativeDescription:
            validationResult.generativeDescription ||
            `AI-generated code for ${toolDirective}`,
          additionalDescription: additionalDescription || '',
          generativeRequestedDirectives:
            validationResult.generativeRequestedDirectives || [],
          userSelectedExampleDirectives: userSelectedDirectives,
          selectedModel: selectedModel,
        }),
      });
      const data: ApiPrSubmissionResponseData = await response.json();
      if (!response.ok || !data.success || !data.url) {
        throw new Error(
          data.message || `PR submission failed (${response.status})`
        );
      }
      setPrCreationFeedback(data.message + ' Transitioning to monitoring...'); // Updated feedback
      setPrCreationStatus('success');

      const match = data.url.match(/\/pull\/(\d+)/);
      let createdPrNumber: number | null = null;
      if (match && match[1]) {
        createdPrNumber = parseInt(match[1], 10);
      } else {
        throw new Error('Could not parse PR number from URL: ' + data.url);
      }
      // Notify parent (BuildToolClient) about the created PR
      onPrCreated(createdPrNumber, data.url, toolDirective);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setPrCreationStatus('error');
      setPrCreationFeedback(
        `PR Submission Error: ${error.message || 'Unexpected error.'}`
      );
    } finally {
      setIsSubmittingPr(false);
    }
  };

  return (
    <section
      className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isSubmittingPr ? 'opacity-70' : ''} ${prCreationStatus === 'error' ? 'border-red-300' : 'border-purple-300'}`}
    >
      <h2 className="text-lg font-semibold mb-3 text-gray-700">
        Step 3: Review Generated Tool & Submit PR for ‘{toolDirective}’
      </h2>

      {generationResult.message && (
        <div
          className={`text-sm mb-4 p-3 rounded border ${
            generationResult.message.toLowerCase().includes('warning')
              ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
              : generationResult.message.toLowerCase().includes('error')
                ? 'bg-red-50 text-red-700 border-red-300'
                : 'bg-green-50 text-green-700 border-green-300'
          }`}
        >
          <strong>AI Generator Message:</strong> {generationResult.message}
        </div>
      )}

      {generationResult.assetInstructions && (
        <div className="mb-4 p-3 border border-blue-300 rounded-lg bg-blue-50 text-blue-700">
          <h3 className="text-sm font-semibold mb-2 flex items-center">
            <InformationCircleIcon className="h-5 w-5 mr-2 text-blue-500" />
            Important: Manual Asset Setup May Be Required
          </h3>
          <p className="text-xs mb-1.5">
            The AI has provided the following instructions for assets this tool
            might need:
          </p>
          <pre className="whitespace-pre-wrap bg-blue-100/50 p-2.5 rounded-md text-xs text-blue-800 font-mono overflow-x-auto custom-scrollbar">
            {generationResult.assetInstructions}
          </pre>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Generated Code Files Preview:
        </label>
        {sortedFilePaths.length > 0 && filesToDisplayInPreview ? (
          <div className="space-y-2 max-h-96 overflow-y-auto border p-2 rounded-md bg-gray-50 custom-scrollbar">
            {sortedFilePaths.map((filePath) => {
              const isExpanded = expandedFilePath === filePath;
              const fileContent = filesToDisplayInPreview[filePath];
              return (
                <div
                  key={filePath}
                  className={`border rounded ${isExpanded ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'} overflow-hidden`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedFilePath((prev) =>
                        prev === filePath ? null : filePath
                      )
                    }
                    className="w-full text-left px-3 py-2 flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded-t"
                    aria-expanded={isExpanded}
                  >
                    <code
                      className={`text-sm font-mono ${isExpanded ? 'text-indigo-700 font-semibold' : 'text-gray-700'}`}
                    >
                      {filePath.startsWith(`app/tool/${toolDirective}/`)
                        ? filePath.substring(
                            `app/tool/${toolDirective}/`.length
                          )
                        : filePath}
                    </code>
                    <span className="text-xs text-gray-400">
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-1 pb-1 bg-gray-900">
                      {fileContent != null ? (
                        <textarea
                          readOnly
                          value={fileContent}
                          rows={10}
                          className="block w-full p-2 border-t border-gray-700 bg-gray-900 text-gray-100 font-mono text-xs resize-y focus:outline-none custom-scrollbar-dark"
                          spellCheck="false"
                        />
                      ) : (
                        <div className="p-4 text-red-200 text-xs italic">
                          (Content missing)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 border border-dashed border-red-300 rounded bg-red-50 text-red-700 text-sm">
            Error: No generated code files available to preview.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4 mt-6">
        <Button
          type="button"
          onClick={onBack}
          disabled={isSubmittingPr}
          variant="link"
        >
          Back to Tool Refinement
        </Button>
        <Button
          type="button"
          onClick={handleAnonymousSubmitClick}
          disabled={
            isSubmittingPr ||
            !generationResult?.generatedFiles ||
            Object.keys(generationResult.generatedFiles).length === 0
          }
          className="bg-purple-600 hover:bg-purple-700 text-white"
          isLoading={isSubmittingPr}
          loadingText="Submitting PR..."
        >
          Submit Anonymous PR to GitHub
        </Button>
      </div>
      {prCreationFeedback &&
        prCreationStatus !== 'success' && ( // Don't show non-success feedback if API call succeeded
          <div
            className={`mt-4 text-sm p-3 rounded ${prCreationStatus === 'error' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}
          >
            {prCreationFeedback}
          </div>
        )}
      {prCreationFeedback &&
        prCreationStatus === 'success' && ( // Show success feedback briefly
          <div className="mt-4 text-sm p-3 rounded bg-green-100 text-green-700 border-green-200">
            {prCreationFeedback}
          </div>
        )}
    </section>
  );
}
