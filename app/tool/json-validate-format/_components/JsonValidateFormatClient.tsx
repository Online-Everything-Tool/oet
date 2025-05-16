// --- FILE: app/tool/json-validate-format/_components/JsonValidateFormatClient.tsx ---
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
import Checkbox from '../../_components/form/Checkbox';
import Button from '../../_components/form/Button';
import Select from '../../_components/form/Select';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type {
  ParamConfig,
  ToolMetadata,
  OutputConfig,
} from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import importedMetadata from '../metadata.json';

interface JsonValidateFormatClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

interface JsonToolState {
  jsonInput: string;
  indent: number;
  sortKeys: boolean;
  lastLoadedFilename?: string | null;
  outputValue: string;
  isValid: boolean | null;
  errorMsg: string;
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

const metadata: ToolMetadata = importedMetadata as ToolMetadata;

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

interface OutputActionButtonsProps {
  canPerform: boolean;
  isSaveSuccess: boolean;
  isCopySuccess: boolean;
  onInitiateSave: () => void;
  onInitiateDownload: () => void;
  onCopy: () => void;
  directiveName: string;
  outputConfig: OutputConfig;
}

const OutputActionButtons = React.memo(function OutputActionButtons({
  canPerform,
  isSaveSuccess,
  isCopySuccess,
  onInitiateSave,
  onInitiateDownload,
  onCopy,
  directiveName,
  outputConfig,
}: OutputActionButtonsProps) {
  if (!canPerform) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-3 items-center p-3 border-y border-[rgb(var(--color-border-base))]">
      <SendToToolButton
        currentToolDirective={directiveName}
        currentToolOutputConfig={outputConfig}
        buttonText="Send Output To..."
      />
      <Button
        variant="primary-outline"
        onClick={onInitiateSave}
        disabled={isSaveSuccess}
        iconLeft={
          isSaveSuccess ? (
            <CheckIcon className="h-5 w-5" />
          ) : (
            <DocumentPlusIcon className="h-5 w-5" />
          )
        }
      >
        {isSaveSuccess ? 'Saved!' : 'Save to Library'}
      </Button>
      <Button
        variant="secondary"
        onClick={onInitiateDownload}
        iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
      >
        Download .json
      </Button>
      <Button
        variant="neutral"
        onClick={onCopy}
        disabled={isCopySuccess}
        iconLeft={
          isCopySuccess ? (
            <CheckIcon className="h-5 w-5" />
          ) : (
            <ClipboardDocumentIcon className="h-5 w-5" />
          )
        }
      >
        {isCopySuccess ? 'Copied!' : 'Copy Output'}
      </Button>
    </div>
  );
});

export default function JsonValidateFormatClient({
  urlStateParams,
  toolRoute,
}: JsonValidateFormatClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<JsonToolState>(toolRoute, DEFAULT_JSON_TOOL_STATE);

  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameActionType, setFilenameActionType] = useState<
    'download' | 'save' | null
  >(null);
  const [currentOutputFilename, setCurrentOutputFilename] = useState<
    string | null
  >(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] =
    useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialUrlLoadProcessedRef = useRef(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const directiveName = useMemo(
    () => toolRoute.split('/').pop() || 'json-validate-format',
    [toolRoute]
  );

  const generateOutputFilename = useCallback(
    (baseName?: string | null): string => {
      const base = baseName?.replace(/\.[^/.]+$/, '') || 'formatted-json';
      return `${base}.json`;
    },
    []
  );

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[JsonValidateFormat ITDE Accept] Processing signal from: ${signal.sourceDirective}`
      );
      setToolState({ errorMsg: '', isValid: null });
      setCurrentOutputFilename(null);

      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setToolState({
          errorMsg: `Metadata not found for source tool: ${signal.sourceToolTitle}`,
        });
        return;
      }

      const resolvedPayload = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );

      if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none') {
        setToolState({
          errorMsg:
            resolvedPayload.errorMessage ||
            'No transferable data received from source.',
        });
        return;
      }

      let newJsonInput = '';
      if (
        (resolvedPayload.type === 'text' ||
          resolvedPayload.type === 'jsonObject') &&
        resolvedPayload.data
      ) {
        if (typeof resolvedPayload.data === 'string') {
          newJsonInput = resolvedPayload.data;
        } else if (typeof resolvedPayload.data === 'object') {
          try {
            newJsonInput = JSON.stringify(resolvedPayload.data, null, 2);
          } catch (_e) {
            setToolState({
              errorMsg: 'Received object could not be stringified to JSON.',
            });
            return;
          }
        }
      } else if (
        resolvedPayload.type === 'fileReference' &&
        resolvedPayload.data
      ) {
        const fileData = resolvedPayload.data as StoredFile;
        if (
          fileData.type === 'application/json' ||
          fileData.type?.startsWith('text/')
        ) {
          try {
            newJsonInput = await fileData.blob.text();
          } catch (_e) {
            setToolState({
              errorMsg: `Error reading text from received file: ${fileData.name}`,
            });
            return;
          }
        } else {
          setToolState({
            errorMsg: `Received file '${fileData.name}' is not a JSON or text file.`,
          });
          return;
        }
      } else {
        setToolState({
          errorMsg: `Received unhandled data type '${resolvedPayload.type}' from ${signal.sourceToolTitle}.`,
        });
        return;
      }

      const newState: JsonToolState = {
        ...toolState,
        jsonInput: newJsonInput,
        lastLoadedFilename: null,
        outputValue: '',
        isValid: null,
        errorMsg: '',
      };
      setToolState(newState);
      await saveStateNow(newState);
      setUserDeferredAutoPopup(false);
    },
    [getToolMetadata, toolState, setToolState, saveStateNow]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingToolState) {
      if (!initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = true;
      }
    } else {
      if (initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = false;
      }
    }
  }, [isLoadingToolState]);

  useEffect(() => {
    const canProceed =
      !isLoadingToolState && initialToolStateLoadCompleteRef.current;
    if (
      canProceed &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingToolState, itdeTarget, userDeferredAutoPopup, directiveName]);

  const handleFormatValidate = useCallback(
    (
      textToProcess: string = toolState.jsonInput,
      currentIndent: number = toolState.indent,
      currentSortKeys: boolean = toolState.sortKeys
    ) => {
      const trimmedInput = textToProcess.trim();
      if (!trimmedInput) {
        setToolState({
          outputValue: '',
          isValid: null,
          errorMsg: '',
        });
        setCurrentOutputFilename(null);
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
        if (toolState.lastLoadedFilename && !currentOutputFilename) {
          setCurrentOutputFilename(
            generateOutputFilename(toolState.lastLoadedFilename)
          );
        } else if (!toolState.lastLoadedFilename) {
          setCurrentOutputFilename(null);
        }
      } catch (err) {
        newErrorMsg =
          err instanceof Error
            ? `Invalid JSON: ${err.message}`
            : 'Invalid JSON: Unknown error.';
        newIsValid = false;
        setCurrentOutputFilename(null);
      }
      setToolState({
        outputValue: newOutputValue,
        isValid: newIsValid,
        errorMsg: newErrorMsg,
      });
      setCopySuccess(false);
      setSaveSuccess(false);
    },
    [
      toolState.jsonInput,
      toolState.indent,
      toolState.sortKeys,
      toolState.lastLoadedFilename,
      currentOutputFilename,
      setToolState,
      generateOutputFilename,
    ]
  );

  useEffect(() => {
    if (
      isLoadingToolState ||
      initialUrlLoadProcessedRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      if (
        !isLoadingToolState &&
        initialToolStateLoadCompleteRef.current &&
        toolState.jsonInput.trim() &&
        !toolState.outputValue &&
        !toolState.errorMsg
      ) {
        handleFormatValidate(
          toolState.jsonInput,
          toolState.indent,
          toolState.sortKeys
        );
      }
      return;
    }
    initialUrlLoadProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<JsonToolState> = {};

    const jsonFromUrl = params.get('json');
    if (jsonFromUrl !== null && jsonFromUrl !== toolState.jsonInput) {
      updates.jsonInput = jsonFromUrl;
      updates.lastLoadedFilename = null;
      setCurrentOutputFilename(null);
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
        setCurrentOutputFilename(null);
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.outputValue = '';
      updates.isValid = null;
      updates.errorMsg = '';
      setToolState(updates);

      if (updates.jsonInput?.trim()) {
        handleFormatValidate(
          updates.jsonInput,
          updates.indent || toolState.indent,
          updates.sortKeys || toolState.sortKeys
        );
      }
    } else if (
      toolState.jsonInput.trim() &&
      !toolState.outputValue &&
      !toolState.errorMsg
    ) {
      handleFormatValidate(
        toolState.jsonInput,
        toolState.indent,
        toolState.sortKeys
      );
    }
  }, [
    isLoadingToolState,
    urlStateParams,
    toolState.jsonInput,
    toolState.indent,
    toolState.sortKeys,
    toolState.outputValue,
    toolState.errorMsg,
    setToolState,
    handleFormatValidate,
  ]);

  useEffect(() => {
    if (
      isLoadingToolState ||
      !initialUrlLoadProcessedRef.current ||
      !initialToolStateLoadCompleteRef.current
    )
      return;

    if (toolState.jsonInput.trim()) {
      handleFormatValidate(
        toolState.jsonInput,
        toolState.indent,
        toolState.sortKeys
      );
    } else {
      if (
        toolState.outputValue ||
        toolState.isValid !== null ||
        toolState.errorMsg
      ) {
        setToolState({ outputValue: '', isValid: null, errorMsg: '' });
        setCurrentOutputFilename(null);
      }
    }
  }, [toolState, isLoadingToolState, handleFormatValidate, setToolState]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newJsonInput = event.target.value;
    setToolState({
      jsonInput: newJsonInput,
      lastLoadedFilename: null,
      outputValue: '',
      isValid: null,
      errorMsg: '',
    });
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);

    if (newJsonInput.trim()) {
      handleFormatValidate(newJsonInput, toolState.indent, toolState.sortKeys);
    }
  };

  const handleClear = useCallback(async () => {
    await clearStateAndPersist();
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setUserDeferredAutoPopup(false);
  }, [clearStateAndPersist]);

  const handleIndentationChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newIndentation = parseInt(event.target.value, 10);
    setToolState({ indent: newIndentation });
    setCurrentOutputFilename(null);
  };

  const handleSortKeysChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSortKeys = event.target.checked;
    setToolState({ sortKeys: newSortKeys });
    setCurrentOutputFilename(null);
  };

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
          jsonInput: text,
          lastLoadedFilename: file.name,
          outputValue: '',
          isValid: null,
          errorMsg: '',
        });
        setCurrentOutputFilename(generateOutputFilename(file.name));
        setUserDeferredAutoPopup(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setToolState({
          errorMsg: `Error reading file "${file.name}": ${msg}`,
          jsonInput: '',
          lastLoadedFilename: null,
          outputValue: '',
          isValid: null,
        });
        setCurrentOutputFilename(null);
      }
    },
    [setToolState, generateOutputFilename]
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

      setCurrentOutputFilename(finalFilename);

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

  const initiateOutputAction = (action: 'download' | 'save') => {
    if (toolState.isValid !== true || !toolState.outputValue.trim()) {
      setToolState({
        errorMsg: `No valid output to ${action}. Please validate your JSON first.`,
      });
      return;
    }
    if (currentOutputFilename) {
      handleFilenameConfirm(currentOutputFilename);
    } else {
      setSuggestedFilenameForPrompt(
        generateOutputFilename(toolState.lastLoadedFilename)
      );
      setFilenameActionType(action);
      setIsFilenameModalOpen(true);
    }
  };

  const handleModalDeferAll = () => {
    setUserDeferredAutoPopup(true);
    itdeTarget.closeModal();
  };
  const handleModalIgnoreAll = () => {
    setUserDeferredAutoPopup(false);
    itdeTarget.ignoreAllSignals();
  };
  const handleModalAccept = (sourceDirective: string) => {
    itdeTarget.acceptSignal(sourceDirective);
  };
  const handleModalIgnore = (sourceDirective: string) => {
    itdeTarget.ignoreSignal(sourceDirective);
    const remainingSignalsAfterIgnore = itdeTarget.pendingSignals.filter(
      (s) => s.sourceDirective !== sourceDirective
    );
    if (remainingSignalsAfterIgnore.length === 0) {
      setUserDeferredAutoPopup(false);
    }
  };

  if (
    isLoadingToolState &&
    !initialToolStateLoadCompleteRef.current &&
    !initialUrlLoadProcessedRef.current
  ) {
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
              ({toolState.lastLoadedFilename})
            </span>
          )}
        </label>
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
          <Button
            variant="neutral-outline"
            size="sm"
            onClick={() => setIsLoadFileModalOpen(true)}
            iconLeft={<ArrowUpTrayIcon className="h-4 w-4" />}
          >
            Load from File
          </Button>
        </div>
      </div>
      <Textarea
        id="json-input"
        rows={10}
        value={toolState.jsonInput}
        onChange={handleInputChange}
        placeholder={`Paste your JSON here or load from a file...\n{\n  "example": "data",\n  "isValid": true\n}`}
        error={toolState.isValid === false ? toolState.errorMsg : null}
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
          onClick={() =>
            handleFormatValidate(
              toolState.jsonInput,
              toolState.indent,
              toolState.sortKeys
            )
          }
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
              { value: 0, label: 'Compact (No Indent)' },
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

      <OutputActionButtons
        canPerform={canPerformOutputActions}
        isSaveSuccess={saveSuccess}
        isCopySuccess={copySuccess}
        onInitiateSave={() => initiateOutputAction('save')}
        onInitiateDownload={() => initiateOutputAction('download')}
        onCopy={handleCopyToClipboard}
        directiveName={directiveName}
        outputConfig={metadata.outputConfig as OutputConfig}
      />

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

      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
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
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={handleModalAccept}
        onIgnore={handleModalIgnore}
        onDeferAll={handleModalDeferAll}
        onIgnoreAll={handleModalIgnoreAll}
      />
    </div>
  );
}
