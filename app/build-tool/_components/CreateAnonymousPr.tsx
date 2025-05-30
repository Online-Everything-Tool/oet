// FILE: app/build-tool/_components/CreateAnonymousPr.tsx
'use client';

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  type JSX,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import type {
  GenerationResult,
  ValidationResult,
  ApiPrSubmissionResponseData,
} from '@/src/types/build';
import Button from '@/app/tool/_components/form/Button';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import {
  XCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/20/solid';

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
  onFlowComplete?: () => void;
  currentMode: 'building' | 'monitoring';
  monitoredPrNumberForPolling?: number | null;
}

const POLLING_INTERVAL = 10000;
const MAX_POLLING_ATTEMPTS = 360;

export default function CreateAnonymousPr({
  toolDirective: initialToolDirectiveFromProps,
  generationResult,
  validationResult,
  additionalDescription,
  userSelectedDirectives,
  selectedModel,
  onBack,
  initialPrNumber,
  onFlowComplete,
  currentMode,
  monitoredPrNumberForPolling,
}: CreateAnonymousPrProps) {
  const router = useRouter();

  const [isSubmittingPr, setIsSubmittingPr] = useState(false);
  const [prCreationFeedback, setPrCreationFeedback] = useState<string | null>(
    null
  );
  const [prCreationStatus, setPrCreationStatus] = useState<
    'idle' | 'error' | 'success'
  >('idle');
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [prNumberToMonitor, setPrNumberToMonitor] = useState<number | null>(
    null
  );
  const [displayToolDirective, setDisplayToolDirective] = useState<string>(
    initialToolDirectiveFromProps
  );

  const [ciStatus, setCiStatus] = useState<PrCiStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const pollingAttemptsRef = useRef(0);
  const [expandedFilePath, setExpandedFilePath] = useState<string | null>(null);

  useEffect(() => {
    if (currentMode === 'monitoring' && monitoredPrNumberForPolling) {
      if (
        prNumberToMonitor !== monitoredPrNumberForPolling ||
        prCreationStatus !== 'success'
      ) {
        setPrNumberToMonitor(monitoredPrNumberForPolling);
        setPrUrl(null);
        setCiStatus(null);
        setPrCreationStatus('success');
        setPrCreationFeedback(
          `Monitoring Pull Request #${monitoredPrNumberForPolling}...`
        );
        setDisplayToolDirective(
          initialToolDirectiveFromProps.startsWith('tool-for-pr-') ||
            initialToolDirectiveFromProps.startsWith('tool-from-pr-')
            ? `tool-from-pr-${monitoredPrNumberForPolling}`
            : initialToolDirectiveFromProps
        );
      }
    } else if (
      currentMode === 'building' &&
      initialPrNumber &&
      prCreationStatus === 'success'
    ) {
      setPrNumberToMonitor(initialPrNumber);
    } else if (currentMode === 'building') {
      if (prNumberToMonitor) {
        setPrNumberToMonitor(null);
        setPrUrl(null);
        setCiStatus(null);
        setPrCreationStatus('idle');
        setPrCreationFeedback(null);
        setDisplayToolDirective(initialToolDirectiveFromProps);
      }
    }
  }, [
    currentMode,
    monitoredPrNumberForPolling,
    initialPrNumber,
    prCreationStatus,
    initialToolDirectiveFromProps,
    prNumberToMonitor,
  ]);

  const filesToDisplayInPreview = useMemo(() => {
    return generationResult.generatedFiles || {};
  }, [generationResult.generatedFiles]);

  const sortedFilePaths = useMemo(() => {
    const files = filesToDisplayInPreview;
    if (!files || Object.keys(files).length === 0) return [];

    const metadataPath = `app/tool/${displayToolDirective}/metadata.json`;
    const pagePath = `app/tool/${displayToolDirective}/page.tsx`;

    const preferredOrder = [metadataPath, pagePath];

    return Object.keys(files).sort((a, b) => {
      const indexA = preferredOrder.indexOf(a);
      const indexB = preferredOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      if (a.includes('/_components/') && !b.includes('/_components/')) return 1;
      if (!a.includes('/_components/') && b.includes('/_components/'))
        return -1;
      if (a.includes('/_hooks/') && !b.includes('/_hooks/')) return 1;
      if (!a.includes('/_hooks/') && b.includes('/_hooks/')) return -1;
      return a.localeCompare(b);
    });
  }, [filesToDisplayInPreview, displayToolDirective]);

  useEffect(() => {
    if (
      currentMode === 'building' &&
      sortedFilePaths.length > 0 &&
      !expandedFilePath
    ) {
      const pagePath = `app/tool/${displayToolDirective}/page.tsx`;
      const metadataPath = `app/tool/${displayToolDirective}/metadata.json`;

      if (filesToDisplayInPreview && filesToDisplayInPreview[pagePath]) {
        setExpandedFilePath(pagePath);
      } else if (
        filesToDisplayInPreview &&
        filesToDisplayInPreview[metadataPath]
      ) {
        setExpandedFilePath(metadataPath);
      } else if (sortedFilePaths.length > 0) {
        setExpandedFilePath(sortedFilePaths[0]);
      }
    } else if (currentMode !== 'building' && expandedFilePath) {
      setExpandedFilePath(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentMode,
    sortedFilePaths,
    displayToolDirective,
    filesToDisplayInPreview,
  ]);

  const fetchPrStatus = useCallback(async () => {
    if (!prNumberToMonitor) {
      setIsPolling(false);
      return;
    }
    pollingAttemptsRef.current += 1;
    try {
      const response = await fetch(
        `/api/pr-status?prNumber=${prNumberToMonitor}`
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({
          error: `API request failed with status ${response.status}`,
        }));
        const errorMessage =
          errData.error || `Failed to fetch PR status: ${response.status}`;
        if (response.status === 404 && pollingAttemptsRef.current > 3) {
          throw new Error(
            `PR #${prNumberToMonitor} not found. Polling stopped. ${errorMessage}`
          );
        } else if (response.status === 404) {
          setPollingError(
            `PR #${prNumberToMonitor} not found yet. Retrying... (${pollingAttemptsRef.current})`
          );
          return;
        }
        throw new Error(errorMessage);
      }
      const data: PrCiStatus = await response.json();
      setCiStatus(data);
      if (!prUrl && data.prUrl) setPrUrl(data.prUrl);
      if (
        data.prHeadBranch &&
        (displayToolDirective.startsWith('tool-for-pr-') ||
          displayToolDirective.startsWith('tool-from-pr-'))
      ) {
        const directiveFromBranch = data.prHeadBranch.startsWith('feat/gen-')
          ? data.prHeadBranch
              .substring('feat/gen-'.length)
              .replace(/-[0-9]*$/, '')
          : null;
        if (
          directiveFromBranch &&
          directiveFromBranch !== displayToolDirective
        ) {
          setDisplayToolDirective(directiveFromBranch);
        }
      }
      setPollingError(null);
      if (
        data.overallStatus === 'success' ||
        data.overallStatus === 'failure' ||
        data.overallStatus === 'error'
      ) {
        setIsPolling(false);
        if (onFlowComplete) onFlowComplete();
      } else if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
        setPollingError(
          'Max polling attempts reached. CI status may still be pending. Please check the PR on GitHub directly.'
        );
        setIsPolling(false);
        if (onFlowComplete) onFlowComplete();
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('[CreateAnonymousPr] Error polling PR status:', error);
      setPollingError(
        error.message || 'An unknown error occurred while fetching PR status.'
      );
      if (error.message?.toLowerCase().includes('not found')) {
        setIsPolling(false);
        if (onFlowComplete) onFlowComplete();
      }
    }
  }, [prNumberToMonitor, onFlowComplete, prUrl, displayToolDirective]);

  useEffect(() => {
    if (
      prNumberToMonitor &&
      prCreationStatus === 'success' &&
      !isPolling &&
      (!ciStatus || ciStatus.overallStatus === 'pending')
    ) {
      setIsPolling(true);
      pollingAttemptsRef.current = 0;
      setPollingError(null);
      fetchPrStatus();
    } else if (
      (!prNumberToMonitor ||
        prCreationStatus !== 'success' ||
        (ciStatus && ciStatus.overallStatus !== 'pending')) &&
      isPolling
    ) {
      setIsPolling(false);
    }
  }, [prNumberToMonitor, prCreationStatus, isPolling, ciStatus, fetchPrStatus]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (isPolling && prNumberToMonitor) {
      intervalId = setInterval(fetchPrStatus, POLLING_INTERVAL);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPolling, prNumberToMonitor, fetchPrStatus]);

  const handleAnonymousSubmitClick = async () => {
    if (currentMode !== 'building') return;
    setPrCreationStatus('idle');
    setPrCreationFeedback(null);
    setCiStatus(null);
    setPrUrl(null);
    setPrNumberToMonitor(null);

    if (
      !generationResult?.generatedFiles ||
      Object.keys(generationResult.generatedFiles).length === 0
    ) {
      setPrCreationStatus('error');
      setPrCreationFeedback(
        `Error: No generated files found for ${displayToolDirective}.`
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
          toolDirective: displayToolDirective,
          generatedFiles: generationResult.generatedFiles,
          identifiedDependencies: generationResult.identifiedDependencies || [],
          assetInstructions: generationResult.assetInstructions || null,
          generativeDescription:
            validationResult.generativeDescription ||
            `AI-generated code for ${displayToolDirective}`,
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
        setPrNumberToMonitor(createdPrNumber);
      } else {
        throw new Error('Could not parse PR number from URL: ' + data.url);
      }
      setPrCreationStatus('success');
      if (router && createdPrNumber && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const currentQuery = new URLSearchParams(window.location.search);
        currentQuery.set('prNumber', String(createdPrNumber));
        router.replace(`${currentPath}?${currentQuery.toString()}`, {
          scroll: false,
        });
      }
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

  const getStatusIcon = (
    status: string | null | undefined,
    conclusion: string | null | undefined
  ): JSX.Element => {
    if (status === 'completed') {
      if (conclusion === 'success')
        return (
          <CheckCircleIcon className="h-5 w-5 text-green-500 inline mr-1" />
        );
      if (
        conclusion === 'failure' ||
        conclusion === 'timed_out' ||
        conclusion === 'cancelled'
      )
        return <XCircleIcon className="h-5 w-5 text-red-500 inline mr-1" />;
      if (conclusion === 'skipped')
        return (
          <span
            className="inline-block mr-1.5 h-3 w-3 bg-gray-300 rounded-full align-middle"
            title="Skipped"
          ></span>
        );
      if (conclusion === 'neutral')
        return (
          <span
            className="inline-block mr-1.5 h-3 w-3 bg-yellow-400 rounded-full align-middle"
            title="Neutral"
          ></span>
        );
      return (
        <QuestionMarkCircleIcon
          className="h-5 w-5 text-gray-400 inline mr-1"
          title="Unknown conclusion"
        />
      );
    }
    if (status === 'in_progress' || status === 'queued')
      return (
        <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin inline mr-1" />
      );
    return (
      <QuestionMarkCircleIcon
        className="h-5 w-5 text-gray-400 inline mr-1"
        title="Unknown status"
      />
    );
  };

  const isEffectivelyMonitoring =
    prNumberToMonitor && prCreationStatus === 'success';

  if (isEffectivelyMonitoring) {
    return (
      <section className="p-4 border rounded-lg bg-white shadow-sm border-green-300">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">
          Monitoring PR #{prNumberToMonitor}
          {displayToolDirective &&
          !displayToolDirective.startsWith('tool-from-pr-')
            ? ` for '${displayToolDirective}'`
            : ''}
        </h2>
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
              View Pull Request #{prNumberToMonitor} on GitHub
            </Link>
          </p>
        )}
        {isPolling && !ciStatus && !pollingError && (
          <p className="text-sm text-gray-600 italic animate-pulse">
            Fetching CI status...
          </p>
        )}
        {pollingError && (
          <div className="my-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
            <strong>Status Update Error:</strong> {pollingError}
            {prUrl && !pollingError.toLowerCase().includes('not found') && (
              <Link
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline ml-1"
              >
                Check PR on GitHub for manual status.
              </Link>
            )}
          </div>
        )}
        {ciStatus && (
          <div className="space-y-3 my-4">
            <h3 className="text-md font-semibold text-gray-600">
              CI/CD Checks:
            </h3>
            {ciStatus.checks.length > 0 ? (
              <ul className="space-y-1 text-sm list-none pl-1">
                {ciStatus.checks.map((check) => (
                  <li
                    key={check.name}
                    className="flex items-center py-1.5 border-b border-gray-100 last:border-b-0"
                  >
                    {getStatusIcon(check.status, check.conclusion)}
                    <span
                      className={`ml-1 ${
                        check.conclusion === 'failure'
                          ? 'text-red-600 font-medium'
                          : check.conclusion === 'success'
                            ? 'text-green-600'
                            : 'text-gray-700'
                      }`}
                    >
                      {check.name}
                    </span>
                    <span className="text-xs text-gray-500 ml-1.5">
                      ({check.status}
                      {check.conclusion && `, ${check.conclusion}`})
                    </span>
                    {check.url && (
                      <Link
                        href={check.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline ml-auto"
                      >
                        (Details)
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">
                {isPolling
                  ? 'Waiting for CI checks to appear...'
                  : 'No CI checks reported for this commit yet.'}
              </p>
            )}

            {/* Netlify Preview URL display logic */}
            {ciStatus.netlifyPreviewUrl &&
            displayToolDirective &&
            !displayToolDirective.startsWith('tool-from-pr-') ? (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-md font-semibold text-green-700">
                  🎉 Deploy Preview Ready!
                </p>
                <Link
                  href={`${ciStatus.netlifyPreviewUrl}/tool/${displayToolDirective}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-1 text-blue-600 hover:underline break-all"
                >
                  {`${ciStatus.netlifyPreviewUrl}/tool/${displayToolDirective}`}
                </Link>
                <p className="text-xs text-green-600 mt-1">
                  Go test your tool!
                </p>
              </div>
            ) : ciStatus.netlifyDeploymentSucceeded ? (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md">
                <p className="text-md font-semibold text-yellow-700">
                  ✅ Netlify Deployment Succeeded (Base Preview)
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  {ciStatus.netlifyPreviewUrl ? (
                    <Link
                      href={ciStatus.netlifyPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-1 text-blue-600 hover:underline break-all"
                    >
                      Base Preview URL: {ciStatus.netlifyPreviewUrl}
                    </Link>
                  ) : (
                    `Base preview likely at: https://deploy-preview-${ciStatus.prNumber}--<your-netlify-site-name>.netlify.app (Replace with your site name)`
                  )}
                </p>
                {displayToolDirective.startsWith('tool-from-pr-') &&
                  ciStatus.netlifyPreviewUrl && (
                    <p className="text-xs text-yellow-600 mt-1">
                      Tool directive for direct link not confirmed from PR
                      branch yet to form direct tool link.
                    </p>
                  )}
              </div>
            ) : ciStatus.overallStatus === 'pending' &&
              isPolling &&
              ciStatus.checks.some((c) =>
                c.name.toLowerCase().includes('netlify')
              ) ? (
              <p className="text-sm text-gray-600 italic animate-pulse mt-4">
                Netlify Deploy Preview: Waiting for status or building...
              </p>
            ) : ciStatus.overallStatus === 'success' &&
              !ciStatus.netlifyDeploymentSucceeded &&
              !isPolling ? (
              <p className="text-sm text-yellow-600 mt-4">
                CI checks passed. Netlify Deploy Preview information not
                available (it may be disabled or not yet reported).
              </p>
            ) : null}

            {/* Douglas Screenshot */}
            {ciStatus.imgurScreenshotUrl && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-600 mb-1">
                  Douglas&apos; View:
                </h4>
                <Image
                  src={ciStatus.imgurScreenshotUrl}
                  alt={`Douglas Screenshot for PR #${ciStatus.prNumber}`}
                  width={600}
                  height={400}
                  className="border rounded-md object-contain max-w-full h-auto"
                  unoptimized
                />
              </div>
            )}

            {/* Overall Status messages */}
            {ciStatus.overallStatus === 'failure' && (
              <p className="text-md font-semibold text-red-700 mt-4">
                🔴 One or more critical CI checks failed. Please review the PR
                on GitHub for details.
              </p>
            )}
            {ciStatus.overallStatus === 'success' && !isPolling && (
              <p className="text-md font-semibold text-green-700 mt-4">
                ✅ All relevant CI checks reported by the poller have passed
                successfully!
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  if (currentMode === 'building') {
    return (
      <section
        className={`p-4 border rounded-lg bg-white shadow-sm transition-opacity duration-300 ${isSubmittingPr ? 'opacity-70' : ''} ${prCreationStatus === 'error' ? 'border-red-300' : 'border-purple-300'}`}
      >
        <h2 className="text-lg font-semibold mb-3 text-gray-700">
          Step 3: Review Generated Tool & Submit PR for &lsquo;
          {displayToolDirective}&rsquo;
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
              The AI has provided the following instructions for assets this
              tool might need:
            </p>
            <pre className="whitespace-pre-wrap bg-blue-100/50 p-2.5 rounded-md text-xs text-blue-800 font-mono overflow-x-auto custom-scrollbar">
              {generationResult.assetInstructions}
            </pre>
            <p className="text-xs mt-2">
              These assets (e.g., model files for libraries) will need to be
              manually placed in the specified directories (usually within{' '}
              <code>public/data/{displayToolDirective}/...</code>) by a
              developer. This can be done locally and committed if you are using
              a script like <code>generate-real-pr.mjs</code>, or added to the
              PR branch after it&apos;s created via this UI. CI checks may fail
              if these assets are missing when the tool&apos;s code attempts to
              load them.
            </p>
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
                        {filePath.startsWith(
                          `app/tool/${displayToolDirective}/`
                        )
                          ? filePath.substring(
                              `app/tool/${displayToolDirective}/`.length
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
        {prCreationFeedback && prCreationStatus !== 'success' && (
          <div
            className={`mt-4 text-sm p-3 rounded ${prCreationStatus === 'error' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}
          >
            {prCreationFeedback}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="p-4 border rounded-lg bg-white shadow-sm">
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Submission/Monitoring View...
      </p>
    </section>
  );
}
