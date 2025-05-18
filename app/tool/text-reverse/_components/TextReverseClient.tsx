// --- FILE: app/tool/text-reverse/_components/TextReverseClient.tsx ---
'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import Select from '../../_components/form/Select';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type {
  ParamConfig,
  ToolMetadata,
  OutputConfig,
} from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { useDebouncedCallback } from 'use-debounce';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useFileLibrary } from '@/app/context/FileLibraryContext';

import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import importedMetadata from '../metadata.json';

type ReverseMode = 'character' | 'word' | 'line';

interface TextReverseToolState {
  inputText: string;
  reverseMode: ReverseMode;
  outputValue: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_TEXT_REVERSE_STATE: TextReverseToolState = {
  inputText: '',
  reverseMode: 'character',
  outputValue: '',
  lastLoadedFilename: null,
};

const AUTO_PROCESS_DEBOUNCE_MS = 300;
const metadata = importedMetadata as ToolMetadata;

interface TextReverseClientProps {
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
    <div className="flex items-center space-x-3">
      {' '}
      {/* Simplified layout slightly */}
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
        Download Output
      </Button>
      <Button
        variant={isCopySuccess ? 'secondary' : 'accent2'}
        onClick={onCopy}
        disabled={isCopySuccess}
        iconLeft={
          isCopySuccess ? (
            <CheckIcon className="h-5 w-5" />
          ) : (
            <ClipboardDocumentIcon className="h-5 w-5" />
          )
        }
        className="transition-colors duration-150 ease-in-out"
      >
        {isCopySuccess ? 'Copied!' : 'Copy Output'}
      </Button>
    </div>
  );
});

const TextReverseClient = ({
  urlStateParams,
  toolRoute,
}: TextReverseClientProps) => {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<TextReverseToolState>(toolRoute, DEFAULT_TEXT_REVERSE_STATE);

  const [isOutputCopied, setIsOutputCopied] = useState<boolean>(false);
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
  const [uiError, setUiError] = useState('');
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialUrlLoadProcessedRef = useRef(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const directiveName = metadata.directive;

  const reverseOptions = useMemo(
    () => [
      { value: 'character' as ReverseMode, label: 'Character' },
      { value: 'word' as ReverseMode, label: 'Word' },
      { value: 'line' as ReverseMode, label: 'Line' },
    ],
    []
  );

  const generateOutputFilenameForAction = useCallback((): string => {
    const base =
      toolState.lastLoadedFilename?.replace(/\.[^/.]+$/, '') || 'reversed-text';
    return `${base}-${toolState.reverseMode}.txt`;
  }, [toolState.lastLoadedFilename, toolState.reverseMode]);

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[TextReverse ITDE Accept] Processing signal from: ${signal.sourceDirective}`
      );
      setUiError('');
      setCurrentOutputFilename(null);
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
          setUiError(`Error reading text from received data: ${errorMsgText}`);
          return;
        }
      } else if (firstItem) {
        setUiError(
          `Received data is not text (type: ${firstItem.type}). Cannot process.`
        );
        return;
      } else {
        setUiError('No valid item found in received ITDE data.');
        return;
      }

      const currentReverseMode = toolState.reverseMode;
      const newStateUpdate: Partial<TextReverseToolState> = {
        inputText: newText,
        outputValue: '',
        lastLoadedFilename: loadedFilename,
      };
      setToolState(newStateUpdate);
      await saveStateNow({
        ...toolState,
        ...newStateUpdate,
        reverseMode: currentReverseMode,
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

  const performTextReversal = useCallback(
    (
      text: string = toolState.inputText,
      mode: ReverseMode = toolState.reverseMode
    ) => {
      if (!text.trim()) {
        setToolState((prev) => ({ ...prev, outputValue: '' }));
        setCurrentOutputFilename(null);
        return;
      }
      let newOutput = '';
      try {
        if (mode === 'character') {
          newOutput = text.split('').reverse().join('');
        } else if (mode === 'word') {
          newOutput = text.split(/\s+/).reverse().join(' ');
        } else if (mode === 'line') {
          newOutput = text.split(/\r?\n/).reverse().join('\n');
        }

        const currentFilename = toolState.lastLoadedFilename;
        if (currentFilename && !currentOutputFilename) {
          setCurrentOutputFilename(generateOutputFilenameForAction());
        } else if (!currentFilename && currentOutputFilename !== null) {
          setCurrentOutputFilename(null);
        }
      } catch (_e) {
        setUiError('Failed to reverse text.');
        newOutput = '';
        setCurrentOutputFilename(null);
      }
      setToolState((prev) => ({ ...prev, outputValue: newOutput }));
      setIsOutputCopied(false);
      setSaveSuccess(false);
    },
    [
      toolState.inputText,
      toolState.reverseMode,
      toolState.lastLoadedFilename,
      currentOutputFilename,
      setToolState,
      generateOutputFilenameForAction,
      setUiError,
    ]
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
        !toolState.outputValue.trim() &&
        !uiError
      ) {
        performTextReversal(toolState.inputText, toolState.reverseMode);
      }
      return;
    }
    initialUrlLoadProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<TextReverseToolState> = {};
    let needsProcessing = false;

    const textFromUrl = params.get('text');
    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      updates.inputText = textFromUrl;
      updates.lastLoadedFilename = null;
      setCurrentOutputFilename(null);
      needsProcessing = true;
    }

    const reverseModeFromUrl = params.get('reverse') as ReverseMode | null;
    if (
      reverseModeFromUrl &&
      reverseOptions.some((opt) => opt.value === reverseModeFromUrl) &&
      reverseModeFromUrl !== toolState.reverseMode
    ) {
      updates.reverseMode = reverseModeFromUrl;
      setCurrentOutputFilename(null);
      needsProcessing = true;
    }

    if (Object.keys(updates).length > 0) {
      updates.outputValue = '';
      setToolState(updates);

      if (
        needsProcessing &&
        (updates.inputText || toolState.inputText).trim()
      ) {
        performTextReversal(
          updates.inputText || toolState.inputText,
          updates.reverseMode || toolState.reverseMode
        );
      }
    } else if (
      toolState.inputText.trim() &&
      !toolState.outputValue.trim() &&
      !uiError
    ) {
      performTextReversal(toolState.inputText, toolState.reverseMode);
    }
  }, [
    isLoadingState,
    urlStateParams,
    toolState.inputText,
    toolState.reverseMode,
    toolState.outputValue,
    uiError,
    setToolState,
    reverseOptions,
    performTextReversal,
  ]);

  const debouncedPerformTextReversal = useDebouncedCallback(
    performTextReversal,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (
      isLoadingState ||
      !initialUrlLoadProcessedRef.current ||
      !initialToolStateLoadCompleteRef.current
    )
      return;

    if (!toolState.inputText.trim()) {
      if (toolState.outputValue !== '') setToolState({ outputValue: '' });
      if (currentOutputFilename !== null) setCurrentOutputFilename(null);
      if (uiError !== '') setUiError('');
      debouncedPerformTextReversal.cancel();
      return;
    }
    debouncedPerformTextReversal(toolState.inputText, toolState.reverseMode);
  }, [
    toolState.inputText,
    toolState.reverseMode,
    isLoadingState,
    debouncedPerformTextReversal,
    setToolState,
    toolState.outputValue,
    currentOutputFilename,
    uiError,
  ]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setToolState({
        inputText: event.target.value,
        lastLoadedFilename: null,
        outputValue: '',
      });
      setCurrentOutputFilename(null);
      setIsOutputCopied(false);
      setSaveSuccess(false);
    },
    [setToolState]
  );

  const handleReverseChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setToolState({
        reverseMode: event.target.value as ReverseMode,
        outputValue: '',
      });
      setCurrentOutputFilename(null);
      setIsOutputCopied(false);
      setSaveSuccess(false);
    },
    [setToolState]
  );

  const handleClear = useCallback(async () => {
    await clearStateAndPersist();
    setCurrentOutputFilename(null);
    setIsOutputCopied(false);
    setSaveSuccess(false);
    setUiError('');
    debouncedPerformTextReversal.cancel();
    setUserDeferredAutoPopup(false);
  }, [clearStateAndPersist, debouncedPerformTextReversal]);

  const handleCopyOutput = useCallback(() => {
    if (!toolState.outputValue || !navigator.clipboard) {
      setUiError('Nothing to copy or clipboard unavailable.');
      return;
    }
    setUiError('');
    navigator.clipboard.writeText(toolState.outputValue).then(
      () => {
        setIsOutputCopied(true);
        setTimeout(() => setIsOutputCopied(false), 1500);
      },
      (_err) => {
        setUiError('Failed to copy to clipboard.');
      }
    );
  }, [toolState.outputValue, setUiError]);

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
          outputValue: '',
        });
        setCurrentOutputFilename(generateOutputFilenameForAction());
        setUiError('');
        setUserDeferredAutoPopup(false);
      } catch (e) {
        setUiError(
          `Error reading file "${file.name}": ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        setToolState({
          inputText: '',
          lastLoadedFilename: null,
          outputValue: '',
        });
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
      if (!action || !toolState.outputValue) return;
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
          setUiError('');
        } catch (_err) {
          setUiError('Failed to prepare download.');
        }
      } else if (action === 'save') {
        const blob = new Blob([toolState.outputValue], {
          type: 'text/plain;charset=utf-8',
        });
        try {
          await addFileToLibrary(blob, finalFilename, 'text/plain', false);
          setSaveSuccess(true);
          setUiError('');
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (_err) {
          setUiError('Failed to save to library.');
        }
      }
    },
    [
      filenameActionType,
      toolState.outputValue,
      generateOutputFilenameForAction,
      addFileToLibrary,
      setUiError,
    ]
  );

  const initiateOutputActionWithPrompt = (action: 'download' | 'save') => {
    if (!toolState.outputValue.trim()) {
      setUiError('No output to ' + action + '.');
      return;
    }
    if (uiError && toolState.outputValue.trim()) {
      setUiError('Cannot ' + action + ' output due to existing errors.');
      return;
    }
    setUiError('');
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
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Text Reverse Tool...
      </p>
    );
  }
  const canPerformOutputActions =
    toolState.outputValue.trim() !== '' && !uiError;

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="flex justify-between items-center gap-2">
        <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
          Input Text:
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Textarea
          label="Input Text:"
          id="text-input"
          rows={8}
          value={toolState.inputText}
          onChange={handleInputChange}
          placeholder="Enter text to reverse here..."
          textareaClassName="text-base font-mono"
          spellCheck="false"
          aria-label="Enter text to reverse"
        />
        <div>
          <label
            htmlFor="reversed-text-output"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
          >
            Reversed Text ({toolState.reverseMode}):
          </label>
          <Textarea
            id="reversed-text-output"
            rows={8}
            value={toolState.outputValue}
            readOnly
            placeholder="Reversed text will appear here..."
            textareaClassName="text-base font-mono bg-[rgb(var(--color-bg-subtle))]"
            aria-live="polite"
            spellCheck="false"
          />
        </div>
      </div>
      {uiError && (
        <div
          role="alert"
          className="p-3 my-1 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0"
            aria-hidden="true"
          />{' '}
          {uiError}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4 border border-[rgb(var(--color-border-base))] rounded-md p-4 bg-[rgb(var(--color-bg-component))]">
        <Select
          label="Reverse by:"
          id="reverse-select"
          name="reverseMode"
          options={reverseOptions}
          value={toolState.reverseMode}
          onChange={handleReverseChange}
          containerClassName="w-full sm:w-auto sm:min-w-[150px]"
          selectClassName="py-2"
        />
        <div className="flex items-center space-x-3 ml-auto">
          {' '}
          {/* This div will push to the right */}
          <OutputActionButtons
            canPerform={canPerformOutputActions}
            isSaveSuccess={saveSuccess}
            isCopySuccess={isOutputCopied}
            onInitiateSave={() => initiateOutputActionWithPrompt('save')}
            onInitiateDownload={() =>
              initiateOutputActionWithPrompt('download')
            }
            onCopy={handleCopyOutput}
            directiveName={directiveName}
            outputConfig={metadata.outputConfig}
          />
          <Button
            variant="neutral"
            onClick={handleClear}
            disabled={
              !toolState.inputText &&
              toolState.reverseMode ===
                DEFAULT_TEXT_REVERSE_STATE.reverseMode &&
              !toolState.outputValue &&
              !uiError
            }
          >
            Clear
          </Button>
        </div>
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
};

export default TextReverseClient;
