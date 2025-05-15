// --- FILE: app/tool/hash-generator/_components/HashGeneratorClient.tsx ---
'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import Select from '../../_components/form/Select';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ParamConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { bufferToHex, isTextBasedMimeType } from '@/app/lib/utils';
import { md5 } from 'js-md5';
import { useDebouncedCallback } from 'use-debounce';
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512';
const AUTO_PROCESS_DEBOUNCE_MS = 500;

interface HashGeneratorToolState {
  inputText: string;
  algorithm: HashAlgorithm;
  lastLoadedFilename?: string | null;
  outputValue: string;
  errorMsg: string;
}

const DEFAULT_HASH_TOOL_STATE: HashGeneratorToolState = {
  inputText: '',
  algorithm: 'MD5',
  lastLoadedFilename: null,
  outputValue: '',
  errorMsg: '',
};

interface HashGeneratorClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function HashGeneratorClient({
  urlStateParams,
  toolRoute,
}: HashGeneratorClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    clearStateAndPersist: persistentClearState,
  } = useToolState<HashGeneratorToolState>(toolRoute, DEFAULT_HASH_TOOL_STATE);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameActionType, setFilenameActionType] = useState<
    'download' | 'save' | null
  >(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] =
    useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { addFile: addFileToLibrary } = useFileLibrary();
  const initialUrlLoadProcessedRef = useRef(false);

  const algorithmOptions = useMemo(
    () => [
      { value: 'MD5' as HashAlgorithm, label: 'MD5' },
      { value: 'SHA-1' as HashAlgorithm, label: 'SHA-1' },
      { value: 'SHA-256' as HashAlgorithm, label: 'SHA-256' },
      { value: 'SHA-512' as HashAlgorithm, label: 'SHA-512' },
    ],
    []
  );

  const handleGenerateHashInternal = useCallback(
    async (textToProcess: string, algo: HashAlgorithm) => {
      setIsProcessing(true);

      setToolState({ outputValue: '', errorMsg: '' });
      setCopySuccess(false);
      setSaveSuccess(false);

      const trimmedTextToProcess = textToProcess.trim();
      if (!trimmedTextToProcess) {
        setIsProcessing(false);
        return;
      }

      let newOutputValue = '';
      let newErrorMsg = '';
      try {
        if (algo === 'MD5') {
          newOutputValue = md5(trimmedTextToProcess);
        } else {
          if (!crypto?.subtle) {
            throw new Error(
              'Web Crypto API (crypto.subtle) is not available (requires HTTPS or secure context).'
            );
          }
          const encoder = new TextEncoder();
          const dataBuffer = encoder.encode(trimmedTextToProcess);
          const subtleAlgo = algo as AlgorithmIdentifier;
          const hashBuffer = await crypto.subtle.digest(subtleAlgo, dataBuffer);
          newOutputValue = bufferToHex(hashBuffer);
        }
      } catch (err) {
        newErrorMsg = err instanceof Error ? err.message : 'Hashing error.';
      } finally {
        setToolState({ outputValue: newOutputValue, errorMsg: newErrorMsg });
        setIsProcessing(false);
      }
    },
    [setToolState]
  );

  const debouncedGenerateHash = useDebouncedCallback(
    handleGenerateHashInternal,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (
      isLoadingToolState ||
      initialUrlLoadProcessedRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      return;
    }
    initialUrlLoadProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<HashGeneratorToolState> = {};
    let needsProcessingAfterUpdate = false;

    const textFromUrl = params.get('text');
    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      updates.inputText = textFromUrl;
      updates.lastLoadedFilename = '(loaded from URL)';
      needsProcessingAfterUpdate = true;
    }

    const algoFromUrl = params.get('algorithm') as HashAlgorithm | null;
    if (
      algoFromUrl &&
      algorithmOptions.some((opt) => opt.value === algoFromUrl) &&
      algoFromUrl !== toolState.algorithm
    ) {
      updates.algorithm = algoFromUrl;
      needsProcessingAfterUpdate = true;
    }

    if (Object.keys(updates).length > 0) {
      updates.outputValue = '';
      updates.errorMsg = '';
      setToolState(updates);
    } else if (needsProcessingAfterUpdate && toolState.inputText.trim()) {
      handleGenerateHashInternal(toolState.inputText, toolState.algorithm);
    }
  }, [
    isLoadingToolState,
    urlStateParams,
    toolState,
    setToolState,
    algorithmOptions,
    handleGenerateHashInternal,
  ]);

  useEffect(() => {
    if (isLoadingToolState || !initialUrlLoadProcessedRef.current) return;

    if (!toolState.inputText.trim()) {
      if (toolState.outputValue !== '' || toolState.errorMsg !== '') {
        setToolState({ outputValue: '', errorMsg: '' });
      }
      debouncedGenerateHash.cancel();
      return;
    }
    debouncedGenerateHash(toolState.inputText, toolState.algorithm);
  }, [
    toolState.inputText,
    toolState.algorithm,
    isLoadingToolState,
    debouncedGenerateHash,
    setToolState,
    toolState.outputValue,
    toolState.errorMsg,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({
      inputText: event.target.value,
      lastLoadedFilename: null,
      outputValue: '',
      errorMsg: '',
    });
    setCopySuccess(false);
    setSaveSuccess(false);
  };

  const handleAlgorithmChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setToolState({
      algorithm: event.target.value as HashAlgorithm,
      outputValue: '',
      errorMsg: '',
    });
    setCopySuccess(false);
    setSaveSuccess(false);
  };

  const handleClear = useCallback(async () => {
    await persistentClearState();

    setIsProcessing(false);
    setCopySuccess(false);
    setSaveSuccess(false);
    debouncedGenerateHash.cancel();
  }, [persistentClearState, debouncedGenerateHash]);

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
      if (
        isTextBasedMimeType(file.type) ||
        file.type === '' ||
        file.type === 'application/octet-stream' ||
        file.name.endsWith('.txt')
      ) {
        setIsProcessing(true);
        try {
          const text = await file.blob.text();
          setToolState({
            inputText: text,
            lastLoadedFilename: file.name,
            outputValue: '',
            errorMsg: '',
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'File read error';
          setToolState({
            errorMsg: `Error reading file "${file.name}": ${msg}. Ensure it's text-based.`,
            inputText: '',
            lastLoadedFilename: null,
            outputValue: '',
          });
        } finally {
          setIsProcessing(false);
        }
      } else {
        setToolState({
          errorMsg: `File type "${file.type}" may not be suitable. Please select a text-based file.`,
        });
      }
    },
    [setToolState]
  );

  const generateOutputFilenameForAction = useCallback((): string => {
    const base =
      toolState.lastLoadedFilename?.replace(/\.[^/.]+$/, '') || 'hashed-output';
    const algoLabel = toolState.algorithm.toLowerCase().replace('-', '');
    return `${base}.${algoLabel}-${Date.now()}.txt`;
  }, [toolState.lastLoadedFilename, toolState.algorithm]);

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

  const handleCopyToClipboard = useCallback(async () => {
    if (!toolState.outputValue) {
      setToolState({ errorMsg: 'No output to copy.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(toolState.outputValue);
      setCopySuccess(true);
      setToolState({ errorMsg: '' });
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (_err) {
      setToolState({ errorMsg: 'Failed to copy to clipboard.' });
    }
  }, [toolState.outputValue, setToolState]);

  if (isLoadingToolState && !initialUrlLoadProcessedRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Hash Generator...
      </p>
    );
  }

  const canPerformOutputActions =
    toolState.outputValue.trim() !== '' && !toolState.errorMsg && !isProcessing;

  return (
    <div className="space-y-6 text-[rgb(var(--color-text-base))]">
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
          disabled={isProcessing}
        >
          Load from File
        </Button>
      </div>
      <Textarea
        id="text-input"
        rows={8}
        value={toolState.inputText}
        onChange={handleInputChange}
        placeholder="Enter text to hash or load from a file..."
        textareaClassName="text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
        spellCheck="false"
        disabled={isProcessing}
      />

      <div className="flex flex-wrap gap-4 items-center border border-[rgb(var(--color-border-base))] p-3 rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
          <label
            htmlFor="algorithm-select"
            className="text-sm font-medium text-[rgb(var(--color-text-muted))] whitespace-nowrap"
          >
            Algorithm:
          </label>
          <Select
            id="algorithm-select"
            name="algorithm"
            options={algorithmOptions}
            value={toolState.algorithm}
            onChange={handleAlgorithmChange}
            selectClassName="text-sm py-1.5 pl-2 pr-8 min-w-[120px]"
            disabled={isProcessing}
          />
        </div>
        <div className="flex-grow"></div>
        {canPerformOutputActions && (
          <>
            <Button
              variant="neutral"
              onClick={handleCopyToClipboard}
              disabled={copySuccess || isProcessing}
              iconLeft={
                copySuccess ? (
                  <CheckIcon className="h-5 w-5" />
                ) : (
                  <ClipboardDocumentIcon className="h-5 w-5" />
                )
              }
            >
              {copySuccess ? 'Copied!' : 'Copy Hash'}
            </Button>
            <Button
              variant="primary-outline"
              onClick={() => initiateOutputActionWithPrompt('save')}
              disabled={saveSuccess || isProcessing}
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
              onClick={() => initiateOutputActionWithPrompt('download')}
              iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
              disabled={isProcessing}
            >
              Download Hash
            </Button>
          </>
        )}
        <Button
          variant="neutral"
          onClick={handleClear}
          disabled={isProcessing}
          className="ml-auto"
        >
          Clear
        </Button>
      </div>

      {toolState.algorithm === 'MD5' && (
        <p className="text-xs text-[rgb(var(--color-text-muted))] italic text-center border border-dashed border-[rgb(var(--color-border-base))] p-2 rounded-md">
          Note: MD5 is useful for checksums but is not considered secure for
          cryptographic purposes like password storage due to known
          vulnerabilities.
        </p>
      )}
      {toolState.errorMsg && (
        <div
          role="alert"
          className="p-3 border rounded-md text-sm bg-[rgb(var(--color-bg-error-subtle))] border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] flex items-start gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong>{' '}
            {toolState.errorMsg}
          </div>
        </div>
      )}

      {(toolState.outputValue || isProcessing) && (
        <div>
          <label
            htmlFor="text-output"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"
          >
            Hash Output ({toolState.algorithm}):
          </label>
          <Textarea
            id="text-output"
            rows={3}
            value={
              isProcessing && !toolState.outputValue
                ? 'Generating...'
                : toolState.outputValue
            }
            readOnly
            placeholder="Generated hash will appear here..."
            textareaClassName={`text-base font-mono resize-none bg-[rgb(var(--color-bg-subtle))] ${isProcessing && !toolState.outputValue ? 'animate-pulse' : ''}`}
            aria-live="polite"
            onClick={(e) => e.currentTarget.select()}
          />
        </div>
      )}
      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".txt,text/*,application/octet-stream"
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
