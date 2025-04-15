// FILE: app/t/_components/ToolHistorySettings.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useHistory, LoggingPreference } from '../../context/HistoryContext'; // Ensure correct path
import '@shoelace-style/shoelace/dist/components/radio-group/radio-group.js';
import '@shoelace-style/shoelace/dist/components/radio/radio.js';
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';

interface ToolHistorySettingsProps {
    toolRoute: string;
}

/**
 * A reusable component to display and control history logging preferences
 * for a specific tool, intended to be placed inside a dialog or similar container.
 */
export default function ToolHistorySettings({ toolRoute }: ToolHistorySettingsProps) {
    const {
        isHistoryEnabled,
        getToolLoggingPreference,
        setToolLoggingPreference,
        isLoaded // Use isLoaded to prevent setting preference before context is ready
    } = useHistory();

    // Local state to manage the radio button selection reflects the context
    // Defaults to 'restrictive', matching the context default
    const [currentToolPreference, setCurrentToolPreference] = useState<LoggingPreference>('restrictive');

    // Effect to sync local state with context state when loaded or toolRoute changes
    useEffect(() => {
        if (isLoaded) {
            const preferenceFromContext = getToolLoggingPreference(toolRoute);
            // console.log(`[ToolHistorySettings ${toolRoute}] Syncing Effect: Context loaded. Pref from context: ${preferenceFromContext}`);
            setCurrentToolPreference(preferenceFromContext);
        } else {
            // console.log(`[ToolHistorySettings ${toolRoute}] Syncing Effect: Context NOT loaded yet.`);
        }
    }, [isLoaded, toolRoute, getToolLoggingPreference]); // Dependency on isLoaded is key

    // Handler for radio button changes
    const handlePreferenceChange = (event: CustomEvent) => {
        console.log('fired'); // <-- Your added console log
        // Shoelace components often emit events with details in `event.target.value`
        const newPref = (event.target as HTMLInputElement).value as LoggingPreference;
        // console.log(`[ToolHistorySettings ${toolRoute}] Handle Change: New value selected: ${newPref}, isLoaded: ${isLoaded}`);
        // Double-check isLoaded before setting context state, though UI should be disabled anyway
        if (isLoaded && ['on', 'restrictive', 'off'].includes(newPref)) {
            setCurrentToolPreference(newPref); // Update local state immediately for UI feedback
            setToolLoggingPreference(toolRoute, newPref); // Update the context state
        } else {
            // console.warn(`[ToolHistorySettings ${toolRoute}] Change ignored. isLoaded: ${isLoaded}, newPref: ${newPref}`);
        }
    };

    // Determine tooltip content based on global history status
    const fieldsetTooltipContent = !isHistoryEnabled
        ? "History logging is disabled globally. Enable it on the main History page to manage per-tool settings."
        : "";

    // console.log(`[ToolHistorySettings ${toolRoute}] Rendering with currentToolPreference: ${currentToolPreference}, isLoaded: ${isLoaded}, isHistoryEnabled: ${isHistoryEnabled}`);

    return (
        // Removed outer div, assuming the parent dialog provides padding/structure
        <div className={`space-y-4 ${!isHistoryEnabled ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">History Logging:</p>
                 <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isHistoryEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    Global Status: {isHistoryEnabled ? 'Enabled' : 'Disabled'}
                 </span>
            </div>

            <sl-tooltip content={fieldsetTooltipContent} hoist>
                {/* The value prop is bound to the local state `currentToolPreference` */}
                <sl-radio-group
                    label="For This Tool:"
                    name="tool-log-pref"
                    value={currentToolPreference}
                    onSl-change={handlePreferenceChange} // Use Shoelace's change event
                    className={!isHistoryEnabled ? 'cursor-not-allowed' : ''}
                    // Styling for the Shoelace label part
                    style={{ '--sl-label-font-size': 'var(--sl-font-size-small)', '--sl-label-color': 'rgb(var(--color-text-muted))' }}
                >
                    <div className="flex flex-col gap-2 mt-1"> {/* Vertical layout for radios */}
                        {/* Option: On (Log All) */}
                        <sl-radio
                            value="on"
                            disabled={!isHistoryEnabled || !isLoaded}
                        >
                             {/* Using span for styling the label text */}
                             <span className={`ml-1 ${!isHistoryEnabled || !isLoaded ? 'text-gray-400' : 'text-gray-700'} cursor-pointer select-none`}>
                                On <span className='text-orange-600 font-semibold'>(Log Input & Output)</span>
                             </span>
                         </sl-radio>

                        {/* Option: Restrictive (Log Inputs Only - Default) */}
                        <sl-radio
                            value="restrictive"
                            disabled={!isHistoryEnabled || !isLoaded}
                        >
                            <span className={`ml-1 ${!isHistoryEnabled || !isLoaded ? 'text-gray-400' : 'text-gray-700'} cursor-pointer select-none`}>
                                Restrictive <span className='text-gray-500'>(Log Input Only - Default)</span>
                             </span>
                         </sl-radio>

                        {/* Option: Off (Log Nothing) */}
                        <sl-radio
                            value="off"
                            disabled={!isHistoryEnabled || !isLoaded}
                        >
                            <span className={`ml-1 ${!isHistoryEnabled || !isLoaded ? 'text-gray-400' : 'text-gray-700'} cursor-pointer select-none`}>
                                Off <span className='text-red-600 font-semibold'>(Log Nothing)</span>
                             </span>
                         </sl-radio>
                     </div>
                </sl-radio-group>
            </sl-tooltip>
            <p className="text-xs text-gray-500 pt-1 italic">
                Choose what gets saved to your browser's local history for this specific tool. Global setting overrides this if disabled.
            </p>
        </div>
    );
}