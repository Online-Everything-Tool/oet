// FILE: app/tool/case-converter/_components/CaseConverterClient.tsx
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { TriggerType } from '@/src/types/history';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ParamConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { CASE_TYPES, CaseType } from '@/src/constants/text';
import { useDebouncedCallback } from 'use-debounce';
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const SENTENCE_CASE_REGEX = /(^\s*\w|[.!?]\s*\w)/g;
const TITLE_CASE_DELIMITERS = /[\s\-_]+/;
const AUTO_PROCESS_DEBOUNCE_MS = 300;

interface CaseConverterToolState {
  inputText: string;
  caseType: CaseType;
  lastLoadedFilename?: string | null;
}

const DEFAULT_CASE_CONVERTER_STATE: CaseConverterToolState = {
  inputText: '',
  caseType: 'lowercase',
  lastLoadedFilename: null,
};

const buttonColorCycle = [
  {
    base: '--color-button-primary-bg',
    hover: '--color-button-primary-hover-bg',
    text: '--color-button-primary-text',
  },
  {
    base: '--color-button-secondary-bg',
    hover: '--color-button-secondary-hover-bg',
    text: '--color-button-secondary-text',
  },
  {
    base: '--color-button-accent2-bg',
    hover: '--color-button-accent2-hover-bg',
    text: '--color-button-accent2-text',
  },
  {
    base: '--color-button-accent-bg',
    hover: '--color-button-accent-hover-bg',
    text: '--color-button-accent-text',
  },
] as const;

const activeBgColorVar = '--color-button-accent-bg';
const activeHoverBgColorVar = '--color-button-accent-hover-bg';
const activeTextColorVar = '--color-button-accent-text';

interface CaseConverterClientProps {
  urlStateParams: ParamConfig[];
  toolTitle: string;
  toolRoute: string;
}

export default function CaseConverterClient({
  urlStateParams,
  toolTitle,
  toolRoute,
}: CaseConverterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
  } = useToolState<CaseConverterToolState>(
    toolRoute,
    DEFAULT_CASE_CONVERTER_STATE
  );

  const [outputValue, setOutputValue] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { addHistoryEntry } = useHistory();
  const { addFile: addFileToLibrary } = useFileLibrary();

  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameAction, setFilenameAction] = useState<
    'download' | 'save' | null
  >(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] =
    useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const performConversion = useCallback(
    (
      triggerType: TriggerType,
      textToProcess = toolState.inputText,
      targetCase = toolState.caseType
    ) => {
      let result = '';
      let currentError = '';
      let status: 'success' | 'error' = 'success';
      let historyOutputObj: Record<string, unknown> = {};
      const targetCaseLabel =
        CASE_TYPES.find((ct) => ct.value === targetCase)?.label || targetCase;
      setError('');
      const trimmedTextToProcess = textToProcess.trim();
      if (!trimmedTextToProcess) {
        setOutputValue('');
        return;
      }

      const inputDetailsForHistory = {
        source: toolState.lastLoadedFilename || 'pasted/typed',
        inputTextTruncated:
          trimmedTextToProcess.length > 500
            ? trimmedTextToProcess.substring(0, 500) + '...'
            : trimmedTextToProcess,
        caseType: targetCase,
      };

      try {
        switch (targetCase) {
          case 'uppercase':
            result = trimmedTextToProcess.toUpperCase();
            break;
          case 'lowercase':
            result = trimmedTextToProcess.toLowerCase();
            break;
          case 'sentence':
            result = trimmedTextToProcess
              .toLowerCase()
              .replace(SENTENCE_CASE_REGEX, (char) => char.toUpperCase());
            break;
          case 'title':
            result = trimmedTextToProcess
              .toLowerCase()
              .split(TITLE_CASE_DELIMITERS)
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            break;
          case 'camel':
            result = trimmedTextToProcess
              .toLowerCase()
              .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
              .replace(/^./, (char) => char.toLowerCase());
            break;
          case 'pascal':
            result = trimmedTextToProcess
              .toLowerCase()
              .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
              .replace(/^./, (char) => char.toUpperCase());
            break;
          case 'snake':
            result = trimmedTextToProcess
              .replace(/\W+/g, ' ')
              .split(/ |\B(?=[A-Z])/)
              .map((word) => word.toLowerCase())
              .filter(Boolean)
              .join('_');
            break;
          case 'kebab':
            result = trimmedTextToProcess
              .replace(/\W+/g, ' ')
              .split(/ |\B(?=[A-Z])/)
              .map((word) => word.toLowerCase())
              .filter(Boolean)
              .join('-');
            break;
          default:
            const exhaustiveCheck: never = targetCase;
            throw new Error(`Unsupported case type: ${exhaustiveCheck}`);
        }
        setOutputValue(result);
        historyOutputObj = {
          resultCaseTypeLabel: targetCaseLabel,
          outputLength: result.length,
        };
      } catch (err) {
        currentError =
          err instanceof Error ? err.message : 'Failed to convert case.';
        setError(currentError);
        status = 'error';
        historyOutputObj = {
          resultCaseTypeLabel: `Error converting to ${targetCaseLabel}`,
          errorMessage: currentError,
        };
        (inputDetailsForHistory as Record<string, unknown>).error =
          currentError;
        setOutputValue('');
      }
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: triggerType,
        input: inputDetailsForHistory,
        output: historyOutputObj,
        status: status,
        eventTimestamp: Date.now(),
      });
    },
    [
      toolState.inputText,
      toolState.caseType,
      toolState.lastLoadedFilename,
      addHistoryEntry,
      toolTitle,
      toolRoute,
    ]
  );

  const debouncedPerformConversion = useDebouncedCallback(
    performConversion,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (!isLoadingToolState && urlStateParams?.length > 0) {
      const params = new URLSearchParams(window.location.search);
      let initialInput = toolState.inputText;
      let initialCase = toolState.caseType;
      let needsStateUpdate = false;
      const textFromUrl = params.get('text');
      if (textFromUrl !== null && textFromUrl !== initialInput) {
        initialInput = textFromUrl;
        needsStateUpdate = true;
      }
      const caseFromUrl = params.get('case') as CaseType;
      if (
        caseFromUrl &&
        CASE_TYPES.some((ct) => ct.value === caseFromUrl) &&
        caseFromUrl !== initialCase
      ) {
        initialCase = caseFromUrl;
        needsStateUpdate = true;
      }
      if (needsStateUpdate) {
        setToolState((prev) => ({
          ...prev,
          inputText: initialInput,
          caseType: initialCase,
          lastLoadedFilename:
            textFromUrl !== null
              ? '(loaded from URL)'
              : prev.lastLoadedFilename,
        }));
      } else if (initialInput.trim()) {
        setTimeout(
          () => performConversion('query', initialInput, initialCase),
          0
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingToolState, urlStateParams, setToolState]);

  useEffect(() => {
    if (!isLoadingToolState) {
      debouncedPerformConversion(
        'auto',
        toolState.inputText,
        toolState.caseType
      );
    }
  }, [
    toolState.inputText,
    toolState.caseType,
    isLoadingToolState,
    debouncedPerformConversion,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState((prev) => ({
      ...prev,
      inputText: event.target.value,
      lastLoadedFilename: null,
    }));
    setCopySuccess(false);
    setSaveSuccess(false);
  };

  const handleClear = useCallback(() => {
    setToolState(DEFAULT_CASE_CONVERTER_STATE);
    setOutputValue('');
    setError('');
    setCopySuccess(false);
    setSaveSuccess(false);
    debouncedPerformConversion.cancel();
  }, [setToolState, debouncedPerformConversion]);

  const handleCaseButtonClick = (newCaseType: CaseType) => {
    setToolState((prev) => ({ ...prev, caseType: newCaseType }));
  };

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[], source: 'library' | 'upload') => {
      setIsLoadFileModalOpen(false);
      if (files.length === 0) return;
      const file = files[0];
      if (!file.blob) {
        setError(`Error: File "${file.name}" has no content.`);
        return;
      }
      try {
        const text = await file.blob.text();
        setToolState((prev) => ({
          ...prev,
          inputText: text,
          lastLoadedFilename: file.name,
        }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(`Error reading file "${file.name}": ${msg}`);
        setToolState((prev) => ({
          ...prev,
          inputText: '',
          lastLoadedFilename: null,
        }));
      }
    },
    [setToolState]
  );

  const generateOutputFilename = useCallback(
    (baseName?: string | null): string => {
      const base = baseName?.replace(/\.[^/.]+$/, '') || 'converted-text';
      const caseLabel = toolState.caseType.replace(/_/g, '-');
      return `${base}.${caseLabel}-${Date.now()}.txt`;
    },
    [toolState.caseType]
  );

  const initiateOutputAction = useCallback(
    (action: 'download' | 'save') => {
      if (!outputValue.trim() || error) {
        setError(error || 'No output to ' + action + '.');
        return;
      }
      if (toolState.lastLoadedFilename) {
        const autoFilename = generateOutputFilename(
          toolState.lastLoadedFilename
        );
        handleFilenameConfirm(autoFilename, action);
      } else {
        setSuggestedFilenameForPrompt(generateOutputFilename(null));
        setFilenameAction(action);
        setIsFilenameModalOpen(true);
      }
    },
    [
      outputValue,
      error,
      toolState.lastLoadedFilename,
      generateOutputFilename,
      setFilenameAction,
      setIsFilenameModalOpen,
      setSuggestedFilenameForPrompt,
      setError,
    ]
  );

  const handleFilenameConfirm = useCallback(
    (filename: string, actionOverride?: 'download' | 'save') => {
      setIsFilenameModalOpen(false);
      const currentAction = actionOverride || filenameAction;
      if (!currentAction) return;
      let finalFilename = filename.trim();
      if (!finalFilename)
        finalFilename = generateOutputFilename(toolState.lastLoadedFilename);
      if (!/\.txt$/i.test(finalFilename)) finalFilename += '.txt';

      if (currentAction === 'download') {
        if (!outputValue) {
          setError('No output to download.');
          return;
        }
        try {
          const blob = new Blob([outputValue], {
            type: 'text/plain;charset=utf-8',
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = finalFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setError('');
          addHistoryEntry({
            toolName: toolTitle,
            toolRoute,
            trigger: 'click',
            input: {
              action: 'downloadOutput',
              filename: finalFilename,
              length: outputValue.length,
            },
            output: { message: `Downloaded ${finalFilename}` },
            status: 'success',
            eventTimestamp: Date.now(),
          });
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Unknown download error';
          setError(`Failed to prepare download: ${msg}`);
          addHistoryEntry({
            toolName: toolTitle,
            toolRoute,
            trigger: 'click',
            input: { action: 'downloadOutput', filename: finalFilename },
            output: { error: `Download failed: ${msg}` },
            status: 'error',
            eventTimestamp: Date.now(),
          });
        }
      } else if (currentAction === 'save') {
        if (!outputValue) {
          setError('No output to save.');
          return;
        }
        const blob = new Blob([outputValue], {
          type: 'text/plain;charset=utf-8',
        });
        addFileToLibrary(blob, finalFilename, 'text/plain', false)
          .then((newFileId) => {
            setSaveSuccess(true);
            setError('');
            setTimeout(() => setSaveSuccess(false), 2000);
            addHistoryEntry({
              toolName: toolTitle,
              toolRoute,
              trigger: 'click',
              input: {
                action: 'saveOutputToLibrary',
                filename: finalFilename,
                length: outputValue.length,
              },
              output: {
                message: 'Saved to library',
                fileId: newFileId,
                filename: finalFilename,
              },
              status: 'success',
              eventTimestamp: Date.now(),
              outputFileIds: [newFileId],
            });
          })
          .catch((err) => {
            const msg =
              err instanceof Error ? err.message : 'Unknown save error';
            setError(`Failed to save to library: ${msg}`);
            addHistoryEntry({
              toolName: toolTitle,
              toolRoute,
              trigger: 'click',
              input: { action: 'saveOutputToLibrary', filename: finalFilename },
              output: { error: `Save to library failed: ${msg}` },
              status: 'error',
              eventTimestamp: Date.now(),
            });
          });
      }
      setFilenameAction(null);
    },
    [
      filenameAction,
      toolState.lastLoadedFilename,
      outputValue,
      addFileToLibrary,
      toolTitle,
      toolRoute,
      addHistoryEntry,
      setError,
      setSaveSuccess,
      generateOutputFilename,
      setIsFilenameModalOpen,
      setFilenameAction,
    ]
  );

  const handleCopyToClipboard = useCallback(async () => {
    if (!outputValue) {
      setError('No output to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(outputValue);
      setCopySuccess(true);
      setError('');
      setTimeout(() => setCopySuccess(false), 2000);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute,
        trigger: 'click',
        input: { action: 'copyOutput', length: outputValue.length },
        output: { message: 'Copied to clipboard' },
        status: 'success',
        eventTimestamp: Date.now(),
      });
    } catch (err) {
      setError('Failed to copy to clipboard.');
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute,
        trigger: 'click',
        input: { action: 'copyOutput' },
        output: { error: 'Failed to copy' },
        status: 'error',
        eventTimestamp: Date.now(),
      });
    }
  }, [
    outputValue,
    toolTitle,
    toolRoute,
    addHistoryEntry,
    setError,
    setCopySuccess,
  ]);

  const currentCaseLabel = useMemo(() => {
    return (
      CASE_TYPES.find((ct) => ct.value === toolState.caseType)?.label ||
      toolState.caseType
    );
  }, [toolState.caseType]);

  if (isLoadingToolState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Case Converter...
      </p>
    );
  }
  const canPerformOutputActions = outputValue.trim() !== '' && !error;

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="flex justify-between items-center gap-2">
        <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
          Input Text:
          {toolState.lastLoadedFilename && (
            <span className="ml-2 text-xs italic">
              (from: {toolState.lastLoadedFilename})
            </span>
          )}
        </label>
        <Button
          variant="neutral-outline"
          size="sm"
          onClick={() => setIsLoadFileModalOpen(true)}
          iconLeft={<ArrowUpTrayIcon className="h-4 w-4" />}
        >
          Load from File
        </Button>
      </div>
      <Textarea
        id="text-input"
        rows={8}
        value={toolState.inputText}
        onChange={handleInputChange}
        placeholder="Paste or type your text here..."
        textareaClassName="text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
        spellCheck="false"
      />

      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-3">
          Convert to:
        </label>
        <div className="flex flex-wrap gap-2">
          {CASE_TYPES.map((ct, index) => {
            const isActive = toolState.caseType === ct.value;
            const colorIndex = index % buttonColorCycle.length;
            const colors = buttonColorCycle[colorIndex];
            return (
              <Button
                key={ct.value}
                type="button"
                onClick={() => handleCaseButtonClick(ct.value)}
                variant={isActive ? 'accent' : 'neutral'}
                className={
                  isActive
                    ? `ring-2 ring-offset-1 ring-[rgb(var(${activeBgColorVar}))]`
                    : `bg-[rgb(var(${colors.base}))] text-[rgb(var(${colors.text}))] hover:bg-[rgb(var(${colors.hover}))] border-transparent`
                }
                aria-pressed={isActive}
                size="sm"
              >
                {ct.label}
              </Button>
            );
          })}
          <Button
            variant="neutral"
            onClick={handleClear}
            disabled={!toolState.inputText && !outputValue && !error}
            title="Clear input and output"
            className="ml-auto"
          >
            Clear
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          {' '}
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />{' '}
          <div>
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        </div>
      )}

      <Textarea
        label={`Output (${currentCaseLabel}):`}
        id="text-output"
        rows={8}
        value={outputValue}
        readOnly
        placeholder="Result appears here..."
        textareaClassName="text-base bg-[rgb(var(--color-bg-subtle))] placeholder:text-[rgb(var(--color-input-placeholder))]"
        aria-live="polite"
        spellCheck="false"
      />

      {canPerformOutputActions && (
        <div className="flex flex-wrap gap-3 items-center p-3 border-t border-[rgb(var(--color-border-base))]">
          <Button
            variant="primary-outline"
            onClick={() => initiateOutputAction('save')}
            disabled={saveSuccess}
            iconLeft={
              saveSuccess ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <DocumentPlusIcon className="h-5 w-5" />
              )
            }
          >
            {saveSuccess ? 'Saved!' : 'Save to Library'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => initiateOutputAction('download')}
            iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
          >
            Download Output
          </Button>
          <Button
            variant="neutral"
            onClick={handleCopyToClipboard}
            disabled={copySuccess}
            iconLeft={
              copySuccess ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5" />
              )
            }
          >
            {copySuccess ? 'Copied!' : 'Copy Output'}
          </Button>
        </div>
      )}

      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".txt,text/*"
        selectionMode="single"
        libraryFilter={{ category: 'text' }}
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
        promptMessage={
          filenameAction === 'download'
            ? 'Filename for download:'
            : 'Filename for library:'
        }
        confirmButtonText={
          filenameAction === 'download' ? 'Download' : 'Save to Library'
        }
      />
    </div>
  );
}
