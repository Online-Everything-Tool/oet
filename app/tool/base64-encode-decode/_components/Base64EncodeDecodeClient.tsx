// FILE: app/tool/base64-encode-decode/_components/Base64EncodeDecodeClient.tsx
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
import RadioGroup from '../../_components/form/RadioGroup';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { useDebouncedCallback } from 'use-debounce';
import {
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import importedMetadata from '../metadata.json';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';

type Operation = 'encode' | 'decode';

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
const metadata = importedMetadata as ToolMetadata;

interface Base64EncodeDecodeClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function Base64EncodeDecodeClient({
  urlStateParams,
  toolRoute,
}: Base64EncodeDecodeClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
  } = useToolState<Base64ToolState>(toolRoute, DEFAULT_BASE64_TOOL_STATE);

  const [uiError, setUiError] = useState<string>('');
  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameAction, setFilenameAction] = useState<
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
  const initialToolStateLoadCompleteRef = useRef(false);
  const initialUrlLoadProcessedRef = useRef(false);

  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const directiveName = metadata.directive;

  const operationOptions = useMemo(
    () => [
      { value: 'encode' as Operation, label: 'Encode' },
      { value: 'decode' as Operation, label: 'Decode' },
    ],
    []
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

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[Base64 ITDE Accept] Processing signal from: ${signal.sourceDirective}`
      );
      setUiError('');
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setUiError(
          `Metadata not found for source tool: ${signal.sourceToolTitle}`
        );
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
        setUiError(
          resolvedPayload.errorMessage ||
            'No transferable data received from source.'
        );
        return;
      }

      let newText = '';
      const firstItem = resolvedPayload.data.find((item) =>
        item.type?.startsWith('text/')
      );
      let loadedFilename: string | null = null;
      if (firstItem) {
        try {
          newText = await firstItem.blob.text();
          if ('id' in firstItem && 'name' in firstItem) {
            loadedFilename = (firstItem as StoredFile).name;
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          setUiError(`Error reading text from received data: ${errorMsg}`);
          return;
        }
      } else {
        setUiError('No valid text item found in received ITDE data.');
        return;
      }

      const newState: Partial<Base64ToolState> = {
        inputText: newText,
        outputValue: '',
        lastLoadedFilename: loadedFilename,
      };
      setToolState(newState);
      await saveStateNow({ ...toolState, ...newState });
      setUserDeferredAutoPopup(false);
    },
    [getToolMetadata, setToolState, saveStateNow, toolState]
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

  const handleEncodeDecode = useCallback(
    (textToProcess: string, opToPerform: Operation) => {
      let currentOutput = '';
      let currentError = '';
      const trimmedTextToProcess = textToProcess.trim();

      if (!trimmedTextToProcess) {
        setToolState((prev) => ({ ...prev, outputValue: '' }));
        setCurrentOutputFilename(null);
        if (uiError) setUiError('');
        return;
      }

      if (opToPerform === 'encode') {
        try {
          currentOutput = btoa(
            unescape(encodeURIComponent(trimmedTextToProcess))
          );
        } catch (_err) {
          currentError = 'Failed to encode text. Ensure text is valid UTF-8.';
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
        }
      }

      if (currentError) {
        if (uiError !== currentError) setUiError(currentError);
        setToolState((prev) => ({ ...prev, outputValue: '' }));
        setCurrentOutputFilename(null);
      } else {
        if (uiError) setUiError('');

        setToolState((prev) => ({
          ...prev,
          outputValue: currentOutput,
          operation: opToPerform,
        }));

        const currentFilenameForOutput =
          toolState.inputText === textToProcess
            ? toolState.lastLoadedFilename
            : null;

        if (currentFilenameForOutput) {
          setCurrentOutputFilename(
            generateOutputFilename(currentFilenameForOutput, opToPerform)
          );
        } else {
          setCurrentOutputFilename(null);
        }
      }
    },
    [
      setToolState,
      uiError,
      generateOutputFilename,
      toolState.inputText,
      toolState.lastLoadedFilename,
    ]
  );

  const debouncedProcess = useDebouncedCallback(
    handleEncodeDecode,
    AUTO_PROCESS_DEBOUNCE_MS
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
    const textFromUrl = params.get('text');
    const opFromUrlExplicit = params.get('operation') as Operation | null;

    let textToSetForState = toolState.inputText;
    let opToSetForState = toolState.operation;
    let filenameToSetForState = toolState.lastLoadedFilename;
    let needsProcessingDueToUrl = false;

    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      textToSetForState = textFromUrl;
      filenameToSetForState = null;
      needsProcessingDueToUrl = true;
    }

    if (
      opFromUrlExplicit &&
      ['encode', 'decode'].includes(opFromUrlExplicit) &&
      opFromUrlExplicit !== toolState.operation
    ) {
      opToSetForState = opFromUrlExplicit;
      needsProcessingDueToUrl = true;
    }

    if (needsProcessingDueToUrl) {
      setToolState({
        inputText: textToSetForState,
        operation: opToSetForState,
        lastLoadedFilename: filenameToSetForState,
        outputValue: '',
      });
    }
  }, [isLoadingToolState, urlStateParams, toolState, setToolState]);

  useEffect(() => {
    if (isLoadingToolState || !initialToolStateLoadCompleteRef.current) {
      return;
    }

    const text = toolState.inputText;
    const currentOperation = toolState.operation;

    if (!text.trim()) {
      if (toolState.outputValue !== '' || uiError !== '') {
        setToolState((prev) => ({
          ...prev,
          outputValue: '' /* Keep potential error for empty input if desired */,
        }));
      }
      if (currentOutputFilename !== null) setCurrentOutputFilename(null);
      debouncedProcess.cancel();
      if (uiError && text.trim() === '') setUiError('');
      return;
    }
    debouncedProcess(text, currentOperation);
  }, [
    toolState.inputText,
    toolState.operation,
    isLoadingToolState,
    debouncedProcess,
    toolState.outputValue,
    uiError,
    currentOutputFilename,
    setToolState,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setToolState({
      inputText: newText,
      lastLoadedFilename: null,
    });
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
  };

  const handleOperationChange = (newOperation: Operation) => {
    setToolState({
      operation: newOperation,
    });
  };

  const handleClear = useCallback(async () => {
    const newState: Base64ToolState = {
      ...DEFAULT_BASE64_TOOL_STATE,
      operation: toolState.operation,
    };
    setToolState(newState);
    await saveStateNow(newState);

    setUiError('');
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    debouncedProcess.cancel();
  }, [setToolState, saveStateNow, toolState.operation, debouncedProcess]);

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
        });
        setUiError('');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setUiError(`Error reading file "${file.name}": ${msg}`);
        setToolState({
          inputText: '',
          lastLoadedFilename: null,
          outputValue: '',
          operation: 'encode',
        });
        setCurrentOutputFilename(null);
      }
    },
    [setToolState]
  );

  const handleFilenameConfirm = useCallback(
    (filename: string, actionOverride?: 'download' | 'save') => {
      setIsFilenameModalOpen(false);
      const currentAction = actionOverride || filenameAction;
      setFilenameAction(null);
      if (!currentAction) return;

      let finalFilename = filename.trim();

      if (!finalFilename) {
        finalFilename = generateOutputFilename(
          toolState.lastLoadedFilename,
          toolState.operation
        );
      }

      if (
        toolState.operation === 'encode' &&
        !/\.b64(\.txt)?$/i.test(finalFilename)
      ) {
        finalFilename = finalFilename.replace(/\.txt$/i, '') + '.b64.txt';
      } else if (
        toolState.operation === 'decode' &&
        !/\.txt$/i.test(finalFilename)
      ) {
        finalFilename += '.txt';
      }

      setCurrentOutputFilename(finalFilename);

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
          setDownloadSuccess(true);
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          if (uiError) setUiError('');
          setTimeout(() => setDownloadSuccess(false), 2000);
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
    },
    [
      filenameAction,
      toolState,
      addFileToLibrary,
      generateOutputFilename,
      uiError,
    ]
  );

  const initiateOutputAction = useCallback(
    (action: 'download' | 'save') => {
      if (!toolState.outputValue.trim()) {
        setUiError('No output to ' + action + '.');
        return;
      }

      if (uiError && !uiError.toLowerCase().includes('output')) {
        setUiError(
          'Cannot ' + action + ' output due to existing input errors.'
        );
        return;
      }
      setUiError('');

      const opForFilename = toolState.operation;
      const lastLoadedForFilename = toolState.lastLoadedFilename;

      if (currentOutputFilename) {
        handleFilenameConfirm(currentOutputFilename, action);
      } else {
        setSuggestedFilenameForPrompt(
          generateOutputFilename(lastLoadedForFilename, opForFilename)
        );
        setFilenameAction(action);
        setIsFilenameModalOpen(true);
      }
    },
    [
      currentOutputFilename,
      handleFilenameConfirm,
      toolState.outputValue,
      toolState.operation,
      toolState.lastLoadedFilename,
      uiError,
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
      if (uiError && !uiError.toLowerCase().includes('output')) setUiError('');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (_err) {
      setUiError('Failed to copy to clipboard.');
    }
  }, [toolState.outputValue, uiError]);

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
    if (remainingSignalsAfterIgnore.length === 0)
      setUserDeferredAutoPopup(false);
  };

  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Base64 Tool...
      </p>
    );
  }
  const canPerformOutputActions =
    toolState.outputValue.trim() !== '' && !uiError;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div>
        <div className="flex justify-between items-center gap-2">
          <label
            htmlFor="base64-input-label"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
          >
            Input:
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
          id="base64-input"
          label="Input Text / Base64 String"
          labelClassName="sr-only"
          rows={8}
          value={toolState.inputText}
          onChange={handleInputChange}
          placeholder="Paste text or Base64 string here..."
          textareaClassName="text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
          spellCheck="false"
        />
      </div>
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
      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        slurpContentOnly={true}
        mode="selectExistingOrUploadNew"
        accept=".txt,text/*,.b64"
        selectionMode="single"
        libraryFilter={{ category: 'text' }}
        initialTab="upload"
      />
      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => {
          setIsFilenameModalOpen(false);
          setFilenameAction(null);
        }}
        onConfirm={handleFilenameConfirm}
        initialFilename={suggestedFilenameForPrompt}
        title={
          filenameAction === 'download'
            ? 'Enter Download Filename'
            : 'Enter Filename for Library'
        }
        filenameAction={filenameAction || 'download'}
        promptMessage={
          filenameAction === 'download'
            ? 'Please enter a filename for the download:'
            : 'Please enter a filename to save to the library:'
        }
        confirmButtonText={
          filenameAction === 'download' ? 'Download' : 'Save to Library'
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
