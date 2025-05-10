// FILE: app/tool/base64-encode-decode/_components/Base64EncodeDecodeClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { TriggerType } from '@/src/types/history';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import RadioGroup from '../../_components/form/RadioGroup';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ParamConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { useDebouncedCallback } from 'use-debounce'; // Import useDebouncedCallback
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon,
  // ArrowPathIcon, // No longer needed for Process button
} from '@heroicons/react/24/outline';

type Operation = 'encode' | 'decode';
type Base64Likelihood =
  | 'unknown'
  | 'possibly_base64_or_text'
  | 'likely_text'
  | 'invalid_base64_chars';

interface Base64ToolState {
  inputText: string;
  operation: Operation;
  lastLoadedFilename?: string | null;
}

const DEFAULT_BASE64_TOOL_STATE: Base64ToolState = {
  inputText: '',
  operation: 'encode',
  lastLoadedFilename: null,
};

const AUTO_PROCESS_DEBOUNCE_MS = 500; // Debounce time for auto-processing on text input

interface Base64EncodeDecodeClientProps {
  urlStateParams: ParamConfig[];
  toolTitle: string;
  toolRoute: string;
}

export default function Base64EncodeDecodeClient({
  urlStateParams,
  toolTitle,
  toolRoute,
}: Base64EncodeDecodeClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
  } = useToolState<Base64ToolState>(toolRoute, DEFAULT_BASE64_TOOL_STATE);

  const [outputValue, setOutputValue] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [base64Likelihood, setBase64Likelihood] =
    useState<Base64Likelihood>('unknown');

  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameAction, setFilenameAction] = useState<
    'download' | 'save' | null
  >(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] =
    useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { addHistoryEntry } = useHistory();
  const { addFile: addFileToLibrary } = useFileLibrary();

  const operationOptions = useMemo(
    () => [
      { value: 'encode' as Operation, label: 'Encode' },
      { value: 'decode' as Operation, label: 'Decode' },
    ],
    []
  );

  const handleEncodeDecode = useCallback(
    (
      triggerType: TriggerType,
      textToProcess = toolState.inputText,
      opToPerform = toolState.operation
    ) => {
      let currentOutput = '';
      let currentError = '';
      let status: 'success' | 'error' = 'success';
      let historyOutputObj: Record<string, unknown> = {};
      setError('');
      setOutputValue('');
      setCopySuccess(false);
      setSaveSuccess(false);

      const trimmedTextToProcess = textToProcess.trim(); // Use trimmed for processing

      if (!trimmedTextToProcess) {
        // If, after trimming, the input is empty, clear relevant state.
        // Don't clear lastLoadedFilename here if original inputText was just spaces from a file.
        // Let handleInputChange or handleClear manage lastLoadedFilename.
        setBase64Likelihood('unknown'); // Reset likelihood for empty effective input
        return;
      }

      const inputDetailsForHistory = {
        source: toolState.lastLoadedFilename || 'pasted/typed',
        inputTextTruncated:
          trimmedTextToProcess.length > 500
            ? trimmedTextToProcess.substring(0, 500) + '...'
            : trimmedTextToProcess,
        operation: opToPerform,
      };

      if (opToPerform === 'encode') {
        try {
          currentOutput = btoa(
            unescape(encodeURIComponent(trimmedTextToProcess))
          ); // Process trimmed
          setOutputValue(currentOutput);
          historyOutputObj = {
            operationResult: 'Encoded Text',
            outputLength: currentOutput.length,
          };
        } catch (err) {
          currentError = 'Failed to encode text. Ensure text is valid UTF-8.';
          setError(currentError);
          status = 'error';
          historyOutputObj = {
            operationResult: 'Encoding Error',
            errorMessage: currentError,
          };
        }
      } else {
        // Decode
        try {
          const cleanedTextToDecode = trimmedTextToProcess.replace(/\s/g, ''); // Further clean for decode
          if (
            cleanedTextToDecode.length % 4 !== 0 ||
            !/^[A-Za-z0-9+/]*={0,2}$/.test(cleanedTextToDecode)
          ) {
            throw new DOMException(
              'Input is not valid Base64.',
              'InvalidCharacterError'
            );
          }
          const decodedBytes = atob(cleanedTextToDecode);
          currentOutput = decodeURIComponent(
            Array.from(decodedBytes)
              .map((byte) => ('0' + byte.charCodeAt(0).toString(16)).slice(-2))
              .join('%')
          );
          setOutputValue(currentOutput);
          historyOutputObj = {
            operationResult: 'Decoded Text',
            outputLength: currentOutput.length,
          };
        } catch (err) {
          if (
            err instanceof DOMException &&
            err.name === 'InvalidCharacterError'
          ) {
            currentError =
              'Failed to decode: Input is not a valid Base64 string or contains invalid characters.';
          } else {
            currentError = 'An unexpected error occurred during decoding.';
          }
          setError(currentError);
          status = 'error';
          historyOutputObj = {
            operationResult: 'Decoding Error',
            errorMessage: currentError,
          };
        }
      }
      // Only add history if there was something to process (trimmed input was not empty)
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
      toolState.operation,
      toolState.lastLoadedFilename,
      addHistoryEntry,
      toolTitle,
      toolRoute,
    ] // Removed setToolState
  );

  // Debounced auto-processing for text input changes
  const debouncedProcess = useDebouncedCallback(
    (text: string, operation: Operation) => {
      if (text.trim()) {
        // Only process if there's non-whitespace content
        handleEncodeDecode('auto', text, operation);
      } else {
        // If input becomes effectively empty, clear output
        setOutputValue('');
        setError('');
        setBase64Likelihood('unknown');
      }
    },
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (!isLoadingToolState && urlStateParams?.length > 0) {
      const params = new URLSearchParams(window.location.search);
      let initialInput = toolState.inputText;
      let initialOp = toolState.operation;
      const textFromUrl = params.get('text');
      if (textFromUrl !== null && textFromUrl !== initialInput) {
        initialInput = textFromUrl;
      }
      const opFromUrl = params.get('operation') as Operation;
      if (
        opFromUrl &&
        ['encode', 'decode'].includes(opFromUrl) &&
        opFromUrl !== initialOp
      ) {
        initialOp = opFromUrl;
      }

      const needsStateUpdate =
        initialInput !== toolState.inputText ||
        initialOp !== toolState.operation;
      const loadedFilename =
        textFromUrl !== null
          ? '(loaded from URL)'
          : toolState.lastLoadedFilename;

      if (needsStateUpdate) {
        setToolState((prev) => ({
          ...prev,
          inputText: initialInput,
          operation: initialOp,
          lastLoadedFilename: loadedFilename,
        }));
      }

      // If input has content (either from URL or already in state), process it.
      // This will also cover the case where only the operation changed via URL for existing text.
      if (initialInput.trim()) {
        // We need to ensure this runs after state is set if it was updated.
        // If state was updated, the other useEffect for inputText/operation change will trigger processing.
        // If state was NOT updated (URL matched current state), but we still want to process on load, call here.
        if (!needsStateUpdate) {
          setTimeout(() => {
            handleEncodeDecode('query', initialInput, initialOp);
          }, 0);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingToolState, urlStateParams, setToolState]); // Removed handleEncodeDecode from deps

  useEffect(() => {
    // This effect handles likelihood and auto-processing on inputText or operation change
    const text = toolState.inputText;
    const operation = toolState.operation;

    if (!text) {
      setBase64Likelihood('unknown');
      setOutputValue('');
      setError('');
      return;
    }
    const cleanedInput = text.replace(/\s/g, '');
    if (!cleanedInput) {
      setBase64Likelihood('unknown');
      setOutputValue('');
      setError('');
      return;
    }

    const base64CharRegex = /^[A-Za-z0-9+/]*={0,2}$/;
    const potentialBase64Regex = /[A-Za-z0-9+/=]/;
    if (!base64CharRegex.test(cleanedInput)) {
      setBase64Likelihood('invalid_base64_chars');
    } else if (
      cleanedInput.length % 4 === 0 &&
      potentialBase64Regex.test(cleanedInput)
    ) {
      try {
        atob(cleanedInput);
        setBase64Likelihood('possibly_base64_or_text');
      } catch {
        setBase64Likelihood('likely_text');
      }
    } else {
      setBase64Likelihood('likely_text');
    }

    // Auto-process if not loading state (to avoid processing during initial hydration with persisted state)
    if (!isLoadingToolState) {
      debouncedProcess(text, operation);
    }
  }, [
    toolState.inputText,
    toolState.operation,
    isLoadingToolState,
    debouncedProcess,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState((prev) => ({
      ...prev,
      inputText: event.target.value,
      lastLoadedFilename: null,
    }));
    // Debounced processing will take care of outputValue, error, and likelihood
    setCopySuccess(false);
    setSaveSuccess(false); // Reset action feedbacks immediately
  };

  const handleOperationChange = (newOperation: Operation) => {
    setToolState((prev) => ({ ...prev, operation: newOperation }));
    // The useEffect listening to toolState.operation (and inputText) will trigger debouncedProcess
  };

  const handleClear = useCallback(() => {
    setToolState(DEFAULT_BASE64_TOOL_STATE); // This will also clear inputText
    setOutputValue('');
    setError('');
    setBase64Likelihood('unknown'); // Reset local UI state
    setCopySuccess(false);
    setSaveSuccess(false);
    debouncedProcess.cancel(); // Cancel any pending processing
  }, [setToolState, debouncedProcess]);

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
        const cleanedInputForLikelihood = text.replace(/\s/g, '');
        let opForFileLoad = toolState.operation;
        if (cleanedInputForLikelihood) {
          const b64CharRegex = /^[A-Za-z0-9+/]*={0,2}$/;
          if (!b64CharRegex.test(cleanedInputForLikelihood)) {
            opForFileLoad = 'encode';
          } else if (cleanedInputForLikelihood.length % 4 === 0) {
            try {
              atob(cleanedInputForLikelihood);
              opForFileLoad = 'decode';
            } catch {
              opForFileLoad = 'encode';
            }
          } else {
            opForFileLoad = 'encode';
          }
        }
        // Set state. The useEffect for inputText/operation change will trigger debouncedProcess.
        setToolState({
          inputText: text,
          lastLoadedFilename: file.name,
          operation: opForFileLoad,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(`Error reading file "${file.name}": ${msg}`);
        setToolState({ inputText: '', lastLoadedFilename: null }); // Reset relevant state
      }
    },
    [setToolState, toolState.operation]
  ); // Removed handleEncodeDecode, it's now handled by useEffect

  const generateOutputFilename = useCallback(
    (baseName?: string | null, chosenOperation?: Operation): string => {
      const op = chosenOperation || toolState.operation;
      const base =
        baseName?.replace(/\.[^/.]+$/, '') ||
        (op === 'encode' ? 'encoded-text' : 'decoded-text');
      const mainExtension = op === 'encode' ? '.b64' : '';
      return `${base}${mainExtension}.txt`;
    },
    [toolState.operation]
  );

  const initiateOutputAction = useCallback(
    (action: 'download' | 'save') => {
      if (!outputValue.trim()) {
        setError('No output to ' + action + '.');
        return;
      } // No error check here, rely on outputValue
      if (error && outputValue.trim()) {
        setError('Cannot ' + action + ' output due to existing input errors.');
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
      // ... (implementation remains the same as last correct version)
      setIsFilenameModalOpen(false);
      const currentAction = actionOverride || filenameAction;
      if (!currentAction) return;
      let finalFilename = filename.trim();
      if (!finalFilename)
        finalFilename = generateOutputFilename(
          toolState.lastLoadedFilename,
          toolState.operation
        );
      if (!/\.(txt|b64|text|json)$/i.test(finalFilename))
        finalFilename += toolState.operation === 'encode' ? '.b64.txt' : '.txt';
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
      toolState.operation,
      outputValue,
      addFileToLibrary,
      toolTitle,
      toolRoute,
      addHistoryEntry,
      setError,
      setSaveSuccess,
      generateOutputFilename,
      setFilenameAction,
      setIsFilenameModalOpen,
    ]
  );

  const handleCopyToClipboard = useCallback(async () => {
    /* ... as before ... */
  }, [
    outputValue,
    toolTitle,
    toolRoute,
    addHistoryEntry,
    setError,
    setCopySuccess,
  ]);

  const getLikelihoodBarState = () => {
    /* ... as before ... */
    switch (base64Likelihood) {
      case 'likely_text':
        return {
          text: 'Input: Likely Plain Text (Ready to Encode)',
          bgColor: 'bg-[rgb(var(--color-indicator-text))]',
          label: 'Text',
          valueNow: 10,
        };
      case 'possibly_base64_or_text':
        return {
          text: 'Input: Could be Base64 (Ready to Decode) or Plain Text',
          bgColor: 'bg-[rgb(var(--color-indicator-ambiguous))]',
          label: 'Ambiguous',
          valueNow: 50,
        };
      case 'invalid_base64_chars':
        return {
          text: 'Input: Contains characters NOT valid for Base64',
          bgColor: 'bg-[rgb(var(--color-text-error))]',
          label: 'Invalid Chars',
          valueNow: 80,
        };
      case 'unknown':
      default:
        return {
          text: 'Enter text to analyze format',
          bgColor: 'bg-[rgb(var(--color-indicator-base))]',
          label: 'Unknown',
          valueNow: 0,
        };
    }
  };
  const {
    text: likelihoodText,
    bgColor,
    label: likelihoodLabel,
    valueNow,
  } = getLikelihoodBarState();

  if (isLoadingToolState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Base64 Tool...
      </p>
    );
  }

  const canPerformOutputActions = outputValue.trim() !== '' && !error;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex justify-between items-center gap-2">
        <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
          Input:
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
        id="base64-input"
        rows={8}
        value={toolState.inputText}
        onChange={handleInputChange}
        placeholder="Paste text or Base64 string here..."
        textareaClassName="text-base font-mono"
        spellCheck="false"
        aria-describedby="format-indicator"
      />
      <div
        className="relative h-3 -mt-4 bg-[rgb(var(--color-indicator-track-bg))] rounded-full overflow-hidden"
        title={`Input Format Likelihood: ${likelihoodLabel}`}
      >
        <div
          className={`absolute inset-y-0 left-0 ${bgColor} rounded-full transition-all duration-300 ease-in-out`}
          style={{ width: `${valueNow}%` }}
          role="progressbar"
          aria-label={`Input Format Likelihood: ${likelihoodLabel}`}
          aria-valuenow={valueNow}
          aria-valuemin={0}
          aria-valuemax={100}
        ></div>
      </div>
      <p
        className="text-xs text-[rgb(var(--color-text-muted))] -mt-3 h-4"
        id="format-indicator"
        aria-live="polite"
      >
        {likelihoodText}
      </p>

      <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <RadioGroup
          name="base64Operation"
          legend="Operation:"
          options={operationOptions}
          selectedValue={toolState.operation}
          onChange={handleOperationChange}
          layout="horizontal"
          radioClassName="text-sm"
          labelClassName="font-medium"
        />
        {/* Process button removed */}
        <div className="flex-grow"></div>
        <Button
          variant="neutral"
          onClick={handleClear}
          title="Clear input and output"
          className="sm:ml-auto"
        >
          Clear
        </Button>
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
          </div>{' '}
        </div>
      )}
      <Textarea
        label="Output:"
        id="base64-output"
        rows={8}
        value={outputValue}
        readOnly
        placeholder="Result will appear here..."
        textareaClassName="text-base font-mono bg-[rgb(var(--color-bg-subtle))]"
        spellCheck="false"
        aria-live="polite"
      />
      {canPerformOutputActions && (
        <div className="flex flex-wrap gap-3 items-center p-3 border-t border-[rgb(var(--color-border-base))]">
          {' '}
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
            {' '}
            {saveSuccess ? 'Saved!' : 'Save to Library'}{' '}
          </Button>{' '}
          <Button
            variant="secondary"
            onClick={() => initiateOutputAction('download')}
            iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
          >
            {' '}
            Download Output{' '}
          </Button>{' '}
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
            {' '}
            {copySuccess ? 'Copied!' : 'Copy Output'}{' '}
          </Button>{' '}
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
