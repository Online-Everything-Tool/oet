// FILE: app/tool/_components/shared/SendToToolButton.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useItdeDiscovery from '../../_hooks/useItdeDiscovery';
import { signalTargetTool } from '@/app/lib/sessionStorageUtils';
import type { OutputConfig, DiscoveredTarget } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import Button from '../form/Button';
import {
  PaperAirplaneIcon,
  ChevronDownIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/20/solid';

interface SendToToolButtonProps {
  currentToolDirective: string;
  currentToolOutputConfig: OutputConfig;
  selectedOutputItems?: StoredFile[];
  onBeforeSignal?: () => Promise<boolean | void>;
  buttonText?: string;
  className?: string;
}

export default function SendToToolButton({
  currentToolDirective,
  currentToolOutputConfig,
  selectedOutputItems,
  onBeforeSignal,
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
  const [isPreDispatching, setIsPreDispatching] = useState(false);
  const [preDispatchError, setPreDispatchError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasTargets = discoveredTargets.length > 0;
  const isDisabledOverall = !hasTargets || isPreDispatching;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        setPreDispatchError(null);
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
    if (isDisabledOverall && !isDropdownOpen) return;
    setIsDropdownOpen((prev) => !prev);
    if (isDropdownOpen) setPreDispatchError(null);
  };

  const handleSelectTarget = async (target: DiscoveredTarget) => {
    setPreDispatchError(null);
    setIsDropdownOpen(false);

    if (onBeforeSignal) {
      setIsPreDispatching(true);
      try {
        const proceed = await onBeforeSignal();
        if (proceed === false) {
          setIsPreDispatching(false);
          return;
        }
      } catch (error) {
        setPreDispatchError(
          error instanceof Error
            ? error.message
            : 'Preparation for sending failed.'
        );
        setIsPreDispatching(false);
        return;
      }
      setIsPreDispatching(false);
    }

    signalTargetTool(target.directive, currentToolDirective);
    router.push(target.route);
  };

  const buttonTitle = preDispatchError
    ? `Error: ${preDispatchError}`
    : isPreDispatching
      ? 'Preparing to send...'
      : isDisabledOverall && !isDropdownOpen
        ? 'No compatible tools found or data not ready'
        : hasTargets
          ? "Send this tool's output to another tool"
          : 'No compatible tools found for this output';

  return (
    <div
      className={`relative inline-block text-left ${className}`}
      ref={dropdownRef}
    >
      <Button
        variant="accent"
        onClick={handleToggleDropdown}
        disabled={isDisabledOverall && !isDropdownOpen}
        iconLeft={
          isPreDispatching ? undefined : preDispatchError ? (
            <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
          ) : (
            <PaperAirplaneIcon className="h-5 w-5 transform -rotate-45" />
          )
        }
        iconRight={
          hasTargets && !isPreDispatching && !preDispatchError ? (
            <ChevronDownIcon className="h-5 w-5" />
          ) : undefined
        }
        aria-haspopup="true"
        aria-expanded={isDropdownOpen}
        title={buttonTitle}
        isLoading={isPreDispatching}
        loadingText="Preparing..."
      >
        {preDispatchError ? 'Error' : isPreDispatching ? undefined : buttonText}
      </Button>

      {isDropdownOpen && (
        <div
          className="absolute mt-1 right-0 z-20 w-72 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none max-h-80 overflow-y-auto"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="send-to-tool-button"
        >
          {preDispatchError && (
            <div
              className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200"
              role="alert"
            >
              <p className="font-semibold">Preparation Error:</p>
              <p>{preDispatchError}</p>
            </div>
          )}
          {!preDispatchError && hasTargets && (
            <div className="py-1" role="none">
              {discoveredTargets.map((target) => (
                <Button
                  key={target.directive}
                  onClick={() => handleSelectTarget(target)}
                  fullWidth
                  className="!justify-start !text-left !block !w-full !px-4 !py-3 !text-sm !text-gray-700 !bg-gray-250 hover:!bg-gray-100 hover:!text-gray-900 !transition-colors !duration-150 !shadow-none !border-none !rounded-none"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={isPreDispatching}
                >
                  <div className="font-medium text-[rgb(var(--color-text-link))]">
                    {target.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {target.description}
                  </div>
                </Button>
              ))}
            </div>
          )}
          {!preDispatchError && !hasTargets && (
            <div className="px-4 py-3 text-sm text-gray-500 italic">
              No compatible tools found for this output.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
