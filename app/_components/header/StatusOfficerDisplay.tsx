// FILE: app/_components/header/StatusOfficerDisplay.tsx
'use client';

import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { getDefaultHomeNarrativeSync } from '@/app/lib/narrativeService';
import {
  CubeTransparentIcon,
  ShieldCheckIcon,
  EyeSlashIcon,
  CodeBracketSquareIcon,
  ArrowRightEndOnRectangleIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';

export type OfficerDisplayState =
  | 'hidden'
  | 'pending'
  | 'operational'
  | 'error';

interface StatusOfficerDisplayProps {
  displayState: OfficerDisplayState;
}

const FLICKER_SPEED_MULTIPLIER = 1;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StatusDot = ({ controls }: { controls: any }) => (
  <motion.div
    key="status-indicator-dot"
    className="h-3 w-3 rounded-full border border-white/40 shadow-sm"
    animate={controls}
    initial={{ backgroundColor: '#FBBF24', scale: 0, opacity: 0 }}
  />
);

export default function StatusOfficerDisplay({
  displayState,
}: StatusOfficerDisplayProps) {
  const officerNarrative = useMemo(() => getDefaultHomeNarrativeSync(), []);
  const dotControls = useAnimationControls();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [storageInfo, setStorageInfo] = useState<{
    usage: string;
    quota?: string;
  } | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };
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

  useEffect(() => {
    const flickerSequence = [
      {
        backgroundColor: '#1F2937',
        scale: 0.85,
        transition: { duration: 0.05 * FLICKER_SPEED_MULTIPLIER },
      },
      {
        backgroundColor: '#FBBF24',
        scale: 1.0,
        transition: { duration: 0.1 * FLICKER_SPEED_MULTIPLIER },
      },
      {
        backgroundColor: '#1F2937',
        scale: 0.85,
        transition: { duration: 0.05 * FLICKER_SPEED_MULTIPLIER },
      },
      {
        backgroundColor: '#FBBF24',
        scale: 1.0,
        transition: { duration: 0.1 * FLICKER_SPEED_MULTIPLIER },
      },
      {
        backgroundColor: '#1F2937',
        scale: 0.85,
        transition: { duration: 0.05 * FLICKER_SPEED_MULTIPLIER },
      },
    ];

    const animateDot = async () => {
      if (displayState === 'hidden') {
        await dotControls.start({
          opacity: 0,
          scale: 0.5,
          transition: { duration: 0.2 * FLICKER_SPEED_MULTIPLIER },
        });
        return;
      }
      await dotControls.start({
        backgroundColor: '#FBBF24',
        opacity: 1,
        scale: 1,
        transition: { duration: 0.15 * FLICKER_SPEED_MULTIPLIER },
      });
      if (displayState === 'pending') {
        dotControls.start({
          scale: [1, 1.08, 1],
          transition: {
            duration: 1.2 * FLICKER_SPEED_MULTIPLIER,
            repeat: Infinity,
            ease: 'easeInOut',
            repeatType: 'mirror',
          },
        });
      } else if (displayState === 'operational' || displayState === 'error') {
        dotControls.stop();
        await dotControls.start({ scale: 1, backgroundColor: '#FBBF24' });
        for (const step of flickerSequence) {
          await dotControls.start(step);
        }
        const finalColor =
          displayState === 'operational' ? '#16a34a' : '#dc2626';
        await dotControls.start({
          backgroundColor: finalColor,
          scale: 1,
          opacity: 1,
          transition: {
            duration: 0.2 * FLICKER_SPEED_MULTIPLIER,
            ease: 'easeOut',
          },
        });
      }
    };
    animateDot();
  }, [displayState, dotControls]);

  useEffect(() => {
    async function estimateStorage() {
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          if (estimate.usage !== undefined) {
            const usageMB = (estimate.usage / (1024 * 1024)).toFixed(2);
            const quotaMB = estimate.quota
              ? (estimate.quota / (1024 * 1024)).toFixed(0)
              : null;
            setStorageInfo({
              usage: `${usageMB} MB`,
              quota: quotaMB ? `${quotaMB} MB` : undefined,
            });
            setStorageError(null);
          } else {
            setStorageError('Usage data N/A');
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          console.warn('Storage estimate failed:', e);
          setStorageError('Error');
        }
      } else {
        setStorageError('Not Supported');
      }
    }

    if (displayState !== 'hidden') {
      estimateStorage();
    } else {
      setStorageInfo(null);
      setStorageError(null);
    }
  }, [displayState]);

  if (displayState === 'hidden') {
    return null;
  }

  const persona = officerNarrative || {
    epicCompanyEmployeeName: 'Status Monitor',
    epicCompanyEmployeeEmoji: '📡',
    epicCompanyJobTitle: 'System Check',
    epicCompanyEmployeeGithub: null,
    epicCompanyName: 'OET Internal',
    epicCompanyEmoji: '⚙️',
    epicNarrative: [],
  };

  const {
    epicCompanyEmployeeName: statusOfficerName,
    epicCompanyEmployeeEmoji: statusOfficerEmoji,
    epicCompanyJobTitle: statusOfficerJobTitle,
    epicCompanyEmployeeGithub: statusOfficerGithub,
  } = persona;

  const officerContent = (
    <>
      {statusOfficerEmoji && (
        <span className="mr-1.5 text-xl leading-none align-middle">
          {statusOfficerEmoji}
        </span>
      )}
      <div className="text-xs text-left">
        <span className="font-semibold block text-white whitespace-nowrap">
          {statusOfficerName}
        </span>
        {statusOfficerJobTitle && (
          <span className="block text-indigo-200 italic whitespace-nowrap text-[0.7rem]">
            {statusOfficerJobTitle}
          </span>
        )}
      </div>
      <div className="ml-2 flex items-center self-stretch">
        <StatusDot controls={dotControls} />
      </div>
    </>
  );

  const baseTitle = statusOfficerGithub
    ? `View ${statusOfficerName} (${statusOfficerJobTitle || 'Status'}) on GitHub`
    : `${statusOfficerName} (${statusOfficerJobTitle || 'Status'})`;

  const handleContainerClick = () => {
    toggleDropdown();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleContainerClick();
    }
  };

  const principles = [
    { text: 'Client-Side First', Icon: CubeTransparentIcon, key: 'client' },
    { text: 'Privacy Focused', Icon: ShieldCheckIcon, key: 'privacy' },
    { text: 'No Ads, No Tracking', Icon: EyeSlashIcon, key: 'no-ads' },
    {
      text: 'Free & Open Source',
      Icon: CodeBracketSquareIcon,
      key: 'open-source',
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className={`flex items-center p-1.5 bg-black bg-opacity-20 rounded-lg shadow hover:bg-opacity-30 transition-colors group cursor-pointer`}
        title={baseTitle}
        onClick={handleContainerClick}
        role={'button'}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-haspopup="true"
        aria-expanded={isDropdownOpen}
      >
        {officerContent}
      </div>
      {isDropdownOpen && (
        <div
          className="absolute right-0 mt-2 w-64 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg z-[60] animate-slide-down"
          role="menu"
          aria-orientation="vertical"
          tabIndex={-1}
        >
          <div
            className="py-1 divide-y divide-gray-100 dark:divide-gray-700"
            role="none"
          >
            {/* OET Ethos Section */}
            <div>
              <div className="px-4 pt-2 pb-1">
                {' '}
                {/* Adjusted pt-2 if storage info is not present, otherwise pt-3 from its wrapper */}
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  OET Ethos
                </p>
              </div>
              {principles.map((principle) => (
                <div
                  key={principle.key}
                  className="px-4 py-2 flex items-center text-sm text-gray-700 dark:text-gray-300"
                  role="menuitem"
                  aria-disabled="true"
                >
                  <principle.Icon className="h-5 w-5 mr-3 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                  <span>{principle.text}</span>
                </div>
              ))}
            </div>

            {(storageInfo || storageError) && (
              <div className="pb-1">
                <div className="px-4 pt-3 pb-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Storage Footprint
                  </p>
                </div>
                <div
                  className="px-4 py-2 flex items-center text-sm text-gray-700 dark:text-gray-300"
                  role="menuitem"
                  aria-disabled="true"
                >
                  <CircleStackIcon className="h-5 w-5 mr-3 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                  {storageInfo && (
                    <div className="flex-grow">
                      <span>
                        Usage: <strong>{storageInfo.usage}</strong>
                      </span>
                      {storageInfo.quota && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 block">
                          (Approx. Quota: {storageInfo.quota})
                        </span>
                      )}
                    </div>
                  )}
                  {storageError && (
                    <span
                      className={`text-xs italic ${storageError === 'Error' ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                      {storageError === 'Error'
                        ? 'Estimation Error'
                        : storageError}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Links Section */}
            <div className="pt-1 flex flex-col items-end">
              <a
                href={`https://github.com/Online-Everything-Tool`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                role="menuitem"
                tabIndex={-1}
                onClick={closeDropdown}
              >
                <span>OET on GitHub</span>
                <ArrowRightEndOnRectangleIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </a>
              {statusOfficerGithub && (
                <a
                  href={`https://github.com/${statusOfficerGithub}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={closeDropdown}
                >
                  <span>{statusOfficerGithub} on GitHub</span>
                  <ArrowRightEndOnRectangleIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
