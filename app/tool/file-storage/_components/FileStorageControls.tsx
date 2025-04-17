// FILE: app/tool/file-storage/_components/FileStorageControls.tsx
'use client';

// Removed useRef import
import React from 'react';

// TODO: Replace placeholders with actual icon components

interface FileStorageControlsProps {
    isLoading: boolean;
    isPasting: boolean;
    isDeleting: boolean | string | null;
    storedFileCount: number;
    currentLayout: 'list' | 'grid';
    onAddClick: () => void;
    onClearAllClick: () => void;
    onLayoutChange: (newLayout: 'list' | 'grid') => void;
}

export default function FileStorageControls({
    isLoading,
    isPasting,
    isDeleting,
    storedFileCount,
    currentLayout,
    onAddClick,
    onClearAllClick,
    onLayoutChange
}: FileStorageControlsProps) {

    // Removed unused fileInputRef

    return (
      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        {/* Row 1: Main Actions */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
            <button type="button" onClick={onAddClick} disabled={isLoading || isPasting} className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-button-accent2-bg))] transition-colors duration-150 ease-in-out ${isLoading || isPasting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                 <span>➕</span> {isLoading ? 'Processing...' : (isPasting ? 'Pasting...' : 'Add File(s)')}
            </button>
             <div className="flex-grow"></div>
            <button type="button" onClick={onClearAllClick} disabled={storedFileCount === 0 || isLoading || isPasting || isDeleting !== null} className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                 <span>🗑️</span> Clear All
             </button>
        </div>
        {/* Row 2: View Options & Filtering */}
        <div className="flex flex-wrap gap-4 items-center border-t border-gray-200 pt-3 mt-2">
            <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-md">
                 <button onClick={() => onLayoutChange('list')} disabled={currentLayout === 'list'} title="List View" className={`p-1.5 rounded disabled:opacity-100 disabled:cursor-default ${currentLayout === 'list' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}> <span className="text-lg">📄</span> </button>
                 <button onClick={() => onLayoutChange('grid')} disabled={currentLayout === 'grid'} title="Grid View" className={`p-1.5 rounded disabled:opacity-100 disabled:cursor-default ${currentLayout === 'grid' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}> <span className="text-lg">🖼️</span> </button>
            </div>
            <div className="relative"> <button disabled className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-400 bg-gray-100 cursor-not-allowed"> <span>🔎</span> Filter: All </button> </div>
             <div className="relative flex-grow max-w-xs"> <input type="search" placeholder="Search files..." disabled className="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-400 bg-gray-100 cursor-not-allowed placeholder-gray-400" /> <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"> 🔍 </span> </div>
            <div className="flex items-center ml-auto pl-4 border-l border-gray-200"> <input id="includeAppFiles" type="checkbox" disabled className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-not-allowed accent-indigo-600" /> <label htmlFor="includeAppFiles" className="ml-2 block text-sm text-gray-500 cursor-not-allowed"> Include Application Files </label> </div>
        </div>
      </div>
    );
}