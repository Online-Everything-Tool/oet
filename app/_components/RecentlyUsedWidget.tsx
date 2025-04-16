// FILE: app/_components/RecentlyUsedWidget.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useHistory, HistoryEntry } from '../context/HistoryContext';
// Removed formatDistanceToNowStrict import as it's now in RecentlyUsedItem
import RecentlyUsedItem from './RecentlyUsedItem'; // Import the new component

// Define expected structure for tool metadata fetched from API (Interface remains the same)
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

// Memoized Item Component REMOVED from here

export default function RecentlyUsedWidget({ limit, filterToolRoute, displayMode }: RecentlyUsedWidgetProps) {
  const { history, isLoaded } = useHistory();
  const [metadataCache, setMetadataCache] = useState<Record<string, ToolMetadata | null>>({});

  // Filter history entries based on the optional filterToolRoute (Logic remains the same)
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

  // Fetch metadata for displayed tools (Logic remains the same)
  const fetchMetadata = useCallback(async (toolRoute: string) => {
    if (metadataCache[toolRoute] !== undefined) return; // Already fetched or fetching

    // Prevent fetching for non-tool routes if any slip through
    if (!toolRoute || !toolRoute.startsWith('/tool/')) return;

    const directive = toolRoute.substring('/tool/'.length).replace(/\/$/, ''); // Extract 'tool-directive'
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

  // Trigger metadata fetching when filtered history changes (Logic remains the same)
  useEffect(() => {
    filteredHistory.forEach(entry => {
      fetchMetadata(entry.toolRoute);
    });
  }, [filteredHistory, fetchMetadata]);


  // Loading State (Unchanged)
  if (!isLoaded) {
    return (
        <div className={`p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] ${displayMode === 'homepage' ? 'mb-8' : ''}`}>
             <h2 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-muted))]">Recently Used</h2>
             <p className="text-sm text-[rgb(var(--color-text-muted))] italic animate-pulse">Loading history...</p>
         </div>
    );
  }

  // Empty State (Unchanged)
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

  // --- UPDATED Render logic ---
  // Use the new RecentlyUsedItem component
  const items = filteredHistory.map(entry => (
    <RecentlyUsedItem
      key={entry.id}
      entry={entry}
      metadata={metadataCache[entry.toolRoute] || null}
      displayMode={displayMode} // Pass displayMode down
    />
  ));

  return (
     <div className={`p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] ${displayMode === 'homepage' ? 'mb-8' : ''}`}>
        <div className="flex justify-between items-center mb-3">
           <h2 className="text-lg font-semibold text-[rgb(var(--color-text-muted))]">
               {displayMode === 'homepage' ? 'Recently Used' : 'Recent Activity'}
           </h2>
           {displayMode === 'homepage' && (
               <Link href="/history" className="text-sm text-[rgb(var(--color-text-link))] hover:underline">
                 View All
               </Link>
            )}
        </div>
        {/* Conditionally wrap items for homepage layout */}
        {displayMode === 'homepage' ? (
            <div className="flex space-x-4 overflow-x-auto py-2"> {/* Horizontal scroll container */}
                 {items}
             </div>
        ) : (
            <div className="space-y-1"> {/* Original vertical layout for toolpage */}
                 {items}
            </div>
        )}
     </div>
  );
}