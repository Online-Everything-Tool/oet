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
  ChatBubbleLeftEllipsisIcon,
} from '@heroicons/react/20/solid';
import type {
  ToolGenerationInfoFileContent,
  EmojiMessage,
} from '@/src/types/build';
import FeedbackMerge from './FeedbackMerge';
import Button from '@/app/tool/_components/form/Button';

interface PrCiSummaryData {
  prInfo: {
    number: number;
    title: string | null;
    state: 'open' | 'closed';
    merged: boolean;
    branch: string | null;
    headSha: string;
    baseBranch: string;
    url: string;
    createdAt: string;
    updatedAt: string;
    user: string | null | undefined;
  };
  toolGenerationInfo: {
    status: 'found' | 'error_fetching' | 'not_applicable' | 'deleted';
    content: ToolGenerationInfoFileContent | null;
    error: string | null;
  };

  githubActions: unknown;
  netlifyStatus: unknown;
  recentComments: unknown[];
  imgurScreenshotUrl: string | null;
  timestamp: string;
}

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
  workflow_run_id?: number | null;
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
    | 'unknown'
    | 'neutral';
  netlifyPreviewUrl: string | null;
  netlifyDeploymentSucceeded: boolean;
  imgurScreenshotUrl?: string | null;
  toolGenerationInfoForUI: {
    npmDependenciesFulfilled:
      | ToolGenerationInfoFileContent['npmDependenciesFulfilled']
      | 'not_found'
      | 'not_applicable'
      | 'deleted';
    lintFixesAttempted: boolean | 'not_found' | 'not_applicable' | 'deleted';
    identifiedDependencies?: string[] | null;
  };
  automatedActions: AutomatedActionsStatus;
  lastUpdated: string;
  error?: string;
  _debug_data_source?: PrCiSummaryData;
}

interface ViewPrStatusProps {
  prNumberToMonitor: number;
  initialPrUrl?: string | null;
  toolDirectiveForDisplay?: string | null;
  onPollingStopped?: (finalStatus: PrStatusApiResponse | null) => void;
}

const POLLING_INTERVAL = 7000;
const MAX_CLIENT_POLLING_ATTEMPTS = 360;
const INITIAL_404_GRACE_ATTEMPTS = 6;

function extractToolDirectiveFromBranchName(
  branchName: string | null
): string | null {
  if (!branchName || !branchName.startsWith('feat/gen-')) return null;
  const tempDirective = branchName.substring('feat/gen-'.length);
  return tempDirective.replace(/-[0-9]+$/, '') || null;
}

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

  const [isFeedbackSectionVisible, setIsFeedbackSectionVisible] =
    useState(false);
  const [buildFailureMessages, setBuildFailureMessages] = useState<
    Record<string, EmojiMessage[]>
  >({});
  const [isLoadingFailureMessages, setIsLoadingFailureMessages] =
    useState(true);

  const pollingAttemptsRef = useRef(0);
  const componentMountedRef = useRef(false);
  const currentMonitoredPrRef = useRef<number | null>(null);
  const prStatusRef = useRef(prStatus);

  useEffect(() => {
    prStatusRef.current = prStatus;
  }, [prStatus]);

  useEffect(() => {
    componentMountedRef.current = true;
    const fetchMessages = async () => {
      setIsLoadingFailureMessages(true);
      try {
        const response = await fetch('/data/build/build_failure_messages.json');
        if (!response.ok)
          throw new Error(
            `Failed to load failure messages (${response.status})`
          );
        const data: Record<string, EmojiMessage[]> = await response.json();
        if (componentMountedRef.current) {
          setBuildFailureMessages(data);
        }
      } catch (error) {
        console.error('Error fetching build failure messages:', error);
        if (componentMountedRef.current) {
          setBuildFailureMessages({});
        }
      } finally {
        if (componentMountedRef.current) {
          setIsLoadingFailureMessages(false);
        }
      }
    };
    fetchMessages();
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
        console.log('status-pr response:', data);
        if (!componentMountedRef.current) return;

        if (componentMountedRef.current) {
          setPrStatus(data);
          if (pollingError) setPollingError(null);
          if (initialPollingMessage) setInitialPollingMessage(null);
        }

        if (
          currentAttempt >= MAX_CLIENT_POLLING_ATTEMPTS &&
          data.prState === 'open' &&
          data.automatedActions.shouldContinuePolling
        ) {
          if (componentMountedRef.current) {
            setPrStatus((prev) =>
              prev
                ? {
                    ...prev,
                    automatedActions: {
                      ...prev.automatedActions,
                      statusSummary:
                        'Max polling attempts reached by client. Please check the PR on GitHub for the latest status.',
                      shouldContinuePolling: false,
                      nextExpectedAction: 'MANUAL_REVIEW_TIMEOUT',
                      uiHint: 'error',
                    },
                    lastUpdated: new Date().toISOString(),
                  }
                : null
            );
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
      }
    },
    [prNumberToMonitor, pollingError, initialPollingMessage]
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
        setIsFeedbackSectionVisible(false);

        fetchPrStatusCallback(true);
        setIsPolling(true);
      }
    }
  }, [prNumberToMonitor, fetchPrStatusCallback]);

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

    const apiShouldPoll = prStatus.automatedActions.shouldContinuePolling;

    if (isPolling !== apiShouldPoll) {
      setIsPolling(apiShouldPoll);
    }

    if (!apiShouldPoll && onPollingStopped) {
      onPollingStopped(prStatusRef.current);
    }

    if (
      prStatus.automatedActions.nextExpectedAction !== 'USER_REVIEW_PREVIEW' ||
      !prStatus.netlifyPreviewUrl
    ) {
      setIsFeedbackSectionVisible(false);
    }
  }, [
    prStatus,
    isPolling,
    onPollingStopped,
    prNumberToMonitor,
    fetchPrStatusCallback,
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
          title={`Unknown conclusion: ${conclusion}`}
        />
      );
    }
    if (
      ['in_progress', 'queued', 'pending', 'requested', 'waiting'].includes(
        status || ''
      )
    )
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
        return 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-200';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-300 text-yellow-700 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200';
      case 'loading':
        return 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900 dark:border-indigo-700 dark:text-indigo-200 animate-pulse';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300';
    }
  };

  const sortedChecks = useMemo(() => {
    if (!prStatus?.checks) return [];
    return [...prStatus.checks].sort((a, b) => {
      const getNumericPrefix = (name: string): number => {
        const match = name.match(/^(\d+)\.?\s+/);
        return match ? parseInt(match[1], 10) : Infinity;
      };
      const numA = getNumericPrefix(a.name);
      const numB = getNumericPrefix(b.name);

      if (numA !== Infinity && numB !== Infinity) {
        return numA - numB;
      }
      if (numA !== Infinity) return -1;
      if (numB !== Infinity) return 1;

      const aIsNetlify = a.name.toLowerCase().includes('netlify');
      const bIsNetlify = b.name.toLowerCase().includes('netlify');
      if (aIsNetlify && !bIsNetlify) return 1;
      if (!aIsNetlify && bIsNetlify) return -1;

      return a.name.localeCompare(b.name);
    });
  }, [prStatus?.checks]);

  const renderToolGenInfo = () => {
    if (!prStatus?.toolGenerationInfoForUI) return null;

    const {
      npmDependenciesFulfilled,
      lintFixesAttempted,
      identifiedDependencies,
    } = prStatus.toolGenerationInfoForUI;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isNotApplicableOrNotFoundOrDeleted = (value: any) =>
      ['not_found', 'not_applicable', 'deleted'].includes(value);

    const isInteresting =
      (!isNotApplicableOrNotFoundOrDeleted(npmDependenciesFulfilled) &&
        npmDependenciesFulfilled !== 'absent') ||
      (!isNotApplicableOrNotFoundOrDeleted(lintFixesAttempted) &&
        lintFixesAttempted !== false) ||
      (identifiedDependencies &&
        identifiedDependencies.length > 0 &&
        npmDependenciesFulfilled !== 'deleted');

    if (!isInteresting) return null;
    if (npmDependenciesFulfilled === 'deleted') return null;

    return (
      <div className="mt-3 p-2.5 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 space-y-1">
        <h4 className="font-medium text-gray-700 dark:text-gray-200">
          Tool Generation State (from current commit):
        </h4>
        {!isNotApplicableOrNotFoundOrDeleted(npmDependenciesFulfilled) &&
          npmDependenciesFulfilled !== 'absent' && (
            <p>
              NPM Deps Processed:{' '}
              <span
                className={`font-semibold ${
                  npmDependenciesFulfilled === 'true'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {String(npmDependenciesFulfilled)}
              </span>
            </p>
          )}
        {!isNotApplicableOrNotFoundOrDeleted(lintFixesAttempted) &&
          lintFixesAttempted !== false && (
            <p>
              Lint Fixes Attempted by AI:{' '}
              <span className="font-semibold">
                {String(lintFixesAttempted)}
              </span>
            </p>
          )}
        {identifiedDependencies && identifiedDependencies.length > 0 && (
          <p>
            Initially Identified Dependencies:{' '}
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
      !prStatus.automatedActions.nextExpectedAction?.startsWith(
        'MANUAL_REVIEW'
      ) ||
      isLoadingFailureMessages
    ) {
      return null;
    }

    const actionCode = prStatus.automatedActions.nextExpectedAction;
    const messagesToDisplay: EmojiMessage[] = buildFailureMessages[
      actionCode
    ] ||
      buildFailureMessages['DEFAULT_MANUAL_REVIEW'] || [
        {
          emoji: '🚧',
          memo: 'This tool requires manual review. Please check the GitHub Pull Request for details.',
        },
      ];

    const prNum = prStatus.prNumber;
    const toolDir = toolDirectiveForDisplay || 'unknown-directive';
    const headShaShort = prStatus.headSha.substring(0, 7);
    const statusSummaryForIssue =
      prStatus.automatedActions.statusSummary || 'Status not available.';

    const issueTitle = encodeURIComponent(
      `AI Tool Gen Feedback: PR #${prNum} - ${toolDir}`
    );
    const issueBodyTemplate = `
**Pull Request Number:** #${prNum}
**(Link: [View PR on GitHub](${prStatus.prUrl}))**

**Tool Directive Attempted:** \`${toolDir}\`

**Observed CI Status Summary:**
${statusSummaryForIssue}

**What were you trying to build?**
(Please describe the tool you were hoping the AI would generate)

**Example URLs or Similar Tools (Optional):**
- Example 1: [URL] - Notes: ...

**General Feedback / Additional Details:**

---
*Internal Diagnostics (Maintainer Use):*
*Affected Commit SHA:* ${headShaShort}
*Next Expected Action Code:* ${actionCode}
    `;
    const issueBody = encodeURIComponent(issueBodyTemplate.trim());
    const labels = encodeURIComponent('build-tool,feedback,needs-triage');
    const githubRepoOwner =
      process.env.NEXT_PUBLIC_GITHUB_REPO_OWNER || 'Online-Everything-Tool';
    const githubRepoName = process.env.NEXT_PUBLIC_GITHUB_REPO_NAME || 'oet';
    const reportIssueUrl = `https://github.com/${githubRepoOwner}/${githubRepoName}/issues/new?title=${issueTitle}&body=${issueBody}&labels=${labels}`;

    return (
      <div
        className={`mt-4 p-4 border rounded-lg text-sm ${getUiHintClasses('warning')}`}
      >
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 dark:text-yellow-400 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-grow">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 text-md mb-2">
              Automation Halted: Manual Review Needed
            </h4>
            <div className="space-y-2 mb-3">
              {messagesToDisplay.map((msg, index) => (
                <div key={index} className="flex items-start">
                  <span className="text-xl mr-2">{msg.emoji}</span>
                  <p className="text-yellow-700 dark:text-yellow-300 leading-relaxed">
                    {msg.memo}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-yellow-600 dark:text-yellow-400 mt-3 mb-2 text-xs italic">
              Current automated status:{' '}
              {prStatus.automatedActions.statusSummary}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Link
                href={prStatus.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-400 dark:border-gray-500 text-xs font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                View PR Details on GitHub
                <ArrowTopRightOnSquareIcon className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href={reportIssueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-orange-500 hover:bg-orange-600"
              >
                Report Issue / Provide Details
                <ArrowTopRightOnSquareIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section
      className={`p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm ${
        prStatus
          ? getUiHintClasses(prStatus.automatedActions.uiHint).split(' ')[0]
          : 'border-gray-200 dark:border-gray-600'
      } ${
        prStatus
          ? getUiHintClasses(prStatus.automatedActions.uiHint).split(' ')[1]
          : 'border-gray-200 dark:border-gray-600'
      }`}
    >
      <h2 className="text-lg font-semibold mb-1 text-gray-700 dark:text-gray-100 flex items-center">
        {prTitleForDisplay}
        {isPolling && prStatus?.prState === 'open' && (
          <ArrowPathIcon className="h-5 w-5 text-blue-500 dark:text-blue-400 animate-spin inline ml-2" />
        )}
      </h2>

      {prUrlToDisplay && (
        <p className="text-sm mb-3">
          <Link
            href={prUrlToDisplay}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            View Pull Request #{prNumberToMonitor} on GitHub
            <ArrowTopRightOnSquareIcon className="inline h-4 w-4 ml-1" />
          </Link>
        </p>
      )}

      {initialPollingMessage && !prStatus && (
        <div
          className={`my-2 p-3 rounded-md text-sm ${getUiHintClasses(
            'loading'
          )}`}
        >
          {initialPollingMessage}
        </div>
      )}
      {!initialPollingMessage && !pollingError && !prStatus && isPolling && (
        <div
          className={`my-2 p-3 rounded-md text-sm ${getUiHintClasses(
            'loading'
          )}`}
        >
          Awaiting first status update...
        </div>
      )}
      {pollingError && (
        <div
          className={`my-4 p-3 rounded-md text-sm ${getUiHintClasses('error')}`}
        >
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
        <div className="space-y-3 my-2">
          {prStatus.automatedActions?.statusSummary &&
            !isFeedbackSectionVisible && (
              <div
                className={`p-3 rounded-md text-sm border ${getUiHintClasses(
                  prStatus.automatedActions.uiHint
                )}`}
              >
                <strong className="block mb-1">Automated Status:</strong>
                <p>{prStatus.automatedActions.statusSummary}</p>
                {prStatus.automatedActions.lastBotComment && (
                  <div className="text-xs mt-2 pt-2 border-t border-opacity-30 border-current">
                    <span>
                      Last bot activity:{' '}
                      {prStatus.automatedActions.lastBotComment.botName ||
                        'Bot'}{' '}
                      -{' '}
                      <em>
                        {prStatus.automatedActions.lastBotComment.summary}
                      </em>
                    </span>
                    {prStatus.automatedActions.lastBotComment.url && (
                      <Link
                        href={prStatus.automatedActions.lastBotComment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline ml-1"
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
                  ) &&
                  prStatus.automatedActions.nextExpectedAction !==
                    'USER_REVIEW_PREVIEW' && (
                    <span className="block text-xs mt-1 opacity-80">
                      Next expected:{' '}
                      {prStatus.automatedActions.nextExpectedAction.replace(
                        /_/g,
                        ' '
                      )}
                    </span>
                  )}
              </div>
            )}

          {!isFeedbackSectionVisible && renderToolGenInfo()}
          {!isFeedbackSectionVisible && renderManualReviewSection()}

          {sortedChecks.length > 0 && !isFeedbackSectionVisible && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                CI/CD Checks:
              </h3>
              <ul className="space-y-1 text-sm list-none pl-1 border border-gray-200 dark:border-gray-600 rounded-md p-2 bg-gray-50/50 dark:bg-gray-700/50 max-h-60">
                {sortedChecks.map((check, idx) => (
                  <li
                    key={`${check.name}-${check.started_at || idx}`}
                    className="flex items-center py-1.5 border-b border-gray-100 dark:border-gray-600/50 last:border-b-0 last:pb-0"
                  >
                    {getStatusIcon(check.status, check.conclusion)}
                    <span
                      className={`ml-1 ${
                        check.conclusion === 'failure'
                          ? 'text-red-600 dark:text-red-400 font-medium'
                          : check.conclusion === 'success'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {check.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1.5">
                      ({check.status || 'unknown'}
                      {check.conclusion && `, ${check.conclusion}`})
                    </span>
                    {check.url && (
                      <Link
                        href={check.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 dark:text-blue-400 hover:underline ml-auto"
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
            prStatus.netlifyDeploymentSucceeded &&
            prStatus.automatedActions.nextExpectedAction ===
              'USER_REVIEW_PREVIEW' &&
            !isFeedbackSectionVisible && (
              <div
                className={`mt-4 p-3 rounded-md text-sm ${getUiHintClasses(
                  'success'
                )}`}
              >
                <div className="flex flex-col justify-between items-center gap-3">
                  <div className="flex gap-2 items-center">
                    <p className="text-4xl font-semibold">🎉</p>
                    <div className="flex flex-col gap-2">
                      <p className="text-xl font-semibold">
                        Deploy Preview Ready!
                      </p>
                      <Link
                        href={prStatus.netlifyPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-1 text-blue-600 dark:text-blue-400 hover:underline break-all"
                      >
                        {prStatus.netlifyPreviewUrl}
                        <ArrowTopRightOnSquareIcon className="inline h-4 w-4 ml-1" />
                      </Link>
                    </div>
                  </div>
                  <Button
                    variant="accent"
                    onClick={() => setIsFeedbackSectionVisible(true)}
                    iconLeft={
                      <ChatBubbleLeftEllipsisIcon className="h-5 w-5" />
                    }
                    className="w-full sm:w-auto mt-2 sm:mt-0 flex-shrink-0"
                  >
                    Feedback / Merge
                  </Button>
                </div>
              </div>
            )}

          {prStatus.imgurScreenshotUrl && !isFeedbackSectionVisible && (
            <div className="mt-4 flex justify-center">
              <div>
                <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  Douglas&apos; View (Screenshot):
                </h4>
                <Image
                  src={prStatus.imgurScreenshotUrl}
                  alt={`Douglas Screenshot for PR #${prStatus.prNumber}`}
                  width={600}
                  height={400}
                  className="border dark:border-gray-600 rounded-md object-contain max-w-full h-auto"
                  unoptimized
                />
              </div>
            </div>
          )}

          {!isPolling &&
            !isFeedbackSectionVisible &&
            prStatus.prState === 'closed' && (
              <div
                className={`mt-4 p-3 rounded-md text-sm font-semibold ${getUiHintClasses(
                  prStatus.automatedActions.uiHint
                )}`}
              >
                {prStatus.automatedActions.statusSummary} Polling stopped.
              </div>
            )}
          {!isPolling &&
            !isFeedbackSectionVisible &&
            prStatus.prState === 'open' &&
            prStatus.automatedActions.nextExpectedAction &&
            prStatus.automatedActions.nextExpectedAction.startsWith(
              'MANUAL_REVIEW'
            ) && (
              <div
                className={`mt-4 p-3 rounded-md text-sm ${getUiHintClasses(
                  'error'
                )}`}
              >
                <strong>Polling stopped.</strong> Manual intervention required.
              </div>
            )}
        </div>
      )}

      {isFeedbackSectionVisible && prStatus && prStatus.netlifyPreviewUrl && (
        <FeedbackMerge
          prNumber={prStatus.prNumber}
          prUrl={prStatus.prUrl}
          toolName={
            toolDirectiveForDisplay ||
            prStatus.prHeadBranch ||
            `Tool for PR #${prStatus.prNumber}`
          }
          netlifyPreviewUrl={prStatus.netlifyPreviewUrl}
          onHideFeedback={() => setIsFeedbackSectionVisible(false)}
        />
      )}
    </section>
  );
}
