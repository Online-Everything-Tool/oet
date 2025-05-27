'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { useDebouncedCallback } from 'use-debounce';
import {
  ArrowUpTrayIcon,
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
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import importedMetadata from '../metadata.json';

const AUTO_PROCESS_DEBOUNCE_MS = 300;
interface TextWhitespaceRemoverToolState {
  inputText: string;
  outputValue: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_TEXT_WHITESPACE_REMOVER_STATE: TextWhitespaceRemoverToolState = {
  inputText: '',
  outputValue: '',
  lastLoadedFilename: null,
};

const metadata = importedMetadata as ToolMetadata;

interface TextWhitespaceRemoverClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function TextWhitespaceRemoverClient({
  urlStateParams,
  toolRoute,
}: TextWhitespaceRemoverClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    saveStateNow,
  } = useToolState<TextWhitespaceRemoverToolState>(
    toolRoute,
    DEFAULT_TEXT_WHITESPACE_REMOVER_STATE
  );

  const initialUrlLoadProcessedRef = useRef(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);

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
  const [uiError, setUiError] = useState('');

  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const directiveName = metadata.directive;

  const generateOutputFilenameForAction = useCallback((): string => {
    const base =
      toolState.lastLoadedFilename?.replace(/\.[^/.]+$/, '') ||
      'whitespace-removed';
    return `${base}.txt`;
  }, [toolState.lastLoadedFilename]);

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[TextWhitespaceRemover ITDE Accept] Processing signal from: ${signal.sourceDirective}`
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

      const newState: Partial<TextWhitespaceRemoverToolState> = {
        inputText: newText,
        outputValue: '',
        lastLoadedFilename: loadedFilename,
      };

      setToolState(newState);
      await saveStateNow({ ...toolState, ...newState });
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

  const performWhitespaceRemoval = useCallback(
    (text: string) => {
      let newOutput = '';
      let currentError = '';
      if (!text.trim()) {
        newOutput = '';
        currentError = '';
      } else {
        try {
          newOutput = text.replace(/\s+/g, ' ');
        } catch (e) {
          currentError =
            e instanceof Error ? e.message : 'Failed to remove whitespace.';
          newOutput = '';
        }
      }
      setToolState((prevState) => ({ ...prevState, outputValue: newOutput }));
      if (currentError) {
        if (uiError !== currentError) setUiError(currentError);
      } else {
        if (uiError) setUiError('');
      }
      if (text.trim() && !currentError) {
        if (toolState.inputText === text && toolState.lastLoadedFilename) {
          setCurrentOutputFilename(generateOutputFilenameForAction());
        } else {
          setCurrentOutputFilename(null);
        }
      } else {
        setCurrentOutputFilename(null);
      }
    },
    [
      setToolState,
      uiError,
      toolState.inputText,
      toolState.lastLoadedFilename,
      generateOutputFilenameForAction,
    ]
  );

  const debouncedPerformWhitespaceRemoval = useDebouncedCallback(
    performWhitespaceRemoval,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (
      isLoadingState ||
      initialUrlLoadProcessedRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0 ||
      !initialToolStateLoadCompleteRef.current
    ) {
      if (
        !isLoadingState &&
        !initialUrlLoadProcessedRef.current &&
        initialToolStateLoadCompleteRef.current
      ) {
        initialUrlLoadProcessedRef.current = true;
      }

      return;
    }

    initialUrlLoadProcessedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const updates: Partial<TextWhitespaceRemoverToolState> = {};
    let needsUpdate = false;

    const textFromUrl = params.get('text');
    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      updates.inputText = textFromUrl;
      updates.lastLoadedFilename = '(loaded from URL)';
      needsUpdate = true;
    }

    if (needsUpdate) {
      setToolState(updates);
    }
  }, [isLoadingState, urlStateParams, toolState.inputText, setToolState]);

  useEffect(() => {
    if (isLoadingState || !initialToolStateLoadCompleteRef.current) return;
    const text = toolState.inputText;

    if (!text.trim()) {
      if (toolState.outputValue !== '' || uiError !== '') {
        setToolState((prev) => ({ ...prev, outputValue: '' }));
        if (uiError) setUiError('');
      }
      if (currentOutputFilename !== null) setCurrentOutputFilename(null);
      debouncedPerformWhitespaceRemoval.cancel();
      return;
    }

    debouncedPerformWhitespaceRemoval(text);
  }, [
    toolState.inputText,
    isLoadingState,
    debouncedPerformWhitespaceRemoval,
    setToolState,
    toolState.outputValue,
    uiError,
    currentOutputFilename,
  ]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setToolState({
        inputText: event.target.value,
        lastLoadedFilename: null,
      });
      setCopySuccess(false);
      setSaveSuccess(false);
      setDownloadSuccess(false);
    },
    [setToolState]
  );

  const handleClear = useCallback(async () => {
    const newState: TextWhitespaceRemoverToolState = {
      ...DEFAULT_TEXT_WHITESPACE_REMOVER_STATE,
    };
    setToolState(newState);
    await saveStateNow(newState);
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    setUiError('');
    debouncedPerformWhitespaceRemoval.cancel();
  }, [
    setToolState,
    saveStateNow,
    debouncedPerformWhitespaceRemoval,
  ]);

  const handleCopyToClipboard = useCallback(() => {
    if (!toolState.outputValue || !navigator.clipboard) {
      setUiError('Nothing to copy or clipboard unavailable.');
      return;
    }
    if (uiError && !uiError.toLowerCase().includes('output')) setUiError('');
    navigator.clipboard.writeText(toolState.outputValue).then(
      () => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      },
      (_err) => {
        setUiError('Failed to copy to clipboard.');
      }
    );
  }, [toolState.outputValue, uiError]);

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
        setToolState({ inputText: text, lastLoadedFilename: file.filename });
        setUiError('');
      } catch (e) {
        setUiError(
          `Error reading file "${file.filename}": ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        setToolState({
          inputText: '',
          lastLoadedFilename: null,
          outputValue: '',
        });
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

      if (!action || !toolState.outputValue) {
        setUiError(uiError || 'No output to process.');
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
          setDownloadSuccess(true);
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          if (uiError && !uiError.toLowerCase().includes('output'))
            setUiError('');
          setTimeout(() => setDownloadSuccess(false), 2000);
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
          if (uiError && !uiError.toLowerCase().includes('output'))
            setUiError('');
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (_err) {
          setUiError('Failed to save to library.');
        }
      }
    },
    [
      filenameActionType,
      toolState,
      addFileToLibrary,
      generateOutputFilenameForAction,
      uiError,
    ]
  );

  const initiateOutputActionWithPrompt = (action: 'download' | 'save') => {
    if (!toolState.outputValue.trim()) {
      setUiError('No output to ' + action + '.');
      return;
    }
    if (uiError && !uiError.toLowerCase().includes('output')) {
      setUiError('Cannot ' + action + ' output due to existing errors.');
      return;
    }
    setUiError('');

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

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Text Whitespace Remover...
      </p>
    );
  }

  const canPerformOutputActions =
    toolState.outputValue.trim() !== '' && !uiError;

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="flex justify-between items-center gap-2">
        <label
          htmlFor="text-input"
          className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
        >
          Input Text:{' '}
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
            onClick={() => setIsLoadFileModalOpen(true)}
            iconLeft={<ArrowUpTrayIcon className="h-4 w-4" />}
          >
            Load from File
          </Button>
        </div>
      </div>
      <Textarea
        id="text-input"
        rows={10}
        value={toolState.inputText}
        onChange={handleInputChange}
        placeholder="Paste or type your text here..."
        aria-label="Text input area"
        textareaClassName="text-base font-inherit"
        spellCheck="false"
      />

      {uiError && (
        <div
          role="alert"
          className="p-3 my-1 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0"
            aria-hidden="true"
          />
          {uiError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex-grow"></div>
        <OutputActionButtons
          canPerform={canPerformOutputActions}
          isSaveSuccess={saveSuccess}
          isCopySuccess={copySuccess}
          isDownloadSuccess={downloadSuccess}
          onInitiateSave={() => initiateOutputActionWithPrompt('save')}
          onInitiateDownload={() => initiateOutputActionWithPrompt('download')}
          onCopy={handleCopyToClipboard}
          onClear={handleClear}
          directiveName={directiveName}
          outputConfig={metadata.outputConfig}
        />
      </div>

      <Textarea
        label="Output with Removed Whitespace:"
        id="text-output"
        rows={10}
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