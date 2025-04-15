// FILE: app/t/_components/ToolSettings.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import ToolHistorySettings from './ToolHistorySettings';
import RecentlyUsedWidget from '@/app/_components/RecentlyUsedWidget'; // Import the widget

interface ToolSettingsProps {
    toolRoute: string;
}

export default function ToolSettings({ toolRoute }: ToolSettingsProps) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRecentPanelOpen, setIsRecentPanelOpen] = useState(false); // State for recent panel
    const settingsDialogRef = useRef<HTMLDivElement>(null);
    const recentPanelRef = useRef<HTMLDivElement>(null); // Ref for recent panel

    // Combined click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isSettingsOpen && settingsDialogRef.current && !settingsDialogRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
            if (isRecentPanelOpen && recentPanelRef.current && !recentPanelRef.current.contains(event.target as Node)) {
                 setIsRecentPanelOpen(false);
            }
        };

        if (isSettingsOpen || isRecentPanelOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSettingsOpen, isRecentPanelOpen]); // Depends on both states


    // Combined Escape key handler
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (isSettingsOpen) setIsSettingsOpen(false);
                if (isRecentPanelOpen) setIsRecentPanelOpen(false);
            }
        };

        if (isSettingsOpen || isRecentPanelOpen) {
            window.addEventListener('keydown', handleKeyDown);
        } else {
            window.removeEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSettingsOpen, isRecentPanelOpen]);

    const handleOpenSettings = () => {
        setIsRecentPanelOpen(false); // Close recent panel if open
        setIsSettingsOpen(true);
    };

    const handleOpenRecentPanel = () => {
        setIsSettingsOpen(false); // Close settings if open
        setIsRecentPanelOpen(true);
    };


    return (
        // Container for the icons
        <div className="absolute top-0 right-0 mt-1 mr-1 z-10 flex items-center gap-1">
            {/* Recent Activity Button */}
            <button
                type="button"
                onClick={handleOpenRecentPanel}
                title="View Recent Activity for this Tool"
                aria-label="Open Recent Activity Panel"
                className="p-1.5 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-base))] rounded-full hover:bg-[rgba(var(--color-border-base)/0.2)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-border-focus))]"
            >
                {/* Unicode Clock icon */}
                <span className="text-xl" aria-hidden="true">🕒</span>
            </button>

             {/* Settings Button */}
            <button
                type="button"
                onClick={handleOpenSettings}
                title="History Logging Settings"
                aria-label="Open History Logging Settings"
                className="p-1.5 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-base))] rounded-full hover:bg-[rgba(var(--color-border-base)/0.2)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-border-focus))]"
            >
                {/* Unicode Gear icon */}
                <span className="text-xl" aria-hidden="true">⚙️</span>
            </button>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-center justify-center p-4"
                    aria-labelledby="settings-dialog-title" role="dialog" aria-modal="true"
                >
                    <div
                        ref={settingsDialogRef}
                        className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col"
                    >
                        <div className="p-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center">
                            <h2 id="settings-dialog-title" className="text-lg font-semibold text-[rgb(var(--color-text-base))]">
                                History Settings
                            </h2>
                            <button type="button" onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close Settings">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <ToolHistorySettings toolRoute={toolRoute} />
                        </div>
                        <div className="p-4 border-t border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] flex justify-end">
                            <button type="button" onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-button-primary-bg))]">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Activity Panel/Modal */}
             {isRecentPanelOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-center justify-center p-4"
                    aria-labelledby="recent-panel-title" role="dialog" aria-modal="true"
                >
                    <div
                        ref={recentPanelRef} // Attach ref
                        className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]" // Increased width, max height
                    >
                        <div className="p-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center flex-shrink-0">
                            <h2 id="recent-panel-title" className="text-lg font-semibold text-[rgb(var(--color-text-base))]">
                                Recent Activity
                            </h2>
                            <button type="button" onClick={() => setIsRecentPanelOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close Recent Activity">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-grow"> {/* Make body scrollable */}
                             {/* Render the widget for the tool page */}
                            <RecentlyUsedWidget
                                limit={10} // Show more items for specific tool
                                filterToolRoute={toolRoute}
                                displayMode="toolpage"
                            />
                        </div>
                         {/* No explicit footer needed, close button is in header */}
                    </div>
                </div>
             )}
        </div>
    );
}