// FILE: app/history/page.tsx
'use client';

import React from 'react';
import { useHistory } from '../context/HistoryContext'; // Uses updated context
import type { HistoryEntry, TriggerType } from '@/src/types/history'; // Uses updated types
import { useRouter } from 'next/navigation';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools'; // Keep ToolMetadata type
// Removed safeStringify import if not used, but let's keep JSON.stringify for preview

export default function HistoryPage() {
    const {
        history, // History state now contains updated HistoryEntry objects
        deleteHistoryEntry,
        clearHistory,
        isLoaded,
        isHistoryEnabled,
        toggleHistoryEnabled
    } = useHistory();
    const router = useRouter();

    // Format single event timestamp
    const formatEventTimestamp = (timestamp: number): string => {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'short',
            timeStyle: 'medium',
        }).format(new Date(timestamp));
    };

    // Format single trigger type
    const formatTriggerType = (trigger: TriggerType): string => {
       switch (trigger) {
            case 'click': return 'Manual Click'; // Slightly more descriptive
            case 'query': return 'URL Load';
            case 'auto': return 'Auto Execution';
            case 'transfer': return 'Data Transfer';
            case 'upload': return 'File Upload';
            default: return trigger; // Fallback for any future types
        }
    }

    // handleReload logic remains the same, fetching metadata and building URL
    const handleReload = async (entry: HistoryEntry) => {
        if (!entry.toolRoute || !entry.toolRoute.startsWith('/tool/')) {
            console.error("[Reload] Invalid toolRoute in history entry:", entry.toolRoute);
            alert("Cannot reload: Invalid tool route found in history.");
            return;
        }
        const directiveName = entry.toolRoute.substring('/tool/'.length).replace(/\/$/, '');
        if (!directiveName) {
             console.error("[Reload] Could not extract directive name from route:", entry.toolRoute);
             alert("Cannot reload: Could not determine tool directive from history.");
            return;
        }

        let metadata: ToolMetadata | undefined;
        try {
            const response = await fetch(`/api/tool-metadata/${directiveName}.json`);
            if (!response.ok) {
                if (response.status === 404) { throw new Error(`Metadata file not found for tool '${directiveName}'.`); }
                throw new Error(`Failed to fetch metadata (${response.status})`);
            }
            metadata = await response.json();
        } catch (error) {
            console.error("[Reload] Error fetching or parsing tool metadata:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            alert(`Could not load tool configuration: ${message}`);
            return;
        }

        const urlParamsConfig = metadata?.urlStateParams ?? [];
        if (urlParamsConfig.length === 0) {
            // Check if input is a simple string and tool supports it implicitly (less ideal)
            const firstStringParam = urlParamsConfig.find(p => p.type === 'string');
             if (typeof entry.input === 'string' && firstStringParam) {
                 const queryParams = new URLSearchParams();
                 queryParams.set(firstStringParam.paramName, entry.input);
                 const finalUrl = `${entry.toolRoute}?${queryParams.toString()}`;
                 console.log("[Reload] Navigating (simple string input):", finalUrl);
                 router.push(finalUrl);
                 return; // Exit after handling simple string case
             } else {
                 alert(`Reloading state is not supported for this tool or the history entry's input format.`);
                 return;
             }
        }

        // Proceed with object input logic
        const queryParams = new URLSearchParams();
        if (typeof entry.input !== 'object' || entry.input === null) {
            alert(`Cannot reload: History entry has unexpected input format for this tool's URL parameters.`);
            return;
        }

        const inputObject = entry.input as Record<string, unknown>;
        urlParamsConfig.forEach((paramConfig: ParamConfig) => {
            const paramNameKey = paramConfig.paramName;
            if (Object.prototype.hasOwnProperty.call(inputObject, paramNameKey)) {
                const value = inputObject[paramNameKey];
                if (value !== undefined) {
                     let valueString: string;
                     if (value === null) { valueString = 'null'; }
                     else if (typeof value === 'string') { valueString = value; }
                     else { try { valueString = JSON.stringify(value); } catch (e) { console.error(`[Reload] Error stringifying value for param '${paramNameKey}':`, value, e); valueString = ''; }}
                     if (valueString) { queryParams.set(paramConfig.paramName, valueString); }
                }
            }
        });

        const queryString = queryParams.toString();
        const finalUrl = `${entry.toolRoute}${queryString ? `?${queryString}` : ''}`;
        console.log("[Reload] Navigating to:", finalUrl);
        router.push(finalUrl);
    };


    // --- Render Logic ---
    return (
        <div className="space-y-6">
            {/* Header section with toggle and clear button remains the same */}
            <div className="flex flex-wrap justify-between items-center border-b pb-2 mb-4 gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Usage History</h1>
                 <div className="flex items-center gap-2 bg-gray-100 border border-gray-300 p-2 rounded-md">
                    <label htmlFor="history-toggle" className="w-10 text-sm font-medium text-gray-700 cursor-pointer select-none text-center"> Log </label>
                    <input
                        type="checkbox" id="history-toggle" role="switch"
                        checked={isHistoryEnabled} onChange={toggleHistoryEnabled} disabled={!isLoaded}
                        className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-gray-200 checked:bg-green-600"
                        aria-checked={isHistoryEnabled}
                    />
                     <span className={`text-sm w-15 font-semibold ${isHistoryEnabled ? 'text-green-700' : 'text-red-700'}`}>
                         {isHistoryEnabled ? 'Enabled' : 'Disabled'}
                     </span>
                 </div>
                <button onClick={clearHistory} disabled={!isLoaded || history.length === 0} className="px-4 py-2 rounded-md text-sm font-medium bg-[rgb(var(--color-button-danger-bg))] text-[rgb(var(--color-button-danger-text))] hover:bg-[rgb(var(--color-button-danger-hover-bg))] focus:outline-none focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 ease-in-out">
                     Clear All History
                 </button>
            </div>

            {/* Loading/Empty/Disabled states remain the same */}
            {!isLoaded && <p className="text-gray-500 italic">Loading history...</p>}
            {isLoaded && history.length === 0 && <p className="text-gray-500">No history recorded yet.</p>}
             {isLoaded && !isHistoryEnabled && history.length > 0 && (
                <p className="p-3 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-md text-sm">
                    History logging is currently disabled. Existing entries are shown below, but new actions will not be recorded until enabled.
                </p>
            )}

            {/* History List Rendering */}
            {isLoaded && history.length > 0 && (
                <ul className="space-y-4">
                    {/* Sort history by eventTimestamp descending for display */}
                    {history.sort((a, b) => b.eventTimestamp - a.eventTimestamp).map((entry: HistoryEntry) => {
                        const isToolPage = entry.toolRoute && entry.toolRoute.startsWith('/tool/');

                        return (
                            <li key={entry.id} className="p-4 border rounded-md shadow-sm bg-white flex justify-between items-start gap-4">
                                <div className="flex-grow overflow-hidden space-y-1">
                                    {/* Header: Tool Name and Timestamp */}
                                    <div className='flex justify-between items-center'>
                                        <p className="font-semibold text-gray-700 flex items-center gap-2">
                                            {entry.toolName}
                                            {/* Removed execution count display as timestamps array is gone */}
                                        </p>
                                        <p className="text-xs text-gray-400" title={`Event occurred at: ${new Date(entry.eventTimestamp).toLocaleString()}`}>
                                             {formatEventTimestamp(entry.eventTimestamp)} {/* Display formatted event time */}
                                        </p>
                                    </div>
                                    {/* Details: Trigger and Status */}
                                     <p className="text-xs text-gray-500">
                                        <span className='font-medium'>Trigger:</span> <code className='text-xs bg-gray-100 px-1 rounded'>{formatTriggerType(entry.trigger)}</code> |{' '}
                                        <span className={`font-medium ${entry.status === 'error' ? 'text-red-600' : 'text-green-600'}`}> Status: {entry.status || 'N/A'} </span>
                                    </p>
                                    {/* Input/Output display logic remains largely the same */}
                                    {entry.input !== undefined && entry.input !== null && (
                                        <div>
                                            <span className="text-xs font-medium text-gray-500">Input / Options:</span>
                                            <pre className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap break-words max-h-32">
                                                { typeof entry.input === 'object'
                                                    ? JSON.stringify(entry.input, null, 2)
                                                    : String(entry.input) }
                                            </pre>
                                        </div>
                                     )}
                                    {/* Output display based on status and type */}
                                    {entry.output !== undefined && entry.output !== null && (
                                         <div>
                                             <span className={`text-xs font-medium ${entry.status === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
                                                 {entry.status === 'error' ? 'Error Output:' : 'Output:'}
                                             </span>
                                             <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap break-words max-h-24 ${entry.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                                                 { typeof entry.output === 'object' ? JSON.stringify(entry.output, null, 2) : String(entry.output).substring(0, 500) + (String(entry.output).length > 500 ? '...' : '') }
                                             </pre>
                                         </div>
                                     )}
                                </div>
                                 {/* Actions: Reload and Delete */}
                                 <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                     <button onClick={() => handleReload(entry)} title={`Reload ${entry.toolName} with this state`} className="px-3 py-1 rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" disabled={!isToolPage} > Reload </button>
                                     <button onClick={() => deleteHistoryEntry(entry.id)} title="Delete this entry" className="px-3 py-1 rounded text-xs font-medium text-red-600 hover:bg-red-100 focus:outline-none"> Delete </button>
                                 </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}