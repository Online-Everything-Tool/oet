// FILE: app/_components/header/HeaderRecentBuilds.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import RecentBuildsWidget from '@/app/_components/RecentBuildsWidget';
import { BellAlertIcon } from '@heroicons/react/24/solid';
import Button from '@/app/tool/_components/form/Button';

export default function HeaderRecentBuilds() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasRecentBuilds = true;
  const isLoadingBuilds = false;

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

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

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Button
        onClick={toggleDropdown}
        disabled={isLoadingBuilds && !hasRecentBuilds}
        className="rounded bg-[rgba(255,255,255,0.2)] hover:!bg-[rgba(255,255,255,0.4)] text-white disabled:opacity-70 px-2.5 py-1.5"
        aria-label="View Recent Tool Builds"
        title={
          isLoadingBuilds
            ? 'Loading Recent Builds...'
            : 'View Recent Tool Builds & Merges'
        }
        aria-haspopup="true"
        aria-expanded={isDropdownOpen}
        iconLeft={<BellAlertIcon className="h-5 w-5" />}
      >
        <span className="hidden sm:inline ml-1">Pipeline</span>
      </Button>
      <div
        className={`absolute px-2 right-0 mt-2 w-72 md:w-80 origin-top-right rounded-md bg-white text-[rgb(var(--color-text-emphasis))] shadow-xl z-[60]
 ${isDropdownOpen ? 'block animate-slide-down' : 'hidden'}`}
        onClick={(e) => e.stopPropagation()}
        aria-hidden={!isDropdownOpen}
      >
        <RecentBuildsWidget onItemClick={closeDropdown} />
      </div>
    </div>
  );
}
