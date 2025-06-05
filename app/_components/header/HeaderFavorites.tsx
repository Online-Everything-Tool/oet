// FILE: app/_components/header/HeaderFavorites.tsx

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useFavorites } from '@/app/context/FavoritesContext';
import { useMetadata } from '@/app/context/MetadataContext';
import {
  StarIcon as StarIconSolid,
  SparklesIcon,
} from '@heroicons/react/24/solid';
import Button from '@/app/tool/_components/form/Button';

interface LatestAdditionsData {
  header: string;
  subheader: string;
  directives: string[];
}

const titleClasses =
  'px-3 pt-3 pb-2 text-xs font-medium text-gray-500 uppercase tracking-wider';

export default function HeaderFavorites() {
  const { favorites, isLoaded: favoritesLoaded } = useFavorites();
  const { getToolMetadata, isLoading: metadataLoading } = useMetadata();
  const [latestAdditions, setLatestAdditions] =
    useState<LatestAdditionsData | null>(null);
  const [latestAdditionsLoading, setLatestAdditionsLoading] = useState(true);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const favoritesCount = favoritesLoaded ? favorites.length : 0;

  useEffect(() => {
    const fetchLatestAdditions = async () => {
      setLatestAdditionsLoading(true);
      try {
        const response = await fetch('/data/build/latest_additions.json');
        if (!response.ok) {
          if (response.status === 404) {
            console.warn(
              'latest_additions.json not found, skipping latest additions banner.'
            );
            setLatestAdditions(null);
            return;
          }
          throw new Error(
            `Failed to fetch latest additions: ${response.status}`
          );
        }
        const data: LatestAdditionsData = await response.json();
        if (data && data.directives && data.directives.length > 0) {
          setLatestAdditions(data);
        } else {
          console.warn('latest_additions.json is empty or has no directives.');
          setLatestAdditions(null);
        }
      } catch (error) {
        console.error(
          'Error fetching or parsing latest_additions.json:',
          error
        );
        setLatestAdditions(null);
      } finally {
        setLatestAdditionsLoading(false);
      }
    };
    fetchLatestAdditions();
  }, []);

  const toggleDropdown = useCallback(() => {
    if (!favoritesLoaded || metadataLoading || latestAdditionsLoading) return;
    setIsDropdownOpen((prev) => !prev);
  }, [favoritesLoaded, metadataLoading, latestAdditionsLoading]);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const handleEscKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    },
    [closeDropdown]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isDropdownOpen, closeDropdown, handleEscKey]);

  const LatestAdditionsBanner = () => {
    if (
      latestAdditionsLoading ||
      !latestAdditions ||
      latestAdditions.directives.length === 0
    ) {
      return null;
    }

    const toolsToShow = latestAdditions.directives.slice(0, 2);

    return (
      <div className="border-t border-gray-200 pt-1">
        <div className="px-3 pt-2.5 pb-1 flex flex-col gap-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {latestAdditions.header}
          </p>
          {latestAdditions.subheader && (
            <p className="text-xs text-gray-500 mb-1.5">
              {latestAdditions.subheader}
            </p>
          )}
        </div>
        {toolsToShow.map((directive) => {
          const metadata = getToolMetadata(directive);
          const title =
            metadata?.title ||
            directive
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (l) => l.toUpperCase());
          return (
            <Link
              key={directive}
              href={`/tool/${directive}/`}
              onClick={closeDropdown}
              className="group block px-3 py-2 transition-colors"
              title={`Check out: ${title}`}
            >
              <div className="flex items-center">
                <SparklesIcon className="h-5 w-5 text-gray-600 mr-2.5 transition-transform group-hover:scale-105 shrink-0" />
                <div className="flex-grow overflow-hidden">
                  <p className="text-sm font-medium text-gray-600 group-hover:text-gray-800 truncate">
                    {title}
                  </p>
                  {metadata?.description && (
                    <p className="text-xs text-gray-600 group-hover:text-gray-800 truncate">
                      {metadata.description.length > 45
                        ? metadata.description.substring(0, 43) + '...'
                        : metadata.description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
        {latestAdditions.directives.length > toolsToShow.length && (
          <div className="px-3 py-1.5 text-center">
            <em className="text-xs text-gray-400">...and more!</em>
          </div>
        )}
      </div>
    );
  };

  const isLoading =
    !favoritesLoaded || metadataLoading || latestAdditionsLoading;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Button
        isEmpty={true}
        onClick={toggleDropdown}
        disabled={isLoading}
        className="rounded bg-[rgba(255,255,255,0.2)] hover:!bg-[rgba(255,255,255,0.3)] relative text-white disabled:opacity-70 px-2.5 py-1.5"
        aria-label="View Favorites"
        title={isLoading ? 'Loading...' : 'View Favorites'}
        aria-haspopup="true"
        aria-expanded={isDropdownOpen}
        iconLeft={
          <StarIconSolid
            className={`h-5 w-5 transition-colors ${favoritesCount > 0 && favoritesLoaded ? 'text-yellow-400' : 'text-indigo-200 group-hover:text-yellow-300'}`}
          />
        }
      >
        {favoritesLoaded && favoritesCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold px-1 pointer-events-none transform translate-x-1/4 -translate-y-1/4 shadow"
            title={`${favoritesCount} favorite tool${favoritesCount === 1 ? '' : 's'}`}
            aria-hidden="true"
          >
            {favoritesCount > 9 ? '9+' : favoritesCount}
          </span>
        )}
        <span className="sr-only">Favorites ({favoritesCount} items)</span>
      </Button>

      {isDropdownOpen && !isLoading && (
        <div
          className="absolute right-0 mt-2 w-72 origin-top-right rounded-md bg-white shadow-xl z-[60] overflow-hidden flex flex-col animate-slide-down"
          role="menu"
          aria-orientation="vertical"
          tabIndex={-1}
        >
          <h2 className={titleClasses}>My Favorites</h2>
          <div
            className="py-1 max-h-60 overflow-y-auto custom-scrollbar"
            role="none"
          >
            {favorites.length > 0 ? (
              favorites.map((directive) => {
                const metadata = getToolMetadata(directive);
                const title =
                  metadata?.title ||
                  directive
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, (l) => l.toUpperCase());
                return (
                  <Link
                    key={directive}
                    href={`/tool/${directive}/`}
                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 truncate"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={closeDropdown}
                    title={title}
                  >
                    {title}
                  </Link>
                );
              })
            ) : (
              <p className="px-4 py-3 text-sm text-gray-500 italic text-center">
                No favorites yet.
                <br />
                Click the ☆ on a tool&apos;s page!
              </p>
            )}
          </div>
          <LatestAdditionsBanner />
        </div>
      )}
    </div>
  );
}
