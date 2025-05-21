// FILE: app/tool/_components/shared/OutputActionButtons.tsx

import { OutputConfig } from '@/src/types/tools';
import SendToToolButton from './SendToToolButton';
import Button from '../form/Button';
import {
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  XCircleIcon,
  DocumentPlusIcon,
} from '@heroicons/react/24/outline';
import React from 'react';
import { StoredFile } from '@/src/types/storage';

interface OutputActionButtonsProps {
  canPerform: boolean;
  isSaveSuccess: boolean;
  isCopySuccess?: boolean;
  isDownloadSuccess: boolean;
  canInitiateSave?: boolean;
  onInitiateSave: () => void;
  onInitiateDownload: () => void;
  onCopy?: () => void;
  onClear: () => void;
  directiveName: string;
  outputConfig: OutputConfig;
  selectedOutputItems?: StoredFile[];
}

export const OutputActionButtons = React.memo(function OutputActionButtons({
  canPerform,
  isSaveSuccess,
  isCopySuccess,
  isDownloadSuccess,
  canInitiateSave = true,
  onInitiateSave,
  onInitiateDownload,
  onCopy,
  onClear,
  directiveName,
  outputConfig,
  selectedOutputItems = [],
}: OutputActionButtonsProps) {
  if (!canPerform) {
    return (
      <>
        <Button
          variant="neutral"
          onClick={onClear}
          title="Clear input and output"
          iconLeft={<XCircleIcon className="h-5 w-5" />}
        >
          Clear
        </Button>
      </>
    );
  }
  return (
    <>
      <SendToToolButton
        currentToolDirective={directiveName}
        currentToolOutputConfig={outputConfig}
        buttonText="Send To..."
        selectedOutputItems={selectedOutputItems}
      />
      <Button
        variant="primary"
        onClick={onInitiateSave}
        disabled={isSaveSuccess || !canInitiateSave}
        iconLeft={
          isSaveSuccess ? (
            <CheckIcon className="h-5 w-5" />
          ) : (
            <DocumentPlusIcon className="h-5 w-5" />
          )
        }
      >
        Library
      </Button>
      <Button
        variant="secondary"
        onClick={onInitiateDownload}
        iconLeft={
          isDownloadSuccess ? (
            <CheckIcon className="h-5 w-5" />
          ) : (
            <ArrowDownTrayIcon className="h-5 w-5" />
          )
        }
      >
        Download
      </Button>
      {onCopy && (
        <Button
          variant="accent2"
          onClick={onCopy}
          disabled={isCopySuccess}
          iconLeft={
            isCopySuccess ? (
              <CheckIcon className="h-5 w-5" />
            ) : (
              <ClipboardDocumentIcon className="h-5 w-5" />
            )
          }
        >
          Copy
        </Button>
      )}
      <Button
        variant="neutral"
        onClick={onClear}
        title="Clear input and output"
        iconLeft={<XCircleIcon className="h-5 w-5" />}
      >
        Clear
      </Button>
    </>
  );
});
