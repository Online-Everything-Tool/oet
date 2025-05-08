// FILE: app/_components/Header.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHistory } from '@/app/context/HistoryContext';
import { useFavorites } from '@/app/context/FavoritesContext';

import { StarIcon, ListBulletIcon } from '@heroicons/react/24/solid';

import Button from '@/app/tool/_components/form/Button';

export default function Header() {
  const { history, isLoaded: historyLoaded } = useHistory();
  const { favorites, isLoaded: favoritesLoaded } = useFavorites();
  const [showFavoritesDropdown, setShowFavoritesDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const historyCount = historyLoaded ? history.length : 0;
  const favoritesCount = favoritesLoaded ? favorites.length : 0;
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isToolPage = pathname.startsWith('/tool/');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowFavoritesDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownRef]);

  const toggleFavoritesDropdown = () => {
    setShowFavoritesDropdown((prev) => !prev);
  };

  const formatDirectiveTitle = (directive: string): string => {
    return directive
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const isCurrentlyFavorite = favoritesLoaded && favorites.length > 0;

  return (
    <header className="bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] shadow-md sticky top-0 z-50">
      <nav className="container mx-auto max-w-6xl px-4 py-3 flex justify-between items-center">
        {/* OET Logo/Link (remains a simple Link) */}
        <Link
          href="/"
          className="text-xl font-bold hover:text-indigo-200 transition-colors duration-200"
        >
          OET
        </Link>

        {/* Right side controls */}
        <div className="flex items-center space-x-1 md:space-x-2">
          {/* Build Tool Link (Conditional - styled Link) */}
          {isHome && (
            <Link
              href="/build-tool/"
              className="hidden sm:inline-block text-sm font-medium hover:text-indigo-200 transition-colors duration-200 px-3 py-1.5 rounded hover:bg-[rgba(255,255,255,0.1)]"
            >
              Build Tool
            </Link>
          )}

          {/* Favorites Button (Conditional - uses custom Button) */}
          {isToolPage && (
            <div className="relative inline-block" ref={dropdownRef}>
              <Button
                variant="link"
                onClick={toggleFavoritesDropdown}
                disabled={!favoritesLoaded}
                className="!px-2 !py-1 rounded hover:!bg-[rgba(255,255,255,0.1)] relative"
                aria-label="View Favorites"
                title="View Favorites"
                aria-haspopup="true"
                aria-expanded={showFavoritesDropdown}
              >
                <StarIcon
                  className={`h-5 w-5 transition-colors ${isCurrentlyFavorite ? 'text-yellow-400' : 'text-indigo-200 hover:text-yellow-300'}`}
                  aria-hidden="true"
                />
                {favoritesLoaded && favoritesCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 pointer-events-none transform translate-x-1/4 -translate-y-1/4"
                    title={`${favoritesCount} favorite tools`}
                    aria-hidden="true"
                  >
                    {favoritesCount > 9 ? '9+' : favoritesCount}
                  </span>
                )}
                <span className="sr-only">
                  Favorites ({favoritesCount} items)
                </span>
              </Button>

              {/* Dropdown Menu (logic remains the same) */}
              {showFavoritesDropdown && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 py-1">
                  <div
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="favorites-menu-button"
                    tabIndex={-1}
                  >
                    {favoritesLoaded && favorites.length > 0 ? (
                      favorites.map((directive) => (
                        <Link
                          key={directive}
                          href={`/tool/${directive}/`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 truncate"
                          role="menuitem"
                          tabIndex={-1}
                          onClick={() => setShowFavoritesDropdown(false)}
                        >
                          {formatDirectiveTitle(directive)}
                        </Link>
                      ))
                    ) : (
                      <p className="px-4 py-2 text-sm text-gray-500 italic">
                        No favorites yet.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Link (Styled Link) */}
          <Link
            href="/history"
            className="relative inline-flex items-center justify-center text-sm font-medium hover:text-indigo-200 transition-colors duration-200 px-2 py-1 rounded hover:bg-[rgba(255,255,255,0.1)]"
            aria-label="View History"
            title="View History"
          >
            <ListBulletIcon
              className="h-5 w-5 text-indigo-200"
              aria-hidden="true"
            />
            {historyLoaded && historyCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-yellow-400 text-gray-900 text-[10px] font-bold px-1 pointer-events-none transform translate-x-1/4 -translate-y-1/4"
                title={`${historyCount} history entries`}
                aria-hidden="true"
              >
                {historyCount > 99 ? '99+' : historyCount}
              </span>
            )}
            <span className="sr-only">History ({historyCount} items)</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
