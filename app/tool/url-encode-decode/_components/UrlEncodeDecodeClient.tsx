// --- FILE: app/tool/url-encode-decode/_components/UrlEncodeDecodeClient.tsx ---
'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import useToolState from '../../_hooks/useToolState';
import type {
  ParamConfig,
  ToolMetadata,
  OutputConfig,
} from '@/src/types/tools';
import Textarea from '../../_components/form/Textarea';
import RadioGroup from '../../_components/form/RadioGroup';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
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

import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import SendToToolButton from '../../_components/shared/SendToToolButton';
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

interface OutputActionButtonsProps {
  canPerform: boolean;
  isSaveSuccess: boolean;
  isCopySuccess: boolean;
  onInitiateSave: () => void;
  onInitiateDownload: () => void;
  onCopy: () => void;
  directiveName: string;
  outputConfig: OutputConfig;
  isProcessing: boolean;
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
  isProcessing,
}: OutputActionButtonsProps) {
  if (!canPerform && !isProcessing) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-3 items-center py-3 border-t border-b border-[rgb(var(--color-border-base))]">
      <SendToToolButton
        currentToolDirective={directiveName}
        currentToolOutputConfig={outputConfig}
        buttonText="Send Output To..."

      />
      <Button
        variant="primary-outline"
        onClick={onInitiateSave}
        disabled={isSaveSuccess || !canPerform || isProcessing}
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
        disabled={!canPerform || isProcessing}
      >
        Download Output
      </Button>
      <Button
        variant={isCopySuccess ? 'secondary' : 'accent-outline'}
        onClick={onCopy}
        disabled={isCopySuccess || !canPerform || isProcessing}
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

export default function UrlEncodeDecodeClient({
  urlStateParams,
  toolRoute,
}: UrlEncodeDecodeClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    clearStateAndPersist,
    errorLoadingState,
    saveStateNow,
  } = useToolState<UrlToolState>(toolRoute, DEFAULT_URL_TOOL_STATE);

  const [isCopied, setIsCopied] = useState<boolean>(false);
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
  const [saveSuccess, setSaveSuccess] = useState(false);
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
      const firstItem = resolvedPayload.data[0];
      let loadedFilename: string | null = null;

      if (firstItem && firstItem.type.startsWith('text/')) {
        try {
          newText = await firstItem.blob.text();
          if ('id' in firstItem && 'name' in firstItem) {
            loadedFilename = (firstItem as StoredFile).name;
          } else {
            loadedFilename = null;
          }
        } catch (e) {
          const errorMsgText = e instanceof Error ? e.message : String(e);
          setToolState((prevState) => ({
            ...prevState,
            errorMsg: `Error reading text from received data: ${errorMsgText}`,
          }));
          return;
        }
      } else if (firstItem) {
        setToolState((prevState) => ({
          ...prevState,
          errorMsg: `Received data is not text (type: ${firstItem.type}). Cannot process.`,
        }));
        return;
      } else {
        setToolState((prevState) => ({
          ...prevState,
          errorMsg: 'No valid item found in received ITDE data.',
        }));
        return;
      }

      const currentOperation = toolState.operation;
      const currentEncodeMode = toolState.encodeMode;
      const newStateUpdate: Partial<UrlToolState> = {
        inputText: newText,
        outputValue: '',
        errorMsg: '',
        lastLoadedFilename: loadedFilename,
      };
      setToolState(newStateUpdate);
      await saveStateNow({
        ...toolState,
        ...newStateUpdate,
        operation: currentOperation,
        encodeMode: currentEncodeMode,
      });
      setUserDeferredAutoPopup(false);
    },
    [
      getToolMetadata,
      toolState,
      setToolState,
      saveStateNow,
    ]
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
    (
      text: string = toolState.inputText,
      operation: Operation = toolState.operation,
      mode: EncodeMode = toolState.encodeMode
    ) => {
      setIsProcessing(true);

      setToolState((prevState) => ({
        ...prevState,
        outputValue: '',
        errorMsg: '',
      }));
      setIsCopied(false);
      setSaveSuccess(false);

      if (!text.trim()) {

        setCurrentOutputFilename(null);
        setIsProcessing(false);
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

        setToolState((prevState) => {
          const currentLlf = prevState.lastLoadedFilename;
          if (currentLlf && !currentOutputFilename) {

            setCurrentOutputFilename(generateOutputFilenameForAction());
          } else if (!currentLlf && currentOutputFilename !== null) {

            setCurrentOutputFilename(null);
          }
          return { ...prevState, outputValue: newOutput, errorMsg: newError };
        });
      } catch (err) {
        newOutput = '';
        if (err instanceof URIError && operation === 'decode') {
          newError =
            'Decoding failed: Invalid percent-encoding sequence found. Check input.';
        } else {
          newError = `An unexpected error occurred during ${operation}.`;
        }
        setCurrentOutputFilename(null);
        setToolState((prevState) => ({
          ...prevState,
          outputValue: newOutput,
          errorMsg: newError,
        }));
      }
      setIsProcessing(false);
    },
    [
      toolState.inputText,
      toolState.operation,
      toolState.encodeMode,
      currentOutputFilename,
      setToolState,
      generateOutputFilenameForAction,
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
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      if (
        !isLoadingState &&
        initialToolStateLoadCompleteRef.current &&
        toolState.inputText.trim() &&
        !toolState.outputValue &&
        !toolState.errorMsg &&
        !isProcessing
      ) {
        debouncedProcess(
          toolState.inputText,
          toolState.operation,
          toolState.encodeMode
        );
      }
      return;
    }
    initialUrlLoadProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<UrlToolState> = {};
    let needsProcessingForUrl = false;

    const textFromUrl = params.get('text');
    if (textFromUrl !== null) {
      if (textFromUrl !== toolState.inputText) {
        updates.inputText = textFromUrl;
        updates.lastLoadedFilename = null;
        setCurrentOutputFilename(null);
        needsProcessingForUrl = true;
      }
    }

    const opFromUrl = params.get('operation') as Operation | null;
    if (
      opFromUrl &&
      ['encode', 'decode'].includes(opFromUrl) &&
      opFromUrl !== toolState.operation
    ) {
      updates.operation = opFromUrl;
      setCurrentOutputFilename(null);
      needsProcessingForUrl = true;
    }

    if (Object.keys(updates).length > 0) {
      updates.outputValue = '';
      updates.errorMsg = '';
      setToolState(updates);

      if (
        needsProcessingForUrl &&
        (updates.inputText || toolState.inputText).trim()
      ) {
        performEncodeDecode(
          updates.inputText || toolState.inputText,
          updates.operation || toolState.operation,
          updates.encodeMode || toolState.encodeMode
        );
      }
    } else if (
      toolState.inputText.trim() &&
      !toolState.outputValue.trim() &&
      !toolState.errorMsg &&
      !isProcessing
    ) {

      performEncodeDecode(
        toolState.inputText,
        toolState.operation,
        toolState.encodeMode
      );
    }
  }, [
    isLoadingState,
    urlStateParams,
    toolState.inputText,
    toolState.operation,
    toolState.encodeMode,
    toolState.outputValue,
    toolState.errorMsg,
    setToolState,
    performEncodeDecode,
    isProcessing,
    debouncedProcess,
  ]);

  useEffect(() => {

    if (
      isLoadingState ||
      !initialUrlLoadProcessedRef.current ||
      !initialToolStateLoadCompleteRef.current
    )
      return;
    if (!toolState.inputText.trim()) {
      if (toolState.outputValue !== '' || toolState.errorMsg !== '') {
        setToolState((prev) => ({ ...prev, outputValue: '', errorMsg: '' }));
      }
      if (currentOutputFilename !== null) setCurrentOutputFilename(null);
      debouncedProcess.cancel();
      return;
    }
    if (!isProcessing) {
      debouncedProcess(
        toolState.inputText,
        toolState.operation,
        toolState.encodeMode
      );
    }
  }, [
    toolState.inputText,
    toolState.operation,
    toolState.encodeMode,
    isLoadingState,
    debouncedProcess,
    setToolState,
    currentOutputFilename,
    isProcessing,
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
    setCurrentOutputFilename(null);
    setIsCopied(false);
    setSaveSuccess(false);
  };
  const handleOperationChange = (newOperation: Operation) => {
    setToolState({ operation: newOperation, outputValue: '', errorMsg: '' });
    setCurrentOutputFilename(null);
    setIsCopied(false);
    setSaveSuccess(false);
  };
  const handleEncodeModeChange = (newMode: EncodeMode) => {
    setToolState({ encodeMode: newMode, outputValue: '', errorMsg: '' });
    setCurrentOutputFilename(null);
    setIsCopied(false);
    setSaveSuccess(false);
  };
  const handleClear = useCallback(async () => {
    await clearStateAndPersist();
    setCurrentOutputFilename(null);
    setIsCopied(false);
    setSaveSuccess(false);
    debouncedProcess.cancel();
    setUserDeferredAutoPopup(false);
  }, [clearStateAndPersist, debouncedProcess]);

  const handleCopyOutput = useCallback(async () => {
    if (!toolState.outputValue || isCopied) return;
    if (toolState.errorMsg) {

      setToolState((prevState) => ({
        ...prevState,
        errorMsg: 'Cannot copy output due to processing error.',
      }));
      return;
    }
    try {
      await navigator.clipboard.writeText(toolState.outputValue);
      setIsCopied(true);
      setToolState((prevState) => ({ ...prevState, errorMsg: '' }));
      setTimeout(() => setIsCopied(false), 2000);
    } catch (_err) {
      setToolState((prevState) => ({
        ...prevState,
        errorMsg: 'Could not copy text to clipboard.',
      }));
    }
  }, [toolState.outputValue, isCopied, toolState.errorMsg, setToolState]);

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
        setToolState((prevState) => ({
          ...prevState,
          inputText: text,
          lastLoadedFilename: file.name,
          outputValue: '',
          errorMsg: '',
        }));
        setCurrentOutputFilename(generateOutputFilenameForAction());
        setUserDeferredAutoPopup(false);
      } catch (e) {
        setToolState((prevState) => ({
          ...prevState,
          errorMsg: `Error reading file "${file.name}": ${e instanceof Error ? e.message : 'Unknown error'}`,
          inputText: '',
          lastLoadedFilename: null,
          outputValue: '',
        }));
        setCurrentOutputFilename(null);
      }
    },
    [setToolState, generateOutputFilenameForAction]
  );

  const handleFilenameConfirm = useCallback(
    async (chosenFilename: string) => {
      const action = filenameActionType;
      setIsFilenameModalOpen(false);
      setFilenameActionType(null);
      if (!action || !toolState.outputValue || toolState.errorMsg) {
        setToolState((prevState) => ({
          ...prevState,
          errorMsg: prevState.errorMsg || 'No valid output to process.',
        }));
        return;
      }
      let finalFilename = chosenFilename.trim();
      if (!finalFilename) finalFilename = generateOutputFilenameForAction();
      if (!/\.txt$/i.test(finalFilename)) finalFilename += '.txt';
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
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setToolState((prevState) => ({ ...prevState, errorMsg: '' }));
        } catch (_err) {
          setToolState((prevState) => ({
            ...prevState,
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
      toolState.outputValue,
      toolState.errorMsg,
      generateOutputFilenameForAction,
      addFileToLibrary,
      setToolState,
    ]
  );

  const initiateOutputActionWithPrompt = (action: 'download' | 'save') => {
    if (!toolState.outputValue.trim() || toolState.errorMsg) {
      setToolState((prevState) => ({
        ...prevState,
        errorMsg: prevState.errorMsg || 'No valid output to ' + action + '.',
      }));
      return;
    }
    const suggestedName =
      currentOutputFilename || generateOutputFilenameForAction();
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
    isLoadingState &&
    !initialUrlLoadProcessedRef.current &&
    !initialToolStateLoadCompleteRef.current
  ) {
    return (
      <div className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading URL Encoder/Decoder...
      </div>
    );
  }
  const displayError = toolState.errorMsg || errorLoadingState;
  const canPerformOutputActions =
    toolState.outputValue.trim() !== '' && !toolState.errorMsg && !isProcessing;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex justify-between items-center gap-2">
        <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
          Input (Text or URL-encoded string):
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
            disabled={isProcessing}
          >
            Load from File
          </Button>
        </div>
      </div>
      <Textarea
        id="url-input"
        value={toolState.inputText}
        onChange={handleInputChange}
        placeholder="Paste text or URL-encoded string here..."
        rows={8}
        textareaClassName="text-base"
        disabled={isProcessing}
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
              onChange={(val) => handleEncodeModeChange(val as EncodeMode)}
              layout="horizontal"
              radioClassName="text-sm"
              disabled={isProcessing}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-4 items-center border-t pt-3 mt-2">
          <div className="flex-grow"></div>
          <Button
            variant="neutral"
            onClick={handleClear}
            disabled={
              (!toolState.inputText &&
                !toolState.outputValue &&
                !toolState.errorMsg) ||
              isProcessing
            }
          >
            Clear
          </Button>
        </div>
      </div>
      <OutputActionButtons
        canPerform={canPerformOutputActions}
        isSaveSuccess={saveSuccess}
        isCopySuccess={isCopied}
        onInitiateSave={() => initiateOutputActionWithPrompt('save')}
        onInitiateDownload={() => initiateOutputActionWithPrompt('download')}
        onCopy={handleCopyOutput}
        directiveName={directiveName}
        outputConfig={metadata.outputConfig}
        isProcessing={isProcessing}
      />
      {displayError && (
        <div
          role="alert"
          className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-start gap-2"
        >
          <XCircleIcon
            className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {displayError}
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
          textareaClassName={`bg-[rgb(var(--color-bg-subtle))] text-base ${isProcessing && !toolState.outputValue && !toolState.errorMsg ? 'animate-pulse' : ''}`}
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
