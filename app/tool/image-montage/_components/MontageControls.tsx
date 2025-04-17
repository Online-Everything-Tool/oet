// --- FILE: app/tool/image-montage/_components/MontageControls.tsx ---
import React, { ChangeEvent } from 'react';

interface MontageControlsProps {
    isLoading: boolean; // Loading state for actions (save/copy/download) + file add
    isProcessingFiles: boolean; // Specific loading state for file adding
    isSaved: boolean;
    isCopied: boolean;
    imageCount: number;
    onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
    onSave: () => void;
    onDownload: () => void;
    onCopy: () => void;
}

export default function MontageControls({
    isLoading, isProcessingFiles, isSaved, isCopied, imageCount,
    onFileChange, onClear, onSave, onDownload, onCopy
}: MontageControlsProps) {

    const disableActions = imageCount === 0 || isLoading;

    return (
        <div className="flex-shrink-0 pb-4 border-b border-[rgb(var(--color-border-base))] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    {/* Add Images Button */}
                    <label htmlFor="imageUpload" className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-accent2-text))] bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ${isProcessingFiles ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {isProcessingFiles ? 'Processing...' : 'Add Images'}
                    </label>
                    <input id="imageUpload" type="file" multiple accept="image/*" onChange={onFileChange} className="hidden" disabled={isProcessingFiles} />
                    {/* Clear Button */}
                    <button type="button" onClick={onClear} disabled={imageCount === 0 || isLoading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                        Clear
                    </button>
                    {/* Save Button */}
                    <button type="button" onClick={onSave} disabled={disableActions} className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${isSaved ? 'bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] text-[rgb(var(--color-button-secondary-text))]' : 'bg-teal-600 hover:bg-teal-700 text-white'}`}>
                        {isSaved ? 'Saved!' : 'Save to Library'}
                    </button>
                    {/* Download Button */}
                    <button type="button" onClick={onDownload} disabled={disableActions} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-primary-text))] bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                        Download
                    </button>
                    {/* Copy Button */}
                    <button type="button" onClick={onCopy} disabled={disableActions} className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${isCopied ? 'bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] text-[rgb(var(--color-button-secondary-text))]' : 'bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] text-[rgb(var(--color-button-accent-text))]'}`}>
                        {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
            </div>
        </div>
    );
}
// --- END FILE: app/tool/image-montage/_components/MontageControls.tsx ---