// --- FILE: app/_components/FavoriteToolsWidget.tsx ---
'use client';

import React from 'react';
import Link from 'next/link';
import { useMetadata } from '../context/MetadataContext';
import { useFavorites } from '../context/FavoritesContext';
import type { ToolMetadata } from '@/src/types/tools';

interface FavoriteItemProps {
  directive: string;
  metadata: ToolMetadata | null | undefined;
}

const FavoriteItem = React.memo(
  ({ directive, metadata }: FavoriteItemProps) => {
    const title =
      metadata?.title ??
      directive.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const href = `/tool/${directive}/`;

    return (
      <Link
        href={href}
        className="block p-3 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-subtle))] hover:bg-[rgba(var(--color-border-base)/0.1)] hover:border-[rgb(var(--color-text-link))] transition-colors duration-150"
      >
        <h3
          className="text-base font-semibold text-[rgb(var(--color-text-link))] mb-1 truncate"
          title={title}
        >
          {title}
        </h3>
        {metadata ? (
          <p
            className="text-xs text-[rgb(var(--color-text-muted))] line-clamp-2"
            title={metadata.description}
          >
            {metadata.description}
          </p>
        ) : (
          <p className="text-xs text-[rgb(var(--color-text-muted))] italic animate-pulse">
            Loading details...
          </p>
        )}
      </Link>
    );
  }
);
FavoriteItem.displayName = 'FavoriteItem';

export default function FavoriteToolsWidget() {
  const { isLoading, getToolMetadata } = useMetadata();
  const { favorites, isLoaded: favoritesLoaded } = useFavorites();

  if (!favoritesLoaded || isLoading) {
    return (
      <div className="p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] mb-8">
        <h2 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-muted))]">
          Favorites
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-muted))] italic animate-pulse">
          Loading favorites...
        </p>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] mb-8">
        <h2 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-muted))]">
          Favorites
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-muted))] italic text-center py-4">
          You haven&apos;t favorited any tools yet. Click the ☆ on a tool&apos;s
          page to add it!
        </p>
      </div>
    );
  }

  const favoriteItems = favorites.map((directive) => {
    const metadata = getToolMetadata(directive);
    return (
      <FavoriteItem key={directive} directive={directive} metadata={metadata} />
    );
  });

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
    </div>
  );
}
