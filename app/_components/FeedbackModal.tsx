// FILE: app/_components/FeedbackModal.tsx
'use client';

import React from 'react';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    // --- UPDATED TYPE --- Allow RefObject to potentially hold null
    dialogRef: React.RefObject<HTMLDivElement | null>;
}

const GITHUB_ISSUES_URL = 'https://github.com/Online-Everything-Tool/oet/issues/new/choose';

export default function FeedbackModal({ isOpen, onClose, dialogRef }: FeedbackModalProps) {
    if (!isOpen) {
        return null;
    }

    return (
        // Modal Backdrop (Fixed position, covers screen)
        <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-center justify-center p-4"
            aria-labelledby="feedback-dialog-title"
            role="dialog"
            aria-modal="true"
        >
            {/* Modal Content Container (Centered, styled) */}
            {/* --- Cast to specific type here as we know it's HTMLDivElement when rendered --- */}
            <div
                ref={dialogRef as React.RefObject<HTMLDivElement>} // Cast here is safe within the rendered modal
                className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col"
            >
                {/* Modal Header */}
                <div className="p-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center">
                    <h2 id="feedback-dialog-title" className="text-lg font-semibold text-[rgb(var(--color-text-base))]">
                        Provide Feedback
                    </h2>
                    {/* Standard HTML close button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Close Feedback Modal"
                    >
                        {/* SVG 'X' icon */}
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-4">
                    <p className="text-sm text-gray-600">
                        Found a bug, have an idea for a new tool, or want to suggest an improvement? We appreciate your feedback!
                    </p>
                    <p className="text-sm text-gray-600">
                        Please use our GitHub Issues page to share your thoughts.
                    </p>
                    <a
                        href={GITHUB_ISSUES_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block w-full text-center px-5 py-2.5 bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] font-medium text-sm rounded-md shadow-sm hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-button-primary-bg))] transition-colors duration-150 ease-in-out"
                    >
                        Open GitHub Issues
                    </a>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}