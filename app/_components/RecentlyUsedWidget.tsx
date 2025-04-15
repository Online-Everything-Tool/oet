// FILE: app/_components/RecentlyUsedWidget.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { useHistory, HistoryEntry } from '../context/HistoryContext';
import { formatDistanceToNow } from 'date-fns';
// Import necessary things for reload (if implementing here)
import { useRouter } from 'next/navigation';
import type { ParamConfig } from '@/app/tool/_hooks/useToolUrlState'; // Assuming ParamConfig path

// Define REDACTED_OUTPUT_PLACEHOLDER if not imported globally
const REDACTED_OUTPUT_PLACEHOLDER = "[Output Redacted by Setting]";

// --- Interfaces (Unchanged and potentially new) ---
interface RecentItemDisplay {
  id: string;
  toolRoute: string;
  toolName: string;
  lastUsedTimestamp: number;
  input?: Record<string, unknown> | string | null;
  outputPreview?: string;
  status?: 'success' | 'error';
}

interface RecentlyUsedWidgetProps {
    limit: number;
    filterToolRoute?: string;
    displayMode: 'homepage' | 'toolpage';
    // onClose?: () => void; // Keep if needed for other closing mechanisms
}

// --- NEW: Interfaces needed for Reload ---
interface ToolMetadataForReload {
    urlStateParams?: ParamConfig[];
    [key: string]: unknown;
}
interface MetadataApiResponseForReload {
    success: boolean;
    metadata?: ToolMetadataForReload;
    error?: string;
}
// --- END NEW ---

export default function RecentlyUsedWidget({ limit, filterToolRoute, displayMode }: RecentlyUsedWidgetProps) {
    const { history, isLoaded } = useHistory();
    const router = useRouter(); // Add router hook
    const [widgetError, setWidgetError] = useState<string | null>(null); // State for widget-specific errors

    const recentItems = useMemo((): RecentItemDisplay[] => { // Ensure return type
        if (!isLoaded) return [];

        const relevantHistory = filterToolRoute
            ? history.filter(entry => entry.toolRoute === filterToolRoute)
            : history;

        const sortedHistory = [...relevantHistory].sort((a, b) => b.timestamps[0] - a.timestamps[0]);

        const uniqueItemsMap = new Map<string, HistoryEntry>();
        // If filtering for a tool, show recent *unique states* (by ID)
        // If on homepage, show recent *unique tools* (by route)
        const keyGetter = filterToolRoute ? (entry: HistoryEntry) => entry.id : (entry: HistoryEntry) => entry.toolRoute;

        for (const entry of sortedHistory) {
            const key = keyGetter(entry);
            if (!uniqueItemsMap.has(key)) {
                uniqueItemsMap.set(key, entry);
            }
            if (uniqueItemsMap.size >= limit) break;
        }

        return Array.from(uniqueItemsMap.values())
            .slice(0, limit)
            .map((entry): RecentItemDisplay => { // Ensure mapping returns correct type
                let outputPreview = 'N/A';
                if (entry.output === REDACTED_OUTPUT_PLACEHOLDER) {
                    outputPreview = REDACTED_OUTPUT_PLACEHOLDER;
                } else if (entry.status === 'error' && typeof entry.output === 'string') {
                    outputPreview = `Error: ${entry.output.substring(0, 50)}${entry.output.length > 50 ? '...' : ''}`;
                } else if (entry.status === 'success') {
                     // Improved preview logic
                     const output = entry.output;
                     if (typeof output === 'string') {
                         outputPreview = output.substring(0, 80) + (output.length > 80 ? '...' : '');
                     } else if (output && typeof output === 'object') {
                         try {
                             const jsonString = JSON.stringify(output);
                             outputPreview = jsonString.substring(0, 80) + (jsonString.length > 80 ? '...' : '');
                         } catch { outputPreview = '[Object Output]'; }
                     } else if (output !== undefined && output !== null) {
                         outputPreview = `[${typeof output}]`;
                     } else {
                         outputPreview = 'No output logged'; // Handle case where output is undefined/null
                     }
                }

                return {
                    id: entry.id,
                    toolRoute: entry.toolRoute,
                    toolName: entry.toolName,
                    lastUsedTimestamp: entry.timestamps[0],
                    input: entry.input,
                    outputPreview: outputPreview,
                    status: entry.status
                };
            });

    }, [history, isLoaded, limit, filterToolRoute]);

    // --- Reload Logic (Adapted from history page) ---
    const handleReloadState = async (item: RecentItemDisplay) => {
        setWidgetError(null); // Clear previous errors
        const directiveName = item.toolRoute.substring(3); // Assumes '/tool/' prefix
        if (!directiveName) {
             console.error("[RecentWidget Reload] Could not extract directive name:", item.toolRoute);
             setWidgetError("Cannot reload: Invalid tool route."); return;
        }

        let metadata: ToolMetadataForReload | undefined;
        try {
            // Fetch metadata specifically for reload info
            const response = await fetch(`/api/tool-metadata?directive=${encodeURIComponent(directiveName)}`);
            const data: MetadataApiResponseForReload = await response.json();
            if (!response.ok || !data.success || !data.metadata) {
                throw new Error(data.error || `Failed to fetch metadata (${response.status})`);
            }
            metadata = data.metadata;
        } catch (error) {
            console.error("[RecentWidget Reload] Error fetching metadata:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            setWidgetError(`Reload failed: Could not load tool config: ${message}`); return;
        }

        const urlParamsConfig = metadata?.urlStateParams ?? [];
        if (urlParamsConfig.length === 0 || typeof item.input !== 'object' || item.input === null) {
            // If no params defined or input is not an object, just navigate to the tool page
            console.log("[RecentWidget Reload] No URL params or non-object input. Navigating without state.");
            router.push(item.toolRoute);
            return;
        }

        // Construct query params
        const queryParams = new URLSearchParams();
        const inputObject = item.input as Record<string, unknown>;

        urlParamsConfig.forEach((paramConfig: ParamConfig) => {
            const paramNameKey = paramConfig.paramName;
             if (Object.prototype.hasOwnProperty.call(inputObject, paramNameKey)) {
                const value = inputObject[paramNameKey];
                if (value !== undefined && value !== null) { // Don't set null/undefined values
                     let valueString: string;
                     if (typeof value === 'string') { valueString = value; }
                     else if (typeof value === 'boolean' || typeof value === 'number') { valueString = String(value); }
                     else { try { valueString = JSON.stringify(value); } catch (e) { console.error(`[RecentWidget Reload] Error stringifying value for param '${paramNameKey}':`, value, e); valueString = ''; }}

                     if(valueString) { // Only set if we got a non-empty string
                         queryParams.set(paramConfig.paramName, valueString);
                     }
                }
            }
        });

        const queryString = queryParams.toString();
        const finalUrl = `${item.toolRoute}${queryString ? `?${queryString}` : ''}`;
        console.log("[RecentWidget Reload] Navigating with state:", finalUrl);
        router.push(finalUrl);
    };
    // --- End Reload Logic ---

    if (!isLoaded && displayMode === 'homepage') { // Show loading only on homepage initially
        return <div className="text-sm text-center p-4 text-gray-400 italic">Loading recent activity...</div>;
    }

    if (recentItems.length === 0) {
        return displayMode === 'homepage' ? null : <div className="text-sm text-center p-2 text-gray-500">No recent activity found for this tool.</div>;
    }

    // --- Homepage Rendering (Unchanged) ---
    if (displayMode === 'homepage') {
        return (
            <div className="p-4 md:p-6 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-component))] shadow-sm">
                <h2 className="text-xl font-semibold mb-4 text-[rgb(var(--color-text-base))]">
                    Recently Used Tools
                </h2>
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(limit, 5)} gap-4`}>
                    {recentItems.map(item => (
                        // Use the handleReloadState function onClick for homepage items too
                        <button
                            key={item.id}
                            onClick={() => handleReloadState(item)}
                            className="block p-3 border border-[rgba(var(--color-border-base)/0.5)] rounded-md bg-[rgb(var(--color-bg-subtle))] hover:bg-[rgba(var(--color-border-base)/0.1)] hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-button-primary-bg))] text-left h-full"
                            title={`Reload ${item.toolName} with last state`}
                        >
                            <div className="flex flex-col h-full">
                                <p className="font-semibold text-base text-[rgb(var(--color-text-link))] mb-1 truncate">
                                    {item.toolName}
                                </p>
                                <p className="text-xs text-gray-500 mb-2">
                                    {formatDistanceToNow(new Date(item.lastUsedTimestamp), { addSuffix: true })}
                                </p>
                                <p className={`text-xs mt-auto flex-grow-0 ${item.status === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
                                    {item.status === 'error' ? 'Last action resulted in error' : 'Last action successful'}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
                {widgetError && <p className="text-xs text-red-600 mt-2">{widgetError}</p>}
            </div>
        );
    }

    // --- Toolpage Rendering (Updated with Reload) ---
    if (displayMode === 'toolpage') {
         return (
            <div className={`recently-used-widget mode-${displayMode}`}>
                {/* Title moved to modal header */}
                {widgetError && <p className="text-xs text-red-600 mb-2">{widgetError}</p>}
                <ul className="space-y-3">
                    {recentItems.map(item => (
                        <li key={item.id} className="p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-component))] shadow-sm text-sm flex flex-col gap-1.5">
                             <div className="flex justify-between items-center">
                                <p className="text-xs text-gray-500">
                                    {formatDistanceToNow(new Date(item.lastUsedTimestamp), { addSuffix: true })}
                                </p>
                                <button
                                     onClick={() => handleReloadState(item)}
                                     className="px-2 py-0.5 rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                     title="Reload this state"
                                     // Disable if input is not suitable for reload (e.g., not an object when params exist)
                                     disabled={!item.input || typeof item.input !== 'object'}
                                >
                                     Reload
                                 </button>
                             </div>
                              {/* Show input preview if it's an object */}
                              {item.input && typeof item.input === 'object' && (
                                 <div className="mt-1">
                                     <span className="text-xs font-medium text-gray-500">Input State:</span>
                                     <pre className="p-1.5 bg-gray-50 rounded text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap break-words max-h-20">
                                         {JSON.stringify(item.input, null, 2)}
                                     </pre>
                                 </div>
                              )}
                             <p className={`text-xs truncate ${item.status === 'error' ? 'text-red-600' : 'text-gray-600'}`} title={item.outputPreview}>
                                 <span className="font-medium">Last Output:</span> {item.outputPreview}
                             </p>
                        </li>
                    ))}
                </ul>
            </div>
         );
    }

    return null; // Should not be reached
}