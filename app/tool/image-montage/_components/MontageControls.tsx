// --- FILE: app/tool/image-montage/_components/MontageControls.tsx ---
import React from 'react';
import Button from '../../_components/form/Button';
import {
  PhotoIcon,
  ArchiveBoxArrowDownIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  CheckBadgeIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/20/solid';

interface MontageControlsProps {
  isLoading: boolean;
  isGeneratingMontageForAction: boolean;
  isOutputPermanentAndSaved: boolean;
  canSaveOrUpdate: boolean;
  canDownload: boolean;
  imageCount: number;
  manualSaveSuccessFeedback: boolean;

  onAddClick: () => void;
  onClear: () => void;
  onSaveOrUpdateClick: () => void;
  onSaveAsNewClick: () => void;
  onDownloadClick: () => void;
}

export default function MontageControls({
  isLoading,
  isGeneratingMontageForAction,
  isOutputPermanentAndSaved,
  canSaveOrUpdate,
  canDownload,
  imageCount,
  manualSaveSuccessFeedback,

  onAddClick,
  onClear,
  onSaveOrUpdateClick,
  onSaveAsNewClick,
  onDownloadClick,
}: MontageControlsProps) {
  const generalActionsDisabled = isLoading || isGeneratingMontageForAction;

  let saveButtonText = 'Save to Library';
  let saveButtonIcon = <ArchiveBoxArrowDownIcon className="h-5 w-5" />;
  let saveButtonVariant: 'secondary' | 'primary-outline' = 'primary-outline';

  if (manualSaveSuccessFeedback) {
    saveButtonText = 'Saved!';
    saveButtonIcon = <CheckBadgeIcon className="h-5 w-5" />;
    saveButtonVariant = 'secondary';
  } else if (isOutputPermanentAndSaved) {
    saveButtonText = 'Update Saved Montage';
    saveButtonVariant = 'secondary';
  }

  const showSaveAsNewButton = canSaveOrUpdate && isOutputPermanentAndSaved;

  return (
    <div className="flex-shrink-0 pb-4 border-b border-[rgb(var(--color-border-base))] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <Button
            variant="accent2"
            onClick={onAddClick}
            isLoading={
              isLoading && !isGeneratingMontageForAction && imageCount === 0
            }
            loadingText="Loading..."
            disabled={generalActionsDisabled}
            iconLeft={<PhotoIcon className="h-5 w-5" />}
          >
            Add Images
          </Button>

          <Button
            variant="neutral"
            onClick={onClear}
            disabled={generalActionsDisabled || imageCount === 0}
            iconLeft={<TrashIcon className="h-5 w-5" />}
          >
            Clear All
          </Button>

          <Button
            variant={saveButtonVariant}
            onClick={onSaveOrUpdateClick}
            disabled={
              generalActionsDisabled ||
              !canSaveOrUpdate ||
              manualSaveSuccessFeedback
            }
            isLoading={
              isGeneratingMontageForAction && !manualSaveSuccessFeedback
            }
            loadingText={
              isOutputPermanentAndSaved ? 'Updating...' : 'Saving...'
            }
            iconLeft={saveButtonIcon}
          >
            {saveButtonText}
          </Button>

          {showSaveAsNewButton && (
            <Button
              variant="primary-outline"
              onClick={onSaveAsNewClick}
              disabled={generalActionsDisabled || !canSaveOrUpdate}
              isLoading={isGeneratingMontageForAction} // Corrected
              loadingText="Saving As..."
              iconLeft={<DocumentDuplicateIcon className="h-5 w-5" />}
            >
              Save As New...
            </Button>
          )}

          <Button
            variant="primary"
            onClick={onDownloadClick}
            disabled={generalActionsDisabled || !canDownload}
            isLoading={isGeneratingMontageForAction}
            loadingText="Preparing..."
            iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
          >
            Download Montage
          </Button>
        </div>
      </div>
    </div>
  );
}
