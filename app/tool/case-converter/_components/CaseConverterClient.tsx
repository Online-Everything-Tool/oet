// FILE: app/tool/case-converter/_components/CaseConverterClient.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import RadioGroup from '../../_components/form/RadioGroup';
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
const TITLE_WORD_DELIMITERS = /([\s\-_]+)/;
const AUTO_PROCESS_DEBOUNCE_MS = 300;

interface CaseConverterToolState {
  inputText: string;
  caseType: CaseType;
  outputValue: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_CASE_CONVERTER_STATE: CaseConverterToolState = {
  inputText: '',
  caseType: 'lowercase',
  outputValue: '',
  lastLoadedFilename: null,
};

interface CaseConverterClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function CaseConverterClient({
  urlStateParams,
  toolRoute,
}: CaseConverterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    clearState: persistentClearState,
  } = useToolState<CaseConverterToolState>(
    toolRoute,
    DEFAULT_CASE_CONVERTER_STATE
  );

  const [uiError, setUiError] = useState<string>('');
  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameAction, setFilenameAction] = useState<
    'download' | 'save' | null
  >(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] =
    useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { addFile: addFileToLibrary } = useFileLibrary();

  const performConversion = useCallback(
    (textToProcess = toolState.inputText, targetCase = toolState.caseType) => {
      let result = '';
      let currentError = '';
      if (uiError) setUiError('');

      const inputForProcessing =
        targetCase === 'title' ? textToProcess : textToProcess.trim();

      if (!inputForProcessing && !textToProcess.trim()) {
        setToolState({ outputValue: '' });
        if (uiError) setUiError('');
        return;
      }

      try {
        switch (targetCase) {
          case 'uppercase':
            result = inputForProcessing.toUpperCase();
            break;
          case 'lowercase':
            result = inputForProcessing.toLowerCase();
            break;
          case 'sentence':
            result = inputForProcessing
              .toLowerCase()
              .replace(SENTENCE_CASE_REGEX, (char) => char.toUpperCase());
            break;
          case 'title':
            result = inputForProcessing
              .split(/(\r?\n)/)
              .map((segment) => {
                if (/^\r?\n$/.test(segment)) {
                  return segment;
                }
                return segment
                  .split(TITLE_WORD_DELIMITERS)
                  .map((part) => {
                    if (
                      TITLE_WORD_DELIMITERS.test(part) &&
                      part.match(TITLE_WORD_DELIMITERS)?.[0] === part
                    ) {
                      return part;
                    }

                    if (part && part.length > 0) {
                      return (
                        part.charAt(0).toUpperCase() +
                        part.slice(1).toLowerCase()
                      );
                    }
                    return part;
                  })
                  .join('');
              })
              .join('');
            break;
          case 'camel':
            result = inputForProcessing
              .toLowerCase()
              .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
              .replace(/^./, (char) => char.toLowerCase());
            break;
          case 'pascal':
            result = inputForProcessing
              .toLowerCase()
              .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
              .replace(/^./, (char) => char.toUpperCase());
            break;
          case 'snake':
            result = inputForProcessing
              .replace(/\W+/g, ' ')
              .trim()
              .split(/ |\B(?=[A-Z])/)
              .map((word) => word.toLowerCase())
              .filter(Boolean)
              .join('_');
            break;
          case 'kebab':
            result = inputForProcessing
              .replace(/\W+/g, ' ')
              .trim()
              .split(/ |\B(?=[A-Z])/)
              .map((word) => word.toLowerCase())
              .filter(Boolean)
              .join('-');
            break;

          default:
            const exhaustiveCheck: never = targetCase;
            throw new Error(`Unsupported case type: ${exhaustiveCheck}`);
        }
        setToolState({ outputValue: result });
        if (uiError) setUiError('');
      } catch (err) {
        currentError =
          err instanceof Error ? err.message : 'Failed to convert case.';
        setUiError(currentError);
        setToolState({ outputValue: '' });
      }
    },
    [toolState.inputText, toolState.caseType, setToolState, uiError]
  );

  const debouncedPerformConversion = useDebouncedCallback(
    performConversion,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (isLoadingToolState || !urlStateParams || urlStateParams.length === 0)
      return;

    const params = new URLSearchParams(window.location.search);
    const textFromUrl = params.get('text');
    const caseFromUrl = params.get('case') as CaseType | null;

    let newText = toolState.inputText;
    let newCase = toolState.caseType;
    let newFilename = toolState.lastLoadedFilename;
    let needsStateUpdate = false;

    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      newText = textFromUrl;
      newFilename = '(loaded from URL)';
      needsStateUpdate = true;
    }

    if (
      caseFromUrl &&
      CASE_TYPES.some((ct) => ct.value === caseFromUrl) &&
      caseFromUrl !== toolState.caseType
    ) {
      newCase = caseFromUrl;
      needsStateUpdate = true;
    }

    if (needsStateUpdate) {
      setToolState({
        inputText: newText,
        caseType: newCase,
        lastLoadedFilename: newFilename,
        outputValue: '',
      });
    } else if (newText.trim() && !toolState.outputValue.trim() && !uiError) {
      performConversion(newText, newCase);
    }
  }, [
    isLoadingToolState,
    urlStateParams,
    setToolState,
    performConversion,
    toolState.inputText,
    toolState.caseType,
    toolState.lastLoadedFilename,
    toolState.outputValue,
    uiError,
  ]);

  useEffect(() => {
    if (isLoadingToolState) return;

    const text = toolState.inputText;
    const currentCase = toolState.caseType;

    const effectiveText = currentCase === 'title' ? text : text.trim();

    if (!effectiveText && !text.trim()) {
      if (toolState.outputValue !== '') setToolState({ outputValue: '' });
      if (uiError !== '') setUiError('');
      debouncedPerformConversion.cancel();
      return;
    }
    debouncedPerformConversion(text, currentCase);
  }, [
    toolState.inputText,
    toolState.caseType,
    isLoadingToolState,
    debouncedPerformConversion,
    setToolState,
    toolState.outputValue,
    uiError,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({
      inputText: event.target.value,
      lastLoadedFilename: null,
      outputValue: '',
    });
    setCopySuccess(false);
    setSaveSuccess(false);
  };

  const handleCaseTypeChange = (newCaseType: CaseType) => {
    setToolState({ caseType: newCaseType, outputValue: '' });
  };

  const handleClear = useCallback(async () => {
    await persistentClearState();
    setUiError('');
    setCopySuccess(false);
    setSaveSuccess(false);
    debouncedPerformConversion.cancel();
  }, [persistentClearState, debouncedPerformConversion]);

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLoadFileModalOpen(false);
      if (files.length === 0) return;
      const file = files[0];
      if (!file.blob) {
        setUiError(`Error: File "${file.name}" has no content.`);
        return;
      }
      try {
        const text = await file.blob.text();
        setToolState({
          inputText: text,
          lastLoadedFilename: file.name,
          outputValue: '',
        });
        setUiError('');
      } catch (e) {
        setUiError(
          `Error reading file "${file.name}": ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        setToolState({
          inputText: '',
          lastLoadedFilename: null,
          outputValue: '',
        });
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
        if (!toolState.outputValue) {
          setUiError('No output to download.');
          return;
        }
        try {
          const blob = new Blob([toolState.outputValue], {
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
          if (uiError) setUiError('');
        } catch (err) {
          setUiError(
            `Failed to prepare download: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      } else if (currentAction === 'save') {
        if (!toolState.outputValue) {
          setUiError('No output to save.');
          return;
        }
        const blob = new Blob([toolState.outputValue], {
          type: 'text/plain;charset=utf-8',
        });
        addFileToLibrary(blob, finalFilename, 'text/plain', false)
          .then(() => {
            setSaveSuccess(true);
            if (uiError) setUiError('');
            setTimeout(() => setSaveSuccess(false), 2000);
          })
          .catch((err) =>
            setUiError(
              `Failed to save to library: ${err instanceof Error ? err.message : 'Unknown error'}`
            )
          );
      }
      setFilenameAction(null);
    },
    [
      filenameAction,
      toolState.lastLoadedFilename,
      toolState.outputValue,
      addFileToLibrary,
      generateOutputFilename,
      uiError,
    ]
  );

  const initiateOutputAction = useCallback(
    (action: 'download' | 'save') => {
      if (!toolState.outputValue.trim() || uiError) {
        setUiError(uiError || 'No output to ' + action + '.');
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
      handleFilenameConfirm,
      toolState.outputValue,
      uiError,
      toolState.lastLoadedFilename,
      generateOutputFilename,
    ]
  );

  const handleCopyToClipboard = useCallback(async () => {
    if (!toolState.outputValue) {
      setUiError('No output to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(toolState.outputValue);
      setCopySuccess(true);
      if (uiError) setUiError('');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (_err) {
      setUiError('Failed to copy to clipboard.');
    }
  }, [toolState.outputValue, uiError]);

  if (isLoadingToolState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Case Converter...
      </p>
    );
  }
  const canPerformOutputActions =
    toolState.outputValue.trim() !== '' && !uiError;
  const currentCaseLabel =
    CASE_TYPES.find((ct) => ct.value === toolState.caseType)?.label ||
    toolState.caseType;

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
        <div className="flex flex-wrap justify-between items-center">
          <RadioGroup
            name="caseType"
            legend="Convert to:"
            options={CASE_TYPES.map((ct) => ({
              value: ct.value,
              label: ct.label,
            }))}
            selectedValue={toolState.caseType}
            onChange={handleCaseTypeChange}
            layout="horizontal"
            className="flex-grow"
            radioClassName="text-sm mb-2 mr-2"
            labelClassName="font-medium"
          />
          <Button
            variant="neutral"
            onClick={handleClear}
            disabled={
              !toolState.inputText && !toolState.outputValue && !uiError
            }
            title="Clear input and output"
            className="ml-auto sm:ml-4 mt-2 sm:mt-0"
          >
            Clear
          </Button>
        </div>
      </div>

      {uiError && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {uiError}
          </div>
        </div>
      )}

      <Textarea
        label={`Output (${currentCaseLabel}):`}
        id="text-output"
        rows={8}
        value={toolState.outputValue}
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
        slurpContentOnly={true}
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
            ? 'Please enter a filename for the download:'
            : 'Please enter a filename to save to the library:'
        }
        confirmButtonText={
          filenameAction === 'download' ? 'Download' : 'Save to Library'
        }
      />
    </div>
  );
}
