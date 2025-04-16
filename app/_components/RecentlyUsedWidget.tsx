// FILE: app/_components/RecentlyUsedWidget.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useHistory } from '../context/HistoryContext';
import type { HistoryEntry } from '@/src/types/history'
import RecentlyUsedItem from './RecentlyUsedItem'; // Import the new component
import { ToolMetadata } from '@/src/types/tools'

// Note: No MetadataApiResponse interface needed now, we fetch direct JSON

interface RecentlyUsedWidgetProps {
  limit: number;
  filterToolRoute?: string; // Optional: Filter history by a specific tool route
  displayMode: 'homepage' | 'toolpage'; // Control layout variations
}

export default function RecentlyUsedWidget({ limit, filterToolRoute, displayMode }: RecentlyUsedWidgetProps) {
  const { history, isLoaded } = useHistory();
  const [metadataCache, setMetadataCache] = useState<Record<string, ToolMetadata | null>>({});

  const filteredHistory = useMemo(() => {
      const sorted = history.sort((a, b) => b.timestamps[0] - a.timestamps[0]);
      if (filterToolRoute) {
          return sorted.filter(entry => entry.toolRoute === filterToolRoute).slice(0, limit);
      }
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
      return sorted.slice(0, limit);
  }, [history, limit, filterToolRoute, displayMode]);

  // Fetch metadata for displayed tools - UPDATED FETCH LOGIC
  const fetchMetadata = useCallback(async (toolRoute: string) => {
    if (metadataCache[toolRoute] !== undefined) return;

    if (!toolRoute || !toolRoute.startsWith('/tool/')) return;

    const directive = toolRoute.substring('/tool/'.length).replace(/\/$/, '');
     if (!directive) {
          console.warn(`[RecentlyUsed] Could not extract directive from route: ${toolRoute}`);
          setMetadataCache(prev => ({ ...prev, [toolRoute]: null }));
          return;
      }

    // Mark as fetching/pending
    setMetadataCache(prev => ({ ...prev, [toolRoute]: null }));

    try {
      // Fetch the static JSON file directly
      const response = await fetch(`/api/tool-metadata/${directive}.json`);

      if (response.ok) {
        const data: ToolMetadata = await response.json(); // Expect direct ToolMetadata object
        setMetadataCache(prev => ({ ...prev, [toolRoute]: data || null }));
      } else {
         // Handle 404 or other errors specifically if needed
         if (response.status === 404) {
              console.warn(`[RecentlyUsed] Metadata file not found for ${directive} at /api/tool-metadata/${directive}.json`);
         } else {
              throw new Error(`Failed to fetch metadata for ${directive} (${response.status})`);
         }
         setMetadataCache(prev => ({ ...prev, [toolRoute]: null })); // Mark as failed if not OK
      }
    } catch (fetchError: unknown) {
      console.error(`[RecentlyUsed] Error fetching metadata for ${toolRoute}:`, fetchError);
      setMetadataCache(prev => ({ ...prev, [toolRoute]: null })); // Mark as failed
    }
  }, [metadataCache]);

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
      if (displayMode === 'toolpage') {
           return (
                <div className="p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))]">
                    <h3 className="text-md font-semibold mb-2 text-[rgb(var(--color-text-muted))]">Recent Activity</h3>
                    <p className="text-sm text-[rgb(var(--color-text-muted))] italic">No activity recorded for this tool yet.</p>
                </div>
           );
       }
       return null;
  }

  // Render logic using RecentlyUsedItem (Unchanged)
  const items = filteredHistory.map(entry => (
    <RecentlyUsedItem
      key={entry.id}
      entry={entry}
      metadata={metadataCache[entry.toolRoute] || null}
      displayMode={displayMode}
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
        {displayMode === 'homepage' ? (
            <div className="flex space-x-4 overflow-x-auto py-2">
                 {items}
             </div>
        ) : (
            <div className="space-y-1">
                 {items}
            </div>
        )}
     </div>
  );
}