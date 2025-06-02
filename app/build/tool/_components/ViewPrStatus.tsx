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
} from '@heroicons/react/20/solid';

// Type definitions (assuming these are now globally available or imported from a central types file)
// For now, keeping them inline for clarity of this component's needs.
// Consider moving these to a shared types file if not already there.
interface CiCheck {
  name: string;
  status: string;
  conclusion: string | null;
  url?: string;
  started_at?: string | null;
  completed_at?: string | null;
}

interface LastBotComment {
  botName: string;
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
  vprConclusionForHead?: string | null;
}

interface ToolGenerationInfoStatus {
  npmDependenciesFulfilled: 'absent' | 'true' | 'false' | 'not_found';
  lintFixesAttempted: boolean | 'not_found';
  assetInstructionsPending?: boolean | 'not_found';
}

interface PrStatusApiResponse {
  prUrl: string;
  prNumber: number;
  headSha?: string;
  prHeadBranch?: string | null;
  prState: 'open' | 'closed';
  isMerged: boolean;
  checks: CiCheck[];
  overallCheckStatusForHead: 'pending' | 'success' | 'failure' | 'error';
  netlifyPreviewUrl: string | null;
  netlifyDeploymentSucceeded: boolean;
  imgurScreenshotUrl?: string | null;
  toolGenerationInfo: ToolGenerationInfoStatus;
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
  toolDirectiveForDisplay,
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

  const prUrlToDisplay = prStatus?.prUrl || initialPrUrl;

  const effectiveToolDirective = useMemo(() => {
    if (toolDirectiveForDisplay) {
      return toolDirectiveForDisplay;
    }
    if (
      prStatus?.prHeadBranch &&
      prStatus.prHeadBranch.startsWith('feat/gen-')
    ) {
      return prStatus.prHeadBranch
        .substring('feat/gen-'.length)
        .replace(/-[0-9]*$/, '');
    }
    return null;
  }, [toolDirectiveForDisplay, prStatus?.prHeadBranch]);

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
    };
  }, []);

  const fetchPrStatusCallback = useCallback(async () => {
    if (!componentMountedRef.current || !prNumberToMonitor) {
      setIsPolling(false);
      return;
    }

    pollingAttemptsRef.current += 1;
    console.log(
      `[ViewPrStatus PR#${prNumberToMonitor}] Polling attempt #${pollingAttemptsRef.current}`
    );

    if (
      pollingError &&
      pollingAttemptsRef.current > 1 &&
      !initialPollingMessage
    ) {
      setPollingError(null);
    }

    try {
      const response = await fetch(
        `/api/status-pr?prNumber=${prNumberToMonitor}` // Updated API endpoint
      );

      if (!componentMountedRef.current) return;

      if (!response.ok) {
        const errData = await response.json().catch(() => ({
          error: `API request to /api/status-pr failed with status ${response.status}`,
        }));
        const errorMessage =
          errData.error || `Failed to fetch PR status: ${response.status}`;

        if (
          response.status === 404 &&
          pollingAttemptsRef.current <= INITIAL_404_GRACE_ATTEMPTS
        ) {
          console.warn(
            `[ViewPrStatus PR#${prNumberToMonitor}] Not found yet (Attempt ${pollingAttemptsRef.current}). Tolerating.`
          );
          setInitialPollingMessage(
            `PR #${prNumberToMonitor} is being processed by GitHub. Waiting for details... (Attempt ${pollingAttemptsRef.current}/${INITIAL_404_GRACE_ATTEMPTS})`
          );
          return;
        } else if (response.status === 404) {
          throw new Error(
            `PR #${prNumberToMonitor} still not found after ${pollingAttemptsRef.current} attempts. ${errorMessage}`
          );
        }
        throw new Error(errorMessage);
      }

      const data: PrStatusApiResponse = await response.json();
      console.log(
        `[ViewPrStatus PR#${prNumberToMonitor}] Received data from /api/status-pr:`,
        JSON.stringify(data, null, 2)
      );

      if (!componentMountedRef.current) return;

      setInitialPollingMessage(null);
      setPrStatus(data);
      setPollingError(null);

      if (
        !data.automatedActions.shouldContinuePolling ||
        data.prState === 'closed' ||
        pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS
      ) {
        console.log(
          `[ViewPrStatus PR#${prNumberToMonitor}] Stopping polling. Reason: shouldContinuePolling=${data.automatedActions.shouldContinuePolling}, prState=${data.prState}, attempts=${pollingAttemptsRef.current}`
        );
        setIsPolling(false);
        if (onPollingStopped) onPollingStopped(data);
        if (
          pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS &&
          data.prState === 'open' &&
          data.automatedActions.shouldContinuePolling
        ) {
          setPollingError(
            'Max polling attempts reached. CI status may still be pending. Please check the PR on GitHub directly.'
          );
        }
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (!componentMountedRef.current) return;
      console.error(
        `[ViewPrStatus PR#${prNumberToMonitor}] Error polling PR status:`,
        error
      );
      if (
        !initialPollingMessage ||
        pollingAttemptsRef.current > INITIAL_404_GRACE_ATTEMPTS
      ) {
        setPollingError(
          error.message || 'An unknown error occurred while fetching PR status.'
        );
      }
      if (
        error.message?.toLowerCase().includes('not found after') ||
        error.message?.toLowerCase().includes('max polling attempts')
      ) {
        setIsPolling(false);
        if (onPollingStopped) onPollingStopped(prStatus);
      }
    }
  }, [
    prNumberToMonitor,
    onPollingStopped,
    initialPollingMessage,
    pollingError,
    prStatus,
  ]);

  useEffect(() => {
    if (prNumberToMonitor && !isPolling && componentMountedRef.current) {
      if (
        !prStatus ||
        (prStatus.automatedActions.shouldContinuePolling &&
          prStatus.prState === 'open')
      ) {
        console.log(
          `[ViewPrStatus PR#${prNumberToMonitor}] Initializing polling sequence.`
        );
        setIsPolling(true);
        pollingAttemptsRef.current = 0;
        setPollingError(null);
        setInitialPollingMessage(
          `Fetching status for PR #${prNumberToMonitor}...`
        );
        fetchPrStatusCallback();
      } else {
        console.log(
          `[ViewPrStatus PR#${prNumberToMonitor}] Polling not started due to existing terminal status (${prStatus?.overallCheckStatusForHead}) or PR state (${prStatus?.prState}).`
        );
        if (onPollingStopped && prStatus) onPollingStopped(prStatus);
      }
    }
  }, [
    prNumberToMonitor,
    isPolling,
    prStatus,
    fetchPrStatusCallback,
    onPollingStopped,
  ]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (isPolling && prNumberToMonitor && componentMountedRef.current) {
      console.log(
        `[ViewPrStatus PR#${prNumberToMonitor}] Setting up interval. Polling will occur every ${POLLING_INTERVAL}ms.`
      );
      intervalId = setInterval(fetchPrStatusCallback, POLLING_INTERVAL);
    }
    return () => {
      if (intervalId) {
        console.log(
          `[ViewPrStatus PR#${prNumberToMonitor}] Clearing interval ID: ${intervalId}.`
        );
        clearInterval(intervalId);
      }
    };
  }, [isPolling, prNumberToMonitor, fetchPrStatusCallback]);

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

  const prTitleForDisplay = `PR #${prNumberToMonitor}${effectiveToolDirective ? ` for '${effectiveToolDirective}'` : ''}`;

  return (
    <section className="p-4 border rounded-lg bg-white shadow-sm border-green-300">
      <h2 className="text-lg font-semibold mb-3 text-gray-700">
        Monitoring {prTitleForDisplay}
      </h2>

      {prUrlToDisplay && (
        <p className="text-sm mb-4">
          <Link
            href={prUrlToDisplay}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            View Pull Request #{prNumberToMonitor} on GitHub
          </Link>
        </p>
      )}

      {initialPollingMessage && (
        <p className="text-sm text-blue-600 italic animate-pulse my-2 p-2 bg-blue-50 border border-blue-200 rounded">
          {initialPollingMessage}
        </p>
      )}

      {!initialPollingMessage &&
        isPolling &&
        (!prStatus || (!prStatus.checks && !prStatus.error)) &&
        !pollingError && (
          <p className="text-sm text-gray-600 italic animate-pulse my-2">
            Waiting for CI checks to appear for PR #{prNumberToMonitor}...
            {pollingAttemptsRef.current > 0 &&
              ` (Attempt ${pollingAttemptsRef.current})`}
          </p>
        )}

      {pollingError && !initialPollingMessage && (
        <div className="my-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
          <strong>Status Update Error:</strong> {pollingError}
          {prUrlToDisplay &&
            !pollingError.toLowerCase().includes('not found after') && (
              <Link
                href={prUrlToDisplay}
                target="_blank"
                rel="noopener noreferrer"
                className="underline ml-1"
              >
                Check PR on GitHub for manual status.
              </Link>
            )}
        </div>
      )}

      {prStatus && (
        <div className="space-y-3 my-4">
          {prStatus.automatedActions?.statusSummary && (
            <div
              className={`p-3 rounded-md text-sm border ${
                prStatus.overallCheckStatusForHead === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : prStatus.overallCheckStatusForHead === 'failure'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : prStatus.overallCheckStatusForHead === 'pending'
                      ? 'bg-blue-50 border-blue-200 text-blue-700 animate-pulse'
                      : 'bg-yellow-50 border-yellow-300 text-yellow-700'
              }`}
            >
              <strong>Automated Status:</strong>{' '}
              {prStatus.automatedActions.statusSummary}
              {prStatus.automatedActions.lastBotComment && (
                <div className="text-xs mt-1 pt-1 border-t border-opacity-50">
                  <span>
                    Last bot activity:{' '}
                    {prStatus.automatedActions.lastBotComment.botName} -{' '}
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
                prStatus.automatedActions.nextExpectedAction !== 'NONE' && (
                  <span className="block text-xs mt-1">
                    Next expected:{' '}
                    {prStatus.automatedActions.nextExpectedAction}
                  </span>
                )}
            </div>
          )}

          <h3 className="text-md font-semibold text-gray-600">
            CI/CD Checks:
            {isPolling && (
              <ArrowPathIcon className="h-4 w-4 text-blue-500 animate-spin inline ml-2" />
            )}
          </h3>
          {prStatus.checks && prStatus.checks.length > 0 ? (
            <ul className="space-y-1 text-sm list-none pl-1">
              {prStatus.checks.map((check) => (
                <li
                  key={check.name + (check.started_at || Math.random())}
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

          {prStatus.netlifyPreviewUrl && effectiveToolDirective ? (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-md font-semibold text-green-700">
                🎉 Deploy Preview Ready!
              </p>
              <Link
                href={`${prStatus.netlifyPreviewUrl}/tool/${effectiveToolDirective}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1 text-blue-600 hover:underline break-all"
              >
                {`${prStatus.netlifyPreviewUrl}/tool/${effectiveToolDirective}`}
              </Link>
              <p className="text-xs text-green-600 mt-1">Go test your tool!</p>
            </div>
          ) : prStatus.netlifyDeploymentSucceeded ? (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md">
              <p className="text-md font-semibold text-yellow-700">
                ✅ Netlify Deployment Succeeded (Base Preview)
              </p>
              {prStatus.netlifyPreviewUrl ? (
                <Link
                  href={prStatus.netlifyPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-1 text-blue-600 hover:underline break-all"
                >
                  Base Preview URL: {prStatus.netlifyPreviewUrl}
                </Link>
              ) : (
                <p className="text-xs text-yellow-600 mt-1">
                  Base preview URL not found in status.
                </p>
              )}
              {!effectiveToolDirective && prStatus.netlifyPreviewUrl && (
                <p className="text-xs text-yellow-600 mt-1">
                  Tool directive for direct link not confirmed from PR branch
                  yet.
                </p>
              )}
            </div>
          ) : prStatus.overallCheckStatusForHead === 'pending' &&
            isPolling &&
            prStatus.checks?.some((c) =>
              c.name.toLowerCase().includes('netlify')
            ) ? (
            <p className="text-sm text-gray-600 italic animate-pulse mt-4">
              Netlify Deploy Preview: Waiting for status or building...
            </p>
          ) : null}

          {prStatus.imgurScreenshotUrl && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-600 mb-1">
                Douglas&apos; View:
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

          {prStatus.prState === 'closed' && !isPolling && (
            <p
              className={`text-md font-semibold mt-4 ${prStatus.isMerged ? 'text-purple-700' : 'text-gray-700'}`}
            >
              PR #{prNumberToMonitor} is{' '}
              {prStatus.isMerged ? 'MERGED' : 'CLOSED'}. Polling stopped.
            </p>
          )}
          {prStatus.overallCheckStatusForHead === 'success' &&
            !isPolling &&
            prStatus.prState === 'open' && (
              <p className="text-md font-semibold text-green-700 mt-4">
                ✅ All relevant CI checks passed! Polling stopped.
              </p>
            )}
          {prStatus.overallCheckStatusForHead === 'failure' &&
            !isPolling &&
            prStatus.prState === 'open' &&
            (!prStatus.automatedActions ||
              !prStatus.automatedActions.shouldContinuePolling) && (
              <p className="text-md font-semibold text-red-700 mt-4">
                🔴 One or more CI checks failed, and no further automated
                actions are pending. Polling stopped.
              </p>
            )}
        </div>
      )}
    </section>
  );
}
