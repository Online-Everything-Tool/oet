// FILE: app/_components/header/StatusOfficerDisplay.tsx
'use client';

import React, { useEffect, useMemo } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { getDefaultHomeNarrativeSync } from '@/app/lib/narrativeService';

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
          displayState === 'operational' ? '#10B981' : '#EF4444';
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

  const handleClick = () => {
    if (statusOfficerGithub && typeof window !== 'undefined') {
      window.open(
        `https://github.com/${statusOfficerGithub}`,
        '_blank',
        'noopener,noreferrer'
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`flex items-center p-1.5 bg-black bg-opacity-20 rounded-lg shadow hover:bg-opacity-30 transition-colors group ${statusOfficerGithub || true ? 'cursor-pointer' : 'cursor-default'}`}
      title={baseTitle}
      onClick={handleClick}
      role={statusOfficerGithub ? 'link' : 'button'}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {officerContent}
    </div>
  );
}
