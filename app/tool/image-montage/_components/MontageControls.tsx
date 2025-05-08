// --- FILE: app/tool/image-montage/_components/MontageControls.tsx ---
import React, { ChangeEvent } from 'react';

import Button from '../../_components/form/Button';

interface MontageControlsProps {
  isLoading: boolean;
  isProcessingFiles: boolean;
  isSaved: boolean;
  isCopied: boolean;
  imageCount: number;

  onAddClick: () => void;
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

  onAddClick,
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
            disabled={isLoading}
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
            variant={isSaved ? 'secondary' : 'primary-outline'}
            onClick={onSave}
            disabled={disableActions}
          >
            {isSaved ? 'Saved!' : 'Save to Library'}
          </Button>
          {/* Download Button */}
          <Button
            variant="primary"
            onClick={onDownload}
            disabled={disableActions}
          >
            Download
          </Button>
          {/* Copy Button */}
          <Button
            variant={isCopied ? 'secondary' : 'accent-outline'}
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
