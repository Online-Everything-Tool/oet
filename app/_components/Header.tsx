// FILE: app/_components/Header.tsx
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useFavorites } from '@/app/context/FavoritesContext';
import { useRecentlyUsed } from '@/app/context/RecentlyUsedContext';
import RecentlyUsedToolsWidget from './RecentlyUsedToolsWidget';
import RecentBuildsWidget from './RecentBuildsWidget';
import { useFullscreenFocus } from '@/app/context/FullscreenFocusContext';

import {
  ListBulletIcon,
  StarIcon as StarIconSolid,
  WrenchIcon,
  BellAlertIcon,
} from '@heroicons/react/24/solid';
import Button from '@/app/tool/_components/form/Button';

export default function Header() {
  const { isFocusMode } = useFullscreenFocus();

  const router = useRouter();
  const pathname = usePathname();

  const { favorites, isLoaded: favoritesLoaded } = useFavorites();
  const { recentTools, isLoaded: recentsLoaded } = useRecentlyUsed();

  const [showFavoritesDropdown, setShowFavoritesDropdown] = useState(false);
  const [showRecentsDropdown, setShowRecentsDropdown] = useState(false);
  const [showRecentBuildsDropdown, setShowRecentBuildsDropdown] =
    useState(false);

  const favoritesDropdownRef = useRef<HTMLDivElement>(null);
  const recentsDropdownRef = useRef<HTMLDivElement>(null);
  const recentBuildsDropdownRef = useRef<HTMLDivElement>(null);

  const favoritesCount = favoritesLoaded ? favorites.length : 0;
  const isBuildPage = pathname.startsWith('/build-tool');
  const isToolPage = pathname.startsWith('/tool/');

  const currentToolDirective = useMemo(() => {
    if (isToolPage) {
      return pathname.split('/tool/')[1]?.replace(/\/$/, '');
    }
    return undefined;
  }, [pathname, isToolPage]);

  const headerRecentTools = useMemo(() => {
    if (!recentsLoaded) return [];
    return recentTools
      .filter((tool) => tool.directive !== currentToolDirective)
      .slice(0, 5);
  }, [recentTools, recentsLoaded, currentToolDirective]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        favoritesDropdownRef.current &&
        !favoritesDropdownRef.current.contains(event.target as Node)
      ) {
        setShowFavoritesDropdown(false);
      }
      if (
        recentsDropdownRef.current &&
        !recentsDropdownRef.current.contains(event.target as Node)
      ) {
        setShowRecentsDropdown(false);
      }
      if (
        recentBuildsDropdownRef.current &&
        !recentBuildsDropdownRef.current.contains(event.target as Node)
      ) {
        setShowRecentBuildsDropdown(false);
      }
    }

    if (!isFocusMode) {

      document.addEventListener('mousedown', handleClickOutside);
    } else {

      closeAllDropdowns();
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFocusMode]);

  const closeAllDropdowns = () => {
    setShowFavoritesDropdown(false);
    setShowRecentsDropdown(false);
    setShowRecentBuildsDropdown(false);
  };

  const buildTool = () => {
    if (isBuildPage) return;
    closeAllDropdowns();
    router.push('/build-tool/');
  };

  const toggleFavoritesDropdown = () => {
    if (isFocusMode) return;
    setShowFavoritesDropdown((prev) => !prev);
    if (showRecentsDropdown) setShowRecentsDropdown(false);
    if (showRecentBuildsDropdown) setShowRecentBuildsDropdown(false);
  };

  const toggleRecentsDropdown = () => {
    if (isFocusMode) return;
    setShowRecentsDropdown((prev) => !prev);
    if (showFavoritesDropdown) setShowFavoritesDropdown(false);
    if (showRecentBuildsDropdown) setShowRecentBuildsDropdown(false);
  };

  const toggleRecentBuildsDropdown = () => {
    if (isFocusMode) return;
    setShowRecentBuildsDropdown((prev) => !prev);
    if (showFavoritesDropdown) setShowFavoritesDropdown(false);
    if (showRecentsDropdown) setShowRecentsDropdown(false);
  };

  const headerBaseClasses =
    'bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] shadow-md transition-all duration-300 ease-in-out';
  const stickyClasses = 'sticky top-0 z-50';
  const focusModeClasses = 'relative';

  return (
    <header
      className={`${headerBaseClasses} ${!isFocusMode ? stickyClasses : focusModeClasses}`}
    >
      {/* 
        If !isFocusMode, the full nav is shown. 
        If isFocusMode is true, you could opt to show nothing, or a minimal bar.
        For now, we render the nav but its stickiness is controlled by the outer header's class.
        If you want the NAV ITSELF to disappear, you'd do:
        {!isFocusMode && ( <nav> ... </nav> )}
      */}
      <nav
        className={`container mx-auto max-w-6xl px-4 py-3 flex justify-between items-center ${isFocusMode ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {/* Added opacity and pointer-events none to nav content in focus mode for a softer effect than fully hiding */}
        <Link
          href="/"
          className={`text-xl font-bold hover:text-indigo-200 transition-colors duration-200 ${isFocusMode ? 'cursor-default' : ''}`}
          onClick={(e) => {
            if (isFocusMode)
              e.preventDefault();
            else closeAllDropdowns();
          }}
        >
          OET
        </Link>
        <div className="flex items-center space-x-1 md:space-x-2">
          {/* Recent Builds Dropdown */}
          <div className="relative inline-block" ref={recentBuildsDropdownRef}>
            <Button
              onClick={toggleRecentBuildsDropdown}
              disabled={isFocusMode}
              className="rounded bg-[rgba(255,255,255,0.2)] hover:!bg-[rgba(255,255,255,0.4)] text-white"
              aria-label="View Recent Tool Builds"
              title="View Recent Tool Builds & Merges"
              aria-haspopup="true"
              aria-expanded={showRecentBuildsDropdown}
              iconLeft={<BellAlertIcon className="h-5 w-5" />}
            >
              <span className="hidden sm:inline ml-1">Recent</span>
            </Button>
            {!isFocusMode &&
              showRecentBuildsDropdown && (
                <div
                  className="absolute right-0 mt-2 w-64 md:w-72 origin-top-right rounded-md bg-white text-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RecentBuildsWidget
                    onItemClick={closeAllDropdowns}
                    variant="headerDropdown"
                  />
                </div>
              )}
          </div>

          {/* Build Tool Button */}
          <Button
            onClick={buildTool}
            disabled={isBuildPage || isFocusMode}
            className="rounded bg-[rgba(255,255,255,0.2)] hover:!bg-[rgba(255,255,255,0.4)] text-white"
            aria-label="Build Tool"
            title={
              isBuildPage
                ? 'Currently on Build Tool page'
                : 'Build AI Assisted Tool'
            }
            iconLeft={<WrenchIcon className="h-5 w-5" />}
          >
            <span className="hidden sm:inline ml-1">Build Tool</span>
          </Button>

          {/* Recently Used Tools Dropdown */}
          <div className="relative inline-block" ref={recentsDropdownRef}>
            <Button
              onClick={toggleRecentsDropdown}
              disabled={
                !recentsLoaded || headerRecentTools.length === 0 || isFocusMode
              }
              className="rounded bg-[rgba(255,255,255,0.2)] relative hover:!bg-[rgba(255,255,255,0.4)] text-white"
              aria-label="View Recently Used Tools"
              title="View Recently Used Tools"
              aria-haspopup="true"
              aria-expanded={showRecentsDropdown}
            >
              <ListBulletIcon className="h-5 w-5" />
              {recentsLoaded && headerRecentTools.length > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-green-500 text-white text-[10px] font-bold px-1 pointer-events-none transform translate-x-1/4 -translate-y-1/4"
                  title={`${headerRecentTools.length} other recent tools`}
                  aria-hidden="true"
                >
                  {headerRecentTools.length}
                </span>
              )}
              <span className="sr-only">
                Recently Used ({headerRecentTools.length} items)
              </span>
            </Button>
            {!isFocusMode &&
              showRecentsDropdown &&
              headerRecentTools.length > 0 && (
                <div
                  className="absolute right-0 mt-2 w-auto origin-top-right z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RecentlyUsedToolsWidget
                    variant="header"
                    currentToolDirectiveToExclude={currentToolDirective}
                    onItemClick={closeAllDropdowns}
                  />
                </div>
              )}
          </div>

          {/* Favorites Dropdown */}
          <div className="relative inline-block" ref={favoritesDropdownRef}>
            <Button
              onClick={toggleFavoritesDropdown}
              disabled={!favoritesLoaded || isFocusMode}
              className="rounded bg-[rgba(255,255,255,0.2)] hover:!bg-[rgba(255,255,255,0.4)] relative text-white"
              aria-label="View Favorites"
              title="View Favorites"
              aria-haspopup="true"
              aria-expanded={showFavoritesDropdown}
            >
              <StarIconSolid
                className={`h-5 w-5 transition-colors ${favoritesCount > 0 ? 'text-yellow-400' : 'text-indigo-200 hover:text-yellow-300'}`}
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
            {!isFocusMode &&
              showFavoritesDropdown && (
                <div
                  className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 py-1 text-gray-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div role="menu" aria-orientation="vertical" tabIndex={-1}>
                    {favoritesLoaded && favorites.length > 0 ? (
                      favorites.map((directive) => (
                        <Link
                          key={directive}
                          href={`/tool/${directive}/`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 truncate"
                          role="menuitem"
                          tabIndex={-1}
                          onClick={closeAllDropdowns}
                        >
                          {directive
                            .replace(/-/g, ' ')
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
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
        </div>{' '}
        {/* End of flex items-center space-x-1 md:space-x-2 */}
      </nav>
    </header>
  );
}
