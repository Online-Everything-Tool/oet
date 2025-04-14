// /app/history/page.tsx
'use client';

import React from 'react';
import { useHistory } from '../context/HistoryContext';
import type { HistoryEntry } from '../context/HistoryContext';
// import Link from 'next/link';
import { useRouter } from 'next/navigation';
// Import types needed for metadata processing
import type { ParamConfig } from '@/app/t/_hooks/useToolUrlState';
import type { ToolMetadata } from '@/app/api/tool-metadata/route'; // Assuming ToolMetadata is exported or redefine here

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
        return new Date(timestamp).toLocaleString();
    };

    const handleDelete = (id: string) => {
        deleteHistoryEntry(id);
    };

    const handleClearAll = () => {
        clearHistory();
    };

    // --- Handle Reload Click (Uses new API endpoint and param) ---
    const handleReload = async (entry: HistoryEntry) => {
        console.log(`Attempting to reload state for: ${entry.toolRoute}`);

        // Validate toolRoute and extract directiveName
        if (!entry.toolRoute || !entry.toolRoute.startsWith('/t/')) {
            console.error("Invalid toolRoute in history entry:", entry.toolRoute);
            alert("Cannot reload: Invalid tool route found in history.");
            return;
        }
        const directiveName = entry.toolRoute.substring(3); // Extract 'text-reverse' from '/t/text-reverse'
        if (!directiveName) {
             console.error("Could not extract directive name from route:", entry.toolRoute);
             alert("Cannot reload: Could not determine tool directive from history.");
            return;
        }

        let metadata: ToolMetadata | undefined;
        try {
            console.log(`Fetching metadata for directive: ${directiveName}`);
            // --- CHANGE: Call API using 'directive' parameter ---
            const response = await fetch(`/api/tool-metadata?directive=${encodeURIComponent(directiveName)}`);
            const data: MetadataApiResponse = await response.json();

            if (!response.ok || !data.success || !data.metadata) {
                throw new Error(data.error || `Failed to fetch metadata (${response.status})`);
            }
            metadata = data.metadata;
            console.log("Metadata fetched:", metadata);

        } catch (error) {
            console.error("Error fetching or parsing tool metadata:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            alert(`Could not load tool configuration: ${message}`);
            return;
        }

        // Check if necessary metadata exists
        if (!metadata?.urlStateParams || metadata.urlStateParams.length === 0) {
            console.warn(`No urlStateParams defined in metadata for ${directiveName}. Cannot build URL.`);
            // Allow navigation to the tool's base page even without params? Or alert?
            alert(`Cannot reload state for ${entry.toolName}: Tool configuration is missing necessary details (urlStateParams).`);
            // Optionally navigate to base route: router.push(entry.toolRoute);
            return;
        }

        // Build the query string using fetched metadata
        const queryParams = new URLSearchParams();
        metadata.urlStateParams.forEach((paramConfig: ParamConfig) => {
            let value: any;
            // Determine where the value comes from (input or options)
            // Convention: Assume primary input is stored in entry.input if stateVariable matches common names
            // Otherwise, look in entry.options using stateVariable as the key.
            // Adjust this convention if needed!
            if (['inputValue', 'text', 'content', 'json', 'data'].includes(paramConfig.stateVariable)) {
                value = entry.input;
            } else if (entry.options && typeof entry.options === 'object' && paramConfig.stateVariable in entry.options) {
                 value = (entry.options as Record<string, unknown>)[paramConfig.stateVariable];
            } else {
                console.warn(`Could not find value for stateVariable '${paramConfig.stateVariable}' in history entry input/options.`);
                // Skip this parameter if value not found? Or use default? Let's skip for now.
                return;
            }

            // Stringify non-string values if needed (basic)
            const valueString = typeof value === 'string' ? value : JSON.stringify(value);

            if (valueString !== undefined) {
                queryParams.set(paramConfig.paramName, valueString);
            }
        });

        const queryString = queryParams.toString();
        const finalUrl = `${entry.toolRoute}${queryString ? `?${queryString}` : ''}`; // Add '?' only if params exist

        console.log(`Navigating to reload state: ${finalUrl}`);
        router.push(finalUrl);
    };

    // --- Render Logic (No changes needed from previous version) ---
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
                                    <div className='flex justify-between items-center'> <p className="font-semibold text-gray-700 flex items-center gap-2"> {entry.toolName} {executionCountText && <span className="text-xs font-normal px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">{executionCountText}</span>} </p> <p className="text-xs text-gray-400" title={`First used: ${new Date(entry.firstTimestamp).toLocaleString()}`}> Last used: {formatTimestamp(entry.lastUsedTimestamp)} </p> </div>
                                    <p className="text-xs text-gray-500"> <span className='font-medium'>Last Action:</span> <code className='text-xs bg-gray-100 px-1 rounded'>{entry.action || 'N/A'}</code> |{' '} <span className={`font-medium ${entry.status === 'error' ? 'text-red-600' : 'text-green-600'}`}> Last Status: {entry.status || 'N/A'} </span> </p>
                                    {entry.input !== undefined && entry.input !== null && ( <div> <span className="text-xs font-medium text-gray-500">Input:</span> <pre className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap break-words max-h-24">{ typeof entry.input === 'string' ? entry.input.substring(0, 300) + (entry.input.length > 300 ? '...' : '') : JSON.stringify(entry.input)}</pre> </div> )}
                                    {entry.status !== 'error' && entry.output !== undefined && entry.output !== null && ( <div> <span className="text-xs font-medium text-gray-500">Last Output:</span> <pre className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap break-words max-h-24">{ typeof entry.output === 'string' ? entry.output.substring(0, 300) + (entry.output.length > 300 ? '...' : '') : JSON.stringify(entry.output)}</pre> </div> )}
                                    {entry.status === 'error' && entry.output !== undefined && entry.output !== null && ( <div> <span className="text-xs font-medium text-red-500">Last Error Output:</span> <pre className="mt-1 p-2 bg-red-50 rounded text-xs text-red-700 overflow-x-auto whitespace-pre-wrap break-words max-h-24">{ typeof entry.output === 'string' ? entry.output : JSON.stringify(entry.output)}</pre> </div> )}
                                    {entry.options && Object.keys(entry.options).length > 0 && ( <p className="text-xs text-gray-500"> <span className='font-medium'>Options:</span> <code className='text-xs bg-gray-100 px-1 rounded'>{JSON.stringify(entry.options)}</code> </p> )}
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