// FILE: app/tool/file-storage/_components/FileListView.tsx
'use client';

import React from 'react';
import type { StoredFile } from '@/src/types/storage';
import { formatBytes } from '@/app/lib/utils';

// TODO: Replace placeholders with actual icon components

// Helper function (copied from main client for now, could be centralized further)
const isTextBasedMimeType = (mimeType: string | undefined): boolean => {
    if (!mimeType) return false;
    return mimeType.startsWith('text/') ||
           mimeType === 'application/json' ||
           mimeType === 'application/xml' ||
           mimeType === 'application/javascript' ||
           mimeType === 'application/csv';
};

interface FileListViewProps {
    files: StoredFile[];
    isLoading: boolean; // Pass loading state for disabling actions
    isDeleting: string | null; // ID of file being deleted
    feedbackState: Record<string, { type: 'copy' | 'download' | 'error'; message: string } | null>;
    onSendTo: (fileId: string) => void;
    onCopy: (fileId: string) => void;
    onDownload: (fileId: string) => void;
    onDelete: (fileId: string) => void;
}

export default function FileListView({
    files,
    isLoading,
    isDeleting,
    feedbackState,
    onSendTo,
    onCopy,
    onDownload,
    onDelete
}: FileListViewProps) {

    return (
        <div className="overflow-x-auto relative z-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr><th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th><th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th><th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th><th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added</th><th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {files.map((file) => {
                 const isThisDeleting = isDeleting === file.id;
                 const currentFeedback = feedbackState[file.id];
                 const isTextFile = isTextBasedMimeType(file.type);
                 return (
                    <tr key={file.id} className={`${isThisDeleting ? 'opacity-50 bg-red-50' : 'hover:bg-gray-50'} relative`}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-xs" title={file.name}>{file.name}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs" title={file.type}>{file.type}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatBytes(file.size)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500" title={file.createdAt.toLocaleString()}>{file.createdAt.toLocaleDateString()}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                                 {(file.type === 'application/zip' || file.category === 'archive') && ( <button onClick={() => onSendTo(file.id)} disabled={isThisDeleting || isLoading} title="Send to ZIP Explorer" className="p-1 text-blue-600 rounded hover:bg-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"> ➡️ </button> )}
                                 <button onClick={() => onCopy(file.id)} disabled={!isTextFile || isThisDeleting || isLoading || currentFeedback?.type === 'copy'} title={isTextFile ? "Copy file content" : "Cannot copy content"} className={`p-1 rounded focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed ${currentFeedback?.type === 'copy' ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'text-green-600 hover:bg-green-100 focus:ring-green-400'}`}> {currentFeedback?.type === 'copy' ? '✔️' : '📄'} </button>
                                 <button onClick={() => onDownload(file.id)} disabled={isThisDeleting || isLoading || currentFeedback?.type === 'download'} title="Download this file" className={`p-1 rounded focus:outline-none focus:ring-1 disabled:opacity-50 ${currentFeedback?.type === 'download' ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'text-indigo-600 hover:bg-indigo-100 focus:ring-indigo-400'}`}> {currentFeedback?.type === 'download' ? '✔️' : '⬇️'} </button>
                                <button onClick={() => onDelete(file.id)} disabled={isThisDeleting || isLoading} title="Delete this file" className="p-1 text-red-600 rounded hover:bg-red-100 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"> ❌ </button>
                            </div>
                        </td>
                        {currentFeedback?.type === 'error' && ( <td colSpan={5} className="absolute inset-x-0 bottom-0 p-1 bg-red-100 text-red-700 text-[10px] text-center truncate pointer-events-none border-t border-red-200" title={currentFeedback.message}> Error: {currentFeedback.message} </td> )}
                    </tr>
                 );
                })}
            </tbody>
          </table>
        </div>
    );
}