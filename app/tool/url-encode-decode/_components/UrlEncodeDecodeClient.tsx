// --- FILE: app/tool/url-encode-decode/_components/UrlEncodeDecodeClient.tsx ---
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import useToolState from '../../_hooks/useToolState';
import type { ParamConfig } from '@/src/types/tools';
import Textarea from '../../_components/form/Textarea';
import RadioGroup from '../../_components/form/RadioGroup';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { StoredFile } from '@/src/types/storage';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useDebouncedCallback } from 'use-debounce';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  XCircleIcon,
  ArrowUpTrayIcon,
  DocumentPlusIcon,
} from '@heroicons/react/20/solid';

type Operation = 'encode' | 'decode';
type EncodeMode = 'standard' | 'aggressive';

interface UrlToolState {
  inputText: string;
  operation: Operation;
  encodeMode: EncodeMode;
  outputValue: string;
  errorMsg: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_URL_TOOL_STATE: UrlToolState = {
  inputText: '',
  operation: 'encode',
  encodeMode: 'standard',
  outputValue: '',
  errorMsg: '',
  lastLoadedFilename: null,
};

const AUTO_PROCESS_DEBOUNCE_MS = 300;

interface UrlEncodeDecodeClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function UrlEncodeDecodeClient({
  urlStateParams,
  toolRoute,
}: UrlEncodeDecodeClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState, //isLoadingToolState before
    clearState: persistentClearState,
    errorLoadingState,
  } = useToolState<UrlToolState>(toolRoute, DEFAULT_URL_TOOL_STATE);

  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameActionType, setFilenameActionType] = useState<
    'download' | 'save' | null
  >(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] =
    useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const initialUrlLoadProcessedRef = useRef(false);
  const { addFile: addFileToLibrary } = useFileLibrary();

  useEffect(() => {
    if (
      isLoadingState ||
      initialUrlLoadProcessedRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      if (!isLoadingState && !initialUrlLoadProcessedRef.current)
        initialUrlLoadProcessedRef.current = true;
      return;
    }
    initialUrlLoadProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<UrlToolState> = {};
    let needsUpdate = false; // Flag to check if setToolState is necessary
    let textForImmediateProcessing: string | null = null; // Text to process if URL matches state

    const textFromUrl = params.get('text');
    if (textFromUrl !== null) {
      if (textFromUrl !== toolState.inputText) {
        updates.inputText = textFromUrl;
        updates.lastLoadedFilename = '(loaded from URL)';
        needsUpdate = true;
      }
      textForImmediateProcessing = textFromUrl; // Potentially process this
    } else {
      textForImmediateProcessing = toolState.inputText; // Use current state text if no URL text
    }

    const opFromUrl = params.get('operation') as Operation | null;
    if (
      opFromUrl &&
      ['encode', 'decode'].includes(opFromUrl) &&
      opFromUrl !== toolState.operation
    ) {
      updates.operation = opFromUrl;
      needsUpdate = true;
    }

    if (needsUpdate) {
      updates.outputValue = '';
      updates.errorMsg = '';
      setToolState(updates);
    } else if (
      textForImmediateProcessing &&
      textForImmediateProcessing.trim() &&
      !toolState.outputValue.trim() &&
      !toolState.errorMsg
    ) {
      // If URL params matched current state (no 'needsUpdate'), but output is empty, process.
      // Or if no URL params, but there's text in state and no output.
      console.log(
        '[UrlEncodeDecodeClient URL Effect] No state update from URL, but processing initial/persisted text.'
      );
      performEncodeDecode(
        textForImmediateProcessing,
        toolState.operation,
        toolState.encodeMode
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingState, urlStateParams, setToolState]); // Removed toolState.text, toolState.operation as direct changes are handled by other effect
  // performEncodeDecode is stable

  const performEncodeDecode = useCallback(
    (text: string, operation: Operation, mode: EncodeMode) => {
      if (!text.trim()) {
        setToolState({ outputValue: '', errorMsg: '' });
        return;
      }
      let newOutput = '';
      let newError = '';
      try {
        if (operation === 'encode') {
          const standardEncoded = encodeURIComponent(text);
          if (mode === 'aggressive') {
            newOutput = standardEncoded.replace(
              /[!'()*~]/g,
              (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
            );
          } else {
            newOutput = standardEncoded;
          }
        } else {
          newOutput = decodeURIComponent(text.replace(/\+/g, ' '));
        }
      } catch (err) {
        newOutput = '';
        if (err instanceof URIError && operation === 'decode') {
          newError =
            'Decoding failed: Invalid percent-encoding sequence found. Check input.';
        } else {
          newError = `An unexpected error occurred during ${operation}.`;
        }
      }
      setToolState({ outputValue: newOutput, errorMsg: newError });
      setIsCopied(false);
    },
    [setToolState]
  );

  const debouncedProcess = useDebouncedCallback(
    performEncodeDecode,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (isLoadingState || !initialUrlLoadProcessedRef.current) return;

    if (!toolState.inputText.trim()) {
      if (toolState.outputValue !== '' || toolState.errorMsg !== '') {
        setToolState({ outputValue: '', errorMsg: '' });
      }
      debouncedProcess.cancel();
      return;
    }
    // Only call debouncedProcess if text, operation, or encodeMode actually relevant to current state has changed
    // and resulted in a different state object identity from useToolState.
    // useToolState's state object itself being in dependency array handles this.
    debouncedProcess(
      toolState.inputText,
      toolState.operation,
      toolState.encodeMode
    );
  }, [toolState, isLoadingState, debouncedProcess, setToolState]); // Simplified: toolState covers its relevant parts

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({
      inputText: event.target.value,
      lastLoadedFilename: null,
      outputValue: '',
      errorMsg: '',
    });
  };
  const handleOperationChange = (newOperation: Operation) => {
    setToolState({
      operation: newOperation,
      outputValue: '',
      errorMsg: '',
    });
  };
  const handleEncodeModeChange = (newMode: EncodeMode) => {
    setToolState({
      encodeMode: newMode,
      outputValue: '',
      errorMsg: '',
    });
  };

  const handleClear = useCallback(async () => {
    await persistentClearState();
    setIsCopied(false);
    setSaveSuccess(false);
    debouncedProcess.cancel();
  }, [persistentClearState, debouncedProcess]);

  const handleCopyOutput = useCallback(async () => {
    if (!toolState.outputValue || isCopied) return;
    try {
      await navigator.clipboard.writeText(toolState.outputValue);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (_err) {
      setToolState({ errorMsg: 'Could not copy text to clipboard.' });
    }
  }, [toolState.outputValue, isCopied, setToolState]);

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLoadFileModalOpen(false);
      if (files.length === 0) return;
      const file = files[0];
      if (!file.blob) {
        setToolState({
          errorMsg: `Error: File "${file.name}" has no content.`,
        });
        return;
      }
      try {
        const text = await file.blob.text();
        setToolState({
          inputText: text,
          lastLoadedFilename: file.name,
          outputValue: '',
          errorMsg: '',
        });
      } catch (e) {
        setToolState({
          errorMsg: `Error reading file "${file.name}": ${e instanceof Error ? e.message : 'Unknown error'}`,
          inputText: '',
          lastLoadedFilename: null,
          outputValue: '',
        });
      }
    },
    [setToolState]
  );

  const generateOutputFilenameForAction = useCallback((): string => {
    const base =
      toolState.lastLoadedFilename?.replace(/\.[^/.]+$/, '') ||
      (toolState.operation === 'encode' ? 'encoded' : 'decoded');
    const modePart =
      toolState.operation === 'encode' ? `-${toolState.encodeMode}` : '';
    return `${base}${modePart}-${Date.now()}.txt`;
  }, [toolState.lastLoadedFilename, toolState.operation, toolState.encodeMode]);

  const initiateOutputActionWithPrompt = (action: 'download' | 'save') => {
    if (!toolState.outputValue.trim() || toolState.errorMsg) {
      setToolState({
        errorMsg: toolState.errorMsg || 'No valid output to ' + action + '.',
      });
      return;
    }
    setSuggestedFilenameForPrompt(generateOutputFilenameForAction());
    setFilenameActionType(action);
    setIsFilenameModalOpen(true);
  };

  const handleFilenameConfirm = useCallback(
    async (chosenFilename: string) => {
      const action = filenameActionType;
      setIsFilenameModalOpen(false);
      setFilenameActionType(null);

      if (!action || !toolState.outputValue) return;

      let finalFilename = chosenFilename.trim();
      if (!finalFilename) finalFilename = generateOutputFilenameForAction();
      if (!/\.txt$/i.test(finalFilename)) finalFilename += '.txt';

      if (action === 'download') {
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
          setToolState({ errorMsg: '' });
        } catch (_err) {
          setToolState({ errorMsg: 'Failed to prepare download.' });
        }
      } else if (action === 'save') {
        const blob = new Blob([toolState.outputValue], {
          type: 'text/plain;charset=utf-8',
        });
        try {
          await addFileToLibrary(blob, finalFilename, 'text/plain', false);
          setSaveSuccess(true);
          setToolState({ errorMsg: '' });
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (_err) {
          setToolState({ errorMsg: 'Failed to save to library.' });
        }
      }
    },
    [
      filenameActionType,
      toolState.outputValue,
      generateOutputFilenameForAction,
      addFileToLibrary,
      setToolState,
    ]
  );

  if (isLoadingState && !initialUrlLoadProcessedRef.current) {
    return (
      <div className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading URL Encoder/Decoder...
      </div>
    );
  }
  if (errorLoadingState) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded">
        Error loading saved state: {errorLoadingState}
      </div>
    );
  }

  const isCurrentlyProcessing =
    isLoadingState ||
    (toolState.inputText.trim() !== '' &&
      !toolState.outputValue &&
      !toolState.errorMsg);
  const canPerformOutputActions =
    toolState.outputValue.trim() !== '' &&
    !toolState.errorMsg &&
    !isCurrentlyProcessing;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex justify-between items-center gap-2">
        <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
          Input (Text or URL-encoded string):
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
        id="url-input"
        value={toolState.inputText}
        onChange={handleInputChange}
        placeholder="Paste text or URL-encoded string here..."
        rows={8}
        textareaClassName="text-base"
      />

      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="flex flex-wrap gap-4 items-start">
          <RadioGroup
            name="urlOperation"
            legend="Operation:"
            options={[
              { value: 'encode', label: 'Encode' },
              { value: 'decode', label: 'Decode' },
            ]}
            selectedValue={toolState.operation}
            onChange={(val) => handleOperationChange(val as Operation)}
            layout="horizontal"
            radioClassName="text-sm"
          />
          {toolState.operation === 'encode' && (
            <RadioGroup
              name="encodeMode"
              legend="Encoding Mode:"
              options={[
                { value: 'standard', label: 'Standard (RFC 3986)' },
                { value: 'aggressive', label: "Aggressive (!*'()~)" },
              ]}
              selectedValue={toolState.encodeMode}
              onChange={(val) => handleEncodeModeChange(val as EncodeMode)}
              layout="horizontal"
              radioClassName="text-sm"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-4 items-center border-t pt-3 mt-2">
          <div className="flex-grow"></div>
          {toolState.outputValue && (
            <>
              <Button
                variant={isCopied ? 'secondary' : 'accent-outline'}
                size="sm"
                onClick={handleCopyOutput}
                title="Copy Output"
                className="!p-1.5"
                disabled={isCopied || !canPerformOutputActions}
                iconLeft={
                  isCopied ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  )
                }
              >
                {isCopied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                variant="primary-outline"
                size="sm"
                onClick={() => initiateOutputActionWithPrompt('save')}
                disabled={!canPerformOutputActions || saveSuccess}
                iconLeft={
                  saveSuccess ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <DocumentPlusIcon className="h-4 w-4" />
                  )
                }
                title="Save to Library"
              >
                {saveSuccess ? 'Saved!' : 'Save to Library'}
              </Button>
              <Button
                variant="primary-outline"
                size="sm"
                onClick={() => initiateOutputActionWithPrompt('download')}
                disabled={!canPerformOutputActions}
                iconLeft={<ArrowDownTrayIcon className="h-4 w-4" />}
                title="Download Output"
              >
                Download Output
              </Button>
            </>
          )}
          <Button
            variant="neutral"
            onClick={handleClear}
            disabled={
              !toolState.inputText &&
              !toolState.outputValue &&
              !toolState.errorMsg
            }
          >
            Clear
          </Button>
        </div>
      </div>

      {toolState.errorMsg && (
        <div
          role="alert"
          className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-start gap-2"
        >
          <XCircleIcon
            className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong>{' '}
            {toolState.errorMsg}
          </div>
        </div>
      )}

      <div className="relative">
        <Textarea
          label="Output:"
          id="url-output"
          value={toolState.outputValue}
          readOnly
          placeholder="Result will appear here..."
          rows={8}
          textareaClassName={`bg-[rgb(var(--color-bg-subtle))] text-base ${isLoadingState || (toolState.inputText.trim() && !toolState.outputValue && !toolState.errorMsg) ? 'animate-pulse' : ''}`}
          aria-live="polite"
        />
      </div>

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
        onClose={() => {
          setIsFilenameModalOpen(false);
          setFilenameActionType(null);
        }}
        onConfirm={handleFilenameConfirm}
        initialFilename={suggestedFilenameForPrompt}
        title={
          filenameActionType === 'download'
            ? 'Enter Download Filename'
            : 'Enter Filename for Library'
        }
        promptMessage={
          filenameActionType === 'download'
            ? 'Filename for download:'
            : 'Filename for library:'
        }
        confirmButtonText={
          filenameActionType === 'download' ? 'Download' : 'Save to Library'
        }
      />
    </div>
  );
}
