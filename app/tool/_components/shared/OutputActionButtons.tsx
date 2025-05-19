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

interface OutputActionButtonsProps {
  canPerform: boolean;
  isSaveSuccess: boolean;
  isCopySuccess: boolean;
  isDownloadSuccess: boolean;
  onInitiateSave: () => void;
  onInitiateDownload: () => void;
  onCopy: () => void;
  onClear: () => void;
  directiveName: string;
  outputConfig: OutputConfig;
}

export const OutputActionButtons = React.memo(function OutputActionButtons({
  canPerform,
  isSaveSuccess,
  isCopySuccess,
  isDownloadSuccess,
  onInitiateSave,
  onInitiateDownload,
  onCopy,
  onClear,
  directiveName,
  outputConfig,
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
      />
      <Button
        variant="primary"
        onClick={onInitiateSave}
        disabled={isSaveSuccess}
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
