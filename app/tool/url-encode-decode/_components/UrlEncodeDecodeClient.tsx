// --- FILE: app/tool/url-encode-decode/_components/UrlEncodeDecodeClient.tsx ---
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import Textarea from '@/app/tool/_components/form/Textarea';
import RadioGroup from '@/app/tool/_components/form/RadioGroup';
import Button from '@/app/tool/_components/form/Button';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import type { StoredFile } from '@/src/types/storage';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useDebouncedCallback } from 'use-debounce';
import {
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import importedMetadata from '../metadata.json';

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
const metadata = importedMetadata as ToolMetadata;

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
    isLoadingState,
    saveStateNow,
    errorLoadingState,
  } = useToolState<UrlToolState>(toolRoute, DEFAULT_URL_TOOL_STATE);

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
  const [isProcessing, setIsProcessing] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialUrlLoadProcessedRef = useRef(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const directiveName = metadata.directive;

  const generateOutputFilenameForAction = useCallback((): string => {
    const base =
      toolState.lastLoadedFilename?.replace(/\.[^/.]+$/, '') ||
      (toolState.operation === 'encode' ? 'encoded' : 'decoded');
    const modePart =
      toolState.operation === 'encode' ? `-${toolState.encodeMode}` : '';
    return `${base}${modePart}.txt`;
  }, [toolState.lastLoadedFilename, toolState.operation, toolState.encodeMode]);

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setToolState((prevState) => ({ ...prevState, errorMsg: '' }));
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

      let newText = '';
      const firstItem = resolvedPayload.data.find((item) =>
        item.type?.startsWith('text/')
      );
      let loadedFilename: string | null = null;

      if (firstItem) {
        try {
          newText = await firstItem.blob.text();
          if ('id' in firstItem && 'name' in firstItem) {
            loadedFilename = (firstItem as StoredFile).filename;
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
          errorMsg: 'No valid text item found in received ITDE data.',
        }));
        return;
      }

      const newStateUpdate: Partial<UrlToolState> = {
        inputText: newText,
        outputValue: '',
        errorMsg: '',
        lastLoadedFilename: loadedFilename,
      };

      setToolState((prevState) => ({ ...prevState, ...newStateUpdate }));
      await saveStateNow({
        ...toolState,
        ...newStateUpdate,
        operation: toolState.operation,
        encodeMode: toolState.encodeMode,
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
    if (!isLoadingState) {
      if (!initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = true;
      }
    } else {
      if (initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = false;
      }
    }
  }, [isLoadingState]);

  useEffect(() => {
    const canProceed =
      !isLoadingState && initialToolStateLoadCompleteRef.current;
    if (
      canProceed &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup, directiveName]);

  const performEncodeDecode = useCallback(
    (text: string, operation: Operation, mode: EncodeMode) => {
      setIsProcessing(true);

      setToolState((prevState) => ({
        ...prevState,
        outputValue: '',
        errorMsg: '',
      }));
      setCopySuccess(false);
      setSaveSuccess(false);
      setDownloadSuccess(false);

      if (!text.trim()) {
        if (text === '') {
        } else {
          setToolState((prevState) => ({
            ...prevState,
            outputValue: '',
            errorMsg: '',
          }));
          setCurrentOutputFilename(null);
          setIsProcessing(false);
          return;
        }
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

        const currentFilenameForOutput =
          toolState.inputText === text ? toolState.lastLoadedFilename : null;
        if (currentFilenameForOutput) {
          setCurrentOutputFilename(generateOutputFilenameForAction());
        } else {
          setCurrentOutputFilename(null);
        }
      } catch (err) {
        newOutput = '';
        if (err instanceof URIError && operation === 'decode') {
          newError =
            'Decoding failed: Invalid percent-encoding sequence found. Check input.';
        } else {
          newError = `An unexpected error occurred during ${operation}.`;
        }
        setCurrentOutputFilename(null);
      }

      setToolState((prevState) => ({
        ...prevState,
        outputValue: newOutput,
        errorMsg: newError,
        operation: operation,
        encodeMode: mode,
      }));
      setIsProcessing(false);
    },
    [
      setToolState,
      generateOutputFilenameForAction,
      toolState.inputText,
      toolState.lastLoadedFilename,
    ]
  );

  const debouncedProcess = useDebouncedCallback(
    performEncodeDecode,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (
      isLoadingState ||
      initialUrlLoadProcessedRef.current ||
      !initialToolStateLoadCompleteRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      return;
    }
    initialUrlLoadProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<UrlToolState> = {};
    let needsUpdate = false;

    const textFromUrl = params.get('text');
    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      updates.inputText = textFromUrl;
      updates.lastLoadedFilename = null;
      needsUpdate = true;
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
      setToolState((prev) => ({ ...prev, ...updates }));
    }
  }, [isLoadingState, urlStateParams, toolState, setToolState]);

  useEffect(() => {
    if (
      isLoadingState ||
      !initialToolStateLoadCompleteRef.current ||
      isProcessing
    ) {
      return;
    }

    debouncedProcess(
      toolState.inputText,
      toolState.operation,
      toolState.encodeMode
    );
  }, [
    toolState.inputText,
    toolState.operation,
    toolState.encodeMode,
    isLoadingState,
    debouncedProcess,
    isProcessing,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({
      inputText: event.target.value,
      lastLoadedFilename: null,
    });
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
  };
  const handleOperationChange = (newOperation: Operation) => {
    setToolState({ operation: newOperation });
  };
  const handleEncodeModeChange = (newMode: EncodeMode) => {
    setToolState({ encodeMode: newMode });
  };

  const handleClear = useCallback(async () => {
    const newState: UrlToolState = {
      ...DEFAULT_URL_TOOL_STATE,
      operation: toolState.operation,
      encodeMode: toolState.encodeMode,
    };
    setToolState(newState);
    await saveStateNow(newState);

    setIsProcessing(false);
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    debouncedProcess.cancel();
  }, [
    setToolState,
    saveStateNow,
    toolState.operation,
    toolState.encodeMode,
    debouncedProcess,
  ]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!toolState.outputValue) {
      setToolState((prev) => ({ ...prev, errorMsg: 'No output to copy.' }));
      return;
    }
    if (
      toolState.errorMsg &&
      !toolState.errorMsg.toLowerCase().includes('output')
    ) {
      setToolState((prev) => ({ ...prev, errorMsg: '' }));
    }
    try {
      await navigator.clipboard.writeText(toolState.outputValue);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (_err) {
      setToolState((prev) => ({
        ...prev,
        errorMsg: 'Failed to copy to clipboard.',
      }));
    }
  }, [toolState, setToolState]);

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLoadFileModalOpen(false);
      if (files.length === 0) return;
      const file = files[0];
      if (!file.blob) {
        setToolState((prev) => ({
          ...prev,
          errorMsg: `Error: File "${file.filename}" has no content.`,
        }));
        return;
      }
      try {
        const text = await file.blob.text();
        setToolState({
          inputText: text,
          lastLoadedFilename: file.filename,
        });
      } catch (e) {
        setToolState((prev) => ({
          ...prev,
          inputText: '',
          lastLoadedFilename: null,
          outputValue: '',
          errorMsg: `Error reading file "${file.filename}": ${e instanceof Error ? e.message : 'Unknown error'}`,
        }));
        setCurrentOutputFilename(null);
      }
    },
    [setToolState]
  );

  const handleFilenameConfirm = useCallback(
    async (chosenFilename: string) => {
      const action = filenameActionType;
      setIsFilenameModalOpen(false);
      setFilenameActionType(null);
      if (!action || !toolState.outputValue || toolState.errorMsg) {
        setToolState((prev) => ({
          ...prev,
          errorMsg: prev.errorMsg || 'No valid output to process.',
        }));
        return;
      }
      let finalFilename = chosenFilename.trim();
      if (!finalFilename) finalFilename = generateOutputFilenameForAction();

      if (
        toolState.operation === 'encode' &&
        !/\.b64(\.txt)?$/i.test(finalFilename)
      ) {
        finalFilename = finalFilename.replace(/\.txt$/i, '') + '.b64.txt';
      } else if (
        toolState.operation === 'decode' &&
        !finalFilename.toLowerCase().endsWith('.txt')
      ) {
        finalFilename += '.txt';
      }
      setCurrentOutputFilename(finalFilename);

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
          setDownloadSuccess(true);
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setToolState((prev) => ({ ...prev, errorMsg: '' }));
          setTimeout(() => setDownloadSuccess(false), 2000);
        } catch (_err) {
          setToolState((prev) => ({
            ...prev,
            errorMsg: 'Failed to prepare download.',
          }));
        }
      } else if (action === 'save') {
        const blob = new Blob([toolState.outputValue], {
          type: 'text/plain;charset=utf-8',
        });
        try {
          await addFileToLibrary(blob, finalFilename, 'text/plain', false);
          setSaveSuccess(true);
          setToolState((prev) => ({ ...prev, errorMsg: '' }));
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (_err) {
          setToolState((prev) => ({
            ...prev,
            errorMsg: 'Failed to save to library.',
          }));
        }
      }
    },
    [
      filenameActionType,
      toolState,
      addFileToLibrary,
      generateOutputFilenameForAction,
      setToolState,
    ]
  );

  const initiateOutputActionWithPrompt = (action: 'download' | 'save') => {
    if (!toolState.outputValue.trim()) {
      setToolState((prev) => ({
        ...prev,
        errorMsg: 'No output to ' + action + '.',
      }));
      return;
    }
    if (
      toolState.errorMsg &&
      !toolState.errorMsg.toLowerCase().includes('output')
    ) {
      setToolState((prev) => ({
        ...prev,
        errorMsg: 'Cannot ' + action + ' output due to existing input errors.',
      }));
      return;
    }
    setToolState((prev) => ({ ...prev, errorMsg: '' }));

    if (currentOutputFilename) {
      handleFilenameConfirm(currentOutputFilename);
    } else {
      setSuggestedFilenameForPrompt(generateOutputFilenameForAction());
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
    if (
      itdeTarget.pendingSignals.filter(
        (s) => s.sourceDirective !== sourceDirective
      ).length === 0
    )
      setUserDeferredAutoPopup(false);
  };

  if (
    isLoadingState &&
    !initialToolStateLoadCompleteRef.current &&
    !initialUrlLoadProcessedRef.current
  ) {
    return (
      <div className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading URL Encoder/Decoder...
      </div>
    );
  }

  const displayError = toolState.errorMsg || errorLoadingState;
  const canPerformOutputActions =
    toolState.outputValue.trim() !== '' && !toolState.errorMsg && !isProcessing;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div>
        <div className="flex justify-between items-center gap-2">
          <label
            htmlFor="url-input-main"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
          >
            Input (Text or URL-encoded string):
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
              onClick={() => setIsLoadFileModalOpen(true)}
              iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
              disabled={isProcessing}
            >
              Load from File
            </Button>
          </div>
        </div>
        <Textarea
          id="url-input-main"
          label="Input text or URL-encoded string"
          labelClassName="sr-only"
          rows={8}
          value={toolState.inputText}
          onChange={handleInputChange}
          placeholder="Paste text or URL-encoded string here..."
          textareaClassName="text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
          spellCheck="false"
          disabled={isProcessing}
        />
      </div>
      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div>
          <div className="flex flex-wrap gap-4 items-start">
            <RadioGroup
              name="urlOperation"
              legend="Operation:"
              options={[
                { value: 'encode', label: 'Encode' },
                { value: 'decode', label: 'Decode' },
              ]}
              selectedValue={toolState.operation}
              onChange={handleOperationChange}
              layout="horizontal"
              radioClassName="text-sm"
              labelClassName="font-medium"
              disabled={isProcessing}
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
                onChange={handleEncodeModeChange}
                layout="horizontal"
                radioClassName="text-sm"
                labelClassName="font-medium"
                disabled={isProcessing}
              />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center justify-end">
          <OutputActionButtons
            canPerform={canPerformOutputActions}
            isSaveSuccess={saveSuccess}
            isCopySuccess={copySuccess}
            isDownloadSuccess={downloadSuccess}
            onInitiateSave={() => initiateOutputActionWithPrompt('save')}
            onInitiateDownload={() =>
              initiateOutputActionWithPrompt('download')
            }
            onCopy={handleCopyToClipboard}
            onClear={handleClear}
            directiveName={directiveName}
            outputConfig={metadata.outputConfig}
          />
        </div>
      </div>
      {displayError && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-status-error))] rounded-md text-sm flex items-start gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 text-[rgb(var(--color-status-error))] flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {displayError}
          </div>
        </div>
      )}
      <div>
        <label
          htmlFor="url-output-main"
          className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"
        >
          Output:
        </label>
        <Textarea
          id="url-output-main"
          label="Output of URL encode/decode operation"
          labelClassName="sr-only"
          rows={8}
          value={
            isProcessing && !toolState.outputValue && !toolState.errorMsg
              ? 'Processing...'
              : toolState.outputValue
          }
          readOnly
          placeholder="Result will appear here..."
          textareaClassName={`text-base font-mono resize-none bg-[rgb(var(--color-bg-subtle))] ${isProcessing && !toolState.outputValue && !toolState.errorMsg ? 'animate-pulse' : ''}`}
          aria-live="polite"
          onClick={(e) => e.currentTarget.select()}
        />
      </div>
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
            ? 'Filename for download:'
            : 'Filename for library:'
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
