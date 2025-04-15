// FILE: app/t/_components/ToolSettings.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import ToolHistorySettings from './ToolHistorySettings';


interface ToolSettingsProps {
    toolRoute: string;
}

export default function ToolSettings({ toolRoute }: ToolSettingsProps) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null); // Ref for the dialog content

    // Effect to handle clicks outside the dialog to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if the click is outside the dialog referenced by dialogRef
            if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
        };

        if (isSettingsOpen) {
            // Add listener when dialog is open
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            // Remove listener when dialog is closed
            document.removeEventListener('mousedown', handleClickOutside);
        }

        // Cleanup listener on component unmount or when isSettingsOpen changes
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSettingsOpen]); // Only re-run the effect if isSettingsOpen changes


    // Effect to handle closing the dialog with the Escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsSettingsOpen(false);
            }
        };

        if (isSettingsOpen) {
            window.addEventListener('keydown', handleKeyDown);
        } else {
            window.removeEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSettingsOpen]); // Only re-run the effect if isSettingsOpen changes


    return (
        <div className="absolute top-0 right-0 mt-1 mr-1 z-10">
            {/* Standard HTML Button styled as an icon button */}
            <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                title="History Logging Settings" // HTML tooltip
                aria-label="Open History Logging Settings"
                // Tailwind classes for styling
                className="p-1.5 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-base))] rounded-full hover:bg-[rgba(var(--color-border-base)/0.2)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-border-focus))]"
            >
                {/* Unicode Gear icon */}
                <span className="text-xl" aria-hidden="true">⚙️</span>
            </button>

            {/* Conditional rendering for the modal based on state */}
            {isSettingsOpen && (
                // Modal Backdrop (Fixed position, covers screen)
                <div
                    className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-center justify-center p-4"
                    aria-labelledby="settings-dialog-title"
                    role="dialog"
                    aria-modal="true"
                >
                    {/* Modal Content Container (Centered, styled) */}
                    <div
                        ref={dialogRef} // Attach ref here
                        className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col"
                    >
                        {/* Modal Header */}
                        <div className="p-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center">
                            <h2 id="settings-dialog-title" className="text-lg font-semibold text-[rgb(var(--color-text-base))]">
                                History Settings
                            </h2>
                            {/* Standard HTML close button */}
                            <button
                                type="button"
                                onClick={() => setIsSettingsOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                                aria-label="Close Settings"
                            >
                                {/* SVG 'X' icon */}
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto">
                            {/* Render the history settings component */}
                            <ToolHistorySettings toolRoute={toolRoute} />
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] flex justify-end">
                            {/* Standard HTML close button, styled */}
                            <button
                                type="button"
                                onClick={() => setIsSettingsOpen(false)}
                                className="px-4 py-2 rounded-md text-sm font-medium bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-button-primary-bg))]"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}