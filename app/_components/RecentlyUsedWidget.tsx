// FILE: app/_components/RecentlyUsedWidget.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useHistory, HistoryEntry } from '../context/HistoryContext';
import { formatDistanceToNowStrict } from 'date-fns';
import HistoryOutputPreview from './HistoryOutputPreview';

// Define expected structure for tool metadata fetched from API
export interface ToolMetadata {
    title?: string;
    description?: string;
    iconName?: string | null;
    outputConfig?: {
        summaryField?: string;
        referenceType?: 'imageLibraryId';
        referenceField?: string;
    };
    // Add other potential metadata fields if needed
    [key: string]: unknown;
}

interface MetadataApiResponse {
    success: boolean;
    metadata?: ToolMetadata;
    error?: string;
}


interface RecentlyUsedWidgetProps {
  limit: number;
  filterToolRoute?: string; // Optional: Filter history by a specific tool route
  displayMode: 'homepage' | 'toolpage'; // Control layout variations
}

// Memoized Item Component
const RecentlyUsedItem = React.memo(({ entry, metadata }: { entry: HistoryEntry, metadata: ToolMetadata | null }) => {
    const latestTimestamp = entry.timestamps[0];
    const timeAgo = formatDistanceToNowStrict(new Date(latestTimestamp), { addSuffix: false });

    // Simplified time formatting
    const formatTime = (time: string): string => {
        // Replace longer units with abbreviations
        time = time.replace(/ minutes?/, 'm');
        time = time.replace(/ hours?/, 'h');
        time = time.replace(/ days?/, 'd');
        time = time.replace(/ months?/, 'mo');
        time = time.replace(/ years?/, 'y');
        // Handle "less than a minute" or similar short forms
        if (time.startsWith('less than') || time.includes('second')) return '< 1m';
        return time;
    };

    return (
        <div className="flex items-center p-2 gap-3 hover:bg-[rgba(var(--color-border-base)/0.1)] rounded transition-colors duration-100">
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-[rgb(var(--color-bg-subtle))] rounded border border-[rgb(var(--color-border-base))]">
                <HistoryOutputPreview entry={entry} metadata={metadata} />
            </div>
            <div className="flex-grow overflow-hidden">
                <Link href={entry.toolRoute} className="text-sm font-medium text-[rgb(var(--color-text-link))] hover:underline truncate block">
                    {entry.toolName}
                </Link>
                 {/* Display summary text only if outputConfig isn't set up for image preview */}
                {!(metadata?.outputConfig?.referenceType === 'imageLibraryId') && (
                    <div className="text-xs text-[rgb(var(--color-text-muted))] truncate">
                        <HistoryOutputPreview entry={entry} metadata={metadata} />
                    </div>
                 )}
            </div>
            <div className="text-xs text-right text-[rgb(var(--color-text-muted))] flex-shrink-0 w-10" title={new Date(latestTimestamp).toLocaleString()}>
                {formatTime(timeAgo)}
            </div>
        </div>
    );
});
RecentlyUsedItem.displayName = 'RecentlyUsedItem';


export default function RecentlyUsedWidget({ limit, filterToolRoute, displayMode }: RecentlyUsedWidgetProps) {
  const { history, isLoaded } = useHistory();
  const [metadataCache, setMetadataCache] = useState<Record<string, ToolMetadata | null>>({});

  // Filter history entries based on the optional filterToolRoute
  const filteredHistory = useMemo(() => {
      const sorted = history.sort((a, b) => b.timestamps[0] - a.timestamps[0]);
      if (filterToolRoute) {
          return sorted.filter(entry => entry.toolRoute === filterToolRoute).slice(0, limit);
      }
      // Homepage mode: Only show one entry per unique tool route
      if (displayMode === 'homepage') {
           const uniqueRoutes = new Set<string>();
           const uniqueEntries: HistoryEntry[] = [];
           for (const entry of sorted) {
               if (!uniqueRoutes.has(entry.toolRoute) && uniqueEntries.length < limit) {
                   uniqueEntries.push(entry);
                   uniqueRoutes.add(entry.toolRoute);
               }
           }
           return uniqueEntries;
       }
       // Default (toolpage, no filter): Just limit
      return sorted.slice(0, limit);
  }, [history, limit, filterToolRoute, displayMode]);

  // Fetch metadata for displayed tools
  const fetchMetadata = useCallback(async (toolRoute: string) => {
    if (metadataCache[toolRoute] !== undefined) return; // Already fetched or fetching

    // Prevent fetching for non-tool routes if any slip through
    if (!toolRoute || !toolRoute.startsWith('/tool/')) return;

    const directive = toolRoute.substring(6); // Extract 'tool-directive' from '/tool/tool-directive/'
     if (!directive) {
          console.warn(`[RecentlyUsed] Could not extract directive from route: ${toolRoute}`);
          setMetadataCache(prev => ({ ...prev, [toolRoute]: null })); // Mark as failed
          return;
      }

    // Mark as fetching (or use null to indicate failed/pending)
    setMetadataCache(prev => ({ ...prev, [toolRoute]: null }));

    try {
      const response = await fetch(`/api/tool-metadata?directive=${encodeURIComponent(directive)}`);
      const data: MetadataApiResponse = await response.json();
      if (response.ok && data.success && data.metadata) {
        setMetadataCache(prev => ({ ...prev, [toolRoute]: data.metadata || null }));
      } else {
        throw new Error(data.error || `Failed to fetch metadata for ${directive}`);
      }
    } catch (fetchError: unknown) { // Use unknown
      console.error(`[RecentlyUsed] Error fetching metadata for ${toolRoute}:`, fetchError);
      setMetadataCache(prev => ({ ...prev, [toolRoute]: null })); // Mark as failed
    }
  }, [metadataCache]); // Depend on metadataCache to avoid re-fetching

  // Trigger metadata fetching when filtered history changes
  useEffect(() => {
    filteredHistory.forEach(entry => {
      fetchMetadata(entry.toolRoute);
    });
  }, [filteredHistory, fetchMetadata]);


  if (!isLoaded) {
    return (
        <div className={`p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] ${displayMode === 'homepage' ? 'mb-8' : ''}`}>
             <h2 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-muted))]">Recently Used</h2>
             <p className="text-sm text-[rgb(var(--color-text-muted))] italic animate-pulse">Loading history...</p>
         </div>
    );
  }

  if (history.length === 0 || filteredHistory.length === 0) {
      if (displayMode === 'toolpage') { // Only show "No recent activity" on toolpage mode
           return (
                <div className="p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))]">
                    <h3 className="text-md font-semibold mb-2 text-[rgb(var(--color-text-muted))]">Recent Activity</h3>
                    <p className="text-sm text-[rgb(var(--color-text-muted))] italic">No activity recorded for this tool yet.</p>
                </div>
           );
       }
       return null; // Don't render anything on homepage if history is empty
  }

  // Use const for items
  const items = filteredHistory.map(entry => (
    <RecentlyUsedItem key={entry.id} entry={entry} metadata={metadataCache[entry.toolRoute] || null} />
  ));


  return (
     <div className={`p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] ${displayMode === 'homepage' ? 'mb-8' : ''}`}>
        <div className="flex justify-between items-center mb-3">
           <h2 className="text-lg font-semibold text-[rgb(var(--color-text-muted))]">
               {filterToolRoute ? 'Recent Activity' : 'Recently Used'}
           </h2>
           {displayMode === 'homepage' && (
               <Link href="/history" className="text-sm text-[rgb(var(--color-text-link))] hover:underline">
                 View All
               </Link>
            )}
        </div>
       <div className="space-y-1">
         {items}
       </div>
     </div>
  );
}