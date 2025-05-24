// /app/build-tool/_components/CreateAnonymousPr.tsx
'use client';

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';

import type {
  GenerationResult,
  ValidationResult,
  ApiPrSubmissionResponseData,
} from '@/src/types/build';
import Button from '@/app/tool/_components/form/Button';

interface CiCheck {
  name: string;
  status: string;
  conclusion: string | null;
  url?: string;
  started_at?: string | null;
  completed_at?: string | null;
}

interface PrCiStatus {
  prUrl: string;
  prNumber: number;
  headSha?: string;
  prHeadBranch?: string | null;
  checks: CiCheck[];
  netlifyPreviewUrl: string | null;
  netlifyDeploymentSucceeded: boolean;
  overallStatus: 'pending' | 'success' | 'failure' | 'error';
  lastUpdated: string;
  error?: string;
  imgurScreenshotUrl?: string | null;
}

interface CreateAnonymousPrProps {
  toolDirective: string;
  generationResult: GenerationResult;
  validationResult: ValidationResult;
  additionalDescription: string;
  userSelectedDirectives: string[];
  selectedModel: string;
  onBack: () => void;
  initialPrNumber?: number | null;
  initialPrUrl?: string | null;
  onFlowComplete?: () => void;
}

const POLLING_INTERVAL = 10000;
const MAX_POLLING_ATTEMPTS = 360;

export default function CreateAnonymousPr({
  toolDirective: initialToolDirective,
  generationResult,
  validationResult,
  additionalDescription,
  userSelectedDirectives,
  selectedModel,
  onBack,
  initialPrNumber,
  initialPrUrl,
  onFlowComplete,
}: CreateAnonymousPrProps) {
  const [isSubmittingPr, setIsSubmittingPr] = useState(false);
  const [prCreationFeedback, setPrCreationFeedback] = useState<string | null>(
    null
  );
  const [prCreationStatus, setPrCreationStatus] = useState<
    'idle' | 'error' | 'success'
  >('idle');

  const [prUrl, setPrUrl] = useState<string | null>(initialPrUrl || null);
  const [prNumber, setPrNumber] = useState<number | null>(
    initialPrNumber || null
  );
  const [currentToolDirective, setCurrentToolDirective] = useState<string>(
    initialToolDirective || ''
  );

  const [ciStatus, setCiStatus] = useState<PrCiStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const pollingAttemptsRef = useRef(0);

  const [expandedFilePath, setExpandedFilePath] = useState<string | null>(null);

  useEffect(() => {
    if (initialPrNumber && prCreationStatus === 'idle') {
      console.log(
        `[CreateAnonymousPr] Direct load for PR #${initialPrNumber}. Setting up for monitoring.`
      );
      setPrNumber(initialPrNumber);

      setCurrentToolDirective(
        initialToolDirective || `tool-for-pr-${initialPrNumber}`
      );
      setPrCreationStatus('success');
      setPrCreationFeedback(
        `Resuming monitoring for PR #${initialPrNumber}...`
      );
    }
  }, [initialPrNumber, initialPrUrl, initialToolDirective, prCreationStatus]);

  const mainFilePath = useMemo(
    () => `app/tool/${currentToolDirective}/page.tsx`,
    [currentToolDirective]
  );
  const mainFileContent = useMemo(
    () => generationResult.generatedFiles?.[mainFilePath] ?? null,
    [generationResult.generatedFiles, mainFilePath]
  );
  const sortedFilePaths = useMemo(() => {
    if (!generationResult.generatedFiles) return [];
    return Object.keys(generationResult.generatedFiles).sort((a, b) =>
      a === mainFilePath ? -1 : b === mainFilePath ? 1 : a.localeCompare(b)
    );
  }, [generationResult.generatedFiles, mainFilePath]);

  useEffect(() => {
    if (mainFileContent !== null && sortedFilePaths.length > 0) {
      setExpandedFilePath(mainFilePath);
    } else {
      setExpandedFilePath(null);
    }
  }, [mainFilePath, mainFileContent, sortedFilePaths]);

  useEffect(() => {
    if (
      prNumber &&
      prCreationStatus === 'success' &&
      !isPolling &&
      (!ciStatus || ciStatus.overallStatus === 'pending')
    ) {
      console.log(`[CreateAnonymousPr] Starting polling for PR #${prNumber}`);
      setIsPolling(true);
      pollingAttemptsRef.current = 0;
      setPollingError(null);
    }
  }, [prNumber, /* prUrl, */ prCreationStatus, isPolling, ciStatus]);

  const fetchPrStatus = useCallback(async () => {
    if (!prNumber) {
      setIsPolling(false);
      return;
    }

    pollingAttemptsRef.current += 1;
    console.log(
      `[CreateAnonymousPr] Polling attempt #${pollingAttemptsRef.current} for PR #${prNumber}`
    );

    try {
      const response = await fetch(`/api/pr-status?prNumber=${prNumber}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({
          error: `API request failed with status ${response.status}`,
        }));
        throw new Error(
          errData.error || `Failed to fetch PR status: ${response.status}`
        );
      }
      const data: PrCiStatus = await response.json();
      setCiStatus(data);

      if (!prUrl && data.prUrl) {
        setPrUrl(data.prUrl);
      }
      if (
        (!currentToolDirective ||
          currentToolDirective.startsWith('tool-for-pr-')) &&
        data.prHeadBranch
      ) {
        const directiveFromBranch = data.prHeadBranch.startsWith('feat/gen-')
          ? data.prHeadBranch
              .substring('feat/gen-'.length)
              .replace(/-[0-9]*$/, '')
          : data.prHeadBranch;
        if (directiveFromBranch) setCurrentToolDirective(directiveFromBranch);
      }

      setPollingError(null);

      if (
        data.overallStatus === 'success' ||
        data.overallStatus === 'failure' ||
        data.overallStatus === 'error'
      ) {
        console.log(
          `[CreateAnonymousPr] Polling stopped for PR #${prNumber}. Status: ${data.overallStatus}`
        );
        setIsPolling(false);
        if (onFlowComplete) {
          console.log(
            '[CreateAnonymousPr] Notifying parent that flow (polling part) is complete.'
          );
          onFlowComplete();
        }
      } else if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
        console.warn(
          `[CreateAnonymousPr] Max polling attempts reached for PR #${prNumber}. Stopping.`
        );
        setPollingError(
          'Max polling attempts reached. Please check the PR on GitHub directly.'
        );
        setIsPolling(false);
        if (onFlowComplete) {
          console.log(
            '[CreateAnonymousPr] Notifying parent that flow (polling part) is complete due to max attempts.'
          );
          onFlowComplete();
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('[CreateAnonymousPr] Error polling PR status:', error);
      setPollingError(
        error.message || 'An unknown error occurred while fetching PR status.'
      );
    }
  }, [prNumber, onFlowComplete, prUrl, currentToolDirective]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isPolling && prNumber) {
      fetchPrStatus();
      intervalId = setInterval(fetchPrStatus, POLLING_INTERVAL);
    }
    return () => clearInterval(intervalId);
  }, [isPolling, prNumber, fetchPrStatus]);

  const handleAnonymousSubmitClick = async () => {
    setPrCreationStatus('idle');
    setPrCreationFeedback(null);
    setCiStatus(null);
    setPrUrl(null);
    setPrNumber(null);
    setCurrentToolDirective(initialToolDirective);

    if (!generationResult.generatedFiles || !mainFileContent) {
      setPrCreationStatus('error');
      setPrCreationFeedback(
        `Error: Required generated file (${mainFilePath}) is missing.`
      );
      return;
    }

    setIsSubmittingPr(true);
    setPrCreationFeedback('Submitting Pull Request to GitHub (anonymously)...');

    try {
      const response = await fetch('/api/create-anonymous-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolDirective: initialToolDirective,
          generatedFiles: generationResult.generatedFiles,
          identifiedDependencies: generationResult.identifiedDependencies || [],
          generativeDescription:
            validationResult.generativeDescription ||
            `AI-generated code for ${initialToolDirective}`,
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

      setPrCreationFeedback(data.message);
      setPrUrl(data.url);
      const match = data.url.match(/\/pull\/(\d+)/);
      let createdPrNumber: number | null = null;
      if (match && match[1]) {
        createdPrNumber = parseInt(match[1], 10);
        setPrNumber(createdPrNumber);
      } else {
        throw new Error('Could not parse PR number from URL: ' + data.url);
      }
      setPrCreationStatus('success');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Anonymous PR Submission Error:', error);
      setPrCreationStatus('error');
      setPrCreationFeedback(
        `PR Submission Error: ${error.message || 'Unexpected error.'}`
      );
    } finally {
      setIsSubmittingPr(false);
    }
  };

  const getStatusIcon = (
    status: string | null | undefined,
    conclusion: string | null | undefined
  ) => {
    if (status === 'completed') {
      if (conclusion === 'success') return '✅';
      if (
        conclusion === 'failure' ||
        conclusion === 'timed_out' ||
        conclusion === 'cancelled'
      )
        return '❌';
      if (conclusion === 'skipped') return '⚪️';
      if (conclusion === 'neutral') return '➖';
      return '❔';
    }
    if (status === 'in_progress' || status === 'queued') return '⏳';
    return '❓';
  };

  if (prNumber && prCreationStatus === 'success') {
    return (
      <section className="p-4 border rounded-lg bg-white shadow-sm border-green-300">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">
          {/* Make title dynamic based on whether ciStatus has loaded the directive */}
          Step 3: Monitoring PR #{prNumber}{' '}
          {currentToolDirective &&
          !currentToolDirective.startsWith('tool-for-pr-')
            ? `for ${currentToolDirective}`
            : ''}
        </h2>
        {/* ... (rest of the monitoring UI is the same, using prUrl, prNumber, ciStatus) ... */}
        <p className="text-sm text-green-700 mb-1">
          {prCreationFeedback || `Pull Request monitoring active!`}
        </p>
        {prUrl && (
          <p className="text-sm mb-4">
            <Link
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View Pull Request #{prNumber} on GitHub
            </Link>
          </p>
        )}

        {isPolling && !ciStatus && !pollingError && (
          <p className="text-sm text-gray-600 italic animate-pulse">
            Fetching CI status for PR #{prNumber}...
          </p>
        )}
        {pollingError && (
          <div className="my-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
            <strong>Error fetching status:</strong> {pollingError}. Please check
            the{' '}
            {prUrl ? (
              <Link
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                PR on GitHub
              </Link>
            ) : (
              'PR on GitHub (URL not yet available)'
            )}{' '}
            for manual updates.
          </div>
        )}

        {ciStatus && (
          <div className="space-y-3 my-4">
            <h3 className="text-md font-semibold text-gray-600">
              CI/CD Progress:
            </h3>
            <ul className="space-y-1 text-sm list-disc list-inside pl-1">
              {ciStatus.checks.map((check) => (
                <li key={check.name} className="flex items-center">
                  <span className="mr-2">
                    {getStatusIcon(check.status, check.conclusion)}
                  </span>
                  <span
                    className={
                      check.conclusion === 'failure'
                        ? 'text-red-600'
                        : check.conclusion === 'success'
                          ? 'text-green-600'
                          : 'text-gray-700'
                    }
                  >
                    {check.name}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">
                    ({check.status}
                    {check.conclusion && `, ${check.conclusion}`})
                  </span>
                  {check.url && (
                    <Link
                      href={check.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline ml-2"
                    >
                      (Details)
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            {ciStatus.netlifyPreviewUrl ? (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-md font-semibold text-green-700">
                  🎉 Deploy Preview Ready!
                </p>
                <Link
                  href={
                    ciStatus.netlifyPreviewUrl + '/tool/' + currentToolDirective
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-1 text-blue-600 hover:underline break-all"
                >
                  {ciStatus.netlifyPreviewUrl}/tool/{currentToolDirective}
                </Link>
                <p className="text-xs text-green-600 mt-1">
                  Go test your tool!
                </p>
              </div>
            ) : ciStatus.netlifyDeploymentSucceeded ? (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md">
                <p className="text-md font-semibold text-yellow-700">
                  ✅ Deployment Succeeded (URL being confirmed or construct
                  manually)
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  You can likely access it at:{' '}
                  <code className="text-xs">
                    https://deploy-preview-{ciStatus.prNumber}
                    --YOUR_NETLIFY_SITE_NAME.netlify.app
                  </code>
                  (Replace YOUR_NETLIFY_SITE_NAME with:{' '}
                  <code className="text-xs">effulgent-donut-c9a0d9</code>)
                </p>
              </div>
            ) : ciStatus.overallStatus === 'pending' && isPolling ? (
              <p className="text-sm text-gray-600 italic animate-pulse mt-4">
                Deploy Preview: Building or pending other checks...
              </p>
            ) : ciStatus.overallStatus === 'pending' && !isPolling ? (
              <p className="text-sm text-orange-600 mt-4">
                Polling stopped. Preview may still be processing or encountered
                an issue. Check GitHub.
              </p>
            ) : null}

            {ciStatus.imgurScreenshotUrl && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-600 mb-1">
                  Douglas&apos;s View of Your Tool:
                </h4>
                <Image
                  src={ciStatus.imgurScreenshotUrl}
                  alt="Douglas Screenshot"
                  width={600}
                  height={400}
                  className="border rounded-md object-contain"
                  unoptimized
                />
              </div>
            )}

            {ciStatus.overallStatus === 'failure' && (
              <p className="text-md font-semibold text-red-700 mt-4">
                🔴 One or more critical checks failed. Please review the PR on
                GitHub.
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  if (initialPrNumber && prCreationStatus === 'idle') {
    return (
      <section className="p-4 border rounded-lg bg-white shadow-sm">
        <p className="text-center p-4 italic text-gray-500 animate-pulse">
          Loading PR #{initialPrNumber} details...
        </p>
      </section>
    );
  }

  return (
    <section
      className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isSubmittingPr ? 'opacity-70' : ''} ${prCreationStatus === 'error' ? 'border-red-300' : 'border-purple-300'}`}
    >
      <h2 className="text-lg font-semibold mb-3 text-gray-700">
        Step 3: Review & Submit Anonymous PR
      </h2>
      {/* ... (rest of the Review & Submit UI is the same) ... */}
      {generationResult.message && (
        <p
          className={`text-sm mb-4 p-2 rounded ${generationResult.message.toLowerCase().includes('warning') ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : generationResult.message.toLowerCase().includes('error') ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}
        >
          {generationResult.message}
        </p>
      )}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Generated Files Preview:
        </label>
        {sortedFilePaths.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto border p-2 rounded-md bg-gray-50">
            {sortedFilePaths.map((filePath) => {
              const isExpanded = expandedFilePath === filePath;
              const fileContent = generationResult.generatedFiles?.[filePath];
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
                      className={`text-sm font-mono ${isExpanded ? 'text-indigo-700 font-medium' : 'text-gray-700'}`}
                    >
                      {filePath}
                    </code>
                  </button>
                  {isExpanded && (
                    <div className="px-1 pb-1 bg-gray-900">
                      {fileContent !== null && fileContent !== undefined ? (
                        <textarea
                          readOnly
                          value={fileContent}
                          rows={10}
                          className="block w-full p-2 border-t border-gray-700 bg-gray-900 text-gray-100 font-mono text-xs resize-y focus:outline-none"
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
            {/* Show a more generic message if generationResult might be a placeholder */}
            {generationResult &&
            Object.keys(generationResult.generatedFiles || {}).length === 0 &&
            initialPrNumber
              ? 'Loading file details for PR...'
              : 'Error: No files generated.'}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <Button
          type="button"
          onClick={handleAnonymousSubmitClick}
          disabled={
            isSubmittingPr ||
            !generationResult.generatedFiles ||
            mainFileContent === null
          }
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isSubmittingPr ? 'Submitting PR...' : 'Submit Anonymous PR'}
        </Button>
        <Button
          type="button"
          onClick={onBack}
          disabled={isSubmittingPr}
          variant="link"
        >
          Back to Generation
        </Button>
      </div>

      {prCreationFeedback && prCreationStatus !== 'success' && (
        <div
          className={`mt-4 text-sm p-3 rounded ${prCreationStatus === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}
        >
          {prCreationFeedback}
        </div>
      )}
    </section>
  );
}
