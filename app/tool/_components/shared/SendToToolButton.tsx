// FILE: app/tool/_components/shared/SendToToolButton.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useItdeDiscovery from '../../_hooks/useItdeDiscovery';
import { signalTargetTool } from '@/app/lib/sessionStorageUtils';
import type { OutputConfig, DiscoveredTarget } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import Button from '../form/Button';
import { PaperAirplaneIcon, ChevronDownIcon } from '@heroicons/react/20/solid';

interface SendToToolButtonProps {
  currentToolDirective: string;
  currentToolOutputConfig: OutputConfig;
  selectedOutputItems?: StoredFile[];
  buttonText?: string;
  className?: string;
}

export default function SendToToolButton({
  currentToolDirective,
  currentToolOutputConfig,
  selectedOutputItems,
  buttonText = 'Send To...',
  className = '',
}: SendToToolButtonProps) {
  const router = useRouter();
  const discoveredTargets = useItdeDiscovery({
    currentToolDirective,
    currentToolOutputConfig,
    selectedOutputItems,
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasTargets = discoveredTargets.length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleToggleDropdown = () => {
    if (hasTargets) {
      setIsDropdownOpen((prev) => !prev);
    }
  };

  const handleSelectTarget = (target: DiscoveredTarget) => {
    console.log(
      `[SendToToolButton] User selected target: ${target.title} (${target.directive})`
    );
    signalTargetTool(target.directive, currentToolDirective);
    setIsDropdownOpen(false);
    router.push(target.route);
  };

  return (
    <div
      className={`relative inline-block text-left ${className}`}
      ref={dropdownRef}
    >
      <Button
        variant="secondary"
        onClick={handleToggleDropdown}
        disabled={!hasTargets}
        iconLeft={
          <PaperAirplaneIcon className="h-5 w-5 transform -rotate-45" />
        }
        iconRight={
          hasTargets ? <ChevronDownIcon className="h-5 w-5" /> : undefined
        }
        aria-haspopup="true"
        aria-expanded={isDropdownOpen}
        title={
          hasTargets
            ? "Send this tool's output to another tool"
            : 'No compatible tools found to send output'
        }
      >
        {buttonText}
      </Button>

      {isDropdownOpen && hasTargets && (
        <div
          className="absolute right-0 z-20 mt-2 w-72 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none max-h-80 overflow-y-auto"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="send-to-tool-button"
        >
          <div className="py-1" role="none">
            {discoveredTargets.map((target) => (
              <button
                key={target.directive}
                onClick={() => handleSelectTarget(target)}
                className="w-full text-left block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150"
                role="menuitem"
                tabIndex={-1}
              >
                <div className="font-medium text-[rgb(var(--color-text-link))]">
                  {target.title}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {target.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {isDropdownOpen && !hasTargets && (
        <div
          className="absolute right-0 z-20 mt-2 w-72 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          role="alert"
        >
          <div className="px-4 py-3 text-sm text-gray-500 italic">
            No compatible tools found for this output.
          </div>
        </div>
      )}
    </div>
  );
}
