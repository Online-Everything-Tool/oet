// FILE: app/build/tool/_components/ViewPrStatus.tsx
'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type JSX,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  XCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/20/solid';
import type { ToolGenerationInfoFileContent } from '@/src/types/build';

interface CiCheck {
  name: string;
  status: string | null;
  conclusion: string | null;
  url?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}
interface LastBotComment {
  botName: string | null;
  summary: string;
  body?: string;
  timestamp: string;
  url?: string;
}
interface AutomatedActionsStatus {
  statusSummary: string;
  activeWorkflow: string | null;
  nextExpectedAction: string | null;
  shouldContinuePolling: boolean;
  lastBotComment?: LastBotComment | null;
  uiHint: 'info' | 'success' | 'warning' | 'error' | 'loading';
}
interface PrStatusApiResponse {
  prUrl: string;
  prNumber: number;
  headSha: string;
  prHeadBranch: string | null;
  prState: 'open' | 'closed';
  isMerged: boolean;
  checks: CiCheck[];
  overallCheckStatusForHead:
    | 'pending'
    | 'success'
    | 'failure'
    | 'error'
    | 'unknown';
  netlifyPreviewUrl: string | null;
  netlifyDeploymentSucceeded: boolean;
  imgurScreenshotUrl?: string | null;
  toolGenerationInfoForUI: {
    npmDependenciesFulfilled:
      | ToolGenerationInfoFileContent['npmDependenciesFulfilled']
      | 'not_found'
      | 'not_applicable';
    lintFixesAttempted: boolean | 'not_found' | 'not_applicable';
    identifiedDependencies?: string[] | null;
  };
  automatedActions: AutomatedActionsStatus;
  lastUpdated: string;
  error?: string;
}

interface ViewPrStatusProps {
  prNumberToMonitor: number;
  initialPrUrl?: string | null;
  toolDirectiveForDisplay?: string | null;
  onPollingStopped?: (finalStatus: PrStatusApiResponse | null) => void;
}

const POLLING_INTERVAL = 10000;
const MAX_POLLING_ATTEMPTS = 360;
const INITIAL_404_GRACE_ATTEMPTS = 6;

export default function ViewPrStatus({
  prNumberToMonitor,
  initialPrUrl,
  toolDirectiveForDisplay: initialToolDirectiveForDisplay,
  onPollingStopped,
}: ViewPrStatusProps) {
  const [prStatus, setPrStatus] = useState<PrStatusApiResponse | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [initialPollingMessage, setInitialPollingMessage] = useState<
    string | null
  >(null);

  const pollingAttemptsRef = useRef(0);
  const componentMountedRef = useRef(false);
  const currentMonitoredPrRef = useRef<number | null>(null);
  const prStatusRef = useRef(prStatus);

  useEffect(() => {
    prStatusRef.current = prStatus;
  }, [prStatus]);

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
    };
  }, []);

  const fetchPrStatusCallback = useCallback(
    async (isInitialCallForPr = false) => {
      if (!componentMountedRef.current || !prNumberToMonitor) return;

      if (isInitialCallForPr) pollingAttemptsRef.current = 0;
      pollingAttemptsRef.current += 1;
      const currentAttempt = pollingAttemptsRef.current;

      if (
        isInitialCallForPr &&
        !initialPollingMessage &&
        !prStatusRef.current
      ) {
        setInitialPollingMessage(
          `Fetching initial status for PR #${prNumberToMonitor}...`
        );
      }

      try {
        const response = await fetch(
          `/api/status-pr?prNumber=${prNumberToMonitor}&pollingAttempt=${currentAttempt}`
        );
        if (!componentMountedRef.current) return;

        if (!response.ok) {
          const errData = await response
            .json()
            .catch(() => ({ error: `API request failed: ${response.status}` }));
          const errorMessage =
            errData.error || `Fetch failed: ${response.status}`;
          if (
            response.status === 404 &&
            currentAttempt <= INITIAL_404_GRACE_ATTEMPTS &&
            !prStatusRef.current
          ) {
            if (componentMountedRef.current)
              setInitialPollingMessage(
                `PR #${prNumberToMonitor} details pending... (Attempt ${currentAttempt}/${INITIAL_404_GRACE_ATTEMPTS})`
              );
            return;
          }
          throw new Error(errorMessage);
        }

        const data: PrStatusApiResponse = await response.json();
        if (!componentMountedRef.current) return;

        if (componentMountedRef.current) {
          setPrStatus(data);
          if (pollingError) setPollingError(null);
          if (initialPollingMessage) setInitialPollingMessage(null);
        }

        if (
          currentAttempt >= MAX_POLLING_ATTEMPTS &&
          data.prState === 'open' &&
          data.automatedActions.shouldContinuePolling
        ) {
          if (componentMountedRef.current) {
            setPollingError(
              'Max polling attempts reached. Check PR on GitHub.'
            );
            setIsPolling(false);
            if (onPollingStopped) onPollingStopped(data);
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (!componentMountedRef.current) return;
        if (
          !initialPollingMessage ||
          currentAttempt > INITIAL_404_GRACE_ATTEMPTS ||
          prStatusRef.current
        ) {
          if (componentMountedRef.current)
            setPollingError(error.message || 'Unknown polling error.');
        }
        if (
          error.message?.toLowerCase().includes('not found after') ||
          currentAttempt >= MAX_POLLING_ATTEMPTS
        ) {
          if (componentMountedRef.current) {
            setIsPolling(false);
            if (onPollingStopped) onPollingStopped(prStatusRef.current);
          }
        }
      }
    },
    [prNumberToMonitor, onPollingStopped, initialPollingMessage, pollingError]
  );

  useEffect(() => {
    if (prNumberToMonitor && componentMountedRef.current) {
      if (currentMonitoredPrRef.current !== prNumberToMonitor) {
        currentMonitoredPrRef.current = prNumberToMonitor;
        pollingAttemptsRef.current = 0;
        setPrStatus(null);
        setIsPolling(false);
        setInitialPollingMessage(null);
        setPollingError(null);
      }
    }
  }, [prNumberToMonitor]);

  useEffect(() => {
    if (!prNumberToMonitor || !componentMountedRef.current) {
      if (isPolling) setIsPolling(false);
      return;
    }

    if (!prStatus) {
      if (!isPolling && pollingAttemptsRef.current === 0) {
        setIsPolling(true);
        fetchPrStatusCallback(true);
      }
      return;
    }

    const shouldCurrentlyBePolling =
      prStatus.automatedActions.shouldContinuePolling &&
      prStatus.prState === 'open';
    if (isPolling !== shouldCurrentlyBePolling)
      setIsPolling(shouldCurrentlyBePolling);
    if (!shouldCurrentlyBePolling && onPollingStopped)
      onPollingStopped(prStatus);
  }, [
    prNumberToMonitor,
    prStatus,
    isPolling,
    fetchPrStatusCallback,
    onPollingStopped,
  ]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (isPolling && prNumberToMonitor && componentMountedRef.current) {
      intervalId = setInterval(
        () => fetchPrStatusCallback(false),
        POLLING_INTERVAL
      );
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPolling, prNumberToMonitor, fetchPrStatusCallback]);

  const prUrlToDisplay = prStatus?.prUrl || initialPrUrl;

  const toolDirectiveForDisplay = useMemo(() => {
    if (initialToolDirectiveForDisplay) return initialToolDirectiveForDisplay;
    if (prStatus?.prHeadBranch)
      return extractToolDirectiveFromBranchName(prStatus.prHeadBranch);
    return null;
  }, [initialToolDirectiveForDisplay, prStatus?.prHeadBranch]);

  const prTitleForDisplay = `PR #${prNumberToMonitor}${toolDirectiveForDisplay ? ` for '${toolDirectiveForDisplay}'` : ''}`;

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
        ['failure', 'timed_out', 'cancelled', 'action_required'].includes(
          conclusion || ''
        )
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
    if (status === 'in_progress' || status === 'queued' || status === 'pending')
      return (
        <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin inline mr-1" />
      );
    return (
      <QuestionMarkCircleIcon
        className="h-5 w-5 text-gray-400 inline mr-1"
        title={`Status: ${status || 'Unknown'}`}
      />
    );
  };

  const getUiHintClasses = (
    hint: AutomatedActionsStatus['uiHint'] | undefined
  ) => {
    switch (hint) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'warning':
        return 'bg-yellow-50 border-yellow-300 text-yellow-700';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'loading':
        return 'bg-indigo-50 border-indigo-200 text-indigo-700 animate-pulse';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const renderToolGenInfo = () => {
    if (!prStatus?.toolGenerationInfoForUI) return null;
    const {
      npmDependenciesFulfilled,
      lintFixesAttempted,
      identifiedDependencies,
    } = prStatus.toolGenerationInfoForUI;

    const isInteresting =
      (npmDependenciesFulfilled !== 'absent' &&
        npmDependenciesFulfilled !== 'not_found' &&
        npmDependenciesFulfilled !== 'not_applicable') ||
      (lintFixesAttempted !== false &&
        lintFixesAttempted !== 'not_found' &&
        lintFixesAttempted !== 'not_applicable') ||
      (identifiedDependencies && identifiedDependencies.length > 0);
    if (!isInteresting) return null;

    return (
      <div className="mt-3 p-2.5 border border-gray-200 rounded-md bg-gray-50 text-xs text-gray-600 space-y-1">
        <h4 className="font-medium text-gray-700">Tool Generation Status:</h4>
        {npmDependenciesFulfilled !== 'absent' &&
          npmDependenciesFulfilled !== 'not_found' &&
          npmDependenciesFulfilled !== 'not_applicable' && (
            <p>
              NPM Deps Fulfilled:{' '}
              <span
                className={`font-semibold ${npmDependenciesFulfilled === 'true' ? 'text-green-600' : 'text-red-600'}`}
              >
                {String(npmDependenciesFulfilled)}
              </span>
            </p>
          )}
        {lintFixesAttempted !== false &&
          lintFixesAttempted !== 'not_found' &&
          lintFixesAttempted !== 'not_applicable' && (
            <p>
              Lint Fixes Attempted:{' '}
              <span className="font-semibold">
                {String(lintFixesAttempted)}
              </span>
            </p>
          )}
        {identifiedDependencies && identifiedDependencies.length > 0 && (
          <p>
            Identified Dependencies:{' '}
            <span className="font-mono">
              {identifiedDependencies.join(', ') || 'None'}
            </span>
          </p>
        )}
      </div>
    );
  };

  const renderManualReviewSection = () => {
    if (
      !prStatus ||
      !prStatus.automatedActions.nextExpectedAction?.startsWith('MANUAL_REVIEW')
    ) {
      return null;
    }
    return (
      <div className="mt-4 p-3 border border-orange-300 bg-orange-50 rounded-md text-sm">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-5 w-5 text-orange-500 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-700">
              Manual Intervention Recommended
            </p>
            <p className="text-orange-600 mt-1">
              {prStatus.automatedActions.statusSummary.includes('Manual review')
                ? prStatus.automatedActions.statusSummary.replace(
                    'Manual review',
                    'This PR may require manual review'
                  )
                : 'This PR may require manual review to proceed.'}
            </p>
            <div className="mt-3">
              <Link
                href={prStatus.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                View PR on GitHub
                <ArrowTopRightOnSquareIcon className="ml-1.5 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section
      className={`p-4 border rounded-lg bg-white shadow-sm ${getUiHintClasses(prStatus?.automatedActions.uiHint).split(' ')[1]}`}
    >
      <h2 className="text-lg font-semibold mb-1 text-gray-700 flex items-center">
        {prTitleForDisplay}
        {isPolling && prStatus?.prState === 'open' && (
          <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin inline ml-2" />
        )}
      </h2>

      {prUrlToDisplay && (
        <p className="text-sm mb-3">
          {' '}
          <Link
            href={prUrlToDisplay}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {' '}
            View Pull Request #{prNumberToMonitor} on GitHub{' '}
          </Link>{' '}
        </p>
      )}

      {initialPollingMessage && !prStatus && (
        <div
          className={`my-2 p-3 rounded-md text-sm ${getUiHintClasses('loading')}`}
        >
          {' '}
          {initialPollingMessage}{' '}
        </div>
      )}
      {!initialPollingMessage && !pollingError && !prStatus && isPolling && (
        <div
          className={`my-2 p-3 rounded-md text-sm ${getUiHintClasses('loading')}`}
        >
          Awaiting first status update...
        </div>
      )}
      {pollingError && (
        <div
          className={`my-4 p-3 rounded-md text-sm ${getUiHintClasses('error')}`}
        >
          {' '}
          <strong>Status Update Error:</strong> {pollingError}{' '}
          {prUrlToDisplay &&
            !pollingError.toLowerCase().includes('not found after') && (
              <Link
                href={prUrlToDisplay}
                target="_blank"
                rel="noopener noreferrer"
                className="underline ml-1"
              >
                {' '}
                Check PR on GitHub for manual status.{' '}
              </Link>
            )}{' '}
        </div>
      )}

      {prStatus && (
        <div className="space-y-3 my-2">
          {prStatus.automatedActions?.statusSummary && (
            <div
              className={`p-3 rounded-md text-sm border ${getUiHintClasses(prStatus.automatedActions.uiHint)}`}
            >
              <strong className="block mb-1">Automated Status:</strong>
              <p>{prStatus.automatedActions.statusSummary}</p>
              {prStatus.automatedActions.lastBotComment && (
                <div className="text-xs mt-2 pt-2 border-t border-opacity-30 border-current">
                  <span>
                    Last bot activity:{' '}
                    {prStatus.automatedActions.lastBotComment.botName || 'Bot'}{' '}
                    -{' '}
                    <em>{prStatus.automatedActions.lastBotComment.summary}</em>
                  </span>
                  {prStatus.automatedActions.lastBotComment.url && (
                    <Link
                      href={prStatus.automatedActions.lastBotComment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline ml-1"
                    >
                      (details)
                    </Link>
                  )}
                </div>
              )}
              {prStatus.automatedActions.nextExpectedAction &&
                prStatus.automatedActions.nextExpectedAction !== 'NONE' &&
                !prStatus.automatedActions.nextExpectedAction.startsWith(
                  'MANUAL_REVIEW'
                ) && (
                  <span className="block text-xs mt-1 opacity-80">
                    Next expected:{' '}
                    {prStatus.automatedActions.nextExpectedAction}
                  </span>
                )}
            </div>
          )}

          {renderToolGenInfo()}
          {renderManualReviewSection()}

          {prStatus.checks && prStatus.checks.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-gray-600 mb-1.5">
                CI/CD Checks:
              </h3>
              <ul className="space-y-1 text-sm list-none pl-1 border border-gray-200 rounded-md p-2 bg-gray-50/50 max-h-60 overflow-y-auto custom-scrollbar">
                {prStatus.checks.map((check, idx) => (
                  <li
                    key={check.name + (check.started_at || idx)}
                    className="flex items-center py-1.5 border-b border-gray-100 last:border-b-0"
                  >
                    {getStatusIcon(check.status, check.conclusion)}
                    <span
                      className={`ml-1 ${check.conclusion === 'failure' ? 'text-red-600 font-medium' : check.conclusion === 'success' ? 'text-green-600' : 'text-gray-700'}`}
                    >
                      {' '}
                      {check.name}{' '}
                    </span>
                    <span className="text-xs text-gray-500 ml-1.5">
                      {' '}
                      ({check.status}
                      {check.conclusion && `, ${check.conclusion}`}){' '}
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
            </div>
          )}

          {prStatus.netlifyPreviewUrl &&
          toolDirectiveForDisplay &&
          prStatus.netlifyDeploymentSucceeded ? (
            <div
              className={`mt-4 p-3 rounded-md ${getUiHintClasses('success')}`}
            >
              <p className="text-md font-semibold">🎉 Deploy Preview Ready!</p>
              <Link
                href={prStatus.netlifyPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1 text-blue-600 hover:underline break-all"
              >
                {' '}
                {prStatus.netlifyPreviewUrl}{' '}
              </Link>
              <p className="text-xs mt-1">Go test your tool!</p>
            </div>
          ) : prStatus.netlifyDeploymentSucceeded &&
            prStatus.netlifyPreviewUrl ? (
            <div
              className={`mt-4 p-3 rounded-md ${getUiHintClasses('success')}`}
            >
              <p className="text-md font-semibold">
                ✅ Netlify Deployment Succeeded (Base Preview)
              </p>
              <Link
                href={prStatus.netlifyPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1 text-blue-600 hover:underline break-all"
              >
                Base Preview: {prStatus.netlifyPreviewUrl}
              </Link>
              {!toolDirectiveForDisplay && (
                <p className="text-xs mt-1">
                  Tool-specific path could not be determined; use base preview.
                </p>
              )}
            </div>
          ) : (prStatus.overallCheckStatusForHead === 'pending' ||
              prStatus.automatedActions.uiHint === 'loading') &&
            isPolling &&
            prStatus.prState === 'open' &&
            prStatus.checks?.some((c) =>
              c.name.toLowerCase().includes('netlify')
            ) ? (
            <div
              className={`mt-4 p-3 rounded-md text-sm ${getUiHintClasses('loading')}`}
            >
              Netlify Deploy Preview: Waiting for status or building...
            </div>
          ) : null}

          {prStatus.imgurScreenshotUrl && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-600 mb-1">
                Douglas&apos; View (Screenshot):
              </h4>
              <Image
                src={prStatus.imgurScreenshotUrl}
                alt={`Douglas Screenshot for PR #${prStatus.prNumber}`}
                width={600}
                height={400}
                className="border rounded-md object-contain max-w-full h-auto"
                unoptimized
              />
            </div>
          )}

          {/* More explicit terminal messages */}
          {!isPolling && prStatus.prState === 'closed' && (
            <div
              className={`mt-4 p-3 rounded-md text-sm font-semibold ${getUiHintClasses(prStatus.automatedActions.uiHint)}`}
            >
              {prStatus.automatedActions.statusSummary} Polling stopped.
            </div>
          )}
          {!isPolling &&
            prStatus.prState === 'open' &&
            prStatus.automatedActions.nextExpectedAction &&
            prStatus.automatedActions.nextExpectedAction.startsWith(
              'MANUAL_REVIEW'
            ) && (
              <div
                className={`mt-4 p-3 rounded-md text-sm ${getUiHintClasses('error')}`}
              >
                <strong>Polling stopped.</strong>{' '}
                {prStatus.automatedActions.statusSummary}
              </div>
            )}
          {!isPolling &&
            prStatus.prState === 'open' &&
            prStatus.automatedActions.nextExpectedAction ===
              'USER_REVIEW_PREVIEW' && (
              <div
                className={`mt-4 p-3 rounded-md text-sm ${getUiHintClasses('success')}`}
              >
                <strong>All automated checks complete!</strong> Review your
                Netlify Deploy Preview. Polling stopped.
              </div>
            )}
        </div>
      )}
    </section>
  );
}

function extractToolDirectiveFromBranchName(
  branchName: string | null
): string | null {
  if (!branchName || !branchName.startsWith('feat/gen-')) return null;
  const tempDirective = branchName.substring('feat/gen-'.length);
  return tempDirective.replace(/-[0-9]+$/, '') || null;
}
