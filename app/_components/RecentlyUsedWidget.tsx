// FILE: app/_components/RecentlyUsedWidget.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useHistory } from '../context/HistoryContext'; // Uses updated HistoryContext
import type { HistoryEntry } from '@/src/types/history'; // Uses updated HistoryEntry
import RecentlyUsedItem from './RecentlyUsedItem';
import type { ToolMetadata } from '@/src/types/tools'; // Correct import path

interface RecentlyUsedWidgetProps {
  limit: number;
  filterToolRoute?: string;
  displayMode: 'homepage' | 'toolpage';
}

export default function RecentlyUsedWidget({
  limit,
  filterToolRoute,
  displayMode,
}: RecentlyUsedWidgetProps) {
  const { history, isLoaded } = useHistory(); // Get history from the updated context
  const [metadataCache, setMetadataCache] = useState<
    Record<string, ToolMetadata | null>
  >({});

  const filteredHistory = useMemo(() => {
    // Sort by eventTimestamp (descending for newest first)
    const sorted = history.sort((a, b) => b.eventTimestamp - a.eventTimestamp);
    // Filtering logic remains the same
    if (filterToolRoute) {
      return sorted
        .filter((entry) => entry.toolRoute === filterToolRoute)
        .slice(0, limit);
    }
    if (displayMode === 'homepage') {
      const uniqueRoutes = new Set<string>();
      const uniqueEntries: HistoryEntry[] = [];
      for (const entry of sorted) {
        // Ensure unique tools are added based on toolRoute
        if (
          !uniqueRoutes.has(entry.toolRoute) &&
          uniqueEntries.length < limit
        ) {
          uniqueEntries.push(entry);
          uniqueRoutes.add(entry.toolRoute);
        }
      }
      return uniqueEntries;
    }
    // Default case: return sorted slice for toolpage or if no special mode
    return sorted.slice(0, limit);
  }, [history, limit, filterToolRoute, displayMode]);

  // Metadata fetching logic remains the same
  const fetchMetadata = useCallback(
    async (toolRoute: string) => {
      if (metadataCache[toolRoute] !== undefined) return;

      if (!toolRoute || !toolRoute.startsWith('/tool/')) return;

      const directive = toolRoute.substring('/tool/'.length).replace(/\/$/, '');
      if (!directive) {
        setMetadataCache((prev) => ({ ...prev, [toolRoute]: null }));
        return;
      }

      setMetadataCache((prev) => ({ ...prev, [toolRoute]: null }));

      try {
        const response = await fetch(`/api/tool-metadata/${directive}.json`);
        if (response.ok) {
          const data: ToolMetadata = await response.json();
          setMetadataCache((prev) => ({ ...prev, [toolRoute]: data || null }));
        } else {
          if (response.status === 404) {
            console.warn(
              `[RecentlyUsed] Metadata file not found for ${directive}.`
            );
          } else {
            console.error(
              `[RecentlyUsed] Failed fetch metadata ${directive} (${response.status})`
            );
          }
          setMetadataCache((prev) => ({ ...prev, [toolRoute]: null }));
        }
      } catch (fetchError: unknown) {
        console.error(
          `[RecentlyUsed] Error fetching metadata for ${toolRoute}:`,
          fetchError
        );
        setMetadataCache((prev) => ({ ...prev, [toolRoute]: null }));
      }
    },
    [metadataCache]
  );

  useEffect(() => {
    filteredHistory.forEach((entry) => {
      // Ensure toolRoute exists before fetching
      if (entry.toolRoute) {
        fetchMetadata(entry.toolRoute);
      }
    });
  }, [filteredHistory, fetchMetadata]);

  // Loading State
  if (!isLoaded) {
    return (
      <div
        className={`p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] ${displayMode === 'homepage' ? 'mb-8' : ''}`}
      >
        <h2 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-muted))]">
          Recently Used
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-muted))] italic animate-pulse">
          Loading history...
        </p>
      </div>
    );
  }

  // Empty State
  if (history.length === 0 || filteredHistory.length === 0) {
    if (displayMode === 'toolpage') {
      return (
        <div className="p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))]">
          <h3 className="text-md font-semibold mb-2 text-[rgb(var(--color-text-muted))]">
            Recent Activity
          </h3>
          <p className="text-sm text-[rgb(var(--color-text-muted))] italic">
            No activity recorded for this tool yet.
          </p>
        </div>
      );
    }
    // Don't render anything on homepage if empty
    return null;
  }

  // Render logic using RecentlyUsedItem
  const items = filteredHistory.map((entry) => (
    <RecentlyUsedItem
      key={entry.id}
      entry={entry}
      metadata={metadataCache[entry.toolRoute] || null}
      displayMode={displayMode}
    />
  ));

  return (
    <div
      className={`p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] ${displayMode === 'homepage' ? 'mb-8' : ''}`}
    >
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-muted))]">
          {displayMode === 'homepage' ? 'Recently Used' : 'Recent Activity'}
        </h2>
        {displayMode === 'homepage' && (
          <Link
            href="/history"
            className="text-sm text-[rgb(var(--color-text-link))] hover:underline"
          >
            View All
          </Link>
        )}
      </div>
      {displayMode === 'homepage' ? (
        // Use flex-wrap and allow items to wrap if needed, add padding for scrolling appearance
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 -mx-2 px-2">
          {items}
        </div>
      ) : (
        <div className="space-y-1">{items}</div>
      )}
    </div>
  );
}
