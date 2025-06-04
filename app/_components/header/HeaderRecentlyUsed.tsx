// FILE: app/_components/header/HeaderRecentlyUsed.tsx
'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { usePathname } from 'next/navigation';
import { useRecentlyUsed } from '@/app/context/RecentlyUsedContext';
import RecentlyUsedToolsWidget from '@/app/_components/RecentlyUsedToolsWidget';
import { ListBulletIcon } from '@heroicons/react/24/solid';
import Button from '@/app/tool/_components/form/Button';

export default function HeaderRecentlyUsed() {
  const pathname = usePathname();
  const { recentTools, isLoaded: recentsLoaded } = useRecentlyUsed();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentToolDirective = useMemo(() => {
    if (pathname.startsWith('/tool/')) {
      return pathname.split('/tool/')[1]?.replace(/\/$/, '');
    }
    return undefined;
  }, [pathname]);

  const headerRecentToolsCount = useMemo(() => {
    if (!recentsLoaded) return 0;
    return recentTools.filter((tool) => tool.directive !== currentToolDirective)
      .length;
  }, [recentTools, recentsLoaded, currentToolDirective]);

  const toggleDropdown = useCallback(() => {
    if (!recentsLoaded) return;
    setIsDropdownOpen((prev) => !prev);
  }, [recentsLoaded]);

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
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isDropdownOpen, closeDropdown]);

  const isLoading = !recentsLoaded;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Button
        isEmpty={true}
        onClick={toggleDropdown}
        disabled={isLoading}
        className="rounded bg-[rgba(255,255,255,0.2)] relative hover:!bg-[rgba(255,255,255,0.4)] text-white disabled:opacity-70 px-2.5 py-1.5"
        aria-label="View Recently Used Tools"
        title={
          isLoading
            ? 'Loading Recent Tools...'
            : headerRecentToolsCount === 0
              ? 'No other recent tools to show'
              : 'View Recently Used Tools'
        }
        aria-haspopup="true"
        aria-expanded={isDropdownOpen}
        iconLeft={<ListBulletIcon className="h-5 w-5" />}
      >
        {recentsLoaded && headerRecentToolsCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-green-600 text-white text-[10px] font-bold px-1 pointer-events-none transform translate-x-1/4 -translate-y-1/4 shadow"
            title={`${headerRecentToolsCount} other recent tool${headerRecentToolsCount === 1 ? '' : 's'}`}
            aria-hidden="true"
          >
            {headerRecentToolsCount > 9 ? '9+' : headerRecentToolsCount}
          </span>
        )}
        <span className="sr-only">
          Recently Used ({headerRecentToolsCount} items)
        </span>
      </Button>

      {recentsLoaded && (
        <div
          className={`absolute right-0 mt-2 w-72 md:w-80 origin-top-right z-[60] 
                     ${isDropdownOpen ? 'block animate-slide-down' : 'hidden'}`}
          onClick={(e) => e.stopPropagation()}
          aria-hidden={!isDropdownOpen}
        >
          <RecentlyUsedToolsWidget
            key="status-recent-builds-dropdown-widget"
            currentToolDirectiveToExclude={currentToolDirective}
            onItemClick={closeDropdown}
          />
        </div>
      )}
    </div>
  );
}
