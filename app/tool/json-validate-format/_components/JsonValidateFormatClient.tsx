// --- FILE: app/tool/json-validate-format/_components/JsonValidateFormatClient.tsx ---
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Checkbox from '../../_components/form/Checkbox';
import Button from '../../_components/form/Button';
import Select from '../../_components/form/Select';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import {
  ArrowUpTrayIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
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

const metadata = importedMetadata as ToolMetadata;

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
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialUrlLoadProcessedRef = useRef(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const directiveName = metadata.directive;

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
      setToolState((prevState) => ({
        ...prevState,
        errorMsg: '',
        isValid: null,
        outputValue: '',
      }));
      setCurrentOutputFilename(null);

      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setToolState((prevState) => ({
          ...prevState,
          errorMsg: `Metadata not found for source tool: ${signal.sourceToolTitle}`,
        }));
        return;
      }

      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );

      if (
        resolvedPayload.type === 'error' ||
        resolvedPayload.type === 'none' ||
        !resolvedPayload.data ||
        resolvedPayload.data.length === 0
      ) {
        setToolState((prevState) => ({
          ...prevState,
          errorMsg:
            resolvedPayload.errorMessage ||
            'No transferable data received from source.',
        }));
        return;
      }

      let newJsonInput = '';
      const firstItem = resolvedPayload.data.find(
        (item) =>
          item.type === 'application/json' || item.type?.startsWith('text/')
      );
      let loadedFilename: string | null = null;

      if (firstItem) {
        try {
          newJsonInput = await firstItem.blob.text();
          if ('id' in firstItem && 'name' in firstItem) {
            loadedFilename = (firstItem as StoredFile).name;
          }
        } catch (e) {
          const errorMsgText = e instanceof Error ? e.message : String(e);
          setToolState((prevState) => ({
            ...prevState,
            errorMsg: `Error reading text from received data: ${errorMsgText}`,
          }));
          return;
        }
      } else {
        setToolState((prevState) => ({
          ...prevState,
          errorMsg: 'No valid JSON or text item found in received ITDE data.',
        }));
        return;
      }

      const newStateUpdate: Partial<JsonToolState> = {
        jsonInput: newJsonInput,
        lastLoadedFilename: loadedFilename,
        outputValue: '',
        isValid: null,
        errorMsg: '',
      };

      setToolState((prevState) => ({ ...prevState, ...newStateUpdate }));
      await saveStateNow({
        ...toolState,
        ...newStateUpdate,
        indent: toolState.indent,
        sortKeys: toolState.sortKeys,
      });
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
      textToProcess: string,
      currentIndent: number,
      currentSortKeys: boolean
    ) => {
      const trimmedInput = textToProcess.trim();
      if (!trimmedInput) {
        setToolState((prevState_1) => ({
          ...prevState_1,
          outputValue: '',
          isValid: null,
          errorMsg: '',
        }));
        setCurrentOutputFilename(null);
        return;
      }

      let newIsValid: boolean | null = null;
      let newErrorMsg = '';
      let newOutputValue = '';

      try {
        let parsedJson = JSON.parse(trimmedInput);
        newIsValid = true;
        if (currentSortKeys) parsedJson = sortObjectKeys(parsedJson);
        newOutputValue = JSON.stringify(
          parsedJson,
          null,
          currentIndent === 0 ? undefined : currentIndent
        );

        setCurrentOutputFilename(
          generateOutputFilename(toolState.lastLoadedFilename)
        );
      } catch (err) {
        newErrorMsg =
          err instanceof Error
            ? `Invalid JSON: ${err.message}`
            : 'Invalid JSON: Unknown error.';
        newIsValid = false;
        setCurrentOutputFilename(null);
      }

      setToolState((prevState_2) => ({
        ...prevState_2,
        outputValue: newOutputValue,
        isValid: newIsValid,
        errorMsg: newErrorMsg,
        indent: currentIndent,
        sortKeys: currentSortKeys,
      }));
      setCopySuccess(false);
      setSaveSuccess(false);
      setDownloadSuccess(false);
    },
    [setToolState, generateOutputFilename, toolState.lastLoadedFilename]
  );

  useEffect(() => {
    if (
      isLoadingToolState ||
      initialUrlLoadProcessedRef.current ||
      !initialToolStateLoadCompleteRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      return;
    }
    initialUrlLoadProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<JsonToolState> = {};

    const jsonFromUrl = params.get('json');
    if (jsonFromUrl !== null && jsonFromUrl !== toolState.jsonInput) {
      updates.jsonInput = jsonFromUrl;
      updates.lastLoadedFilename = null;
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
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.outputValue = '';
      updates.isValid = null;
      updates.errorMsg = '';
      setToolState((prev) => ({ ...prev, ...updates }));
    }
  }, [isLoadingToolState, urlStateParams, toolState, setToolState]);

  useEffect(() => {
    if (isLoadingToolState || !initialToolStateLoadCompleteRef.current) {
      return;
    }

    handleFormatValidate(
      toolState.jsonInput,
      toolState.indent,
      toolState.sortKeys
    );
  }, [
    toolState.jsonInput,
    toolState.indent,
    toolState.sortKeys,
    isLoadingToolState,
    handleFormatValidate,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newJsonInput = event.target.value;
    setToolState({
      jsonInput: newJsonInput,
      lastLoadedFilename: null,
    });
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
  };

  const handleClear = useCallback(async () => {
    const newState: JsonToolState = {
      ...DEFAULT_JSON_TOOL_STATE,
      indent: toolState.indent,
      sortKeys: toolState.sortKeys,
    };
    setToolState(newState);
    await saveStateNow(newState);

    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
  }, [setToolState, saveStateNow, toolState.indent, toolState.sortKeys]);

  const handleIndentationChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newIndentation = parseInt(event.target.value, 10);
    setToolState({ indent: newIndentation });
  };

  const handleSortKeysChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSortKeys = event.target.checked;
    setToolState({ sortKeys: newSortKeys });
  };

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLoadFileModalOpen(false);
      if (files.length === 0) return;
      const file = files[0];
      if (!file.blob) {
        setToolState((prevState) => ({
          ...prevState,
          errorMsg: `Error: File "${file.name}" has no content.`,
        }));
        return;
      }
      try {
        const text = await file.blob.text();
        setToolState({
          jsonInput: text,
          lastLoadedFilename: file.name,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setToolState((prevState) => ({
          ...prevState,
          jsonInput: '',
          lastLoadedFilename: null,
          outputValue: '',
          isValid: null,
          errorMsg: `Error reading file "${file.name}": ${msg}`,
        }));
        setCurrentOutputFilename(null);
      }
    },
    [setToolState]
  );

  const handleCopyToClipboard = async () => {
    if (!toolState.outputValue || toolState.isValid !== true) {
      setToolState((prevState) => ({
        ...prevState,
        errorMsg:
          prevState.isValid !== true
            ? 'Cannot copy invalid or empty JSON.'
            : 'No output to copy.',
      }));
      return;
    }
    try {
      await navigator.clipboard.writeText(toolState.outputValue);
      setCopySuccess(true);
      setToolState((prevState) => ({ ...prevState, errorMsg: '' }));
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setToolState((prevState) => ({
        ...prevState,
        errorMsg: 'Failed to copy to clipboard.',
      }));
      console.error('Clipboard copy error:', err);
    }
  };

  const handleFilenameConfirm = useCallback(
    async (chosenFilename: string) => {
      const action = filenameActionType;
      setIsFilenameModalOpen(false);
      setFilenameActionType(null);

      if (!action || toolState.isValid !== true || !toolState.outputValue) {
        setToolState((prevState) => ({
          ...prevState,
          errorMsg:
            prevState.errorMsg ||
            'Cannot process action: No valid JSON output.',
        }));
        return;
      }

      let finalFilename = chosenFilename.trim();
      if (!finalFilename)
        finalFilename = generateOutputFilename(toolState.lastLoadedFilename);
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
          setDownloadSuccess(true);
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setToolState((prevState) => ({ ...prevState, errorMsg: '' }));
          setTimeout(() => setDownloadSuccess(false), 2000);
        } catch (_err) {
          setToolState((prevState) => ({
            ...prevState,
            errorMsg: 'Failed to prepare download.',
          }));
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
          setToolState((prevState) => ({ ...prevState, errorMsg: '' }));
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (_err) {
          setToolState((prevState) => ({
            ...prevState,
            errorMsg: 'Failed to save to library.',
          }));
        }
      }
    },
    [
      filenameActionType,
      toolState,
      addFileToLibrary,
      generateOutputFilename,
      setToolState,
    ]
  );

  const initiateOutputAction = (action: 'download' | 'save') => {
    if (toolState.isValid !== true || !toolState.outputValue.trim()) {
      setToolState((prevState) => ({
        ...prevState,
        errorMsg: `No valid output to ${action}. Please validate your JSON first.`,
      }));
      return;
    }

    if (
      toolState.errorMsg &&
      !toolState.errorMsg.toLowerCase().includes('invalid json')
    ) {
      setToolState((prev) => ({ ...prev, errorMsg: '' }));
    }

    const suggestedName =
      currentOutputFilename ||
      generateOutputFilename(toolState.lastLoadedFilename);
    setSuggestedFilenameForPrompt(suggestedName);
    setFilenameActionType(action);
    setIsFilenameModalOpen(true);
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
    if (
      itdeTarget.pendingSignals.filter(
        (s) => s.sourceDirective !== sourceDirective
      ).length === 0
    )
      setUserDeferredAutoPopup(false);
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
      <div>
        <div className="flex justify-between items-center gap-2">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Input JSON:
            {toolState.lastLoadedFilename && (
              <span className="ml-2 text-xs italic">
                ({toolState.lastLoadedFilename})
              </span>
            )}
          </label>
          <div className="flex items-center gap-2 mb-2">
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
              iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
            >
              Load from File
            </Button>
          </div>
        </div>
        <Textarea
          id="json-input"
          label="Input JSON text"
          labelClassName="sr-only"
          rows={10}
          value={toolState.jsonInput}
          onChange={handleInputChange}
          placeholder={`Paste your JSON here or load from a file...\n{\n  "example": "data",\n  "isValid": true\n}`}
          error={toolState.isValid === false ? toolState.errorMsg : null}
          textareaClassName="text-sm font-mono"
          spellCheck="false"
          aria-invalid={toolState.isValid === false}
          aria-describedby={
            toolState.isValid === false
              ? 'json-validation-feedback-main'
              : undefined
          }
        />
      </div>
      <div className="border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap gap-x-4 gap-y-3 items-center p-3 ">
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
        </div>
        <div className="flex justify-end gap-4 p-3">
          <OutputActionButtons
            canPerform={canPerformOutputActions}
            isSaveSuccess={saveSuccess}
            isCopySuccess={copySuccess}
            isDownloadSuccess={downloadSuccess}
            onInitiateSave={() => initiateOutputAction('save')}
            onInitiateDownload={() => initiateOutputAction('download')}
            onCopy={handleCopyToClipboard}
            onClear={handleClear}
            directiveName={directiveName}
            outputConfig={metadata.outputConfig}
          />
        </div>
      </div>

      {/* Validation feedback section - can remain, or errors can be shown only on input/output Textarea */}
      {toolState.isValid !== null && !toolState.errorMsg && (
        <div
          id="json-validation-feedback-main"
          className={`p-3 border rounded-md text-sm flex items-start sm:items-center gap-2 ${toolState.isValid ? 'bg-green-100 border-green-300 text-green-800' : ''}`}
          role="alert"
        >
          {toolState.isValid && (
            <CheckIcon className="h-5 w-5 flex-shrink-0 text-green-600" />
          )}
          {toolState.isValid && <strong>Valid JSON</strong>}
        </div>
      )}
      {toolState.errorMsg && (
        <div
          role="alert"
          id="json-validation-feedback-main"
          className="p-3 my-1 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0"
            aria-hidden="true"
          />
          {toolState.errorMsg}
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
      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        slurpContentOnly={true}
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
        filenameAction={filenameActionType || 'download'}
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
