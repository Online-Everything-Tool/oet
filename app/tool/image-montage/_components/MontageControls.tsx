// --- FILE: app/tool/image-montage/_components/MontageControls.tsx ---
import React, { ChangeEvent } from 'react';
// *** ADDED Button import ***
import Button from '../../_components/form/Button';
// ***************************

interface MontageControlsProps {
  isLoading: boolean;
  isProcessingFiles: boolean;
  isSaved: boolean;
  isCopied: boolean;
  imageCount: number;
  // *** REMOVED: onFileChange ***
  onAddClick: () => void; // *** ADDED: Handler for Add button ***
  onClear: () => void;
  onSave: () => void;
  onDownload: () => void;
  onCopy: () => void;
}

export default function MontageControls({
  isLoading,
  isProcessingFiles,
  isSaved,
  isCopied,
  imageCount,
  // *** REMOVED: onFileChange ***
  onAddClick, // *** ADDED ***
  onClear,
  onSave,
  onDownload,
  onCopy,
}: MontageControlsProps) {
  const disableActions = imageCount === 0 || isLoading;

  return (
    <div className="flex-shrink-0 pb-4 border-b border-[rgb(var(--color-border-base))] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* *** UPDATED: Use Button component and onAddClick *** */}
          <Button
            variant="accent2"
            onClick={onAddClick}
            isLoading={isProcessingFiles}
            loadingText="Processing..."
            disabled={isLoading} // Disable if any loading is happening
          >
            Add Images
          </Button>
          {/* *** REMOVED: label and input *** */}

          {/* Clear Button */}
          <Button
            variant="neutral"
            onClick={onClear}
            disabled={imageCount === 0 || isLoading}
          >
            Clear
          </Button>
          {/* Save Button */}
          <Button
            variant={isSaved ? 'secondary' : 'primary-outline'} // Use outline style for primary actions
            onClick={onSave}
            disabled={disableActions}
            // Apply specific teal color if needed, or use existing variants
            // className={!isSaved ? 'bg-teal-600 hover:bg-teal-700 text-white' : ''}
          >
            {isSaved ? 'Saved!' : 'Save to Library'}
          </Button>
          {/* Download Button */}
          <Button
            variant="primary" // Make Download the primary action visually
            onClick={onDownload}
            disabled={disableActions}
          >
            Download
          </Button>
          {/* Copy Button */}
          <Button
            variant={isCopied ? 'secondary' : 'accent-outline'} // Use outline style
            onClick={onCopy}
            disabled={disableActions}
          >
            {isCopied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>
    </div>
  );
}
