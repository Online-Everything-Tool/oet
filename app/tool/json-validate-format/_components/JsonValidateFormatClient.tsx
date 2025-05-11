// FILE: app/tool/json-validate-format/_components/JsonValidateFormatClient.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import { useFileLibrary } from '@/app/context/FileLibraryContext'; // Added for saving output
import type { TriggerType } from '@/src/types/history';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Checkbox from '../../_components/form/Checkbox';
import Button from '../../_components/form/Button';
import Select from '../../_components/form/Select';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import type { ParamConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon, // For Download
  ClipboardDocumentIcon, // For Copy
  CheckIcon, // For success indication
  DocumentPlusIcon, // For Save to Library
} from '@heroicons/react/24/outline';

interface JsonValidateFormatClientProps {
  urlStateParams: ParamConfig[];
  toolTitle: string;
  toolRoute: string;
}

interface JsonToolState {
  jsonInput: string;
  indent: number;
  sortKeys: boolean;
  lastLoadedFilename?: string | null;
}

const DEFAULT_JSON_TOOL_STATE: JsonToolState = {
  jsonInput: '',
  indent: 2,
  sortKeys: false,
  lastLoadedFilename: null,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sortObjectKeys = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj; // Primitives or null
  }
  if (Array.isArray(obj)) {
    // For arrays, we map over elements and apply sorting to any nested objects
    return obj.map(sortObjectKeys);
  }
  // For objects, sort keys and then recursively sort values
  const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: { [key: string]: any } = {};
  for (const key of sortedKeys) {
    result[key] = sortObjectKeys(obj[key]);
  }
  return result;
};

export default function JsonValidateFormatClient({
  urlStateParams,
  toolTitle,
  toolRoute,
}: JsonValidateFormatClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
  } = useToolState<JsonToolState>(toolRoute, DEFAULT_JSON_TOOL_STATE);

  const [outputValue, setOutputValue] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addHistoryEntry } = useHistory();
  const { addFile: addFileToLibrary } = useFileLibrary(); // Get addFile function

  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Effect to handle initial load from URL params
  useEffect(() => {
    if (!isLoadingToolState && urlStateParams?.length > 0) {
      const params = new URLSearchParams(window.location.search);
      let shouldValidateAfterLoad = false;
      let initialJsonInput = toolState.jsonInput;
      let initialIndent = toolState.indent;

      const jsonFromUrl = params.get('json');
      if (jsonFromUrl !== null) {
        initialJsonInput = jsonFromUrl;
        shouldValidateAfterLoad = true;
      }
      const indentFromUrl = params.get('indent');
      if (indentFromUrl !== null) {
        const numIndent = parseInt(indentFromUrl, 10);
        if (!isNaN(numIndent) && [0, 2, 4].includes(numIndent)) {
          initialIndent = numIndent;
          shouldValidateAfterLoad = true;
        }
      }

      if (
        initialJsonInput !== toolState.jsonInput ||
        initialIndent !== toolState.indent
      ) {
        setToolState((prev) => ({
          ...prev,
          jsonInput: initialJsonInput,
          indent: initialIndent,
          lastLoadedFilename:
            jsonFromUrl !== null
              ? '(loaded from URL)'
              : prev.lastLoadedFilename,
        }));
      }
      if (shouldValidateAfterLoad && initialJsonInput.trim()) {
        setTimeout(() => {
          handleFormatValidate(
            'query',
            initialJsonInput,
            initialIndent,
            toolState.sortKeys
          );
        }, 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingToolState, urlStateParams]);

  const handleFormatValidate = useCallback(
    (
      triggerType: TriggerType,
      textToProcess = toolState.jsonInput,
      currentIndent = toolState.indent,
      currentSortKeys = toolState.sortKeys
    ) => {
      let currentIsValid: boolean | null = null;
      let currentError = '';
      let currentOutput = '';
      let status: 'success' | 'error' = 'success';
      let historyOutputObj: Record<string, unknown> = {};
      const trimmedInput = textToProcess.trim();

      setError('');
      setIsValid(null);
      setOutputValue('');
      setCopySuccess(false); // Reset feedback
      setSaveSuccess(false);

      if (!trimmedInput) {
        setToolState((prev) => ({ ...prev, lastLoadedFilename: null }));
        return;
      }

      const inputDetailsForHistory = {
        source: toolState.lastLoadedFilename || 'pasted/typed',
        jsonInputTruncated:
          trimmedInput.length > 500
            ? trimmedInput.substring(0, 500) + '...'
            : trimmedInput,
        indent: currentIndent,
        sortKeys: currentSortKeys,
      };

      try {
        let parsedJson = JSON.parse(trimmedInput);
        if (currentSortKeys) parsedJson = sortObjectKeys(parsedJson);
        currentOutput = JSON.stringify(
          parsedJson,
          null,
          currentIndent === 0 ? undefined : currentIndent
        );
        currentIsValid = true;
        setOutputValue(currentOutput);
        setIsValid(currentIsValid);
        status = 'success';
        historyOutputObj = {
          validationStatus: 'Valid JSON',
          outputLength: currentOutput.length,
        };
      } catch (err) {
        currentError =
          err instanceof Error
            ? `Invalid JSON: ${err.message}`
            : 'Invalid JSON: Unknown parsing error.';
        currentOutput = '';
        currentIsValid = false;
        setError(currentError);
        setIsValid(currentIsValid);
        status = 'error';
        (inputDetailsForHistory as Record<string, unknown>).error =
          currentError;
        historyOutputObj = {
          validationStatus: 'Invalid JSON',
          errorMessage: currentError,
        };
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
      toolState.jsonInput,
      toolState.indent,
      toolState.sortKeys,
      toolState.lastLoadedFilename,
      addHistoryEntry,
      toolTitle,
      toolRoute,
      setToolState,
    ]
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({ jsonInput: event.target.value, lastLoadedFilename: null });
    setIsValid(null);
    setError('');
    setCopySuccess(false);
    setSaveSuccess(false);
  };

  const handleClear = useCallback(() => {
    setToolState(DEFAULT_JSON_TOOL_STATE);
    setOutputValue('');
    setIsValid(null);
    setError('');
    setCopySuccess(false);
    setSaveSuccess(false);
  }, [setToolState]);

  const reformatCurrentJson = useCallback(
    (newIndent: number, newSortKeys: boolean) => {
      if (isValid && toolState.jsonInput.trim()) {
        handleFormatValidate(
          'click',
          toolState.jsonInput,
          newIndent,
          newSortKeys
        );
      } else if (!toolState.jsonInput.trim()) {
        setOutputValue('');
        setCopySuccess(false);
        setSaveSuccess(false);
      }
    },
    [isValid, toolState.jsonInput, handleFormatValidate]
  );

  const handleIndentationChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newIndentation = parseInt(event.target.value, 10);
    setToolState({ indent: newIndentation });
    reformatCurrentJson(newIndentation, toolState.sortKeys);
  };

  const handleSortKeysChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSortKeys = event.target.checked;
    setToolState({ sortKeys: newSortKeys });
    reformatCurrentJson(toolState.indent, newSortKeys);
  };

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[], source: 'library' | 'upload') => {
      setIsModalOpen(false);
      if (files.length === 0) return;
      const file = files[0];
      if (!file.blob) {
        setError(`Error: File "${file.name}" has no content.`);
        return;
      }
      try {
        const text = await file.blob.text();
        setToolState({ jsonInput: text, lastLoadedFilename: file.name });
        setTimeout(() => {
          handleFormatValidate(
            source === 'upload' ? 'upload' : 'transfer',
            text,
            toolState.indent,
            toolState.sortKeys
          );
        }, 0);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(`Error reading file "${file.name}": ${msg}`);
        setToolState({ jsonInput: '', lastLoadedFilename: null });
      }
    },
    [setToolState, handleFormatValidate, toolState.indent, toolState.sortKeys]
  );

  const handleCopyToClipboard = async () => {
    if (!outputValue || !navigator.clipboard) {
      setError('Clipboard API not available or no output to copy.');
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
      console.error('Clipboard copy error:', err);
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
  };

  const handleDownloadOutput = () => {
    if (!outputValue) {
      setError('No output to download.');
      return;
    }
    try {
      const blob = new Blob([outputValue], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const originalFilename =
        toolState.lastLoadedFilename?.replace(/\.[^/.]+$/, '') ||
        'formatted-json';
      link.download = `${originalFilename}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setError('');
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute,
        trigger: 'click',
        input: { action: 'downloadOutput', length: outputValue.length },
        output: { filename: link.download },
        status: 'success',
        eventTimestamp: Date.now(),
      });
    } catch (err) {
      setError('Failed to prepare download.');
      console.error('Download error:', err);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute,
        trigger: 'click',
        input: { action: 'downloadOutput' },
        output: { error: 'Download failed' },
        status: 'error',
        eventTimestamp: Date.now(),
      });
    }
  };

  const handleSaveToLibrary = async () => {
    if (!outputValue) {
      setError('No output to save.');
      return;
    }
    const blob = new Blob([outputValue], { type: 'application/json' });
    const originalFilename =
      toolState.lastLoadedFilename?.replace(/\.[^/.]+$/, '') ||
      'formatted-json';
    const filename = `${originalFilename}-${Date.now()}.json`;
    try {
      const newFileId = await addFileToLibrary(
        blob,
        filename,
        'application/json',
        false /* isTemporary = false */
      );
      setSaveSuccess(true);
      setError('');
      setTimeout(() => setSaveSuccess(false), 2000);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute,
        trigger: 'click',
        input: { action: 'saveOutputToLibrary', length: outputValue.length },
        output: {
          message: 'Saved to library',
          fileId: newFileId,
          filename: filename,
        },
        status: 'success',
        eventTimestamp: Date.now(),
        outputFileIds: [newFileId],
      });
    } catch (err) {
      setError('Failed to save to library.');
      console.error('Save to library error:', err);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute,
        trigger: 'click',
        input: { action: 'saveOutputToLibrary' },
        output: { error: 'Save to library failed' },
        status: 'error',
        eventTimestamp: Date.now(),
      });
    }
  };

  if (isLoadingToolState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading JSON Tool...
      </p>
    );
  }

  const canPerformOutputActions = isValid === true && outputValue.trim() !== '';

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="flex justify-between items-center gap-2">
        <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
          Input JSON:
          {toolState.lastLoadedFilename && (
            <span className="ml-2 text-xs italic">
              (from: {toolState.lastLoadedFilename})
            </span>
          )}
        </label>
        <Button
          variant="neutral-outline"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          iconLeft={<ArrowUpTrayIcon className="h-4 w-4" />}
        >
          Load from File
        </Button>
      </div>
      <Textarea
        id="json-input"
        rows={10}
        value={toolState.jsonInput}
        onChange={handleInputChange}
        placeholder={`Paste your JSON here or load from a file...\n{\n  "example": "data",\n  "isValid": true\n}`}
        error={isValid === false ? error : null}
        textareaClassName="text-sm font-mono"
        spellCheck="false"
        aria-invalid={isValid === false}
        aria-describedby={
          isValid === false ? 'json-validation-feedback' : undefined
        }
      />

      <div className="flex flex-wrap gap-x-4 gap-y-3 items-center p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <Button
          variant="accent"
          onClick={() => handleFormatValidate('click')}
          disabled={!toolState.jsonInput.trim()}
        >
          Validate & Format
        </Button>
        <div className="flex items-center gap-2">
          <label
            htmlFor="indent-select"
            className="text-sm font-medium text-[rgb(var(--color-text-muted))] whitespace-nowrap"
          >
            Indentation:
          </label>
          <Select
            id="indent-select"
            name="indent"
            options={[
              { value: 2, label: '2 Spaces' },
              { value: 4, label: '4 Spaces' },
              { value: 0, label: 'Compact' },
            ]}
            value={toolState.indent}
            onChange={handleIndentationChange}
            selectClassName="text-sm py-1.5 px-2 min-w-[120px]"
          />
        </div>
        <Checkbox
          label="Sort Keys Alphabetically"
          id="sort-keys-checkbox"
          checked={toolState.sortKeys}
          onChange={handleSortKeysChange}
          labelClassName="text-sm whitespace-nowrap"
        />
        <div className="flex-grow"></div>
        <Button
          variant="neutral"
          onClick={handleClear}
          title="Clear input and output"
          className="ml-auto"
        >
          Clear
        </Button>
      </div>

      {isValid !== null && (
        <div
          id="json-validation-feedback"
          className={`p-3 border rounded-md text-sm flex items-start sm:items-center gap-2 ${isValid ? 'bg-green-100 border-green-300 text-green-800' : 'bg-[rgb(var(--color-bg-error-subtle))] border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))]'}`}
          role="alert"
        >
          {isValid ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <div>
            {' '}
            {isValid ? (
              <strong>Valid JSON</strong>
            ) : (
              <>
                <strong className="font-semibold">Error:</strong> {error}
              </>
            )}{' '}
          </div>
        </div>
      )}

      <Textarea
        label="Output:"
        id="json-output"
        rows={12}
        value={outputValue}
        readOnly
        placeholder="Formatted JSON will appear here..."
        textareaClassName="text-sm font-mono bg-[rgb(var(--color-bg-subtle))]"
        spellCheck="false"
        aria-live="polite"
      />

      {/* Output Actions */}
      {canPerformOutputActions && (
        <div className="flex flex-wrap gap-3 items-center p-3 border-t border-[rgb(var(--color-border-base))]">
          <Button
            variant="primary-outline"
            onClick={handleSaveToLibrary}
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
            onClick={handleDownloadOutput}
            iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
          >
            Download .json
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
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".json,application/json,text/plain,.txt"
        selectionMode="single"
        libraryFilter={{ category: 'text' }} // This might need adjustment based on how you categorize .json files
        initialTab="upload"
      />
    </div>
  );
}
