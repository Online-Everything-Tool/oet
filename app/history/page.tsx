// FILE: app/history/page.tsx
'use client';

import React from 'react';
import { useHistory } from '../context/HistoryContext';
import type { HistoryEntry } from '../context/HistoryContext';
import { useRouter } from 'next/navigation';
import type { ParamConfig } from '@/app/t/_hooks/useToolUrlState';

interface ToolMetadata {
    title?: string;
    description?: string;
    urlStateParams?: ParamConfig[];
    [key: string]: unknown;
}

interface MetadataApiResponse {
    success: boolean;
    metadata?: ToolMetadata;
    error?: string;
}


export default function HistoryPage() {
    // --- Destructure new context values ---
    const {
        history,
        deleteHistoryEntry,
        clearHistory,
        isLoaded,
        isHistoryEnabled,
        toggleHistoryEnabled
    } = useHistory();
    // --- End Destructure ---
    const router = useRouter();

    const formatTimestamp = (timestamp: number): string => {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'short',
            timeStyle: 'medium',
        }).format(new Date(timestamp));
    };

    const handleDelete = (id: string) => {
        deleteHistoryEntry(id);
    };

    const handleClearAll = () => {
        clearHistory();
    };

    const handleReload = async (entry: HistoryEntry) => {
        console.log(`[Reload] Attempting to reload state for: ${entry.toolRoute}`);
        console.log(`[Reload] History Entry Data (new structure):`, entry);

        if (!entry.toolRoute || !entry.toolRoute.startsWith('/t/')) {
            console.error("[Reload] Invalid toolRoute in history entry:", entry.toolRoute);
            alert("Cannot reload: Invalid tool route found in history.");
            return;
        }

        const directiveName = entry.toolRoute.substring(3);
        if (!directiveName) {
             console.error("[Reload] Could not extract directive name from route:", entry.toolRoute);
             alert("Cannot reload: Could not determine tool directive from history.");
            return;
        }

        let metadata: ToolMetadata | undefined;
        try {
            console.log(`[Reload] Fetching metadata for directive: ${directiveName}`);
            const response = await fetch(`/api/tool-metadata?directive=${encodeURIComponent(directiveName)}`);
            const data: MetadataApiResponse = await response.json();

            if (!response.ok || !data.success || !data.metadata) {
                throw new Error(data.error || `Failed to fetch metadata (${response.status})`);
            }
            metadata = data.metadata;
            console.log("[Reload] Metadata fetched:", metadata);

        } catch (error) {
            console.error("[Reload] Error fetching or parsing tool metadata:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            alert(`Could not load tool configuration: ${message}`);
            return;
        }

        const urlParamsConfig = metadata?.urlStateParams ?? [];
        if (urlParamsConfig.length === 0) {
            console.log(`[Reload] No urlStateParams defined in metadata for ${directiveName}. Reload not supported.`);
            alert(`Reloading state is not supported for this tool as it does not define URL parameters.`);
            return;
        }

        const queryParams = new URLSearchParams();

        if (typeof entry.input !== 'object' || entry.input === null) {
             console.error(`[Reload] Expected entry.input to be an object, but found:`, typeof entry.input, entry.input);
             alert(`Cannot reload: History entry has unexpected input format.`);
             return;
        }

        console.log(`[Reload] Processing ${urlParamsConfig.length} urlStateParams...`);
        const inputObject = entry.input as Record<string, unknown>;

        urlParamsConfig.forEach((paramConfig: ParamConfig) => {
            const paramNameKey = paramConfig.paramName;
            console.log(`[Reload] Looking for param: '${paramNameKey}' (Type: ${paramConfig.type}) in entry.input object.`);

            if (Object.prototype.hasOwnProperty.call(inputObject, paramNameKey)) {
                const value = inputObject[paramNameKey];
                console.log(`[Reload] -> Found value for '${paramNameKey}' in entry.input:`, value);

                if (value !== undefined) {
                     let valueString: string;
                     if (value === null) {
                         valueString = 'null';
                     } else if (typeof value === 'string') {
                         valueString = value;
                     } else {
                         try {
                             valueString = JSON.stringify(value);
                         } catch (e) {
                             console.error(`[Reload] Error stringifying value for param '${paramNameKey}':`, value, e);
                             valueString = '';
                         }
                     }
                     console.log(`[Reload] -> Setting query param: ${paramConfig.paramName}=${valueString}`);
                     queryParams.set(paramConfig.paramName, valueString);
                } else {
                    console.log(`[Reload] -> Value for param '${paramNameKey}' is undefined. Skipping.`);
                }
            } else {
                 console.log(`[Reload] -> Key '${paramNameKey}' NOT FOUND in entry.input object. Skipping.`);
            }
        });

        const queryString = queryParams.toString();
        const finalUrl = `${entry.toolRoute}${queryString ? `?${queryString}` : ''}`;

        console.log(`[Reload] Navigating to final URL: ${finalUrl}`);
        router.push(finalUrl);
    };

    return (
        <div className="space-y-6">
            {/* --- Modified Header Section --- */}
            <div className="flex flex-wrap justify-between items-center border-b pb-2 mb-4 gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Usage History</h1>
                {/* --- History Toggle Switch --- */}
                 <div className="flex items-center gap-2 bg-gray-100 border border-gray-300 p-2 rounded-md">
                    <label htmlFor="history-toggle" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                        History Logging:
                    </label>
                    <input
                        type="checkbox"
                        id="history-toggle"
                        role="switch"
                        checked={isHistoryEnabled}
                        onChange={toggleHistoryEnabled}
                        disabled={!isLoaded} // Disable until context is loaded
                        className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-gray-200 checked:bg-green-600"
                        aria-checked={isHistoryEnabled}
                    />
                     <span className={`text-sm font-semibold ${isHistoryEnabled ? 'text-green-700' : 'text-red-700'}`}>
                         {isHistoryEnabled ? 'Enabled' : 'Disabled'}
                     </span>
                 </div>
                 {/* --- End History Toggle Switch --- */}

                <button onClick={handleClearAll} disabled={!isLoaded || history.length === 0} className="px-4 py-2 rounded-md text-sm font-medium bg-[rgb(var(--color-button-danger-bg))] text-[rgb(var(--color-button-danger-text))] hover:bg-[rgb(var(--color-button-danger-hover-bg))] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 ease-in-out">
                     Clear All History
                 </button>
            </div>
            {/* --- End Modified Header Section --- */}


            {!isLoaded && <p className="text-gray-500 italic">Loading history...</p>}
            {isLoaded && history.length === 0 && <p className="text-gray-500">No history recorded yet.</p>}
             {isLoaded && !isHistoryEnabled && history.length > 0 && (
                <p className="p-3 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-md text-sm">
                    History logging is currently disabled. Existing entries are shown below, but new actions will not be recorded until enabled.
                </p>
            )}

            {isLoaded && history.length > 0 && (
                <ul className="space-y-4">
                    {history.map((entry: HistoryEntry) => {
                        const isToolPage = entry.toolRoute && entry.toolRoute.startsWith('/t/');
                        const executionCountText = entry.executionCount > 1 ? `(Used ${entry.executionCount} times)` : '';

                        return (
                            <li key={entry.id} className="p-4 border rounded-md shadow-sm bg-white flex justify-between items-start gap-4">
                                <div className="flex-grow overflow-hidden space-y-1">
                                    <div className='flex justify-between items-center'>
                                        <p className="font-semibold text-gray-700 flex items-center gap-2">
                                            {entry.toolName}
                                            {executionCountText && <span className="text-xs font-normal px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">{executionCountText}</span>}
                                        </p>
                                        <p className="text-xs text-gray-400" title={`First used: ${new Date(entry.firstTimestamp).toLocaleString()}`}>
                                            Last used: {formatTimestamp(entry.lastUsedTimestamp)}
                                        </p>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        <span className='font-medium'>Last Action:</span> <code className='text-xs bg-gray-100 px-1 rounded'>{entry.action || 'N/A'}</code> |{' '}
                                        <span className={`font-medium ${entry.status === 'error' ? 'text-red-600' : 'text-green-600'}`}> Last Status: {entry.status || 'N/A'} </span>
                                    </p>
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
                                    {entry.status !== 'error' && entry.output !== undefined && entry.output !== null && (
                                        <div>
                                            <span className="text-xs font-medium text-gray-500">Last Output:</span>
                                            <pre className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap break-words max-h-24">
                                                { typeof entry.output === 'string'
                                                    ? entry.output.substring(0, 300) + (entry.output.length > 300 ? '...' : '')
                                                    : JSON.stringify(entry.output, null, 2) }
                                            </pre>
                                        </div>
                                    )}
                                    {entry.status === 'error' && entry.output !== undefined && entry.output !== null && (
                                         <div>
                                             <span className="text-xs font-medium text-red-500">Last Error Output:</span>
                                             <pre className="mt-1 p-2 bg-red-50 rounded text-xs text-red-700 overflow-x-auto whitespace-pre-wrap break-words max-h-24">
                                                 { typeof entry.output === 'string' ? entry.output : JSON.stringify(entry.output, null, 2) }
                                             </pre>
                                         </div>
                                     )}
                                </div>
                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    <button onClick={() => handleReload(entry)} title={`Reload ${entry.toolName} with this state`} className="px-3 py-1 rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!isToolPage} > Reload </button>
                                    <button onClick={() => handleDelete(entry.id)} title="Delete this entry" className="px-3 py-1 rounded text-xs font-medium text-red-600 hover:bg-red-100 focus:outline-none focus:ring-1 focus:ring-red-500"> Delete </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}