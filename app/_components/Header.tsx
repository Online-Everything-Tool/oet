// --- FILE: app/_components/Header.tsx ---
'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHistory } from '@/app/context/HistoryContext';
import { useFavorites } from '@/app/context/FavoritesContext';

export default function Header() {
  const { history, isLoaded: historyLoaded } = useHistory();
  const { favorites, isLoaded: favoritesLoaded } = useFavorites();
  const [showFavoritesDropdown, setShowFavoritesDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const historyCount = historyLoaded ? history.length : 0;
  const favoritesCount = favoritesLoaded ? favorites.length : 0;
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isToolPage = pathname.startsWith('/tool/'); // Check if it's a tool page

  // Close dropdown if clicking outside
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

  // Function to generate simple link title from directive
  const formatDirectiveTitle = (directive: string): string => {
    return directive
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <header className="bg-[rgb(var(--color-button-primary-bg))] text-white shadow-md sticky top-0 z-50">
      <nav className="container mx-auto max-w-6xl px-4 py-3 flex justify-between items-center">
        {/* Logo/Home Link */}
        <Link href="/" passHref legacyBehavior>
          <a className="text-xl font-bold hover:text-indigo-200 transition-colors duration-200">
            OET
          </a>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Build Tool Link */}
          {isHome && (
            <Link href="/build-tool" passHref legacyBehavior>
              <a className="hidden sm:inline-block text-sm font-medium hover:text-indigo-200 transition-colors duration-200 px-3 py-1 rounded hover:bg-[rgba(255,255,255,0.1)]">
                Build Tool
              </a>
            </Link>
          )}
          {/* --- Conditional Favorites Dropdown Wrapper --- */}
          {isToolPage && ( // Only render if on a /tool/ page
            <div className="relative inline-block" ref={dropdownRef}>
              <button
                type="button"
                onClick={toggleFavoritesDropdown}
                className={`px-2 py-1 text-sm font-medium rounded hover:bg-[rgba(255,255,255,0.1)] flex items-center transition-colors duration-200 ${showFavoritesDropdown ? 'bg-[rgba(255,255,255,0.1)]' : ''}`}
                aria-label="View Favorites"
                title="View Favorites"
                aria-haspopup="true"
                aria-expanded={showFavoritesDropdown}
                disabled={!favoritesLoaded}
              >
                <span
                  className="text-yellow-400"
                  style={{ fontSize: '1.5rem' }}
                  aria-hidden="true"
                >
                  {favoritesLoaded && favoritesCount > 0 ? '★' : '☆'}
                </span>
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
              </button>

              {/* Dropdown Menu */}
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
                          onClick={() => setShowFavoritesDropdown(false)} // Close on click
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
          )}{' '}
          {/* End Conditional Rendering */}
          {/* --- End Conditional Favorites Dropdown Wrapper --- */}
          {/* History Link Wrapper */}
          <div className="relative inline-block">
            <Link
              href="/history"
              className="px-2 py-1 text-sm font-medium rounded hover:bg-[rgba(255,255,255,0.1)] flex items-center transition-colors duration-200"
              aria-label="View History"
              title="View History"
            >
              <span style={{ fontSize: '1.75rem' }} aria-hidden="true">
                📝
              </span>
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
        </div>
      </nav>
    </header>
  );
}
// --- END FILE: app/_components/Header.tsx ---
