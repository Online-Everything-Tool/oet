'use client';

import React, { useState, useCallback, useMemo } from 'react';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import RadioGroup from '../../_components/form/RadioGroup';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import importedMetadata from '../metadata.json';
import { XCircleIcon } from '@heroicons/react/24/solid';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import type { StoredFile } from '@/src/types/storage';


interface TextWhitespaceRemoverToolState {
  inputText: string;
  whitespaceAction: 'replace' | 'reduce';
  replaceWith: 'nothing' | 'carriageReturn';
  reduceSpacesTo: number;
  outputValue: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_TEXT_WHITESPACE_REMOVER_STATE: TextWhitespaceRemoverToolState = {
  inputText: '',
  whitespaceAction: 'replace',
  replaceWith: 'nothing',
  reduceSpacesTo: 1,
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

  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameActionType, setFilenameActionType] = useState<'download' | 'save' | null>(null);
  const [currentOutputFilename, setCurrentOutputFilename] = useState<string | null>(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [uiError, setUiError] = useState('');
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialUrlLoadProcessedRef = useRef(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const directiveName = metadata.directive;

  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    console.log(`[TextWhitespaceRemover ITDE Accept] Processing signal from: ${signal.sourceDirective}`);
    setUiError('');
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setUiError(`Metadata not found for source tool: ${signal.sourceToolTitle}`);
      return;
    }

    const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);

    if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
      setUiError(resolvedPayload.errorMessage || 'No transferable data received from source.');
      return;
    }

    let newText = '';
    const firstItem = resolvedPayload.data.find((item) => item.type?.startsWith('text/'));
    let loadedFilename: string | null = null;

    if (firstItem) {
      try {
        newText = await firstItem.blob.text();
        if ('id' in firstItem && 'name' in firstItem) {
          loadedFilename = (firstItem as StoredFile).filename;
        }
      } catch (e) {
        const errorMsgText = e instanceof Error ? e.message : String(e);
        setUiError(`Error reading text from received data: ${errorMsgText}`);
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
  }, [getToolMetadata, toolState, setToolState, saveStateNow]);

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
    const canProceed = !isLoadingState && initialToolStateLoadCompleteRef.current;
    if (canProceed && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup, directiveName]);

  useEffect(() => {
    if (isLoadingState || initialUrlLoadProcessedRef.current || !initialToolStateLoadCompleteRef.current || !urlStateParams || urlStateParams.length === 0) {
      return;
    }
    initialUrlLoadProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const textFromUrl = params.get('text');
    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      setToolState({ inputText: textFromUrl, lastLoadedFilename: null, outputValue: '' });
    }
  }, [isLoadingState, urlStateParams, toolState, setToolState]);

  const handleWhitespaceActionChange = useCallback((value: 'replace' | 'reduce') => {
    setToolState({ whitespaceAction: value, outputValue: '' });
  }, []);

  const handleReplaceWithChange = useCallback((value: 'nothing' | 'carriageReturn') => {
    setToolState({ replaceWith: value, outputValue: '' });
  }, []);

  const handleReduceSpacesToChange = useCallback((value: number) => {
    setToolState({ reduceSpacesTo: value, outputValue: '' });
  }, []);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({ inputText: event.target.value, lastLoadedFilename: null, outputValue: '' });
  }, []);

  const removeExtraWhitespace = useCallback(() => {
    if (!toolState.inputText) return;
    let output = toolState.inputText;
    if (toolState.whitespaceAction === 'replace') {
      if (toolState.replaceWith === 'nothing') {
        output = output.replace(/\s+/g, '');
      } else {
        output = output.replace(/\s+/g, '\r\n');
      }
    } else {
      output = output.replace(/\s{2,}/g, ' '.repeat(toolState.reduceSpacesTo));
    }
    setToolState({ outputValue: output });
  }, [toolState]);

  useEffect(() => {
    removeExtraWhitespace();
  }, [toolState.inputText, toolState.whitespaceAction, toolState.replaceWith, toolState.reduceSpacesTo, removeExtraWhitespace]);

  const handleClear = useCallback(async () => {
    const newState = { ...DEFAULT_TEXT_WHITESPACE_REMOVER_STATE };
    setToolState(newState);
    await saveStateNow(newState);
    setUiError('');
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
  }, [setToolState, saveStateNow]);

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

  const handleFileSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsLoadFileModalOpen(false);
    if (files.length === 0) return;
    const file = files[0];
    if (!file.blob) {
      setUiError(`Error: File "${file.filename}" has no content.`);
      return;
    }
    try {
      const text = await file.blob.text();
      setToolState({ inputText: text, lastLoadedFilename: file.filename, outputValue: '' });
      setUiError('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setUiError(`Error reading file "${file.filename}": ${msg}`);
      setToolState({ inputText: '', lastLoadedFilename: null, outputValue: '' });
    }
  }, [setToolState]);

  const handleFilenameConfirm = useCallback(async (filename: string) => {
    setIsFilenameModalOpen(false);
    const action = filenameActionType;
    setFilenameActionType(null);
    if (!action || !toolState.outputValue) {
      setUiError(uiError || 'No output to process.');
      return;
    }
    let finalFilename = filename.trim();
    if (!finalFilename) finalFilename = `whitespace-removed-${Date.now()}.txt`;
    if (!/\.txt$/i.test(finalFilename)) finalFilename += '.txt';
    setCurrentOutputFilename(finalFilename);

    if (action === 'download') {
      try {
        const blob = new Blob([toolState.outputValue], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        setDownloadSuccess(true);
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        if (uiError && !uiError.toLowerCase().includes('output')) setUiError('');
        setTimeout(() => setDownloadSuccess(false), 2000);
      } catch (_err) {
        setUiError('Failed to prepare download.');
      }
    } else if (action === 'save') {
      const blob = new Blob([toolState.outputValue], { type: 'text/plain;charset=utf-8' });
      try {
        await addFileToLibrary(blob, finalFilename, 'text/plain', false);
        setSaveSuccess(true);
        if (uiError && !uiError.toLowerCase().includes('output')) setUiError('');
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (_err) {
        setUiError('Failed to save to library.');
      }
    }
  }, [filenameActionType, toolState, addFileToLibrary, uiError]);

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
      setSuggestedFilenameForPrompt(`whitespace-removed-${Date.now()}.txt`);
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
    if (itdeTarget.pendingSignals.filter((s) => s.sourceDirective !== sourceDirective).length === 0) setUserDeferredAutoPopup(false);
  };

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-gray-500 animate-pulse">Loading Text Whitespace Remover Tool...</p>;
  }

  const canPerformOutputActions = toolState.outputValue.trim() !== '' && !uiError;

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div>
        <div className="flex justify-between items-center gap-2">
          <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Input Text:{' '}
            {toolState.lastLoadedFilename && (
              <span className="ml-2 text-xs italic">({toolState.lastLoadedFilename})</span>
            )}
          </label>
          <div className="flex items-center gap-2">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            <Button variant="neutral-outline" onClick={() => setIsLoadFileModalOpen(true)} iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}>
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
      </div>

      {uiError && (
        <div role="alert" className="p-3 my-1 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {uiError}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <RadioGroup<"replace" | "reduce">
          options={[
            { value: 'replace', label: 'Replace all whitespace' },
            { value: 'reduce', label: 'Reduce multiple spaces' },
          ]}
          selectedValue={toolState.whitespaceAction}
          onChange={handleWhitespaceActionChange}
        />
        {toolState.whitespaceAction === 'replace' && (
          <RadioGroup<"nothing" | "carriageReturn">
            options={[
              { value: 'nothing', label: 'Replace with nothing' },
              { value: 'carriageReturn', label: 'Replace with carriage return' },
            ]}
            selectedValue={toolState.replaceWith}
            onChange={handleReplaceWithChange}
          />
        )}
        {toolState.whitespaceAction === 'reduce' && (
          <div className="flex items-center gap-2">
            <label htmlFor="reduceSpacesTo" className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
              Reduce multiple spaces to:
            </label>
            <input
              type="number"
              id="reduceSpacesTo"
              min="1"
              max="10"
              value={toolState.reduceSpacesTo}
              onChange={(e) => handleReduceSpacesToChange(parseInt(e.target.value, 10))}
              className="w-16 border border-[rgb(var(--color-input-border))] px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-input-focus-border))]"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-component))]">
        <div className="p-4">
          <Textarea
            id="text-output"
            label="Processed Text"
            labelClassName="sr-only"
            rows={8}
            value={toolState.outputValue}
            readOnly
            placeholder="Processed text will appear here..."
            textareaClassName="text-base bg-[rgb(var(--color-bg-subtle))] placeholder:text-[rgb(var(--color-input-placeholder))]"
            aria-live="polite"
            spellCheck="false"
          />
        </div>
        <div className="p-4 border-t border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] flex justify-end items-center gap-3">
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
        title={filenameActionType === 'download' ? 'Enter Download Filename' : 'Enter Filename for Library'}
        filenameAction={filenameActionType || 'download'}
        promptMessage={filenameActionType === 'download' ? 'Filename for download:' : 'Filename for library:'}
        confirmButtonText={filenameActionType === 'download' ? 'Download' : 'Save to Library'}
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