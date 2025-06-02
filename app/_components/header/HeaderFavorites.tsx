// FILE: app/_components/header/HeaderFavorites.tsx

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useFavorites } from '@/app/context/FavoritesContext';
import { useMetadata } from '@/app/context/MetadataContext';
import {
  StarIcon as StarIconSolid,
  LightBulbIcon,
} from '@heroicons/react/24/solid';
import Button from '@/app/tool/_components/form/Button';

export default function HeaderFavorites() {
  const { favorites, isLoaded: favoritesLoaded } = useFavorites();
  const { getToolMetadata, isLoading: metadataLoading } = useMetadata();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const favoritesCount = favoritesLoaded ? favorites.length : 0;

  const toggleDropdown = useCallback(() => {
    if (!favoritesLoaded || metadataLoading) return;
    setIsDropdownOpen((prev) => !prev);
  }, [favoritesLoaded, metadataLoading]);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

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
  }, [isDropdownOpen, closeDropdown]);

  const handleEscKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    },
    [closeDropdown]
  );

  const NewToolBanner = () => (
    <div className="px-3 py-2.5 border-t border-gray-200 bg-indigo-50 hover:bg-indigo-100 transition-colors">
      <Link
        href="/tool/build"
        onClick={closeDropdown}
        className="group block"
        title="Create a new tool with AI assistance"
      >
        <div className="flex items-center">
          <LightBulbIcon className="h-5 w-5 text-indigo-500 mr-2 transition-transform group-hover:scale-105" />
          <div>
            <p className="text-sm font-semibold text-indigo-700 group-hover:text-indigo-800">
              Build a New Tool!
            </p>
            <p className="text-xs text-indigo-600 group-hover:text-indigo-700">
              AI-assisted tool creation.
            </p>
          </div>
        </div>
      </Link>
    </div>
  );

  const isLoading = !favoritesLoaded || metadataLoading;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Button
        onClick={toggleDropdown}
        disabled={isLoading}
        className="rounded bg-[rgba(255,255,255,0.2)] hover:!bg-[rgba(255,255,255,0.3)] relative text-white disabled:opacity-70 px-2.5 py-1.5"
        aria-label="View Favorites"
        title={isLoading ? 'Loading Favorites...' : 'View Favorites'}
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
          className="absolute right-0 mt-2 w-64 origin-top-right rounded-md bg-white shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-[60] overflow-hidden flex flex-col animate-slide-down"
          role="menu"
          aria-orientation="vertical"
          tabIndex={-1}
        >
          <div
            className="py-1 max-h-72 overflow-y-auto custom-scrollbar"
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
          <NewToolBanner />
        </div>
      )}
    </div>
  );
}
