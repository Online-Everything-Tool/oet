'use client';

import React, { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import {
  ArrowUpTrayIcon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useMetadata } from '@/app/context/MetadataContext';
import pako from 'pako';
import { safeStringify } from '@/app/lib/utils';
import toolSpecificMetadata from '../metadata.json';
import type { ToolMetadata as AppToolMetadata } from '@/src/types/tools';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';

const ownMetadata = toolSpecificMetadata as AppToolMetadata;

interface GzipToolState {
  selectedFileId: string | null;
  gzipData: string | null;
  extractedText: string;
}

const DEFAULT_GZIP_TOOL_STATE: GzipToolState = {
  selectedFileId: null,
  gzipData: null,
  extractedText: '',
};

export default function GzipFileExplorerClient({
  toolRoute,
}: {
  toolRoute: string;
}) {
  const { getFile, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
  } = useToolState<GzipToolState>(toolRoute, DEFAULT_GZIP_TOOL_STATE);
  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  const handleClear = useCallback(async () => {
    const newState = DEFAULT_GZIP_TOOL_STATE;
    setToolState(newState);
    await saveStateNow(newState);
    setClientError(null);
    if (toolState.selectedFileId) {
      cleanupOrphanedTemporaryFiles([toolState.selectedFileId]).catch((e) =>
        console.error('[Gzip Clear] Cleanup failed:', e)
      );
    }
  }, [toolState.selectedFileId, setToolState, saveStateNow, cleanupOrphanedTemporaryFiles]);

  const handleFilesSelectedFromModal = useCallback(async (files: any[]) => {
    setIsLoadFileModalOpen(false);
    setClientError(null);
    const file = files[0];
    if (!file) return;
    setToolState({ ...toolState, selectedFileId: file.id, gzipData: null });
    await saveStateNow({ ...toolState, selectedFileId: file.id, gzipData: null });
    processGzipFile(file);
  }, [toolState, setToolState, saveStateNow]);

  const processGzipFile = useCallback(async (file: any) => {
    setIsActionInProgress(true);
    setClientError(null);
    try {
      const blob = await file.blob;
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const inflated = pako.inflate(uint8Array);
      const decoder = new TextDecoder('utf-8');
      const extracted = decoder.decode(inflated);
      setToolState({ ...toolState, extractedText: extracted, gzipData: safeStringify(uint8Array) });
      await saveStateNow({ ...toolState, extractedText: extracted, gzipData: safeStringify(uint8Array) });
    } catch (error) {
      setClientError(error instanceof Error ? error.message : 'Failed to process gzip file.');
    } finally {
      setIsActionInProgress(false);
    }
  }, [toolState, setToolState, saveStateNow]);

  const handleDownload = useCallback(async () => {
    if (!toolState.extractedText) {
      setClientError('No data to download.');
      return;
    }
    setIsActionInProgress(true);
    setClientError(null);
    try {
      const blob = new Blob([toolState.extractedText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'extracted_data.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : 'Failed to download.');
    } finally {
      setIsActionInProgress(false);
    }
  }, [toolState.extractedText]);

  const handleCopy = useCallback(async () => {
    if (!toolState.extractedText) {
      setClientError('No data to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(toolState.extractedText);
      setClientError('Data copied to clipboard!');
    } catch (error) {
      setClientError('Failed to copy to clipboard.');
    }
  }, [toolState.extractedText]);

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => setIsLoadFileModalOpen(true)}
            disabled={isActionInProgress}
            iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
          >
            Select GZIP File
          </Button>
          {toolState.selectedFileId && (
            <Button
              variant="danger"
              onClick={handleClear}
              disabled={isActionInProgress}
              iconLeft={<TrashIcon className="h-5 w-5" />}
            >
              Clear File
            </Button>
          )}
        </div>
        <div className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
          {toolState.selectedFileId && (
            <span>
              Selected: {toolState.selectedFileId}
            </span>
          )}
          {!toolState.selectedFileId && !clientError && (
            <span>Ready for GZIP file.</span>
          )}
        </div>
      </div>
      {clientError && (
        <div
          role="alert"
          className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2"
        >
          <XCircleIcon className="h-5 w-5 shrink-0" />
          <strong className="font-semibold">Error:</strong> {clientError}
        </div>
      )}
      {toolState.extractedText && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <Textarea
            label="Extracted Data:"
            id="gzip-output"
            rows={10}
            value={toolState.extractedText}
            readOnly
            placeholder="Extracted data will appear here..."
            textareaClassName="text-base font-mono bg-[rgb(var(--color-bg-subtle))]"
            spellCheck="false"
            aria-live="polite"
            onClick={(e) => e.currentTarget.select()}
          />
          <OutputActionButtons
            canPerform={true}
            isSaveSuccess={false}
            isCopySuccess={false}
            isDownloadSuccess={false}
            onInitiateSave={() => {}}
            onInitiateDownload={handleDownload}
            onCopy={handleCopy}
            onClear={handleClear}
            directiveName={ownMetadata.directive}
            outputConfig={ownMetadata.outputConfig}
          />
        </div>
      )}
      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFilesSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".gz,application/gzip"
        selectionMode="single"
        libraryFilter={{ type: 'application/gzip' }}
        initialTab="upload"
      />
    </div>
  );
}