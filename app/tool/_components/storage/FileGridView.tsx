// FILE: app/tool/_components/storage/FileGridView.tsx
'use client';

import React from 'react';
import type { StoredFile } from '@/src/types/storage';
import { formatBytes } from '@/app/lib/utils';

// TODO: Replace placeholders with actual icon components

// Helper function
const isTextBasedMimeType = (mimeType: string | undefined): boolean => {
    if (!mimeType) return false;
    return mimeType.startsWith('text/') ||
           mimeType === 'application/json' ||
           mimeType === 'application/xml' ||
           mimeType === 'application/javascript' ||
           mimeType === 'application/csv';
};

interface FileGridViewProps {
    files: StoredFile[];
    isLoading: boolean;
    isDeleting: string | null;
    feedbackState: Record<string, { type: 'copy' | 'download' | 'error'; message: string } | null>;
    onSendTo: (fileId: string) => void;
    onCopy: (fileId: string) => void;
    onDownload: (fileId: string) => void;
    onDelete: (fileId: string) => void;
    // --- NEW PROP ---
    // Function to render the preview content for a file
    renderPreview: (file: StoredFile) => React.ReactNode;
}

export default function FileGridView({
    files,
    isLoading,
    isDeleting,
    feedbackState,
    onSendTo,
    onCopy,
    onDownload,
    onDelete,
    // --- ACCEPT NEW PROP ---
    renderPreview
}: FileGridViewProps) {

    return (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 relative z-0">
            {files.map((file) => {
                 const isThisDeleting = isDeleting === file.id;
                 const currentFeedback = feedbackState[file.id];
                 const isTextFile = isTextBasedMimeType(file.type);
                 // Removed generic icon logic - parent will provide preview via renderPreview

                 return (
                    <div key={file.id} className={`relative group border rounded-md shadow-sm overflow-hidden bg-white p-2 flex flex-col items-center gap-1 transition-all duration-150 ease-in-out ${isThisDeleting ? 'opacity-50 animate-pulse' : 'hover:shadow-md hover:border-gray-300'}`}>
                        {/* --- Use renderPreview prop --- */}
                        <div className="aspect-square w-full flex items-center justify-center bg-gray-50 rounded mb-1 pointer-events-none overflow-hidden">
                             {/* Call the provided function to render preview */}
                             {renderPreview(file)}
                        </div>
                        {/* --- End Preview Area --- */}

                        {/* File Info */}
                        <p className="text-xs text-center font-medium text-gray-800 truncate w-full pointer-events-none" title={file.name}> {file.name || 'Untitled'} </p>
                        <p className="text-[10px] text-gray-500 pointer-events-none">{formatBytes(file.size)}</p>

                        {/* Actions Overlay (no change in logic) */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-opacity duration-150 flex items-center justify-center gap-2 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                              {(file.type === 'application/zip' || file.category === 'archive') && ( <button onClick={() => onSendTo(file.id)} disabled={isThisDeleting || isLoading} title="Send to ZIP Explorer" className="p-1.5 text-white rounded-full bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"> ➡️ </button> )}
                             <button onClick={() => onCopy(file.id)} disabled={!isTextFile || isThisDeleting || isLoading || currentFeedback?.type === 'copy'} title={isTextFile ? "Copy content" : "Cannot copy"} className={`p-1.5 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${currentFeedback?.type === 'copy' ? 'bg-green-700 ring-green-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}`}> {currentFeedback?.type === 'copy' ? '✔️' : '📄'} </button>
                             <button onClick={() => onDownload(file.id)} disabled={isThisDeleting || isLoading || currentFeedback?.type === 'download'} title="Download file" className={`p-1.5 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${currentFeedback?.type === 'download' ? 'bg-indigo-700 ring-indigo-500' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'}`}> {currentFeedback?.type === 'download' ? '✔️' : '⬇️'} </button>
                            <button onClick={() => onDelete(file.id)} disabled={isThisDeleting || isLoading} title="Delete file" className="p-1.5 text-white bg-red-600 rounded-full hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"> ❌ </button>
                        </div>
                        {/* Deleting Overlay */}
                        {isThisDeleting && ( <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center pointer-events-none"> <span className="text-red-500 text-xs">Deleting...</span> </div> )}
                        {/* Error Feedback Bar */}
                        {currentFeedback?.type === 'error' && ( <div className="absolute inset-x-0 bottom-0 p-1 bg-red-100 text-red-700 text-[10px] text-center truncate pointer-events-none" title={currentFeedback.message}> Error: {currentFeedback.message}</div> )}
                    </div>
                );
            })}
        </div>
    );
}