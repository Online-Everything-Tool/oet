// FILE: app/tool/hash-generator/_components/HashGeneratorClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
} from '@heroicons/react/24/outline'; // ArrowPathIcon removed as Generate button is gone

type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512';
const AUTO_PROCESS_DEBOUNCE_MS = 500;

interface HashGeneratorToolState {
  inputText: string;
  algorithm: HashAlgorithm;
  lastLoadedFilename?: string | null;
}

const DEFAULT_HASH_TOOL_STATE: HashGeneratorToolState = {
  inputText: '',
  algorithm: 'MD5',
  lastLoadedFilename: null,
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
  } = useToolState<HashGeneratorToolState>(toolRoute, DEFAULT_HASH_TOOL_STATE);

  const [outputValue, setOutputValue] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

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

  const algorithmOptions = useMemo(
    () => [
      { value: 'MD5' as HashAlgorithm, label: 'MD5' },
      { value: 'SHA-1' as HashAlgorithm, label: 'SHA-1' },
      { value: 'SHA-256' as HashAlgorithm, label: 'SHA-256' },
      { value: 'SHA-512' as HashAlgorithm, label: 'SHA-512' },
    ],
    []
  );

  const handleGenerateHash = useCallback(
    async (textToProcess = toolState.inputText, algo = toolState.algorithm) => {
      setError('');
      setOutputValue('');
      setIsProcessing(true);
      setCopySuccess(false);
      setSaveSuccess(false);
      const trimmedTextToProcess = textToProcess.trim();
      if (!trimmedTextToProcess) {
        setOutputValue('');
        setIsProcessing(false);
        return;
      }

      let result = '';
      let errorMessage = '';
      try {
        if (algo === 'MD5') {
          result = md5(trimmedTextToProcess);
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
          result = bufferToHex(hashBuffer);
        }
        setOutputValue(result);
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : 'Hashing error.';
        setError(`Error: ${errorMessage}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [toolState.inputText, toolState.algorithm]
  );

  const debouncedGenerateHash = useDebouncedCallback(
    handleGenerateHash,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (!isLoadingToolState && urlStateParams?.length > 0) {
      const params = new URLSearchParams(window.location.search);
      let initialInput = toolState.inputText;
      let initialAlgo = toolState.algorithm;
      let needsStateUpdate = false;
      const textFromUrl = params.get('text');
      if (textFromUrl !== null && textFromUrl !== initialInput) {
        initialInput = textFromUrl;
        needsStateUpdate = true;
      }
      const algoFromUrl = params.get('algorithm') as HashAlgorithm;
      if (
        algoFromUrl &&
        algorithmOptions.some((opt) => opt.value === algoFromUrl) &&
        algoFromUrl !== initialAlgo
      ) {
        initialAlgo = algoFromUrl;
        needsStateUpdate = true;
      }
      const loadedFilename =
        textFromUrl !== null
          ? '(loaded from URL)'
          : toolState.lastLoadedFilename;
      if (needsStateUpdate) {
        setToolState((prev) => ({
          ...prev,
          inputText: initialInput,
          algorithm: initialAlgo,
          lastLoadedFilename: loadedFilename,
        }));
      } else if (initialInput.trim()) {
        setTimeout(() => handleGenerateHash(initialInput, initialAlgo), 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingToolState, urlStateParams, setToolState, algorithmOptions]); // handleGenerateHash removed

  useEffect(() => {
    if (!isLoadingToolState) {
      debouncedGenerateHash(toolState.inputText, toolState.algorithm);
    }
  }, [
    toolState.inputText,
    toolState.algorithm,
    isLoadingToolState,
    debouncedGenerateHash,
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

  const handleAlgorithmChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setToolState((prev) => ({
      ...prev,
      algorithm: event.target.value as HashAlgorithm,
    }));
  };

  const handleClear = useCallback(() => {
    setToolState(DEFAULT_HASH_TOOL_STATE);
    setOutputValue('');
    setError('');
    setIsProcessing(false);
    setCopySuccess(false);
    setSaveSuccess(false);
    debouncedGenerateHash.cancel();
  }, [setToolState, debouncedGenerateHash]);

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLoadFileModalOpen(false);
      if (files.length === 0) return;
      const file = files[0];
      if (!file.blob) {
        setError(`Error: File "${file.name}" has no content.`);
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
          setToolState((prev) => ({
            ...prev,
            inputText: text,
            lastLoadedFilename: file.name,
          }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'File read error';
          setError(
            `Error reading file "${file.name}": ${msg}. Ensure it's text-based.`
          );
          setToolState((prev) => ({
            ...prev,
            inputText: '',
            lastLoadedFilename: null,
          }));
        } finally {
          setIsProcessing(false);
        }
      } else {
        setError(
          `File type "${file.type}" may not be suitable. Please select a text-based file.`
        );
      }
    },
    [setToolState]
  );

  const generateOutputFilename = useCallback(
    (baseName?: string | null): string => {
      const base = baseName?.replace(/\.[^/.]+$/, '') || 'hashed-text';
      const algoLabel = toolState.algorithm.toLowerCase().replace('-', '');
      return `${base}.${algoLabel}-${Date.now()}.txt`;
    },
    [toolState.algorithm]
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
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Unknown download error';
          setError(`Failed to prepare download: ${msg}`);
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
          .then((_newFileId) => {
            setSaveSuccess(true);
            setError('');
            setTimeout(() => setSaveSuccess(false), 2000);
          })
          .catch((err) => {
            const msg =
              err instanceof Error ? err.message : 'Unknown save error';
            setError(`Failed to save to library: ${msg}`);
          });
      }
      setFilenameAction(null);
    },
    [
      filenameAction,
      toolState.lastLoadedFilename,
      outputValue,
      addFileToLibrary,
      setError,
      setSaveSuccess,
      generateOutputFilename,
      setIsFilenameModalOpen,
      setFilenameAction,
    ]
  );

  const initiateOutputAction = useCallback(
    (action: 'download' | 'save') => {
      if (!outputValue.trim()) {
        setError('No output to ' + action + '.');
        return;
      }
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
      handleFilenameConfirm,
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
    } catch (_err) {
      setError('Failed to copy to clipboard.');
    }
  }, [outputValue, setError, setCopySuccess]);

  if (isLoadingToolState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Hash Generator...
      </p>
    );
  }
  const canPerformOutputActions =
    outputValue.trim() !== '' && !error && !isProcessing;

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
      {error && (
        <div
          role="alert"
          className="p-3 border rounded-md text-sm bg-[rgb(var(--color-bg-error-subtle))] border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] flex items-start gap-2"
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

      {(outputValue || isProcessing) && (
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
            value={isProcessing && !outputValue ? 'Generating...' : outputValue}
            readOnly
            placeholder="Generated hash will appear here..."
            textareaClassName={`text-base font-mono resize-none bg-[rgb(var(--color-bg-subtle))] ${isProcessing && !outputValue ? 'animate-pulse' : ''}`}
            aria-live="polite"
            onClick={(e) => e.currentTarget.select()}
          />
        </div>
      )}

      {canPerformOutputActions && (
        <div className="flex flex-wrap gap-3 items-center p-3 border-t border-[rgb(var(--color-border-base))]">
          <Button
            variant="primary-outline"
            onClick={() => initiateOutputAction('save')}
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
            onClick={() => initiateOutputAction('download')}
            iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
            disabled={isProcessing}
          >
            Download Hash
          </Button>
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
