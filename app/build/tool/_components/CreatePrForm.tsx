// FILE: app/build/tool/_components/CreatePrForm.tsx
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type {
  GenerationResult,
  ValidationResult,
  ApiPrSubmissionResponseData,
} from '@/src/types/build';
import Button from '@/app/tool/_components/form/Button';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface CreatePrFormProps {
  toolDirective: string;
  generationResult: GenerationResult;
  validationResult: ValidationResult;
  additionalDescription: string;
  userSelectedDirectives: string[];
  selectedModel: string;
  onBack: () => void;
  onPrCreated: (
    prNumber: number,
    prUrl: string,
    createdToolDirective: string
  ) => void;
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
    'idle' | 'error' | 'success'
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

      if (a.includes('/_hooks/') && !b.includes('/_hooks/')) return -1;
      if (!a.includes('/_hooks/') && b.includes('/_hooks/')) return 1;
      if (a.includes('/_components/') && !b.includes('/_components/'))
        return -1;
      if (!a.includes('/_components/') && b.includes('/_components/')) return 1;

      return a.localeCompare(b);
    });
  }, [filesToDisplayInPreview, toolDirective]);

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
      setPrCreationFeedback(data.message + ' Transitioning to monitoring...');
      setPrCreationStatus('success');

      const match = data.url.match(/\/pull\/(\d+)/);
      let createdPrNumber: number | null = null;
      if (match && match[1]) {
        createdPrNumber = parseInt(match[1], 10);
      } else {
        throw new Error('Could not parse PR number from URL: ' + data.url);
      }

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
      className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isSubmittingPr ? 'opacity-70' : ''} ${prCreationStatus === 'error' ? 'border-[rgb(var(--color-border-error))]' : 'border-[rgb(var(--color-border-accent))]'}`}
    >
      <h2 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-emphasis))]">
        Step 3: Review Generated Tool & Submit PR for ‘{toolDirective}’
      </h2>

      {generationResult.message && (
        <div
          className={`text-sm mb-4 p-3 rounded border ${
            generationResult.message.toLowerCase().includes('warning')
              ? 'bg-[rgb(var(--color-bg-warning-subtle))] text-[rgb(var(--color-text-warning))] border-[rgb(var(--color-border-warning))]'
              : generationResult.message.toLowerCase().includes('error')
                ? 'bg-[rgb(var(--color-bg-error-subtle))] text-[rgb(var(--color-status-error))] border-[rgb(var(--color-border-error))]'
                : 'bg-[rgb(var(--color-bg-success-subtle))] text-[rgb(var(--color-status-success))] border-[rgb(var(--color-border-success))]'
          }`}
        >
          <strong>AI Generator Message:</strong> {generationResult.message}
        </div>
      )}

      {generationResult.identifiedDependencies &&
        generationResult.identifiedDependencies.length > 0 && (
          <div className="mb-4 p-3 border border-[rgb(var(--color-border-accent))] order-purple-600 rounded-lg bg-[rgb(var(--color-bg-accent-subtle))] g-purple-900/20 text-[rgb(var(--color-text-accent-emphasis))] ext-purple-300">
            <h3 className="text-sm font-semibold mb-2 flex items-center">
              <InformationCircleIcon className="h-5 w-5 mr-2 text-[rgb(var(--color-text-accent))] ext-purple-400" />
              AI Identified Potential NPM Dependencies:
            </h3>
            <ul className="list-disc list-outside pl-5 space-y-1 text-xs">
              {generationResult.identifiedDependencies.map((dep, index) => (
                <li key={index}>
                  <code className="font-mono bg-[rgb(var(--color-bg-accent-subtle))] g-purple-700/40 px-1 py-0.5 rounded">
                    {dep.packageName}
                  </code>
                  {dep.reason && (
                    <span className="italic text-[rgb(var(--color-button-accent-bg))] ext-purple-400">
                      {' '}
                      - {dep.reason}
                    </span>
                  )}
                  {dep.importUsed && (
                    <span className="text-xs text-[rgb(var(--color-text-accent))] ext-[rgb(var(--color-text-accent))]">
                      {' '}
                      (e.g., import used:{' '}
                      <code className="font-mono">{dep.importUsed}</code>)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

      {generationResult.assetInstructions && (
        <div className="mb-4 p-3 border border-[rgb(var(--color-border-info))] rounded-lg bg-[rgb(var(--color-bg-info-subtle))] text-[rgb(var(--color-status-info))]">
          <h3 className="text-sm font-semibold mb-2 flex items-center">
            <InformationCircleIcon className="h-5 w-5 mr-2 text-[rgb(var(--color-status-info))]" />
            Important: Manual Asset Setup May Be Required
          </h3>
          <p className="text-xs mb-1.5">
            The AI has provided the following instructions for assets this tool
            might need:
          </p>
          <pre className="whitespace-pre-wrap bg-[rgb(var(--color-bg-info-subtle))]/50 p-2.5 rounded-md text-xs text-[rgb(var(--color-status-info))] font-mono overflow-x-auto custom-scrollbar">
            {generationResult.assetInstructions}
          </pre>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-[rgb(var(--color-text-emphasis))] mb-2">
          Generated Code Files Preview:
        </label>
        {sortedFilePaths.length > 0 && filesToDisplayInPreview ? (
          <div className="space-y-2 max-h-96 overflow-y-auto border p-2 rounded-md bg-[rgb(var(--color-bg-subtle))] custom-scrollbar">
            {sortedFilePaths.map((filePath) => {
              const isExpanded = expandedFilePath === filePath;
              const fileContent = filesToDisplayInPreview[filePath];
              return (
                <div
                  key={filePath}
                  className={`border rounded ${isExpanded ? 'border-[rgb(var(--color-border-info))] bg-[rgb(var(--color-bg-info-subtle))]' : 'border-[rgb(var(--color-border-base))] bg-white'} overflow-hidden`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedFilePath((prev) =>
                        prev === filePath ? null : filePath
                      )
                    }
                    className="w-full text-left px-3 py-2 flex justify-between items-center rounded-t"
                    aria-expanded={isExpanded}
                  >
                    <code
                      className={`text-sm font-mono ${isExpanded ? 'text-[rgb(var(--color-text-link))] font-semibold' : 'text-[rgb(var(--color-text-emphasis))]'}`}
                    >
                      {filePath.startsWith(`app/tool/${toolDirective}/`)
                        ? filePath.substring(
                            `app/tool/${toolDirective}/`.length
                          )
                        : filePath}
                    </code>
                    <span className="text-xs text-[rgb(var(--color-text-disabled))]">
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-1 pb-1 bg-[rgb(var(--color-overlay-backdrop))]">
                      {fileContent != null ? (
                        <textarea
                          readOnly
                          value={fileContent}
                          rows={10}
                          className="block w-full p-2 border-t border-[rgb(var(--color-border-soft))] bg-[rgb(var(--color-overlay-backdrop))] text-[rgb(var(--color-text-inverted))] font-mono text-xs resize-y focus:outline-none custom-scrollbar-dark"
                          spellCheck="false"
                        />
                      ) : (
                        <div className="p-4 text-[rgb(var(--color-status-error))] text-xs italic">
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
          <div className="p-4 border border-dashed border-[rgb(var(--color-border-error))] rounded bg-[rgb(var(--color-bg-error-subtle))] text-[rgb(var(--color-status-error))] text-sm">
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
          className="bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] text-white"
          isLoading={isSubmittingPr}
          loadingText="Submitting PR..."
        >
          Submit Anonymous PR to GitHub
        </Button>
      </div>
      {prCreationFeedback && prCreationStatus !== 'success' && (
        <div
          className={`mt-4 text-sm p-3 rounded ${prCreationStatus === 'error' ? 'bg-[rgb(var(--color-bg-error-subtle))] text-[rgb(var(--color-status-error))] border-[rgb(var(--color-border-error))]' : 'bg-[rgb(var(--color-bg-info-subtle))] text-[rgb(var(--color-status-info))] border-[rgb(var(--color-border-info))]'}`}
        >
          {prCreationFeedback}
        </div>
      )}
      {prCreationFeedback && prCreationStatus === 'success' && (
        <div className="mt-4 text-sm p-3 rounded bg-[rgb(var(--color-status-success))]/10 text-[rgb(var(--color-status-success))] border-[rgb(var(--color-border-success))]">
          {prCreationFeedback}
        </div>
      )}
    </section>
  );
}
