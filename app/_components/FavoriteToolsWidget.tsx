// --- FILE: app/_components/FavoriteToolsWidget.tsx ---
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useFavorites } from '../context/FavoritesContext';
import type { ToolMetadata } from '@/src/types/tools';

// Component to display a single favorite item
interface FavoriteItemProps {
    directive: string;
    metadata: ToolMetadata | null | undefined; // Allow undefined during loading
}

const FavoriteItem = React.memo(({ directive, metadata }: FavoriteItemProps) => {
    const title = metadata?.title ?? directive.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Fallback title
    const href = `/tool/${directive}/`;

    return (
        <Link
            href={href}
            className="block p-3 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-subtle))] hover:bg-[rgba(var(--color-border-base)/0.1)] hover:border-[rgb(var(--color-text-link))] transition-colors duration-150"
        >
            <h3 className="text-base font-semibold text-[rgb(var(--color-text-link))] mb-1 truncate" title={title}>
                {title}
            </h3>
            {metadata ? (
                <p className="text-xs text-[rgb(var(--color-text-muted))] line-clamp-2" title={metadata.description}>
                    {metadata.description}
                </p>
            ) : (
                 <p className="text-xs text-[rgb(var(--color-text-muted))] italic animate-pulse">Loading details...</p>
             )}
        </Link>
    );
});
FavoriteItem.displayName = 'FavoriteItem';


// Main Widget Component
export default function FavoriteToolsWidget() {
  const { favorites, isLoaded: favoritesLoaded } = useFavorites();
  const [metadataCache, setMetadataCache] = useState<Record<string, ToolMetadata | null>>({});
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Fetch metadata for favorited tools
  const fetchMetadata = useCallback(async (directive: string) => {
    if (metadataCache[directive] !== undefined) return; // Already fetched or fetching

    // Mark as fetching/pending by setting to null initially
    setMetadataCache(prev => ({ ...prev, [directive]: null }));

    try {
      const response = await fetch(`/api/tool-metadata/${directive}.json`);
      if (response.ok) {
        const data: ToolMetadata = await response.json();
        setMetadataCache(prev => ({ ...prev, [directive]: data }));
      } else {
         if (response.status === 404) console.warn(`[FavWidget] Metadata not found for ${directive}`);
         else console.error(`[FavWidget] Failed to fetch metadata for ${directive} (${response.status})`);
         setMetadataCache(prev => ({ ...prev, [directive]: null })); // Indicate fetch failed
      }
    } catch (fetchError: unknown) {
      console.error(`[FavWidget] Error fetching metadata for ${directive}:`, fetchError);
      setMetadataCache(prev => ({ ...prev, [directive]: null })); // Indicate fetch failed
    }
  }, [metadataCache]); // Dependency on metadataCache to prevent re-fetching triggered by its own update

  // Effect to trigger metadata fetching when favorites list changes
  useEffect(() => {
    if (!favoritesLoaded || favorites.length === 0) return;

    const directivesToFetch = favorites.filter(dir => metadataCache[dir] === undefined);

    if (directivesToFetch.length > 0) {
        setIsLoadingMetadata(true);
        Promise.all(directivesToFetch.map(fetchMetadata)).finally(() => {
             // Check if still loading after fetches complete (some might have failed)
            const stillLoading = favorites.some(dir => metadataCache[dir] === undefined);
            setIsLoadingMetadata(stillLoading);
        });
    } else {
        // No new directives to fetch, ensure loading state is false
        setIsLoadingMetadata(false);
    }
  }, [favorites, favoritesLoaded, metadataCache, fetchMetadata]);

  // Loading State for the whole widget
  if (!favoritesLoaded) {
    return (
      <div className="p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] mb-8">
        <h2 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-muted))]">Favorites</h2>
        <p className="text-sm text-[rgb(var(--color-text-muted))] italic animate-pulse">Loading favorites...</p>
      </div>
    );
  }

  // Empty State
  if (favorites.length === 0) {
    return (
      <div className="p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] mb-8">
        <h2 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-muted))]">Favorites</h2>
        <p className="text-sm text-[rgb(var(--color-text-muted))] italic text-center py-4">
           You haven't favorited any tools yet. Click the ☆ on a tool's page to add it!
        </p>
      </div>
    );
  }

  // Render the list/grid of favorites
  const favoriteItems = favorites.map(directive => (
    <FavoriteItem
      key={directive}
      directive={directive}
      metadata={metadataCache[directive]} // Pass cached metadata (could be null or ToolMetadata)
    />
  ));

  return (
    <div className="p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] mb-8">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">
          Favorites ({favorites.length})
        </h2>
        {/* Optional: Add a link to a dedicated favorites page if needed later */}
        {/* <Link href="/favorites" className="text-sm text-[rgb(var(--color-text-link))] hover:underline">View All</Link> */}
      </div>
       {/* Grid layout for favorites */}
       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {favoriteItems}
       </div>
       {isLoadingMetadata && (
           <p className="text-xs text-center text-gray-400 italic pt-2">Loading details...</p>
       )}
    </div>
  );
}
// --- END FILE: app/_components/FavoriteToolsWidget.tsx ---