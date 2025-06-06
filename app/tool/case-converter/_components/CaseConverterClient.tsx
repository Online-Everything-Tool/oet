// FILE: app/tool/case-converter/_components/CaseConverterClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '@/app/tool/_hooks/useToolState';
import Textarea from '@/app/tool/_components/form/Textarea';
import Button from '@/app/tool/_components/form/Button';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { CASE_TYPES, CaseType } from '@/src/constants/text';
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
import Select from '@/app/tool/_components/form/Select';

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

export default function CaseConverterClient({
  urlStateParams,
  toolRoute,
}: CaseConverterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
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
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const initialUrlLoadProcessedRef = useRef(false);

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
            loadedFilename = (firstItem as StoredFile).filename;
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

      const newState: Partial<CaseConverterToolState> = {
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

  const performConversion = useCallback(
    (textToProcess: string, targetCase: CaseType) => {
      let result = '';
      let currentError = '';
      if (uiError) setUiError('');

      const inputForProcessing =
        targetCase === 'title' ? textToProcess : textToProcess.trim();

      if (!inputForProcessing && !textToProcess.trim()) {
        setToolState((prev) => ({ ...prev, outputValue: '' }));
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

        setToolState((prev) => ({
          ...prev,
          outputValue: result,
          caseType: targetCase,
        }));
        if (uiError) setUiError('');

        const currentFilenameForOutput =
          toolState.inputText === textToProcess
            ? toolState.lastLoadedFilename
            : null;
        if (currentFilenameForOutput) {
          setCurrentOutputFilename(
            generateOutputFilename(currentFilenameForOutput)
          );
        } else {
          setCurrentOutputFilename(null);
        }
      } catch (err) {
        currentError =
          err instanceof Error ? err.message : 'Failed to convert case.';
        setUiError(currentError);
        setToolState((prev) => ({
          ...prev,
          outputValue: '',
          caseType: targetCase,
        }));
        setCurrentOutputFilename(null);
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

  const debouncedPerform = useDebouncedCallback(
    performConversion,
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
    const caseFromUrl = params.get('case') as CaseType | null;

    let textToSet = toolState.inputText;
    let caseToSet = toolState.caseType;
    let filenameToSet = toolState.lastLoadedFilename;
    let needsUpdate = false;

    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      textToSet = textFromUrl;
      filenameToSet = null;
      needsUpdate = true;
    }
    if (
      caseFromUrl &&
      CASE_TYPES.some((ct) => ct.value === caseFromUrl) &&
      caseFromUrl !== toolState.caseType
    ) {
      caseToSet = caseFromUrl;
      needsUpdate = true;
    }

    if (needsUpdate) {
      setToolState({
        inputText: textToSet,
        caseType: caseToSet,
        lastLoadedFilename: filenameToSet,
        outputValue: '',
      });
    }
  }, [isLoadingToolState, urlStateParams, toolState, setToolState]);

  useEffect(() => {
    if (isLoadingToolState || !initialToolStateLoadCompleteRef.current) return;

    const text = toolState.inputText;
    const currentCase = toolState.caseType;
    const effectiveText = currentCase === 'title' ? text : text.trim();

    if (!effectiveText && !text.trim()) {
      if (toolState.outputValue !== '' || uiError !== '') {
        setToolState((prev) => ({ ...prev, outputValue: '' }));
      }
      if (currentOutputFilename !== null) setCurrentOutputFilename(null);
      if (uiError && text.trim() === '') setUiError('');
      debouncedPerform.cancel();
      return;
    }
    debouncedPerform(text, currentCase);
  }, [
    toolState.inputText,
    toolState.caseType,
    isLoadingToolState,
    debouncedPerform,
    setToolState,
    toolState.outputValue,
    uiError,
    currentOutputFilename,
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

  const handleCaseTypeChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setToolState({
      caseType: event.target.value as CaseType,
    });
  };

  const handleClear = useCallback(async () => {
    const newState: CaseConverterToolState = {
      ...DEFAULT_CASE_CONVERTER_STATE,
      caseType: toolState.caseType,
    };
    setToolState(newState);
    await saveStateNow(newState);

    setUiError('');
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    debouncedPerform.cancel();
  }, [setToolState, saveStateNow, toolState.caseType, debouncedPerform]);

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLoadFileModalOpen(false);
      if (files.length === 0) return;
      const file = files[0];
      if (!file.blob) {
        setUiError(`Error: File "${file.filename}" has no content.`);
        return;
      }
      try {
        const text = await file.blob.text();
        setToolState({
          inputText: text,
          lastLoadedFilename: file.filename,
        });
        setUiError('');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setUiError(`Error reading file "${file.filename}": ${msg}`);
        setToolState({
          inputText: '',
          lastLoadedFilename: null,
          outputValue: '',
          caseType: 'lowercase',
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
      if (!toolState.outputValue.trim() || uiError) {
        setUiError(uiError || 'No output to ' + action + '.');
        return;
      }
      setUiError('');

      const lastLoadedForFilename = toolState.lastLoadedFilename;

      if (currentOutputFilename) {
        handleFilenameConfirm(currentOutputFilename, action);
      } else {
        setSuggestedFilenameForPrompt(
          generateOutputFilename(lastLoadedForFilename)
        );
        setFilenameAction(action);
        setIsFilenameModalOpen(true);
      }
    },
    [
      currentOutputFilename,
      handleFilenameConfirm,
      toolState.outputValue,
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
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
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
      <div>
        <div className="flex justify-between items-center gap-2">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Input Text:
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
            >
              Load from File
            </Button>
          </div>
        </div>
        <Textarea
          id="text-input"
          label="Input text to be case converted"
          labelClassName="sr-only"
          rows={8}
          value={toolState.inputText}
          onChange={handleInputChange}
          placeholder="Paste or type your text here..."
          textareaClassName="text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
          spellCheck="false"
        />
      </div>
      <div className="flex flex-col border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap gap-4 items-center p-3">
          <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
            <label
              htmlFor="case-type-select"
              className="text-sm font-medium text-[rgb(var(--color-text-muted))] whitespace-nowrap"
            >
              Case Type:
            </label>
            <Select
              id="case-type-select"
              name="caseType"
              options={CASE_TYPES.map((ct) => ({
                value: ct.value,
                label: ct.label,
              }))}
              value={toolState.caseType}
              onChange={handleCaseTypeChange}
              selectClassName="text-sm py-1.5 pl-2 pr-8 min-w-[120px]"
            />
          </div>
          <div className="flex-grow"></div>
          <div className="flex flex-wrap gap-3 justify-end mt-2">
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
