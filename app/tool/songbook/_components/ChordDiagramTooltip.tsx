// FILE: app/tool/songbook/_components/ChordDiagramTooltip.tsx
'use client';
import React from 'react';

interface ChordDiagramTooltipProps {
  chordName: string;
  fingering: string | null;
  tuning?: string[];
  position: { top: number; left: number } | null;
}

export const DEFAULT_TUNING = ['E', 'A', 'D', 'G', 'B', 'E'];

export default function ChordDiagramTooltip({
  chordName,
  fingering,
  tuning = DEFAULT_TUNING,
  position,
}: ChordDiagramTooltipProps) {
  if (!position || !fingering || !chordName) return null;

  const strings = fingering.split('');

  return (
    <div
      className="absolute -translate-y-28 -translate-x-15 z-[70] p-2 bg-white border border-[rgb(var(--color-border-emphasis))] rounded shadow-lg text-xs text-[rgb(var(--color-text-base))] font-mono"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="font-bold text-center text-lg">{chordName}</div>
      <div className="flex items-start">
        {tuning.map((stringName, index) => (
          <div key={stringName + index} className="flex flex-col items-center">
            <span className="font-semibold px-px text-lg">
              {strings[index] || '-'}
            </span>
            <span className="text-[rgb(var(--color-text-muted))] px-px text-lg">
              {stringName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
