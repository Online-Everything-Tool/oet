'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import {
  ArrowUpTrayIcon,
  CheckIcon,
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
import { safeStringify } from '@/app/lib/utils';

interface JsonDiffToolState {
  json1: string;
  json2: string;
  diff: string;
  lastLoadedFilename1?: string | null;
  lastLoadedFilename2?: string | null;
}

const DEFAULT_JSON_DIFF_STATE: JsonDiffToolState = {
  json1: '',
  json2: '',
  diff: '',
  lastLoadedFilename1: null,
  lastLoadedFilename2: null,
};

const metadata = importedMetadata as ToolMetadata;

const diffJson = (json1: any, json2: any): string => {
  const diff = JSONDiff(json1, json2);
  return safeStringify(diff, 2);
};

interface JsonDiffClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function JsonDiffClient({
  urlStateParams,
  toolRoute,
}: JsonDiffClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    saveStateNow,
  } = useToolState<JsonDiffToolState>(toolRoute, DEFAULT_JSON_DIFF_STATE);

  const [isLoadFileModalOpen1, setIsLoadFileModalOpen1] = useState(false);
  const [isLoadFileModalOpen2, setIsLoadFileModalOpen2] = useState(false);
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

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialUrlLoadProcessedRef = useRef(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const directiveName = metadata.directive;

  const generateOutputFilename = useCallback((): string => {
    const base = 'json-diff';
    return `${base}.json`;
  }, []);

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[JsonDiff ITDE Accept] Processing signal from: ${signal.sourceDirective}`
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

      const jsonItems = resolvedPayload.data.filter((item) =>
        item.type === 'application/json'
      );
      if (jsonItems.length === 0) {
        setUiError('No valid JSON data found in received ITDE data.');
        return;
      }

      const json1 = await jsonItems[0].blob.text();
      const json2 = jsonItems.length > 1 ? await jsonItems[1].blob.text() : '';
      const newState: Partial<JsonDiffToolState> = {
        json1,
        json2,
        diff: '',
        lastLoadedFilename1: jsonItems.length > 0 ? (jsonItems[0] as StoredFile).filename : null,
        lastLoadedFilename2: jsonItems.length > 1 ? (jsonItems[1] as StoredFile).filename : null,
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

  useEffect(() => {
    if (isLoadingState || !initialToolStateLoadCompleteRef.current) {
      return;
    }
    try {
      const parsedJson1 = JSON.parse(toolState.json1);
      const parsedJson2 = JSON.parse(toolState.json2);
      const diffResult = diffJson(parsedJson1, parsedJson2);
      setToolState({ diff: diffResult });
      setUiError('');
      setCurrentOutputFilename(generateOutputFilename());
      setCopySuccess(false);
      setSaveSuccess(false);
      setDownloadSuccess(false);
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Error');
      setToolState({ diff: '' });
      setCurrentOutputFilename(null);
    }
  }, [
    toolState.json1,
    toolState.json2,
    setToolState,
    generateOutputFilename,
  ]);

  const handleInputChange = useCallback(
    (index: 1 | 2, event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setToolState((prevState) => ({
        ...prevState,
        [index === 1 ? 'json1' : 'json2']: event.target.value,
        diff: '',
        lastLoadedFilename1: index === 1 ? null : prevState.lastLoadedFilename1,
        lastLoadedFilename2: index === 2 ? null : prevState.lastLoadedFilename2,
      }));
      setCopySuccess(false);
      setSaveSuccess(false);
      setDownloadSuccess(false);
    },
    [setToolState]
  );

  const handleClear = useCallback(async () => {
    const newState: JsonDiffToolState = { ...DEFAULT_JSON_DIFF_STATE };
    setToolState(newState);
    await saveStateNow(newState);

    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    setUiError('');
  }, [setToolState, saveStateNow]);

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[], index: 1 | 2) => {
      if (index === 1) setIsLoadFileModalOpen1(false);
      else setIsLoadFileModalOpen2(false);
      if (files.length === 0) return;
      const file = files[0];
      if (!file.blob) {
        setUiError(`Error: File "${file.filename}" has no content.`);
        return;
      }
      try {
        const text = await file.blob.text();
        setToolState((prevState) => ({
          ...prevState,
          [index === 1 ? 'json1' : 'json2']: text,
          diff: '',
          lastLoadedFilename1: index === 1 ? file.filename : prevState.lastLoadedFilename1,
          lastLoadedFilename2: index === 2 ? file.filename : prevState.lastLoadedFilename2,
        }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setUiError(`Error reading file "${file.filename}": ${msg}`);
        setToolState((prevState) => ({
          ...prevState,
          [index === 1 ? 'json1' : 'json2']: '',
          diff: '',
          lastLoadedFilename1: index === 1 ? null : prevState.lastLoadedFilename1,
          lastLoadedFilename2: index === 2 ? null : prevState.lastLoadedFilename2,
        }));
        setCurrentOutputFilename(null);
      }
    },
    [setToolState]
  );

  const handleCopyToClipboard = useCallback(async () => {
    if (!toolState.diff || !navigator.clipboard) {
      setUiError('Nothing to copy or clipboard unavailable.');
      return;
    }
    if (uiError && !uiError.toLowerCase().includes('output')) setUiError('');
    navigator.clipboard.writeText(toolState.diff).then(
      () => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      },
      (_err) => {
        setUiError('Failed to copy to clipboard.');
      }
    );
  }, [toolState.diff, uiError]);

  const handleFilenameConfirm = useCallback(
    async (chosenFilename: string) => {
      const action = filenameActionType;
      setIsFilenameModalOpen(false);
      setFilenameActionType(null);
      if (!action || !toolState.diff) {
        setUiError(uiError || 'No output to process.');
        return;
      }
      let finalFilename = chosenFilename.trim();
      if (!finalFilename) finalFilename = generateOutputFilename();
      if (!/\.json$/i.test(finalFilename)) finalFilename += '.json';
      setCurrentOutputFilename(finalFilename);

      if (action === 'download') {
        try {
          const blob = new Blob([toolState.diff], {
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
          if (uiError && !uiError.toLowerCase().includes('output'))
            setUiError('');
          setTimeout(() => setDownloadSuccess(false), 2000);
        } catch (_err) {
          setUiError('Failed to prepare download.');
        }
      } else if (action === 'save') {
        const blob = new Blob([toolState.diff], {
          type: 'application/json',
        });
        try {
          await addFileToLibrary(blob, finalFilename, 'application/json', false);
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
      generateOutputFilename,
      uiError,
    ]
  );

  const initiateOutputActionWithPrompt = (action: 'download' | 'save') => {
    if (!toolState.diff.trim()) {
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
      setSuggestedFilenameForPrompt(generateOutputFilename());
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
        Loading JSON Diff Tool...
      </p>
    );
  }
  const canPerformOutputActions = toolState.diff.trim() !== '' && !uiError;

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="space-y-1 h-full flex flex-col">
          <div className="flex justify-between items-center">
            <label
              htmlFor="json-input-1"
              className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
            >
              JSON 1:
              {toolState.lastLoadedFilename1 && (
                <span className="ml-1 text-xs italic">
                  ({toolState.lastLoadedFilename1})
                </span>
              )}
            </label>
            <Button
              variant="neutral-outline"
              onClick={() => setIsLoadFileModalOpen1(true)}
              iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
            >
              Load from File
            </Button>
          </div>
          <Textarea
            id="json-input-1"
            label="JSON 1"
            labelClassName="sr-only"
            name="json1"
            rows={8}
            value={toolState.json1}
            onChange={(e) => handleInputChange(1, e)}
            placeholder={`Paste your first JSON object here...\n{\n  "example": "data1"\n}`}
            textareaClassName="text-sm font-mono"
            spellCheck="false"
          />
        </div>
        <div className="space-y-1 h-full flex flex-col">
          <label
            htmlFor="json-input-2"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
          >
            JSON 2:
            {toolState.lastLoadedFilename2 && (
              <span className="ml-1 text-xs italic">
                ({toolState.lastLoadedFilename2})
              </span>
            )}
          </label>
          <Textarea
            id="json-input-2"
            label="JSON 2"
            labelClassName="sr-only"
            name="json2"
            rows={8}
            value={toolState.json2}
            onChange={(e) => handleInputChange(2, e)}
            placeholder={`Paste your second JSON object here...\n{\n  "example": "data2"\n}`}
            textareaClassName="text-sm font-mono"
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
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center gap-2">
          <label
            htmlFor="json-diff-output"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
          >
            Difference:
          </label>
          <ReceiveItdeDataTrigger
            hasDeferredSignals={
              itdeTarget.pendingSignals.length > 0 &&
              userDeferredAutoPopup &&
              !itdeTarget.isModalOpen
            }
            pendingSignalCount={itdeTarget.pendingSignals.length}
            onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
          />
        </div>
        <Textarea
          id="json-diff-output"
          label="Difference between JSON objects"
          labelClassName="sr-only"
          rows={12}
          value={toolState.diff}
          readOnly
          placeholder="JSON difference will appear here..."
          textareaClassName="text-sm font-mono bg-[rgb(var(--color-bg-subtle))]"
          spellCheck="false"
          aria-live="polite"
        />
      </div>
      <div className="flex justify-end gap-4 p-3">
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

      <FileSelectionModal
        isOpen={isLoadFileModalOpen1}
        onClose={() => setIsLoadFileModalOpen1(false)}
        onFilesSelected={(files) => handleFileSelectedFromModal(files, 1)}
        slurpContentOnly={true}
        mode="selectExistingOrUploadNew"
        accept=".json,application/json"
        selectionMode="single"
        libraryFilter={{ category: 'other' }}
        initialTab="upload"
      />
      <FileSelectionModal
        isOpen={isLoadFileModalOpen2}
        onClose={() => setIsLoadFileModalOpen2(false)}
        onFilesSelected={(files) => handleFileSelectedFromModal(files, 2)}
        slurpContentOnly={true}
        mode="selectExistingOrUploadNew"
        accept=".json,application/json"
        selectionMode="single"
        libraryFilter={{ category: 'other' }}
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