// FILE: app/tool/case-converter/_components/CaseConverterClient.tsx
'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import RadioGroup from '../../_components/form/RadioGroup';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type {
  ParamConfig,
  ToolMetadata,
  OutputConfig,
} from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { CASE_TYPES, CaseType } from '@/src/constants/text';
import { useDebouncedCallback } from 'use-debounce';
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
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import importedMetadata from '../metadata.json';

const SENTENCE_CASE_REGEX = /(^\s*\w|[.!?]\s*\w)/g;
const TITLE_WORD_DELIMITERS = /([\s\-_]+)/;
const AUTO_PROCESS_DEBOUNCE_MS = 300;

interface CaseConverterToolState {
  inputText: string;
  caseType: CaseType;
  outputValue: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_CASE_CONVERTER_STATE: CaseConverterToolState = {
  inputText: '',
  caseType: 'lowercase',
  outputValue: '',
  lastLoadedFilename: null,
};

const metadata = importedMetadata as ToolMetadata;

interface CaseConverterClientProps {
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
        Download Output
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

export default function CaseConverterClient({
  urlStateParams,
  toolRoute,
}: CaseConverterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<CaseConverterToolState>(
    toolRoute,
    DEFAULT_CASE_CONVERTER_STATE
  );

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

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const directiveName = metadata.directive;

  const generateOutputFilename = useCallback(
    (baseName?: string | null): string => {
      const base = baseName?.replace(/\.[^/.]+$/, '') || 'converted-text';
      const caseLabel = toolState.caseType.replace(/_/g, '-');
      return `${base}.${caseLabel}.txt`;
    },
    [toolState.caseType]
  );

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[CaseConverter ITDE Accept] Processing signal from: ${signal.sourceDirective}`
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
          const errorMsg = e instanceof Error ? e.message : String(e);
          setUiError(`Error reading text from received data: ${errorMsg}`);
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

      const newState: CaseConverterToolState = {
        ...toolState,
        inputText: newText,
        outputValue: '',
        lastLoadedFilename: loadedFilename,
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

  const performConversion = useCallback(
    (textToProcess = toolState.inputText, targetCase = toolState.caseType) => {
      let result = '';
      let currentError = '';
      if (uiError) setUiError('');

      const inputForProcessing =
        targetCase === 'title' ? textToProcess : textToProcess.trim();

      if (!inputForProcessing && !textToProcess.trim()) {
        setToolState({ outputValue: '' });
        setCurrentOutputFilename(null);
        if (uiError) setUiError('');
        return;
      }
      try {
        switch (targetCase) {
          case 'uppercase':
            result = inputForProcessing.toUpperCase();
            break;
          case 'lowercase':
            result = inputForProcessing.toLowerCase();
            break;
          case 'sentence':
            result = inputForProcessing
              .toLowerCase()
              .replace(SENTENCE_CASE_REGEX, (char) => char.toUpperCase());
            break;
          case 'title':
            result = inputForProcessing
              .split(/(\r?\n)/)
              .map((segment) => {
                if (/^\r?\n$/.test(segment)) return segment;
                return segment
                  .split(TITLE_WORD_DELIMITERS)
                  .map((part) => {
                    if (
                      TITLE_WORD_DELIMITERS.test(part) &&
                      part.match(TITLE_WORD_DELIMITERS)?.[0] === part
                    )
                      return part;
                    if (part && part.length > 0)
                      return (
                        part.charAt(0).toUpperCase() +
                        part.slice(1).toLowerCase()
                      );
                    return part;
                  })
                  .join('');
              })
              .join('');
            break;
          case 'camel':
            result = inputForProcessing
              .toLowerCase()
              .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
              .replace(/^./, (char) => char.toLowerCase());
            break;
          case 'pascal':
            result = inputForProcessing
              .toLowerCase()
              .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
              .replace(/^./, (char) => char.toUpperCase());
            break;
          case 'snake':
            result = inputForProcessing
              .replace(/\W+/g, ' ')
              .trim()
              .split(/ |\B(?=[A-Z])/)
              .map((word) => word.toLowerCase())
              .filter(Boolean)
              .join('_');
            break;
          case 'kebab':
            result = inputForProcessing
              .replace(/\W+/g, ' ')
              .trim()
              .split(/ |\B(?=[A-Z])/)
              .map((word) => word.toLowerCase())
              .filter(Boolean)
              .join('-');
            break;
          default:
            const exhaustiveCheck: never = targetCase;
            throw new Error(`Unsupported case type: ${exhaustiveCheck}`);
        }
        setToolState({ outputValue: result });
        if (uiError) setUiError('');
        if (toolState.lastLoadedFilename && !currentOutputFilename) {
          setCurrentOutputFilename(
            generateOutputFilename(toolState.lastLoadedFilename)
          );
        } else if (!toolState.lastLoadedFilename && currentOutputFilename) {
          setCurrentOutputFilename(null);
        }
      } catch (err) {
        currentError =
          err instanceof Error ? err.message : 'Failed to convert case.';
        setUiError(currentError);
        setToolState({ outputValue: '' });
        setCurrentOutputFilename(null);
      }
    },
    [
      toolState.inputText,
      toolState.caseType,
      setToolState,
      uiError,
      toolState.lastLoadedFilename,
      currentOutputFilename,
      generateOutputFilename,
    ]
  );

  const debouncedPerformConversion = useDebouncedCallback(
    performConversion,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (
      isLoadingToolState ||
      !initialToolStateLoadCompleteRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      if (
        !isLoadingToolState &&
        initialToolStateLoadCompleteRef.current &&
        (toolState.caseType === 'title'
          ? toolState.inputText
          : toolState.inputText.trim()) &&
        !toolState.outputValue.trim() &&
        !uiError
      ) {
        debouncedPerformConversion(toolState.inputText, toolState.caseType);
      }
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const textFromUrl = params.get('text');
    const caseFromUrl = params.get('case') as CaseType | null;

    let newText = toolState.inputText;
    let newCase = toolState.caseType;
    let newFilename = toolState.lastLoadedFilename;
    let newOutputFilename = currentOutputFilename;
    let needsStateUpdate = false;

    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      newText = textFromUrl;
      newFilename = null;
      newOutputFilename = null;
      needsStateUpdate = true;
    }
    if (
      caseFromUrl &&
      CASE_TYPES.some((ct) => ct.value === caseFromUrl) &&
      caseFromUrl !== toolState.caseType
    ) {
      newCase = caseFromUrl;
      newOutputFilename = null;
      needsStateUpdate = true;
    }

    if (needsStateUpdate) {
      setToolState({
        inputText: newText,
        caseType: newCase,
        lastLoadedFilename: newFilename,
        outputValue: '',
      });
    }
    if (newOutputFilename !== currentOutputFilename)
      setCurrentOutputFilename(newOutputFilename);

    if (
      !needsStateUpdate &&
      newText.trim() &&
      !toolState.outputValue.trim() &&
      !uiError
    ) {
      performConversion(newText, newCase);
    }
  }, [
    isLoadingToolState,
    urlStateParams,
    setToolState,
    performConversion,
    toolState.inputText,
    toolState.caseType,
    toolState.lastLoadedFilename,
    toolState.outputValue,
    uiError,
    debouncedPerformConversion,
    currentOutputFilename,
  ]);

  useEffect(() => {
    if (isLoadingToolState || !initialToolStateLoadCompleteRef.current) return;
    const text = toolState.inputText;
    const currentCase = toolState.caseType;
    const effectiveText = currentCase === 'title' ? text : text.trim();

    if (!effectiveText && !text.trim()) {

      if (toolState.outputValue !== '') setToolState({ outputValue: '' });
      if (currentOutputFilename !== null) setCurrentOutputFilename(null);
      if (uiError !== '') setUiError('');
      debouncedPerformConversion.cancel();
      return;
    }
    debouncedPerformConversion(text, currentCase);
  }, [
    toolState.inputText,
    toolState.caseType,
    isLoadingToolState,
    debouncedPerformConversion,
    setToolState,
    toolState.outputValue,
    uiError,
    currentOutputFilename,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({
      inputText: event.target.value,
      lastLoadedFilename: null,
      outputValue: '',
    });
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
  };

  const handleCaseTypeChange = (newCaseType: CaseType) => {
    setToolState({ caseType: newCaseType, outputValue: '' });
    setCurrentOutputFilename(null);
  };

  const handleClear = useCallback(async () => {
    await clearStateAndPersist();
    setUiError('');
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    debouncedPerformConversion.cancel();
    setUserDeferredAutoPopup(false);
  }, [clearStateAndPersist, debouncedPerformConversion]);

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
          caseType: toolState.caseType,
          inputText: text,
          lastLoadedFilename: file.name,
          outputValue: '',
        });
        setCurrentOutputFilename(generateOutputFilename(file.name));
        setUiError('');
        setUserDeferredAutoPopup(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setUiError(`Error reading file "${file.name}": ${msg}`);
        setToolState({
          caseType: toolState.caseType,
          inputText: '',
          lastLoadedFilename: null,
          outputValue: '',
        });
        setCurrentOutputFilename(null);
      }
    },
    [toolState.caseType, setToolState, generateOutputFilename]
  );

  const handleFilenameConfirm = useCallback(
    (filename: string, actionOverride?: 'download' | 'save') => {
      setIsFilenameModalOpen(false);
      const currentAction = actionOverride || filenameAction;
      setFilenameAction(null);
      if (!currentAction) return;

      let finalFilename = filename.trim();
      if (!finalFilename)
        finalFilename = generateOutputFilename(toolState.lastLoadedFilename);
      if (!/\.txt$/i.test(finalFilename)) finalFilename += '.txt';
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
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          if (uiError) setUiError('');
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
      toolState.lastLoadedFilename,
      toolState.outputValue,
      addFileToLibrary,
      generateOutputFilename,
      uiError,
    ]
  );

  const initiateOutputAction = useCallback(
    (action: 'download' | 'save') => {
      if (!toolState.outputValue.trim() || uiError) {
        setUiError(uiError || 'No output to ' + action + '.');
        return;
      }
      setUiError('');
      if (currentOutputFilename) {
        handleFilenameConfirm(currentOutputFilename, action);
      } else {
        setSuggestedFilenameForPrompt(
          generateOutputFilename(toolState.lastLoadedFilename)
        );
        setFilenameAction(action);
        setIsFilenameModalOpen(true);
      }
    },
    [
      currentOutputFilename,
      handleFilenameConfirm,
      toolState.outputValue,
      uiError,
      toolState.lastLoadedFilename,
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
      if (uiError) setUiError('');
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
        Loading Case Converter...
      </p>
    );
  }
  const canPerformOutputActions =
    toolState.outputValue.trim() !== '' && !uiError;
  const currentCaseLabel =
    CASE_TYPES.find((ct) => ct.value === toolState.caseType)?.label ||
    toolState.caseType;

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
      <Textarea
        id="text-input"
        rows={8}
        value={toolState.inputText}
        onChange={handleInputChange}
        placeholder="Paste or type your text here..."
        textareaClassName="text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
        spellCheck="false"
      />
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap justify-between items-center">
          <RadioGroup
            name="caseType"
            legend="Convert to:"
            options={CASE_TYPES.map((ct) => ({
              value: ct.value,
              label: ct.label,
            }))}
            selectedValue={toolState.caseType}
            onChange={handleCaseTypeChange}
            layout="horizontal"
            className="flex-grow"
            radioClassName="text-sm mb-2 mr-2"
            labelClassName="font-medium"
          />
          <Button
            variant="neutral"
            onClick={handleClear}
            disabled={
              !toolState.inputText && !toolState.outputValue && !uiError
            }
            title="Clear input and output"
            className="ml-auto sm:ml-4 mt-2 sm:mt-0"
          >
            Clear
          </Button>
        </div>
      </div>
      <OutputActionButtons
        canPerform={canPerformOutputActions}
        isSaveSuccess={saveSuccess}
        isCopySuccess={copySuccess}
        onInitiateSave={() => initiateOutputAction('save')}
        onInitiateDownload={() => initiateOutputAction('download')}
        onCopy={handleCopyToClipboard}
        directiveName={directiveName}
        outputConfig={metadata.outputConfig}
      />
      {uiError && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          {' '}
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />{' '}
          <div>
            {' '}
            <strong className="font-semibold">Error:</strong> {uiError}{' '}
          </div>{' '}
        </div>
      )}
      <Textarea
        label={`Output (${currentCaseLabel}):`}
        id="text-output"
        rows={8}
        value={toolState.outputValue}
        readOnly
        placeholder="Result appears here..."
        textareaClassName="text-base bg-[rgb(var(--color-bg-subtle))] placeholder:text-[rgb(var(--color-input-placeholder))]"
        aria-live="polite"
        spellCheck="false"
      />
      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        slurpContentOnly={true}
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
          setFilenameAction(null);
        }}
        onConfirm={handleFilenameConfirm}
        initialFilename={suggestedFilenameForPrompt}
        title={
          filenameAction === 'download'
            ? 'Enter Download Filename'
            : 'Enter Filename for Library'
        }
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
