// FILE: app/_components/header/HeaderBuildToolButton.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  WrenchScrewdriverIcon,
  LightBulbIcon,
  ArrowUpOnSquareIcon,
} from '@heroicons/react/24/solid';
import Button from '@/app/tool/_components/form/Button';

export default function HeaderBuildToolButton() {
  const router = useRouter();
  const pathname = usePathname();
  const isBuildPage = pathname.startsWith('/build/tool');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const goToBuildTool = () => {
    if (!isBuildPage) {
      router.push('/build/tool');
    }
    closeDropdown();
  };

  const goToSuggestions = () => {
    router.push('/build/tool?tab=suggestions');
    closeDropdown();
  };

  const goToUploadTool = () => {
    router.push('/build/tool?tab=upload');
    closeDropdown();
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Button
        onClick={goToBuildTool}
        disabled={false}
        className="rounded bg-[rgba(255,255,255,0.2)] hover:!bg-[rgba(255,255,255,0.4)] text-white disabled:opacity-70 px-2.5 py-1.5"
        aria-label="Build Tool Options"
        title="Build Tool Options"
        aria-haspopup="true"
        aria-expanded={isDropdownOpen}
        iconLeft={<WrenchScrewdriverIcon className="h-5 w-5" />}
      >
        <span className="hidden sm:inline ml-1">Build</span>
      </Button>

      {isDropdownOpen && (
        <div
          className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg focus:outline-none z-[60] animate-slide-down"
          role="menu"
          aria-orientation="vertical"
          tabIndex={-1}
        >
          <div className="py-1" role="none">
            <button
              onClick={goToBuildTool}
              disabled={isBuildPage}
              className="w-full text-left flex items-center px-4 py-2 text-sm text-[rgb(var(--color-text-emphasis))] hover:bg-[rgb(var(--color-bg-subtle-hover))] hover:text-[rgb(var(--color-text-base))] disabled:opacity-50 disabled:cursor-not-allowed"
              role="menuitem"
              tabIndex={-1}
            >
              <WrenchScrewdriverIcon className="h-5 w-5 mr-3 text-[rgb(var(--color-text-muted))]" />
              AI Tool Builder
            </button>
            <button
              onClick={goToSuggestions}
              className="w-full text-left flex items-center px-4 py-2 text-sm text-[rgb(var(--color-text-emphasis))] hover:bg-[rgb(var(--color-bg-subtle-hover))] hover:text-[rgb(var(--color-text-base))]"
              role="menuitem"
              tabIndex={-1}
            >
              <LightBulbIcon className="h-5 w-5 mr-3 text-[rgb(var(--color-text-muted))]" />
              Tool Suggestions
            </button>
            <button
              onClick={goToUploadTool}
              className="w-full text-left flex items-center px-4 py-2 text-sm text-[rgb(var(--color-text-emphasis))] hover:bg-[rgb(var(--color-bg-subtle-hover))] hover:text-[rgb(var(--color-text-base))]"
              role="menuitem"
              tabIndex={-1}
            >
              <ArrowUpOnSquareIcon className="h-5 w-5 mr-3 text-[rgb(var(--color-text-muted))]" />
              Upload Existing Tool
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
