// FILE: app/tool/base64-encode-decode/_components/Base64EncodeDecodeClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import RadioGroup from '../../_components/form/RadioGroup';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ParamConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { useDebouncedCallback } from 'use-debounce';
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type Operation = 'encode' | 'decode';
type Base64Likelihood =
  | 'unknown'
  | 'likely_base64'
  | 'possibly_base64_or_text'
  | 'likely_text'
  | 'invalid_base64_chars';

interface Base64ToolState {
  inputText: string;
  operation: Operation;
  outputValue: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_BASE64_TOOL_STATE: Base64ToolState = {
  inputText: '',
  operation: 'encode',
  outputValue: '',
  lastLoadedFilename: null,
};

const AUTO_PROCESS_DEBOUNCE_MS = 300;

interface Base64EncodeDecodeClientProps {
  urlStateParams: ParamConfig[];
  toolTitle: string;
  toolRoute: string;
}

const determineInitialOperationAndLikelihood = (
  text: string
): { operation: Operation; likelihood: Base64Likelihood } => {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return { operation: 'encode', likelihood: 'unknown' };
  }
  const cleanedForTest = trimmedText.replace(/\s/g, '');
  const strictBase64FormatWithPaddingRegex = /^[A-Za-z0-9+/]*={0,2}$/;

  if (
    strictBase64FormatWithPaddingRegex.test(cleanedForTest) &&
    cleanedForTest.length % 4 === 0
  ) {
    try {
      atob(cleanedForTest);
      return { operation: 'decode', likelihood: 'likely_base64' };
    } catch (e) {
      return { operation: 'encode', likelihood: 'likely_text' };
    }
  }
  return { operation: 'encode', likelihood: 'likely_text' };
};

const calculateLikelihoodForCurrentOperation = (
  text: string,
  currentOperation: Operation
): Base64Likelihood => {
  const trimmedText = text.trim();
  if (!trimmedText) return 'unknown';
  const cleanedForTest = trimmedText.replace(/\s/g, '');

  const base64CharsOnlyStrictRegex = /^[A-Za-z0-9+/]*$/;
  const strictBase64FormatWithPaddingRegex = /^[A-Za-z0-9+/]*={0,2}$/;

  if (currentOperation === 'decode') {
    if (
      !strictBase64FormatWithPaddingRegex.test(cleanedForTest) ||
      cleanedForTest.length % 4 !== 0
    ) {
      return 'invalid_base64_chars';
    }
    try {
      atob(cleanedForTest);
      return 'likely_base64';
    } catch (e) {
      return 'invalid_base64_chars';
    }
  } else {
    if (!base64CharsOnlyStrictRegex.test(cleanedForTest.replace(/=/g, ''))) {
      return 'likely_text';
    }
    return 'possibly_base64_or_text';
  }
};

export default function Base64EncodeDecodeClient({
  urlStateParams,
  toolTitle,
  toolRoute,
}: Base64EncodeDecodeClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    clearState: persistentClearState,
  } = useToolState<Base64ToolState>(toolRoute, DEFAULT_BASE64_TOOL_STATE);

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
      textToProcess = toolState.inputText,
      opToPerform = toolState.operation
    ) => {
      let currentOutput = '';
      let currentError = '';
      let finalOperationForState = opToPerform;
      let finalLikelihoodForUIUpdate = base64Likelihood;

      const trimmedTextToProcess = textToProcess.trim();

      if (!trimmedTextToProcess) {
        setToolState({ outputValue: '' });
        if (error) setError('');
        return;
      }

      if (opToPerform === 'encode') {
        try {
          currentOutput = btoa(
            unescape(encodeURIComponent(trimmedTextToProcess))
          );
          finalLikelihoodForUIUpdate = calculateLikelihoodForCurrentOperation(
            textToProcess,
            'encode'
          );
          if (error) setError('');
        } catch (err) {
          currentError = 'Failed to encode text. Ensure text is valid UTF-8.';
          finalLikelihoodForUIUpdate = calculateLikelihoodForCurrentOperation(
            textToProcess,
            'encode'
          );
        }
      } else {
        try {
          const cleanedTextToDecode = trimmedTextToProcess.replace(/\s/g, '');
          if (
            cleanedTextToDecode.length % 4 !== 0 ||
            !/^[A-Za-z0-9+/]*={0,2}$/.test(cleanedTextToDecode)
          ) {
            throw new DOMException(
              'Input is not valid Base64 (length or padding).',
              'InvalidCharacterError'
            );
          }
          const decodedBytes = atob(cleanedTextToDecode);
          currentOutput = decodeURIComponent(
            Array.from(decodedBytes)
              .map((byte) => ('0' + byte.charCodeAt(0).toString(16)).slice(-2))
              .join('%')
          );
          finalLikelihoodForUIUpdate = 'likely_base64';
          if (error) setError('');
        } catch (err) {
          const errMessage =
            err instanceof Error ? err.message : 'Unknown decode error';
          if (
            err instanceof DOMException &&
            err.name === 'InvalidCharacterError'
          ) {
            currentError = `Failed to decode: Input is not a valid Base64 string or contains invalid characters/padding. (${errMessage})`;
          } else {
            currentError = `An unexpected error occurred during decoding. (${errMessage})`;
          }
          finalOperationForState = 'encode';
          finalLikelihoodForUIUpdate = calculateLikelihoodForCurrentOperation(
            textToProcess,
            'encode'
          );
        }
      }

      if (currentError) {
        if (error !== currentError) setError(currentError);
        setToolState({ outputValue: '', operation: finalOperationForState });
      } else {
        if (error) setError('');
        setToolState({
          outputValue: currentOutput,
          operation: finalOperationForState,
        });
      }

      if (finalLikelihoodForUIUpdate !== base64Likelihood) {
        setBase64Likelihood(finalLikelihoodForUIUpdate);
      }
    },
    [setToolState, base64Likelihood, error]
  );

  const debouncedProcess = useDebouncedCallback(
    handleEncodeDecode,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (isLoadingToolState || !urlStateParams || urlStateParams.length === 0)
      return;

    const params = new URLSearchParams(window.location.search);
    const textFromUrl = params.get('text');
    const opFromUrlExplicit = params.get('operation') as Operation | null;

    let textToSetForState = toolState.inputText;
    let opToSetForState = toolState.operation;
    let filenameToSetForState = toolState.lastLoadedFilename;
    let uiLikelihoodToSetInitially = base64Likelihood;
    let needsToolStateUpdate = false;

    if (textFromUrl !== null) {
      textToSetForState = textFromUrl;
      filenameToSetForState = '(loaded from URL)';
      needsToolStateUpdate = true;

      const {
        operation: determinedOpFromText,
        likelihood: determinedLikelihoodFromText,
      } = determineInitialOperationAndLikelihood(textToSetForState);
      opToSetForState = determinedOpFromText;
      uiLikelihoodToSetInitially = determinedLikelihoodFromText;
    }

    if (opFromUrlExplicit && ['encode', 'decode'].includes(opFromUrlExplicit)) {
      if (opFromUrlExplicit !== opToSetForState) {
        opToSetForState = opFromUrlExplicit;
        needsToolStateUpdate = true;
      }
      uiLikelihoodToSetInitially = calculateLikelihoodForCurrentOperation(
        textToSetForState,
        opToSetForState
      );
    }

    const updates: Partial<Base64ToolState> = {};
    if (textToSetForState !== toolState.inputText)
      updates.inputText = textToSetForState;
    if (opToSetForState !== toolState.operation)
      updates.operation = opToSetForState;
    if (filenameToSetForState !== toolState.lastLoadedFilename)
      updates.lastLoadedFilename = filenameToSetForState;

    if (Object.keys(updates).length > 0) {
      updates.outputValue = '';
      setToolState(updates);
    }

    if (uiLikelihoodToSetInitially !== base64Likelihood) {
      setBase64Likelihood(uiLikelihoodToSetInitially);
    }

    if (
      !needsToolStateUpdate &&
      textToSetForState.trim() &&
      !toolState.outputValue.trim() &&
      !error
    ) {
      const currentContextLikelihood = calculateLikelihoodForCurrentOperation(
        textToSetForState,
        opToSetForState
      );
      if (currentContextLikelihood !== base64Likelihood)
        setBase64Likelihood(currentContextLikelihood);

      handleEncodeDecode(textToSetForState, opToSetForState); // Direct call, not debounced for initial load
    } else if (!textToSetForState.trim() && base64Likelihood !== 'unknown') {
      setBase64Likelihood('unknown');
    }
  }, [isLoadingToolState, urlStateParams]);

  useEffect(() => {
    if (isLoadingToolState) {
      return;
    }

    const text = toolState.inputText;
    const currentOperation = toolState.operation;

    const newUILikelihood = calculateLikelihoodForCurrentOperation(
      text,
      currentOperation
    );
    if (newUILikelihood !== base64Likelihood) {
      setBase64Likelihood(newUILikelihood);
    }

    if (!text.trim()) {
      if (toolState.outputValue !== '') setToolState({ outputValue: '' });
      if (error !== '') setError('');
      debouncedProcess.cancel();
      return;
    }

    debouncedProcess(text, currentOperation);
  }, [
    toolState.inputText,
    toolState.operation,
    isLoadingToolState, // Keep this to prevent running before state is loaded
    debouncedProcess, // Stable ref
    setToolState, // Stable ref
    base64Likelihood, // For comparison before setting
    error, // To clear it if processing becomes successful
    toolState.outputValue, // Re-added: if output changes externally, might need to re-eval some things
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setToolState({
      inputText: newText,
      lastLoadedFilename: null,
      outputValue: '', // Clear output, main useEffect will trigger re-processing
    });
    setCopySuccess(false);
    setSaveSuccess(false);
  };

  const handleOperationChange = (newOperation: Operation) => {
    setToolState({ operation: newOperation, outputValue: '' });
  };

  const handleClear = useCallback(async () => {
    console.log(
      '[Base64Client handleClear] Clearing state via persistentClearState.'
    );
    debouncedProcess.cancel(); // Cancel any pending debounced processing first

    await persistentClearState(); // This will set toolState to default and delete the Dexie record

    setError('');
    setBase64Likelihood('unknown'); // Reflect the cleared input state
    setCopySuccess(false);
    setSaveSuccess(false);
    console.log('[Base64Client handleClear] State cleared.');
  }, [persistentClearState, debouncedProcess]);

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLoadFileModalOpen(false);
      if (files.length === 0) return;

      const file = files[0];
      if (!file.blob) {
        setError(`Error: File "${file.name}" has no content.`);
        return;
      }
      try {
        const text = await file.blob.text();

        let opForFileLoad: Operation;
        let likelihoodForUI: Base64Likelihood;
        let outputForState = '';
        let errorForUI = '';

        const { operation: guessedOp, likelihood: _guessedLikelihoodNotUsed } =
          determineInitialOperationAndLikelihood(text);

        if (guessedOp === 'decode') {
          try {
            const cleanedTextToDecode = text.trim().replace(/\s/g, '');
            if (
              cleanedTextToDecode.length % 4 !== 0 ||
              !/^[A-Za-z0-9+/]*={0,2}$/.test(cleanedTextToDecode)
            ) {
              throw new DOMException(
                'Input is not valid Base64 (length or padding).',
                'InvalidCharacterError'
              );
            }
            const decodedBytes = atob(cleanedTextToDecode);
            outputForState = decodeURIComponent(
              Array.from(decodedBytes)
                .map((byte) =>
                  ('0' + byte.charCodeAt(0).toString(16)).slice(-2)
                )
                .join('%')
            );
            opForFileLoad = 'decode';
            likelihoodForUI = 'likely_base64';
            // console.log('[handleFileSelected] Immediate decode SUCCESSFUL.');
          } catch (decodeError) {
            opForFileLoad = 'encode';
            outputForState = '';
            errorForUI =
              decodeError instanceof Error &&
              decodeError.name === 'InvalidCharacterError'
                ? 'Failed to decode: Input is not a valid Base64 string. Switched to Encode mode.'
                : 'Decode attempt failed. Switched to Encode mode.';
            likelihoodForUI = calculateLikelihoodForCurrentOperation(
              text,
              'encode'
            );
            // console.warn('[handleFileSelected] Immediate decode FAILED. Op: encode, Likelihood:', likelihoodForUI, 'Error:', errorForUI);
          }
        } else {
          opForFileLoad = 'encode';
          likelihoodForUI = calculateLikelihoodForCurrentOperation(
            text,
            'encode'
          );
          outputForState = '';
          // console.log('[handleFileSelected] Initial guess was encode. Op: encode, Likelihood:', likelihoodForUI);
        }

        setToolState({
          inputText: text,
          lastLoadedFilename: file.name,
          operation: opForFileLoad,
          outputValue: outputForState,
        });
        setBase64Likelihood(likelihoodForUI);
        setError(errorForUI);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(`Error reading file "${file.name}": ${msg}`);
        setToolState({
          inputText: '',
          lastLoadedFilename: null,
          outputValue: '',
        });
        setBase64Likelihood('unknown');
        // console.error('[handleFileSelected] Outer catch during file read:', e);
      }
      // console.log('[handleFileSelected] END.');
    },
    [setToolState]
  );

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
      if (!toolState.outputValue.trim()) {
        setError('No output to ' + action + '.');
        return;
      }
      if (error && toolState.outputValue.trim()) {
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
      toolState.outputValue,
      error,
      toolState.lastLoadedFilename,
      generateOutputFilename,
    ]
  );

  const handleFilenameConfirm = useCallback(
    (filename: string, actionOverride?: 'download' | 'save') => {
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
        if (!toolState.outputValue) {
          setError('No output to download.');
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
          setError('');
        } catch (err) {
          setError(
            `Failed to prepare download: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      } else if (currentAction === 'save') {
        if (!toolState.outputValue) {
          setError('No output to save.');
          return;
        }
        const blob = new Blob([toolState.outputValue], {
          type: 'text/plain;charset=utf-8',
        });
        addFileToLibrary(blob, finalFilename, 'text/plain', false)
          .then(() => {
            setSaveSuccess(true);
            setError('');
            setTimeout(() => setSaveSuccess(false), 2000);
          })
          .catch((err) =>
            setError(
              `Failed to save to library: ${err instanceof Error ? err.message : 'Unknown error'}`
            )
          );
      }
      setFilenameAction(null);
    },
    [
      filenameAction,
      toolState.lastLoadedFilename,
      toolState.operation,
      toolState.outputValue,
      addFileToLibrary,
      generateOutputFilename,
    ]
  );

  const handleCopyToClipboard = useCallback(async () => {
    if (!toolState.outputValue) {
      setError('No output to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(toolState.outputValue);
      setCopySuccess(true);
      setError('');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard.');
    }
  }, [toolState.outputValue]);

  const getLikelihoodBarState = useCallback(() => {
    switch (base64Likelihood) {
      case 'likely_base64':
        return {
          text: 'Input: Likely Base64 (Ready to Decode)',
          bgColor: 'bg-green-500',
          label: 'Base64',
          valueNow: 100,
        };
      case 'possibly_base64_or_text':
        return {
          text: `Input: ${toolState.operation === 'encode' ? 'Valid for Encode (may also be decodable Base64)' : 'Potentially Base64 (ambiguous for decode)'}`,
          bgColor: 'bg-[rgb(var(--color-indicator-ambiguous))]',
          label: 'Ambiguous',
          valueNow: 50,
        };
      case 'likely_text':
        return {
          text: 'Input: Likely Plain Text (Ready to Encode)',
          bgColor: 'bg-[rgb(var(--color-indicator-text))]',
          label: 'Text',
          valueNow: 10,
        };
      case 'invalid_base64_chars':
        return {
          text: `Input: Contains characters invalid for Base64 ${toolState.operation === 'decode' ? '(Decode will fail)' : '(Encode might work if invalid char is e.g. space that gets trimmed)'}`,
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
  }, [base64Likelihood, toolState.operation]);

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
  const canPerformOutputActions = toolState.outputValue.trim() !== '' && !error;

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
        textareaClassName="text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
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
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        </div>
      )}
      <Textarea
        label="Output:"
        id="base64-output"
        rows={8}
        value={toolState.outputValue}
        readOnly
        placeholder="Result will appear here..."
        textareaClassName="text-base font-mono bg-[rgb(var(--color-bg-subtle))]"
        spellCheck="false"
        aria-live="polite"
        onClick={(e) => e.currentTarget.select()}
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
