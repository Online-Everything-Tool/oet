// FILE: app/history/page.tsx
'use client';

import React from 'react';
import { useHistory } from '../context/HistoryContext';
import type { HistoryEntry } from '../context/HistoryContext';
import { useRouter } from 'next/navigation';
// Import the hook's config type (which no longer has stateVariable)
import type { ParamConfig } from '@/app/t/_hooks/useToolUrlState';

// Define structure for metadata file content
interface ToolMetadata {
    title?: string;
    description?: string;
    urlStateParams?: ParamConfig[]; // Uses updated ParamConfig
    [key: string]: unknown;
}

// Define response structure for the metadata API call
interface MetadataApiResponse {
    success: boolean;
    metadata?: ToolMetadata;
    error?: string;
}


export default function HistoryPage() {
    const { history, deleteHistoryEntry, clearHistory, isLoaded } = useHistory();
    const router = useRouter();

    const formatTimestamp = (timestamp: number): string => {
        // Use Intl for better locale support
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

    // --- Handle Reload Click (Uses paramName for lookups) ---
    const handleReload = async (entry: HistoryEntry) => {
        console.log(`[Reload] Attempting to reload state for: ${entry.toolRoute}`);
        console.log(`[Reload] History Entry Data:`, entry); // Log the full entry

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

        const queryParams = new URLSearchParams();
        const urlParamsConfig = metadata?.urlStateParams ?? [];

        if (urlParamsConfig.length === 0) {
            console.warn(`[Reload] No urlStateParams defined in metadata for ${directiveName}. Navigating without params.`);
        } else {
            console.log(`[Reload] Processing ${urlParamsConfig.length} urlStateParams...`);
            urlParamsConfig.forEach((paramConfig: ParamConfig) => {
                let value: unknown = undefined;
                const paramNameKey = paramConfig.paramName; // Use paramName as the key for lookups

                console.log(`[Reload] Processing param: '${paramNameKey}' (Type: ${paramConfig.type})`);

                // Define primary input param names (heuristic)
                // TODO: Consider adding a flag in metadata like "isPrimaryInput": true?
                const primaryInputParamNames = ['text', 'json', 'content', 'input', 'inputValue'];
                const isPrimaryParam = primaryInputParamNames.includes(paramNameKey) || urlParamsConfig[0]?.paramName === paramNameKey;

                // 1. Check if input is an object and has the paramName as a key
                if (typeof entry.input === 'object' && entry.input !== null && paramNameKey in entry.input) {
                     value = (entry.input as Record<string, unknown>)[paramNameKey];
                     console.log(`[Reload] -> Found value for '${paramNameKey}' inside entry.input object:`, value);
                }
                // 2. Fallback: If it's the primary param AND input is NOT an object, use entry.input directly
                else if (isPrimaryParam && typeof entry.input !== 'object' && entry.input !== null) {
                    value = entry.input;
                    console.log(`[Reload] -> Using direct entry.input for primary param '${paramNameKey}':`, value);
                }
                // 3. If not found in input, check options using paramName as the key
                else if (entry.options && typeof entry.options === 'object') {
                     console.log(`[Reload] -> Checking entry.options for key '${paramNameKey}'. Options object:`, JSON.stringify(entry.options));
                     if (paramNameKey in entry.options) {
                        value = (entry.options as Record<string, unknown>)[paramNameKey];
                        console.log(`[Reload] -> Found value for '${paramNameKey}' in entry.options:`, value);
                     } else {
                        console.log(`[Reload] -> Key '${paramNameKey}' NOT FOUND in entry.options.`);
                     }
                } else {
                    console.log(`[Reload] -> Neither input nor options contain key '${paramNameKey}'.`);
                }

                // Set query parameter if a value was found
                if (value !== undefined) {
                    // Avoid stringifying null or undefined if they somehow sneak through
                    let valueString: string;
                    if (value === null) {
                        valueString = 'null'; // Or handle as empty string depending on desired behavior
                    } else if (typeof value === 'string') {
                        valueString = value;
                    } else {
                        try {
                            valueString = JSON.stringify(value);
                        } catch (e) {
                             console.error(`[Reload] Error stringifying value for param '${paramNameKey}':`, value, e);
                             valueString = ''; // Fallback to empty string on stringify error
                        }
                    }
                     console.log(`[Reload] -> Setting query param: ${paramConfig.paramName}=${valueString}`);
                    queryParams.set(paramConfig.paramName, valueString);
                } else {
                     console.log(`[Reload] -> No value found for param '${paramNameKey}'. Skipping.`);
                }
            });
        }

        const queryString = queryParams.toString();
        const finalUrl = `${entry.toolRoute}${queryString ? `?${queryString}` : ''}`;

        console.log(`[Reload] Navigating to final URL: ${finalUrl}`);
        router.push(finalUrl);
    };

    // --- Render Logic ---
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h1 className="text-2xl font-bold text-gray-800">Usage History</h1>
                <button onClick={handleClearAll} disabled={!isLoaded || history.length === 0} className="px-4 py-2 rounded-md text-sm font-medium bg-[rgb(var(--color-button-danger-bg))] text-[rgb(var(--color-button-danger-text))] hover:bg-[rgb(var(--color-button-danger-hover-bg))] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 ease-in-out"> Clear All History </button>
            </div>

            {!isLoaded && <p className="text-gray-500 italic">Loading history...</p>}
            {isLoaded && history.length === 0 && <p className="text-gray-500">No history recorded yet.</p>}

            {isLoaded && history.length > 0 && (
                <ul className="space-y-4">
                    {history.map((entry: HistoryEntry) => {
                        const isReloadable = entry.toolRoute && entry.toolRoute.startsWith('/t/');
                        const executionCountText = entry.executionCount > 1 ? `(Used ${entry.executionCount} times)` : '';

                        return (
                            <li key={entry.id} className="p-4 border rounded-md shadow-sm bg-white flex justify-between items-start gap-4">
                                {/* Entry Display */}
                                <div className="flex-grow overflow-hidden space-y-1">
                                    {/* Header */}
                                    <div className='flex justify-between items-center'>
                                        <p className="font-semibold text-gray-700 flex items-center gap-2">
                                            {entry.toolName}
                                            {executionCountText && <span className="text-xs font-normal px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">{executionCountText}</span>}
                                        </p>
                                        <p className="text-xs text-gray-400" title={`First used: ${new Date(entry.firstTimestamp).toLocaleString()}`}>
                                            Last used: {formatTimestamp(entry.lastUsedTimestamp)}
                                        </p>
                                    </div>
                                    {/* Action/Status */}
                                    <p className="text-xs text-gray-500">
                                        <span className='font-medium'>Last Action:</span> <code className='text-xs bg-gray-100 px-1 rounded'>{entry.action || 'N/A'}</code> |{' '}
                                        <span className={`font-medium ${entry.status === 'error' ? 'text-red-600' : 'text-green-600'}`}> Last Status: {entry.status || 'N/A'} </span>
                                    </p>
                                    {/* Input */}
                                    {entry.input !== undefined && entry.input !== null && (
                                        <div>
                                            <span className="text-xs font-medium text-gray-500">Input:</span>
                                            <pre className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap break-words max-h-24">
                                                { typeof entry.input === 'string'
                                                    ? entry.input.substring(0, 300) + (entry.input.length > 300 ? '...' : '')
                                                    : JSON.stringify(entry.input, null, 2) }
                                            </pre>
                                        </div>
                                     )}
                                    {/* Output */}
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
                                    {/* Error Output */}
                                    {entry.status === 'error' && entry.output !== undefined && entry.output !== null && (
                                         <div>
                                             <span className="text-xs font-medium text-red-500">Last Error Output:</span>
                                             <pre className="mt-1 p-2 bg-red-50 rounded text-xs text-red-700 overflow-x-auto whitespace-pre-wrap break-words max-h-24">
                                                 { typeof entry.output === 'string' ? entry.output : JSON.stringify(entry.output, null, 2) }
                                             </pre>
                                         </div>
                                     )}
                                    {/* Options */}
                                    {entry.options && Object.keys(entry.options).length > 0 && (
                                        <p className="text-xs text-gray-500">
                                            <span className='font-medium'>Options:</span> <code className='text-xs bg-gray-100 px-1 rounded'>{JSON.stringify(entry.options, null, 2)}</code>
                                        </p>
                                     )}
                                </div>
                                {/* Action Buttons Area */}
                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    <button onClick={() => handleReload(entry)} title={`Reload ${entry.toolName} with this state`} className="px-3 py-1 rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!isReloadable} > Reload </button>
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