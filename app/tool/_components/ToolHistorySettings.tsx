// FILE: app/tool/_components/ToolHistorySettings.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useHistory } from '../../context/HistoryContext';
import type { LoggingPreference } from '@/src/types/tools';

interface ToolHistorySettingsProps {
  toolRoute: string;
}

/**
 * A reusable component to display and control history logging preferences
 * for a specific tool, intended to be placed inside a dialog or similar container.
 */
export default function ToolHistorySettings({
  toolRoute,
}: ToolHistorySettingsProps) {
  const {
    isHistoryEnabled,
    getToolLoggingPreference,
    setToolLoggingPreference,
    isLoaded,
  } = useHistory();

  // Initialize with a sensible default before loading, like the global default
  const [currentToolPreference, setCurrentToolPreference] =
    useState<LoggingPreference>(() => {
      // Temporarily read from localStorage directly ONLY for initial render
      // This avoids flicker but duplicates logic slightly. HistoryContext handles the 'real' state.
      try {
        const storedSettings = localStorage.getItem('oetSettings_v1');
        if (storedSettings) {
          const parsed = JSON.parse(storedSettings);
          if (parsed?.toolPreferences?.[toolRoute]) {
            return parsed.toolPreferences[toolRoute];
          }
        }
      } catch {
        /* Ignore errors during initial read */
      }
      // If nothing found or error, fallback to global default
      // NOTE: This does NOT fetch the metadata default on initial render, HistoryContext handles that later.
      return 'on'; // Assuming global default is 'on'
    });

  // Effect to sync with the actual preference from HistoryContext once loaded
  useEffect(() => {
    if (isLoaded) {
      setCurrentToolPreference(getToolLoggingPreference(toolRoute));
    }
  }, [isLoaded, toolRoute, getToolLoggingPreference]);

  const handlePreferenceChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newPref = event.target.value as LoggingPreference;
    if (isLoaded && ['on', 'restrictive', 'off'].includes(newPref)) {
      setCurrentToolPreference(newPref); // Update local state immediately for responsiveness
      setToolLoggingPreference(toolRoute, newPref); // Let HistoryContext handle saving/logic
    }
  };

  const isDisabled = !isHistoryEnabled || !isLoaded;
  const disabledReason = !isHistoryEnabled
    ? 'History logging is disabled globally. Enable it on the main History page to manage per-tool settings.'
    : !isLoaded
      ? 'Settings loading...'
      : '';

  return (
    // Add title attribute for tooltip effect when disabled
    <div
      className={`space-y-4 ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      title={disabledReason}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">History Logging:</p>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${isHistoryEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
        >
          Global Status: {isHistoryEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <fieldset className="mt-2" disabled={isDisabled}>
        <legend className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
          For This Tool:
        </legend>
        <div className="flex flex-col gap-2 mt-1">
          {/* Option: On */}
          <div className="flex items-center">
            <input
              id={`history-pref-${toolRoute}-on`}
              name={`history-pref-${toolRoute}`} // Group radios
              type="radio"
              value="on"
              checked={currentToolPreference === 'on'}
              onChange={handlePreferenceChange}
              disabled={isDisabled}
              // Apply Tailwind classes for styling, focus, and accent color
              // CHANGED TO GREEN
              className="h-4 w-4 border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed accent-green-600"
            />
            <label
              htmlFor={`history-pref-${toolRoute}-on`}
              className={`ml-2 block text-sm ${isDisabled ? 'text-gray-400' : 'text-gray-700'} select-none ${!isDisabled ? 'cursor-pointer' : ''}`}
            >
              {/* CHANGED TO GREEN */}
              On{' '}
              <span className="text-green-600 font-semibold">
                (Log Input & Output)
              </span>
            </label>
          </div>

          {/* Option: Restrictive */}
          <div className="flex items-center">
            <input
              id={`history-pref-${toolRoute}-restrictive`}
              name={`history-pref-${toolRoute}`}
              type="radio"
              value="restrictive"
              checked={currentToolPreference === 'restrictive'}
              onChange={handlePreferenceChange}
              disabled={isDisabled}
              // CHANGED TO ORANGE
              className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed accent-orange-600"
            />
            <label
              htmlFor={`history-pref-${toolRoute}-restrictive`}
              className={`ml-2 block text-sm ${isDisabled ? 'text-gray-400' : 'text-gray-700'} select-none ${!isDisabled ? 'cursor-pointer' : ''}`}
            >
              {/* CHANGED TO ORANGE */}
              Restrictive{' '}
              <span className="text-orange-600">
                (Log Input, Redact Output)
              </span>
            </label>
          </div>

          {/* Option: Off */}
          <div className="flex items-center">
            <input
              id={`history-pref-${toolRoute}-off`}
              name={`history-pref-${toolRoute}`}
              type="radio"
              value="off"
              checked={currentToolPreference === 'off'}
              onChange={handlePreferenceChange}
              disabled={isDisabled}
              // KEPT AS RED
              className="h-4 w-4 border-gray-300 text-red-600 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed accent-red-600"
            />
            <label
              htmlFor={`history-pref-${toolRoute}-off`}
              className={`ml-2 block text-sm ${isDisabled ? 'text-gray-400' : 'text-gray-700'} select-none ${!isDisabled ? 'cursor-pointer' : ''}`}
            >
              {/* KEPT AS RED */}
              Off{' '}
              <span className="text-red-600 font-semibold">(Log Nothing)</span>
            </label>
          </div>
        </div>
      </fieldset>

      <p className="text-xs text-gray-500 pt-1 italic">
        Choose what gets saved to local history for this specific tool. Global
        setting overrides this if disabled.
      </p>
    </div>
  );
}
