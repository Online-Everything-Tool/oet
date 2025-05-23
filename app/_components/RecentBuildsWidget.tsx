// app/_components/RecentBuildsWidget.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  TagIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
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
  variant?: 'default' | 'headerDropdown';
}

const CACHE_DURATION_MS = 2 * 60 * 1000;

export default function RecentBuildsWidget({
  onItemClick,
  variant = 'default',
}: RecentBuildsWidgetProps) {
  const [recentBuildPrs, setRecentBuildPrs] = useState<
    RecentBuildPrInfoClient[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchTimestampRef = useRef<number>(0);
  const fetchedDataRef = useRef<RecentBuildPrInfoClient[] | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchRecentBuilds = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/recent-builds');
        const data: RecentBuildsApiResponse = await response.json();

        if (!isMountedRef.current) return;

        if (response.ok && data.recentBuilds) {
          setRecentBuildPrs(data.recentBuilds);
          fetchedDataRef.current = data.recentBuilds;
          lastFetchTimestampRef.current = Date.now();
        } else {
          const errorMessage =
            data.error || `Failed to fetch recent builds (${response.status})`;
          console.error('[RecentBuildsWidget] API Error:', errorMessage);
          setError(errorMessage);
          if (!fetchedDataRef.current) setRecentBuildPrs([]);
        }
      } catch (e) {
        if (!isMountedRef.current) return;
        const errorMessage =
          e instanceof Error ? e.message : 'Unknown error occurred';
        console.error('[RecentBuildsWidget] Fetch Error:', errorMessage, e);
        setError(errorMessage);
        if (!fetchedDataRef.current) setRecentBuildPrs([]);
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };

    const now = Date.now();
    if (
      now - lastFetchTimestampRef.current > CACHE_DURATION_MS ||
      !fetchedDataRef.current
    ) {
      console.log('[RecentBuildsWidget] Cache expired or no data, fetching...');
      fetchRecentBuilds();
    } else {
      console.log('[RecentBuildsWidget] Using cached data.');
      if (fetchedDataRef.current) {
        setRecentBuildPrs(fetchedDataRef.current);
      }
      setIsLoading(false);
    }
  }, []);

  const getItemClasses = () => {
    if (variant === 'headerDropdown') {
      return 'block px-3 py-2.5 text-sm hover:bg-gray-100 transition-colors duration-150';
    }
    return 'p-3 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-subtle))] hover:bg-[rgba(var(--color-border-base)/0.1)] hover:border-[rgb(var(--color-text-link))] transition-colors duration-150';
  };

  const renderItemContent = (pr: RecentBuildPrInfoClient) => {
    const timeAgo =
      pr.status === 'open'
        ? formatDistanceToNowStrict(new Date(pr.createdAt), { addSuffix: true })
        : formatDistanceToNowStrict(new Date(pr.mergedAt), { addSuffix: true });

    const iconContainerClasses =
      variant === 'headerDropdown' ? 'flex-shrink-0 mr-2.5' : 'flex-shrink-0';
    const iconClasses = variant === 'headerDropdown' ? 'h-5 w-5' : 'h-6 w-6';

    const titleClasses =
      variant === 'headerDropdown'
        ? 'font-medium text-gray-800 truncate'
        : 'text-base font-semibold mb-0.5 text-[rgb(var(--color-text-link))] truncate';

    const directiveClasses =
      variant === 'headerDropdown'
        ? 'text-xs text-gray-500 truncate'
        : 'text-xs text-[rgb(var(--color-text-muted))] truncate';

    const timeClasses =
      variant === 'headerDropdown'
        ? 'text-xs text-gray-400 ml-auto pl-2 whitespace-nowrap'
        : 'text-xs text-[rgb(var(--color-text-muted))] mt-0.5';

    const statusIconColor =
      pr.status === 'open'
        ? variant === 'headerDropdown'
          ? 'text-blue-500'
          : 'text-[rgb(var(--color-text-link))]'
        : variant === 'headerDropdown'
          ? 'text-green-500'
          : 'text-green-600';

    return (
      <div
        className={`flex items-center ${variant === 'headerDropdown' ? 'justify-between' : 'gap-3'}`}
      >
        <div className={iconContainerClasses}>
          {pr.status === 'open' ? (
            <WrenchScrewdriverIcon
              className={`${iconClasses} ${statusIconColor}`}
            />
          ) : (
            <CheckCircleIcon className={`${iconClasses} ${statusIconColor}`} />
          )}
        </div>
        <div className="flex-grow min-w-0">
          <p className={titleClasses} title={pr.title}>
            {pr.toolDirective}
          </p>
          <p className={directiveClasses} title={`PR #${pr.prNumber}`}>
            PR #{pr.prNumber}
          </p>
        </div>
        {variant === 'default' && (
          <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
        )}
        {variant === 'headerDropdown' && (
          <span className={timeClasses}>{timeAgo}</span>
        )}
      </div>
    );
  };

  if (isLoading && recentBuildPrs.length === 0 && !fetchedDataRef.current) {
    return (
      <div
        className={`p-4 ${variant === 'default' ? 'border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))]' : ''}`}
      >
        {variant === 'default' && (
          <h3 className="text-md font-semibold text-[rgb(var(--color-text-muted))] mb-2">
            Recent Activity
          </h3>
        )}
        <div className="flex items-center justify-center py-3">
          <ArrowPathIcon className="h-6 w-6 text-gray-400 animate-spin mr-2" />
          <span className="text-sm text-gray-500 italic">
            Loading recent builds...
          </span>
        </div>
      </div>
    );
  }

  if (error && recentBuildPrs.length === 0) {
    return (
      <div
        className={`p-4 ${variant === 'default' ? 'border rounded-lg shadow-sm bg-red-50 border-red-200' : 'bg-red-50'}`}
      >
        {variant === 'default' && (
          <h3 className="text-md font-semibold text-red-700 mb-2">
            Recent Activity
          </h3>
        )}
        <div className="flex items-center text-red-600 py-3">
          <ExclamationCircleIcon className="h-6 w-6 mr-2" />
          <span className="text-sm">Error: {error}</span>
        </div>
      </div>
    );
  }

  if (recentBuildPrs.length === 0 && !isLoading) {
    if (variant === 'headerDropdown')
      return (
        <p className="px-4 py-3 text-sm text-gray-500 italic">
          No recent build activity.
        </p>
      );
    return (
      <div className="p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))]">
        <h3 className="text-md font-semibold text-[rgb(var(--color-text-muted))] mb-2">
          Recent Activity
        </h3>
        <p className="text-sm text-center text-[rgb(var(--color-text-muted))] italic py-4">
          No recent AI-assisted tool builds found.
        </p>
      </div>
    );
  }

  const containerClasses =
    variant === 'default'
      ? 'p-4 md:p-6 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-component))] shadow-sm space-y-3'
      : 'py-1';

  return (
    <div className={containerClasses}>
      {variant === 'default' && (
        <div className="flex items-center gap-2 mb-3">
          <TagIcon className="h-6 w-6 text-[rgb(var(--color-text-base))]" />
          <h2 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">
            Recent Build Activity
            {isLoading && (
              <ArrowPathIcon className="h-4 w-4 text-gray-400 animate-spin inline-block ml-2" />
            )}
            {error && !isLoading && (
              <ExclamationCircleIcon
                className="h-4 w-4 text-red-400 inline-block ml-2"
                title={error}
              />
            )}
          </h2>
        </div>
      )}
      <ul
        className={`${variant === 'default' ? 'space-y-3' : 'divide-y divide-gray-100'}`}
      >
        {recentBuildPrs.map((pr) => {
          const targetUrl =
            pr.status === 'open'
              ? `/build-tool?prNumber=${pr.prNumber}`
              : `/tool/${pr.toolDirective}/`;

          return (
            <li key={pr.prNumber}>
              <Link
                href={targetUrl}
                className={getItemClasses()}
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
