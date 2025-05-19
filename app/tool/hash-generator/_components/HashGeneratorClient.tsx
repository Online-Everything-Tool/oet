// --- FILE: app/tool/hash-generator/_components/HashGeneratorClient.tsx ---
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
import Select from '../../_components/form/Select';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { bufferToHex, isTextBasedMimeType } from '@/app/lib/utils';
import { md5 } from 'js-md5';
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
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import importedMetadata from '../metadata.json';

type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512';
const AUTO_PROCESS_DEBOUNCE_MS = 500;

interface HashGeneratorToolState {
  inputText: string;
  algorithm: HashAlgorithm;
  lastLoadedFilename?: string | null;
  outputValue: string;
  errorMsg: string;
}

const DEFAULT_HASH_TOOL_STATE: HashGeneratorToolState = {
  inputText: '',
  algorithm: 'MD5',
  lastLoadedFilename: null,
  outputValue: '',
  errorMsg: '',
};

const metadata = importedMetadata as ToolMetadata;

interface HashGeneratorClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function HashGeneratorClient({
  urlStateParams,
  toolRoute,
}: HashGeneratorClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
  } = useToolState<HashGeneratorToolState>(toolRoute, DEFAULT_HASH_TOOL_STATE);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
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

  const algorithmOptions = useMemo(
    () => [
      { value: 'MD5' as HashAlgorithm, label: 'MD5' },
      { value: 'SHA-1' as HashAlgorithm, label: 'SHA-1' },
      { value: 'SHA-256' as HashAlgorithm, label: 'SHA-256' },
      { value: 'SHA-512' as HashAlgorithm, label: 'SHA-512' },
    ],
    []
  );

  const generateOutputFilenameForAction = useCallback((): string => {
    const base =
      toolState.lastLoadedFilename?.replace(/\.[^/.]+$/, '') || 'hashed-output';
    const algoLabel = toolState.algorithm.toLowerCase().replace('-', '');
    return `${base}.${algoLabel}.txt`;
  }, [toolState.lastLoadedFilename, toolState.algorithm]);

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[HashGenerator ITDE Accept] Processing signal from: ${signal.sourceDirective}`
      );
      setToolState((prevState) => ({ ...prevState, errorMsg: '' }));
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
            loadedFilename = (firstItem as StoredFile).name;
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

      const newState: Partial<HashGeneratorToolState> = {
        inputText: newText,
        outputValue: '',
        errorMsg: '',
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

  const handleGenerateHashInternal = useCallback(
    async (textToProcess: string, algo: HashAlgorithm) => {
      setIsProcessing(true);

      setToolState((prevState) => ({
        ...prevState,
        outputValue: '',
        errorMsg: '',
      }));
      setCopySuccess(false);
      setSaveSuccess(false);
      setDownloadSuccess(false);

      const trimmedTextToProcess = textToProcess;
      if (!trimmedTextToProcess) {
        setIsProcessing(false);
        setCurrentOutputFilename(null);
        return;
      }

      let newOutputValue = '';
      let newErrorMsg = '';
      try {
        if (algo === 'MD5') {
          newOutputValue = md5(trimmedTextToProcess);
        } else {
          if (!crypto?.subtle) {
            throw new Error(
              'Web Crypto API (crypto.subtle) is not available (requires HTTPS or secure context).'
            );
          }
          const encoder = new TextEncoder();
          const dataBuffer = encoder.encode(trimmedTextToProcess);
          const subtleAlgo = algo as AlgorithmIdentifier;
          const hashBuffer = await crypto.subtle.digest(subtleAlgo, dataBuffer);
          newOutputValue = bufferToHex(hashBuffer);
        }

        setToolState((prevState) => {
          const currentFilenameForOutput =
            prevState.inputText === textToProcess
              ? prevState.lastLoadedFilename
              : null;
          if (currentFilenameForOutput && !currentOutputFilename) {
            setCurrentOutputFilename(generateOutputFilenameForAction());
          } else if (
            !currentFilenameForOutput &&
            currentOutputFilename !== null
          ) {
            setCurrentOutputFilename(null);
          }
          return {
            ...prevState,
            outputValue: newOutputValue,
            errorMsg: '',
            algorithm: algo,
          };
        });
      } catch (err) {
        newErrorMsg = err instanceof Error ? err.message : 'Hashing error.';
        setCurrentOutputFilename(null);
        setToolState((prevState) => ({
          ...prevState,
          outputValue: '',
          errorMsg: newErrorMsg,
          algorithm: algo,
        }));
      } finally {
        setIsProcessing(false);
      }
    },
    [setToolState, generateOutputFilenameForAction, currentOutputFilename]
  );

  const debouncedGenerateHash = useDebouncedCallback(
    handleGenerateHashInternal,
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
    const algoFromUrl = params.get('algorithm') as HashAlgorithm | null;

    let textToSet = toolState.inputText;
    let algoToSet = toolState.algorithm;
    let filenameToSet = toolState.lastLoadedFilename;
    let needsUpdate = false;

    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      textToSet = textFromUrl;
      filenameToSet = null;
      needsUpdate = true;
    }

    if (
      algoFromUrl &&
      algorithmOptions.some((opt) => opt.value === algoFromUrl) &&
      algoFromUrl !== toolState.algorithm
    ) {
      algoToSet = algoFromUrl;
      needsUpdate = true;
    }

    if (needsUpdate) {
      setToolState({
        inputText: textToSet,
        algorithm: algoToSet,
        lastLoadedFilename: filenameToSet,
        outputValue: '',
        errorMsg: '',
      });
    }
  }, [
    isLoadingToolState,
    urlStateParams,
    toolState,
    setToolState,
    algorithmOptions,
  ]);

  useEffect(() => {
    if (
      isLoadingToolState ||
      !initialToolStateLoadCompleteRef.current ||
      isProcessing
    ) {
      return;
    }

    debouncedGenerateHash(toolState.inputText, toolState.algorithm);
  }, [
    toolState.inputText,
    toolState.algorithm,
    isLoadingToolState,
    debouncedGenerateHash,
    isProcessing,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({
      inputText: event.target.value,
      lastLoadedFilename: null,
    });
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
  };

  const handleAlgorithmChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setToolState({
      algorithm: event.target.value as HashAlgorithm,
    });
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
  };

  const handleClear = useCallback(async () => {
    const newState: HashGeneratorToolState = {
      ...DEFAULT_HASH_TOOL_STATE,
      algorithm: toolState.algorithm,
    };
    setToolState(newState);
    saveStateNow(newState);
    setIsProcessing(false);
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    debouncedGenerateHash.cancel();
  }, [saveStateNow, toolState.algorithm, setToolState, debouncedGenerateHash]);

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLoadFileModalOpen(false);
      if (files.length === 0) return;
      const file = files[0];
      if (!file.blob) {
        setToolState((prev) => ({
          ...prev,
          errorMsg: `Error: File "${file.name}" has no content.`,
        }));
        return;
      }

      if (
        isTextBasedMimeType(file.type) ||
        file.type === '' ||
        file.type === 'application/octet-stream' ||
        file.name.endsWith('.txt')
      ) {
        try {
          const text = await file.blob.text();
          setToolState({
            inputText: text,
            lastLoadedFilename: file.name,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'File read error';
          setToolState((prev) => ({
            ...prev,
            inputText: '',
            lastLoadedFilename: null,
            outputValue: '',
            errorMsg: `Error reading file "${file.name}": ${msg}. Ensure it's text-based.`,
          }));
          setCurrentOutputFilename(null);
        }
      } else {
        setToolState((prev) => ({
          ...prev,
          errorMsg: `File type "${file.type}" may not be suitable for text-based hashing. Please select a text-based file or ensure content is appropriate.`,
        }));
        setCurrentOutputFilename(null);
      }
    },
    [
      setToolState /*, toolState.algorithm, generateOutputFilenameForAction removed -> deferred */,
    ]
  );

  const handleFilenameConfirm = useCallback(
    (filename: string, actionOverride?: 'download' | 'save') => {
      setIsFilenameModalOpen(false);
      const currentAction = actionOverride || filenameAction;
      setFilenameAction(null);

      if (!currentAction || !toolState.outputValue) {
        setToolState((prev) => ({
          ...prev,
          errorMsg: prev.errorMsg || 'No output to process.',
        }));
        return;
      }

      let finalFilename = filename.trim();
      if (!finalFilename) finalFilename = generateOutputFilenameForAction();
      if (!/\.txt$/i.test(finalFilename)) finalFilename += '.txt';

      setCurrentOutputFilename(finalFilename);

      if (currentAction === 'download') {
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
      } else if (currentAction === 'save') {
        const blob = new Blob([toolState.outputValue], {
          type: 'text/plain;charset=utf-8',
        });
        addFileToLibrary(blob, finalFilename, 'text/plain', false)
          .then(() => {
            setSaveSuccess(true);
            setToolState((prev) => ({ ...prev, errorMsg: '' }));
            setTimeout(() => setSaveSuccess(false), 2000);
          })
          .catch((_err) =>
            setToolState((prev) => ({
              ...prev,
              errorMsg: 'Failed to save to library.',
            }))
          );
      }
    },
    [
      filenameAction,
      toolState.outputValue,
      setToolState,
      addFileToLibrary,
      generateOutputFilenameForAction,
    ]
  );

  const initiateOutputAction = useCallback(
    (action: 'download' | 'save') => {
      if (!toolState.outputValue.trim()) {
        setToolState((prev) => ({
          ...prev,
          errorMsg: prev.errorMsg || 'No output to ' + action + '.',
        }));
        return;
      }
      if (toolState.errorMsg && toolState.outputValue.trim()) {
        if (!toolState.errorMsg.toLowerCase().includes('output')) {
          setToolState((prev) => ({
            ...prev,
            errorMsg:
              'Cannot ' + action + ' output due to existing input errors.',
          }));
        }
        return;
      }
      setToolState((prev) => ({ ...prev, errorMsg: '' }));

      if (currentOutputFilename) {
        handleFilenameConfirm(currentOutputFilename, action);
      } else {
        setSuggestedFilenameForPrompt(generateOutputFilenameForAction());
        setFilenameAction(action);
        setIsFilenameModalOpen(true);
      }
    },
    [
      currentOutputFilename,
      handleFilenameConfirm,
      toolState.errorMsg,
      toolState.outputValue,
      setToolState,
      generateOutputFilenameForAction,
    ]
  );

  const handleCopyToClipboard = useCallback(async () => {
    if (!toolState.outputValue) {
      setToolState((prev) => ({ ...prev, errorMsg: 'No output to copy.' }));
      return;
    }
    try {
      await navigator.clipboard.writeText(toolState.outputValue);
      setCopySuccess(true);
      if (
        toolState.errorMsg &&
        !toolState.errorMsg.toLowerCase().includes('output')
      ) {
        setToolState((prev) => ({ ...prev, errorMsg: '' }));
      }
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (_err) {
      setToolState((prev) => ({
        ...prev,
        errorMsg: 'Failed to copy to clipboard.',
      }));
    }
  }, [toolState, setToolState]);

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
        Loading Hash Generator...
      </p>
    );
  }
  const canPerformOutputActions =
    toolState.outputValue.trim() !== '' && !toolState.errorMsg && !isProcessing;

  return (
    <div className="space-y-6 text-[rgb(var(--color-text-base))]">
      <div>
        <div className="flex justify-between items-center gap-2 mb-1">
          <label
            htmlFor="text-input-hash-gen"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
          >
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
              iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />}
              disabled={isProcessing}
            >
              Load from File
            </Button>
          </div>
        </div>
        <Textarea
          id="text-input-hash-gen"
          label="Input text to hash"
          labelClassName="sr-only"
          rows={8}
          value={toolState.inputText}
          onChange={handleInputChange}
          placeholder="Enter text to hash or load from a file..."
          textareaClassName="text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
          spellCheck="false"
          disabled={isProcessing}
        />
      </div>
      <div className="flex flex-col border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex flex-wrap gap-4 items-center p-3">
          <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
            <label
              htmlFor="algorithm-select"
              className="text-sm font-medium text-[rgb(var(--color-text-muted))] whitespace-nowrap"
            >
              Algorithm:
            </label>
            <Select
              id="algorithm-select"
              name="algorithm"
              options={algorithmOptions}
              value={toolState.algorithm}
              onChange={handleAlgorithmChange}
              selectClassName="text-sm py-1.5 pl-2 pr-8 min-w-[120px]"
              disabled={isProcessing}
            />
          </div>
          <div className="flex-grow"></div> {/* Spacer */}
          <div className="flex flex-wrap gap-3 items-center sm:ml-auto">
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
        {toolState.algorithm === 'MD5' && (
          <div className="p-3 text-xs text-[rgb(var(--color-text-muted))] italic flex justify-center">
            <b>Note</b>: MD5 is useful for checksums but is not considered
            secure for cryptographic purposes like password storage due to known
            vulnerabilities.
          </div>
        )}
      </div>
      {toolState.errorMsg && (
        <div
          role="alert"
          className="p-3 border rounded-md text-sm bg-[rgb(var(--color-bg-error-subtle))] border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] flex items-start gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong>{' '}
            {toolState.errorMsg}
          </div>
        </div>
      )}
      {(toolState.outputValue || (isProcessing && !toolState.errorMsg)) && (
        <div>
          <label
            htmlFor="text-output-hash-gen"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"
          >
            Hash Output ({toolState.algorithm}):
          </label>
          <Textarea
            id="text-output-hash-gen"
            label={`Hash Output (${toolState.algorithm})`}
            labelClassName="sr-only"
            rows={3}
            value={
              isProcessing && !toolState.outputValue && !toolState.errorMsg
                ? 'Generating...'
                : toolState.outputValue
            }
            readOnly
            placeholder="Generated hash will appear here..."
            textareaClassName={`text-base font-mono resize-none bg-[rgb(var(--color-bg-subtle))] ${isProcessing && !toolState.outputValue && !toolState.errorMsg ? 'animate-pulse' : ''}`}
            aria-live="polite"
            onClick={(e) => e.currentTarget.select()}
          />
        </div>
      )}
      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        slurpContentOnly={true}
        mode="selectExistingOrUploadNew"
        accept=".txt,text/*,application/octet-stream"
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
            ? 'Filename for download:'
            : 'Filename for library:'
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
