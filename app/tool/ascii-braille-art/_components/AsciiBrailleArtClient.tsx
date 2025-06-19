'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import useToolState from '@/app/tool/_hooks/useToolState';
import { useAsciiBrailleArt, ArtType } from '../_hooks/useAsciiBrailleArt';
import Textarea from '@/app/tool/_components/form/Textarea';
import Button from '@/app/tool/_components/form/Button';
import RadioGroup from '@/app/tool/_components/form/RadioGroup';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { ArrowUpTrayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '@/app/tool/_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import importedMetadata from '../metadata.json';

interface AsciiBrailleArtToolState {
  inputText: string;
  artType: ArtType;
  outputText: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_STATE: AsciiBrailleArtToolState = {
  inputText: '',
  artType: 'ascii',
  outputText: '',
  lastLoadedFilename: null,
};

const AUTO_PROCESS_DEBOUNCE_MS = 300;
const metadata = importedMetadata as ToolMetadata;

interface AsciiBrailleArtClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function AsciiBrailleArtClient({ urlStateParams, toolRoute }: AsciiBrailleArtClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    saveStateNow,
  } = useToolState<AsciiBrailleArtToolState>(toolRoute, DEFAULT_STATE);

  const { convertText } = useAsciiBrailleArt();
  const [uiError, setUiError] = useState('');
  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameActionType, setFilenameActionType] = useState<'download' | 'save' | null>(null);
  const [suggestedFilename, setSuggestedFilename] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const directiveName = metadata.directive;

  const artTypeOptions = [
    { value: 'ascii' as const, label: 'ASCII Art' },
    { value: 'braille' as const, label: 'Braille' },
  ];

  const performConversion = useCallback((text: string, type: ArtType) => {
    if (!text.trim()) {
      setToolState({ outputText: '' });
      if (uiError) setUiError('');
      return;
    }
    try {
      const result = convertText(text, type);
      setToolState({ outputText: result });
      if (uiError) setUiError('');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to convert text.';
      setUiError(errorMsg);
      setToolState({ outputText: '' });
    }
  }, [convertText, setToolState, uiError]);

  const debouncedPerformConversion = useDebouncedCallback(performConversion, AUTO_PROCESS_DEBOUNCE_MS);

  useEffect(() => {
    if (isLoadingState || !initialToolStateLoadCompleteRef.current) return;
    debouncedPerformConversion(toolState.inputText, toolState.artType);
  }, [toolState.inputText, toolState.artType, isLoadingState, debouncedPerformConversion]);

  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    setUiError('');
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setUiError(`Metadata not found for source tool: ${signal.sourceToolTitle}`);
      return;
    }
    const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
    if (resolvedPayload.type === 'error' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
      setUiError(resolvedPayload.errorMessage || 'No transferable data received from source.');
      return;
    }
    const firstItem = resolvedPayload.data.find(item => item.type?.startsWith('text/'));
    if (!firstItem) {
      setUiError('No valid text item found in received ITDE data.');
      return;
    }
    try {
      const newText = await firstItem.blob.text();
      const loadedFilename = 'id' in firstItem && 'filename' in firstItem ? (firstItem as StoredFile).filename : null;
      const newState: Partial<AsciiBrailleArtToolState> = { inputText: newText, outputText: '', lastLoadedFilename: loadedFilename };
      setToolState(newState);
      await saveStateNow({ ...toolState, ...newState });
      setUserDeferredAutoPopup(false);
    } catch (e) {
      setUiError(`Error reading text from received data: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [getToolMetadata, setToolState, saveStateNow, toolState]);

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingState) initialToolStateLoadCompleteRef.current = true;
    else initialToolStateLoadCompleteRef.current = false;
  }, [isLoadingState]);

  useEffect(() => {
    if (initialToolStateLoadCompleteRef.current && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({ inputText: event.target.value, lastLoadedFilename: null });
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
  };

  const handleArtTypeChange = (value: ArtType) => {
    setToolState({ artType: value });
  };

  const handleClear = async () => {
    const newState: AsciiBrailleArtToolState = { ...DEFAULT_STATE, artType: toolState.artType };
    setToolState(newState);
    await saveStateNow(newState);
    setUiError('');
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    debouncedPerformConversion.cancel();
  };

  const handleFileSelected = async (files: StoredFile[]) => {
    setIsLoadFileModalOpen(false);
    if (files.length === 0) return;
    const file = files[0];
    try {
      const text = await file.blob.text();
      setToolState({ inputText: text, lastLoadedFilename: file.filename });
      setUiError('');
    } catch (e) {
      setUiError(`Error reading file "${file.filename}": ${e instanceof Error ? e.message : 'Unknown error'}`);
      handleClear();
    }
  };

  const generateFilename = () => {
    const base = toolState.lastLoadedFilename?.replace(/\.[^/.]+$/, '') || 'art';
    return `${base}-${toolState.artType}.txt`;
  };

  const initiateOutputAction = (action: 'download' | 'save') => {
    if (!toolState.outputText.trim() || uiError) {
      setUiError(uiError || `No output to ${action}.`);
      return;
    }
    setUiError('');
    setSuggestedFilename(generateFilename());
    setFilenameActionType(action);
    setIsFilenameModalOpen(true);
  };

  const handleFilenameConfirm = async (filename: string) => {
    const action = filenameActionType;
    setIsFilenameModalOpen(false);
    setFilenameActionType(null);
    if (!action || !toolState.outputText) return;

    const finalFilename = filename.trim() || generateFilename();
    const blob = new Blob([toolState.outputText], { type: 'text/plain;charset=utf-8' });

    if (action === 'download') {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } else if (action === 'save') {
      try {
        await addFileToLibrary(blob, finalFilename, 'text/plain', false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        setUiError(`Failed to save to library: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  };

  const handleCopyToClipboard = () => {
    if (!toolState.outputText) {
      setUiError('Nothing to copy.');
      return;
    }
    navigator.clipboard.writeText(toolState.outputText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }, () => {
      setUiError('Failed to copy to clipboard.');
    });
  };

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Tool...</p>;
  }

  const canPerformOutputActions = toolState.outputText.trim() !== '' && !uiError;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex justify-between items-center gap-2 mb-1">
          <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Input Text {toolState.lastLoadedFilename && <span className="text-xs italic">({toolState.lastLoadedFilename})</span>}
          </label>
          <div className="flex items-center gap-2">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            <Button variant="neutral-outline" onClick={() => setIsLoadFileModalOpen(true)} iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}>
              Load File
            </Button>
          </div>
        </div>
        <Textarea
          id="text-input"
          rows={6}
          value={toolState.inputText}
          onChange={handleInputChange}
          placeholder="Enter text to convert..."
          textareaClassName="text-base"
          spellCheck="false"
        />
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <RadioGroup
          name="artType"
          legend="Art Style:"
          options={artTypeOptions}
          selectedValue={toolState.artType}
          onChange={(v) => handleArtTypeChange(v as ArtType)}
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
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-status-error))] rounded-md text-sm flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {uiError}
        </div>
      )}

      <div>
        <label htmlFor="output-text" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
          Output
        </label>
        <Textarea
          id="output-text"
          rows={10}
          value={toolState.outputText}
          readOnly
          placeholder="Converted art will appear here..."
          textareaClassName="text-sm font-mono bg-[rgb(var(--color-bg-subtle))] whitespace-pre"
          aria-live="polite"
          spellCheck="false"
        />
      </div>

      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelected}
        mode="selectExistingOrUploadNew"
        accept="text/plain"
        selectionMode="single"
        libraryFilter={{ category: 'text' }}
      />
      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => setIsFilenameModalOpen(false)}
        onConfirm={handleFilenameConfirm}
        initialFilename={suggestedFilename}
        title={filenameActionType === 'download' ? 'Download Art' : 'Save Art to Library'}
        confirmButtonText={filenameActionType === 'download' ? 'Download' : 'Save'}
      />
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={itdeTarget.acceptSignal}
        onIgnore={itdeTarget.ignoreSignal}
        onDeferAll={() => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); }}
        onIgnoreAll={itdeTarget.ignoreAllSignals}
      />
    </div>
  );
}