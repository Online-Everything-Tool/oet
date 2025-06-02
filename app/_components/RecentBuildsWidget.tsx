// app/_components/RecentBuildsWidget.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  ArrowPathIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/20/solid';

interface BaseRecentBuildPrClient {
  prNumber: number;
  prUrl: string;
  title: string;
  toolDirective: string;
  branchName: string;
}
interface OpenRecentBuildPrClient extends BaseRecentBuildPrClient {
  status: 'open';
  createdAt: string;
}
interface MergedRecentBuildPrClient extends BaseRecentBuildPrClient {
  status: 'merged';
  mergedAt: string;
}
type RecentBuildPrInfoClient =
  | OpenRecentBuildPrClient
  | MergedRecentBuildPrClient;

interface RecentBuildsApiResponse {
  recentBuilds: RecentBuildPrInfoClient[];
  error?: string;
}

interface RecentBuildsWidgetProps {
  onItemClick?: () => void;
}

const CACHE_DURATION_MS = 5 * 60 * 1000;
const WIDGET_INSTANCE_ID = Math.random().toString(36).substring(2, 7);

export default function RecentBuildsWidget({
  onItemClick,
}: RecentBuildsWidgetProps) {
  const [recentBuildPrs, setRecentBuildPrs] = useState<
    RecentBuildPrInfoClient[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastFetchTimestampRef = useRef<number>(0);
  const fetchedDataRef = useRef<RecentBuildPrInfoClient[] | null>(null);
  const hasAttemptedFetchRef = useRef(false);

  useEffect(() => {
    if (hasAttemptedFetchRef.current) {
      if (!isLoading && fetchedDataRef.current) {
        setRecentBuildPrs(fetchedDataRef.current);
      }
      return;
    }

    const fetchRecentBuilds = async () => {
      if (isLoading && hasAttemptedFetchRef.current && fetchedDataRef.current) {
        return;
      }

      setIsLoading(true);
      setError(null);
      hasAttemptedFetchRef.current = true;

      try {
        const response = await fetch('/api/status-recent-builds');
        const data: RecentBuildsApiResponse = await response.json();

        if (response.ok && data.recentBuilds) {
          setRecentBuildPrs(data.recentBuilds);
          fetchedDataRef.current = data.recentBuilds;
          lastFetchTimestampRef.current = Date.now();
        } else {
          const errorMessage =
            data.error || `Failed to fetch recent builds (${response.status})`;
          setError(errorMessage);
          if (!fetchedDataRef.current) setRecentBuildPrs([]);
        }
      } catch (e) {
        const errorMessage =
          e instanceof Error ? e.message : 'Unknown error occurred';
        console.error(
          `[RecentBuildsWidget ${WIDGET_INSTANCE_ID}] Fetch Error:`,
          errorMessage,
          e
        );
        setError(errorMessage);
        if (!fetchedDataRef.current) setRecentBuildPrs([]);
      } finally {
        setIsLoading(false);
      }
    };

    const now = Date.now();
    if (
      !hasAttemptedFetchRef.current ||
      now - lastFetchTimestampRef.current > CACHE_DURATION_MS
    ) {
      fetchRecentBuilds();
    } else {
      if (fetchedDataRef.current) {
        setRecentBuildPrs(fetchedDataRef.current);
      }
      setIsLoading(false);
    }
  }, []);

  const renderItemContent = (pr: RecentBuildPrInfoClient) => {
    const timeAgo =
      pr.status === 'open'
        ? formatDistanceToNowStrict(new Date(pr.createdAt), { addSuffix: true })
        : formatDistanceToNowStrict(new Date(pr.mergedAt), { addSuffix: true });

    const statusIconColor =
      pr.status === 'open' ? 'text-blue-500' : 'text-green-500';

    return (
      <div className="flex items-center justify-between">
        <div className="flex-shrink-0 mr-2.5">
          {pr.status === 'open' ? (
            <WrenchScrewdriverIcon className={`h-5 w-5 ${statusIconColor}`} />
          ) : (
            <CheckCircleIcon className={`h-5 w-5 ${statusIconColor}`} />
          )}
        </div>
        <div className="flex-grow min-w-0">
          <p className="font-medium text-gray-800 truncate" title={pr.title}>
            {pr.toolDirective}
          </p>
          <p
            className="text-xs text-gray-500 truncate"
            title={`PR #${pr.prNumber}`}
          >
            PR #{pr.prNumber}
          </p>
        </div>
        <span className="text-xs text-gray-400 ml-auto pl-2 whitespace-nowrap">
          {timeAgo}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="py-1 bg-white text-gray-800">
        <div className="flex items-center justify-center px-4 py-3">
          <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin mr-2" />
          <span className="text-sm text-gray-500 italic">
            Loading recent builds...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-1 bg-white text-gray-800 bg-red-50">
        <div className="flex items-center text-red-600 px-4 py-3">
          <ExclamationCircleIcon className="h-5 w-5 mr-2" />
          <span className="text-sm">Error: {error}</span>
        </div>
      </div>
    );
  }

  if (recentBuildPrs.length === 0) {
    return (
      <div className="py-1 bg-white text-gray-800">
        <p className="px-4 py-3 text-sm text-gray-500 italic text-center">
          No recent build activity.
        </p>
      </div>
    );
  }

  return (
    <div className="py-1 bg-white text-gray-800">
      <ul className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-gray-100">
        {recentBuildPrs.map((pr) => {
          const targetUrl =
            pr.status === 'open'
              ? `/build/tool?prNumber=${pr.prNumber}`
              : `/tool/${pr.toolDirective}/`;

          return (
            <li key={pr.prNumber}>
              <Link
                href={targetUrl}
                className="block px-3 py-2.5 text-sm hover:bg-gray-100 transition-colors duration-150"
                onClick={onItemClick}
              >
                {renderItemContent(pr)}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
