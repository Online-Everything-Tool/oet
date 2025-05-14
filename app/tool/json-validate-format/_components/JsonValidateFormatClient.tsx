// --- FILE: app/tool/json-validate-format/_components/JsonValidateFormatClient.tsx ---
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react'; // Added useRef
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Checkbox from '../../_components/form/Checkbox';
import Button from '../../_components/form/Button';
import Select from '../../_components/form/Select';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal'; // For Save/Download
import type { ParamConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon, // For error display
} from '@heroicons/react/24/outline';

interface JsonValidateFormatClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
  // toolTitle is not used in this client's logic
}

interface JsonToolState {
  jsonInput: string;
  indent: number;
  sortKeys: boolean;
  lastLoadedFilename?: string | null;
  outputValue: string; // Persisted output
  isValid: boolean | null; // Persisted validation status
  errorMsg: string; // Persisted error message
  // No outputFilename needed if each save/download is a new timestamped file
}

const DEFAULT_JSON_TOOL_STATE: JsonToolState = {
  jsonInput: '',
  indent: 2,
  sortKeys: false,
  lastLoadedFilename: null,
  outputValue: '',
  isValid: null,
  errorMsg: '',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sortObjectKeys = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
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
  toolRoute,
}: JsonValidateFormatClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    clearState: persistentClearState, // Use this for the clear button
  } = useToolState<JsonToolState>(toolRoute, DEFAULT_JSON_TOOL_STATE);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addFile: addFileToLibrary } = useFileLibrary();

  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false); // For "Save to Library"
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameActionType, setFilenameActionType] = useState<
    'download' | 'save' | null
  >(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] =
    useState('');

  const initialUrlLoadProcessedRef = useRef(false);

  const handleFormatValidate = useCallback(
    (
      textToProcess: string = toolState.jsonInput, // Default to current state
      currentIndent: number = toolState.indent,
      currentSortKeys: boolean = toolState.sortKeys
    ) => {
      const trimmedInput = textToProcess.trim();
      if (!trimmedInput) {
        setToolState({
          outputValue: '',
          isValid: null,
          errorMsg: '',
          lastLoadedFilename: null,
        });
        return;
      }

      let newIsValid: boolean | null = null;
      let newErrorMsg = '';
      let newOutputValue = '';

      try {
        let parsedJson = JSON.parse(trimmedInput);
        if (currentSortKeys) parsedJson = sortObjectKeys(parsedJson);
        newOutputValue = JSON.stringify(
          parsedJson,
          null,
          currentIndent === 0 ? undefined : currentIndent
        );
        newIsValid = true;
      } catch (err) {
        newErrorMsg =
          err instanceof Error
            ? `Invalid JSON: ${err.message}`
            : 'Invalid JSON: Unknown error.';
        newIsValid = false;
      }
      setToolState({
        outputValue: newOutputValue,
        isValid: newIsValid,
        errorMsg: newErrorMsg,
      });
      setCopySuccess(false);
      setSaveSuccess(false);
    },
    [toolState.jsonInput, toolState.indent, toolState.sortKeys, setToolState]
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
    initialUrlLoadProcessedRef.current = true; // Mark as processed

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<JsonToolState> = {};
    let needsProcessingAfterUpdate = false;

    const jsonFromUrl = params.get('json');
    if (jsonFromUrl !== null && jsonFromUrl !== toolState.jsonInput) {
      updates.jsonInput = jsonFromUrl;
      updates.lastLoadedFilename = '(loaded from URL)';
      updates.outputValue = '';
      updates.isValid = null;
      updates.errorMsg = ''; // Invalidate output
      needsProcessingAfterUpdate = true;
    }

    const indentFromUrl = params.get('indent');
    if (indentFromUrl !== null) {
      const numIndent = parseInt(indentFromUrl, 10);
      if (
        !isNaN(numIndent) &&
        [0, 2, 4].includes(numIndent) &&
        numIndent !== toolState.indent
      ) {
        updates.indent = numIndent;
        updates.outputValue = '';
        updates.isValid = null;
        updates.errorMsg = ''; // Invalidate output
        needsProcessingAfterUpdate = true;
      }
    }

    if (Object.keys(updates).length > 0) {
      setToolState(updates);
    } else if (needsProcessingAfterUpdate && toolState.jsonInput.trim()) {
      // If only URL params matched current state, but we decided it needs processing (e.g. jsonInput was set by URL)
      // and there wasn't a setToolState call to trigger the other effect.
      handleFormatValidate(
        updates.jsonInput || toolState.jsonInput,
        updates.indent || toolState.indent,
        toolState.sortKeys
      );
    }
  }, [
    isLoadingToolState,
    urlStateParams,
    toolState,
    setToolState,
    handleFormatValidate,
  ]);

  useEffect(() => {
    if (isLoadingToolState || !initialUrlLoadProcessedRef.current) return;
    if (toolState.jsonInput.trim()) {
      console.log(
        '[JsonClient] Indent or SortKeys changed, re-validating/formatting.'
      );
      handleFormatValidate(
        toolState.jsonInput,
        toolState.indent,
        toolState.sortKeys
      );
    }
  }, [
    toolState.indent,
    toolState.sortKeys,
    isLoadingToolState,
    toolState.jsonInput,
    handleFormatValidate,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({
      jsonInput: event.target.value,
      lastLoadedFilename: null,
      outputValue: '', // Clear output, validation will be triggered by button or settings change
      isValid: null,
      errorMsg: '',
    });
    setCopySuccess(false);
    setSaveSuccess(false);
  };

  const handleClear = useCallback(async () => {
    await persistentClearState(); // Resets toolState to default via useToolState
    setCopySuccess(false);
    setSaveSuccess(false);
  }, [persistentClearState]);

  const handleIndentationChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newIndentation = parseInt(event.target.value, 10);
    // setToolState will trigger the useEffect for indent/sortKeys change if jsonInput is present
    setToolState({ indent: newIndentation });
  };

  const handleSortKeysChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSortKeys = event.target.checked;
    // setToolState will trigger the useEffect for indent/sortKeys change if jsonInput is present
    setToolState({ sortKeys: newSortKeys });
  };

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsModalOpen(false);
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
          // This will update jsonInput, and the effect for indent/sortKeys will kick in
          jsonInput: text,
          lastLoadedFilename: file.name,
          outputValue: '', // Clear previous output
          isValid: null,
          errorMsg: '',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setToolState({
          errorMsg: `Error reading file "${file.name}": ${msg}`,
          jsonInput: '',
          lastLoadedFilename: null,
          outputValue: '',
          isValid: null,
        });
      }
    },
    [setToolState] // Removed handleFormatValidate, indent, sortKeys. Effect will handle processing.
  );

  const handleCopyToClipboard = async () => {
    if (!toolState.outputValue || !navigator.clipboard) {
      setToolState({
        errorMsg: 'Clipboard API not available or no output to copy.',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(toolState.outputValue);
      setCopySuccess(true);
      setToolState({ errorMsg: '' });
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setToolState({ errorMsg: 'Failed to copy to clipboard.' });
      console.error('Clipboard copy error:', err);
    }
  };

  const generateOutputFilename = useCallback((): string => {
    const base =
      toolState.lastLoadedFilename?.replace(/\.[^/.]+$/, '') ||
      'formatted-json';
    return `${base}-${Date.now()}.json`;
  }, [toolState.lastLoadedFilename]);

  const initiateOutputAction = (action: 'download' | 'save') => {
    if (toolState.isValid !== true || !toolState.outputValue.trim()) {
      setToolState({
        errorMsg: `No valid output to ${action}. Please validate your JSON first.`,
      });
      return;
    }
    setSuggestedFilenameForPrompt(generateOutputFilename());
    setFilenameActionType(action);
    setIsFilenameModalOpen(true);
  };

  const handleFilenameConfirm = useCallback(
    async (chosenFilename: string) => {
      const action = filenameActionType;
      setIsFilenameModalOpen(false);
      setFilenameActionType(null);

      if (!action || toolState.isValid !== true || !toolState.outputValue)
        return;

      let finalFilename = chosenFilename.trim();
      if (!finalFilename) finalFilename = generateOutputFilename();
      if (!/\.json$/i.test(finalFilename)) finalFilename += '.json';

      if (action === 'download') {
        try {
          const blob = new Blob([toolState.outputValue], {
            type: 'application/json',
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
          type: 'application/json',
        });
        try {
          await addFileToLibrary(
            blob,
            finalFilename,
            'application/json',
            false
          );
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
      toolState.isValid,
      toolState.outputValue,
      generateOutputFilename,
      addFileToLibrary,
      setToolState,
    ]
  );

  if (isLoadingToolState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading JSON Tool...
      </p>
    );
  }

  const canPerformOutputActions =
    toolState.isValid === true && toolState.outputValue.trim() !== '';

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
        error={toolState.isValid === false ? toolState.errorMsg : null} // Show error from state
        textareaClassName="text-sm font-mono"
        spellCheck="false"
        aria-invalid={toolState.isValid === false}
        aria-describedby={
          toolState.isValid === false ? 'json-validation-feedback' : undefined
        }
      />

      <div className="flex flex-wrap gap-x-4 gap-y-3 items-center p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <Button
          variant="accent"
          onClick={() => handleFormatValidate()}
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

      {toolState.isValid !== null && (
        <div
          id="json-validation-feedback"
          className={`p-3 border rounded-md text-sm flex items-start sm:items-center gap-2 ${toolState.isValid ? 'bg-green-100 border-green-300 text-green-800' : 'bg-[rgb(var(--color-bg-error-subtle))] border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))]'}`}
          role="alert"
        >
          {toolState.isValid ? (
            <CheckIcon className="h-5 w-5 flex-shrink-0 text-green-600" />
          ) : (
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 text-red-500" />
          )}
          <div>
            {toolState.isValid ? (
              <strong>Valid JSON</strong>
            ) : (
              <>
                <strong className="font-semibold">Error:</strong>{' '}
                {toolState.errorMsg}
              </>
            )}
          </div>
        </div>
      )}

      <Textarea
        label="Output:"
        id="json-output"
        rows={12}
        value={toolState.outputValue}
        readOnly
        placeholder="Formatted JSON will appear here..."
        textareaClassName="text-sm font-mono bg-[rgb(var(--color-bg-subtle))]"
        spellCheck="false"
        aria-live="polite"
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
            ? 'Please enter a filename for the download:'
            : 'Please enter a filename to save to the library:'
        }
        confirmButtonText={
          filenameActionType === 'download' ? 'Download' : 'Save to Library'
        }
      />
    </div>
  );
}
