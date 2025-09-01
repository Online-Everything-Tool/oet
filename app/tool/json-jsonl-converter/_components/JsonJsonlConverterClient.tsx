'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '@/app/tool/_hooks/useToolState';
import Textarea from '@/app/tool/_components/form/Textarea';
import Button from '@/app/tool/_components/form/Button';
import RadioGroup from '@/app/tool/_components/form/RadioGroup';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { useDebouncedCallback } from 'use-debounce';
import {
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import importedMetadata from '../metadata.json';

type Operation = 'json-to-jsonl' | 'jsonl-to-json';

interface ConverterState {
  inputText: string;
  operation: Operation;
  jsonOutput: string;
  jsonlOutput: string;
  errorMsg: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_STATE: ConverterState = {
  inputText: '',
  operation: 'json-to-jsonl',
  jsonOutput: '',
  jsonlOutput: '',
  errorMsg: '',
  lastLoadedFilename: null,
};

const AUTO_PROCESS_DEBOUNCE_MS = 300;
const metadata = importedMetadata as ToolMetadata;

interface JsonJsonlConverterClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function JsonJsonlConverterClient({
  urlStateParams,
  toolRoute,
}: JsonJsonlConverterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    saveStateNow,
  } = useToolState<ConverterState>(toolRoute, DEFAULT_STATE);

  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameAction, setFilenameAction] = useState<'download' | 'save' | null>(
    null
  );
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] =
    useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const directiveName = metadata.directive;

  const operationOptions = useMemo(
    () => [
      { value: 'json-to-jsonl' as Operation, label: 'JSON to JSONL' },
      { value: 'jsonl-to-json' as Operation, label: 'JSONL to JSON' },
    ],
    []
  );

  const outputValue = useMemo(
    () => toolState.jsonOutput || toolState.jsonlOutput,
    [toolState.jsonOutput, toolState.jsonlOutput]
  );

  const generateOutputFilename = useCallback(
    (baseName?: string | null): string => {
      const base = baseName?.replace(/\.[^/.]+$/, '') || 'converted';
      return toolState.operation === 'json-to-jsonl'
        ? `${base}.jsonl`
        : `${base}.json`;
    },
    [toolState.operation]
  );

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setToolState({
          errorMsg: `Metadata not found for source tool: ${signal.sourceToolTitle}`,
        });
        return;
      }

      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );

      if (
        resolvedPayload.type === 'error' ||
        !resolvedPayload.data ||
        resolvedPayload.data.length === 0
      ) {
        setToolState({
          errorMsg:
            resolvedPayload.errorMessage ||
            'No transferable data received from source.',
        });
        return;
      }

      const firstItem = resolvedPayload.data[0];
      try {
        const text = await firstItem.blob.text();
        const loadedFilename =
          'filename' in firstItem ? (firstItem as StoredFile).filename : null;

        const newState: Partial<ConverterState> = {
          inputText: text,
          lastLoadedFilename: loadedFilename,
          jsonOutput: '',
          jsonlOutput: '',
          errorMsg: '',
        };
        setToolState(newState);
        await saveStateNow({ ...toolState, ...newState });
        setUserDeferredAutoPopup(false);
      } catch (e) {
        setToolState({
          errorMsg: `Error reading text from received data: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    },
    [getToolMetadata, setToolState, saveStateNow, toolState]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingState) {
      initialToolStateLoadCompleteRef.current = true;
    }
  }, [isLoadingState]);

  useEffect(() => {
    if (
      initialToolStateLoadCompleteRef.current &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [itdeTarget, userDeferredAutoPopup]);

  const handleConversion = useCallback(
    (text: string, op: Operation) => {
      if (!text.trim()) {
        setToolState({ jsonOutput: '', jsonlOutput: '', errorMsg: '' });
        return;
      }

      if (op === 'json-to-jsonl') {
        try {
          const data = JSON.parse(text);
          if (!Array.isArray(data)) {
            throw new Error('Input must be a JSON array.');
          }
          const jsonl = data.map((item) => JSON.stringify(item)).join('\n');
          setToolState({ jsonlOutput: jsonl, jsonOutput: '', errorMsg: '' });
        } catch (e) {
          setToolState({
            jsonlOutput: '',
            jsonOutput: '',
            errorMsg: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      } else {
        // jsonl-to-json
        const lines = text.trim().split('\n');
        const objects = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              objects.push(JSON.parse(line));
            } catch (e) {
              setToolState({
                jsonOutput: '',
                jsonlOutput: '',
                errorMsg: `Invalid JSON on line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`,
              });
              return;
            }
          }
        }
        try {
          const json = JSON.stringify(objects, null, 2);
          setToolState({ jsonOutput: json, jsonlOutput: '', errorMsg: '' });
        } catch (e) {
          setToolState({
            jsonOutput: '',
            jsonlOutput: '',
            errorMsg: `Failed to stringify result: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }
    },
    [setToolState]
  );

  const debouncedConversion = useDebouncedCallback(
    handleConversion,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (isLoadingState) return;
    debouncedConversion(toolState.inputText, toolState.operation);
  }, [
    toolState.inputText,
    toolState.operation,
    isLoadingState,
    debouncedConversion,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({
      inputText: event.target.value,
      lastLoadedFilename: null,
    });
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
  };

  const handleOperationChange = (newOperation: Operation) => {
    setToolState({ operation: newOperation });
  };

  const handleClear = useCallback(async () => {
    const newState: ConverterState = {
      ...DEFAULT_STATE,
      operation: toolState.operation,
    };
    setToolState(newState);
    await saveStateNow(newState);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
  }, [setToolState, saveStateNow, toolState.operation]);

  const handleFileSelected = useCallback(
    async (files: StoredFile[]) => {
      setIsLoadFileModalOpen(false);
      if (files.length === 0) return;
      const file = files[0];
      try {
        const text = await file.blob.text();
        setToolState({
          inputText: text,
          lastLoadedFilename: file.filename,
        });
      } catch (e) {
        setToolState({
          errorMsg: `Error reading file: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    },
    [setToolState]
  );

  const handleCopyToClipboard = useCallback(async () => {
    if (!outputValue) return;
    try {
      await navigator.clipboard.writeText(outputValue);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setToolState({ errorMsg: 'Failed to copy to clipboard.' });
    }
  }, [outputValue, setToolState]);

  const initiateOutputAction = (action: 'download' | 'save') => {
    if (!outputValue.trim() || toolState.errorMsg) {
      return;
    }
    setSuggestedFilenameForPrompt(
      generateOutputFilename(toolState.lastLoadedFilename)
    );
    setFilenameAction(action);
    setIsFilenameModalOpen(true);
  };

  const handleFilenameConfirm = useCallback(
    async (filename: string) => {
      setIsFilenameModalOpen(false);
      const currentAction = filenameAction;
      setFilenameAction(null);
      if (!currentAction || !outputValue) return;

      const mimeType =
        toolState.operation === 'jsonl-to-json'
          ? 'application/json'
          : 'application/x-jsonlines';
      const blob = new Blob([outputValue], { type: mimeType });

      if (currentAction === 'download') {
        try {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          setDownloadSuccess(true);
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setTimeout(() => setDownloadSuccess(false), 2000);
        } catch (err) {
          setToolState({ errorMsg: 'Failed to prepare download.' });
        }
      } else if (currentAction === 'save') {
        try {
          await addFileToLibrary(blob, filename, mimeType, false);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err) {
          setToolState({ errorMsg: 'Failed to save to library.' });
        }
      }
    },
    [
      filenameAction,
      outputValue,
      toolState.operation,
      toolState.lastLoadedFilename,
      addFileToLibrary,
      setToolState,
    ]
  );

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading Converter...
      </p>
    );
  }

  const canPerformOutputActions = !!outputValue.trim() && !toolState.errorMsg;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label
              htmlFor="input-text"
              className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
            >
              Input
              {toolState.lastLoadedFilename && (
                <span className="ml-2 text-xs italic">
                  ({toolState.lastLoadedFilename})
                </span>
              )}
            </label>
            <Button
              variant="neutral-outline"
              size="sm"
              onClick={() => setIsLoadFileModalOpen(true)}
              iconLeft={<ArrowUpTrayIcon className="h-4 w-4" />}
            >
              Load File
            </Button>
          </div>
          <Textarea
            id="input-text"
            value={toolState.inputText}
            onChange={handleInputChange}
            placeholder={
              toolState.operation === 'json-to-jsonl'
                ? '[{"id":1},{"id":2}]'
                : '{"id":1}\n{"id":2}'
            }
            rows={12}
            textareaClassName="font-mono text-sm"
            spellCheck="false"
          />
        </div>
        <div>
          <label
            htmlFor="output-text"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"
          >
            Output
          </label>
          <Textarea
            id="output-text"
            value={outputValue}
            readOnly
            placeholder="Conversion result will appear here..."
            rows={12}
            textareaClassName="font-mono text-sm bg-[rgb(var(--color-bg-subtle))]"
            spellCheck="false"
          />
        </div>
      </div>

      <div className="p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center">
          <RadioGroup
            name="conversionOperation"
            legend="Operation:"
            options={operationOptions}
            selectedValue={toolState.operation}
            onChange={handleOperationChange}
            layout="horizontal"
          />
          <div className="flex-grow"></div>
          <div className="flex items-center gap-2">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={
                itdeTarget.pendingSignals.length > 0 &&
                userDeferredAutoPopup &&
                !itdeTarget.isModalOpen
              }
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            <OutputActionButtons
              canPerform={canPerformOutputActions}
              isSaveSuccess={saveSuccess}
              isCopySuccess={copySuccess}
              isDownloadSuccess={downloadSuccess}
              onInitiateSave={() => initiateOutputAction('save')}
              onInitiateDownload={() => initiateOutputAction('download')}
              onCopy={handleCopyToClipboard}
              onClear={handleClear}
              directiveName={directiveName}
              outputConfig={metadata.outputConfig}
              onBeforeSignal={async () => {
                await saveStateNow();
              }}
            />
          </div>
        </div>
      </div>

      {toolState.errorMsg && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {toolState.errorMsg}
          </div>
        </div>
      )}

      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelected}
        slurpContentOnly={true}
        mode="selectExistingOrUploadNew"
        accept=".json,.jsonl,application/json,application/x-jsonlines,text/plain"
        selectionMode="single"
        initialTab="upload"
      />
      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => setIsFilenameModalOpen(false)}
        onConfirm={handleFilenameConfirm}
        initialFilename={suggestedFilenameForPrompt}
        title={
          filenameAction === 'download'
            ? 'Enter Download Filename'
            : 'Enter Filename for Library'
        }
        filenameAction={filenameAction || 'download'}
      />
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={itdeTarget.acceptSignal}
        onIgnore={itdeTarget.ignoreSignal}
        onDeferAll={itdeTarget.closeModal}
        onIgnoreAll={itdeTarget.ignoreAllSignals}
      />
    </div>
  );
}