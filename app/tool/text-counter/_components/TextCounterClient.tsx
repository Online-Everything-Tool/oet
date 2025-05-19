// --- FILE: app/tool/text-counter/_components/TextCounterClient.tsx ---
'use client';

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import Input from '../../_components/form/Input';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
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

import importedMetadata from '../metadata.json';
import { XCircleIcon } from '@heroicons/react/24/solid';

interface TextCounts {
  words: number;
  characters: number;
  lines: number;
  search: string;
  customCount: number;
}

interface TextCounterToolState {
  inputText: string;
  searchText: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_TEXT_COUNTER_STATE: TextCounterToolState = {
  inputText: '',
  searchText: '',
  lastLoadedFilename: null,
};

const metadata = importedMetadata as ToolMetadata;

interface TextCounterClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function TextCounterClient({
  urlStateParams,
  toolRoute,
}: TextCounterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    errorLoadingState,
    saveStateNow,
  } = useToolState<TextCounterToolState>(toolRoute, DEFAULT_TEXT_COUNTER_STATE);

  const initialUrlLoadProcessedRef = useRef(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);

  const { getToolMetadata } = useMetadata();
  const directiveName = metadata.directive;

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[TextCounter ITDE Accept] Processing signal from: ${signal.sourceDirective}`
      );
      setClientError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setClientError(
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
        setClientError(
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
          setClientError(
            `Error reading text from received data: ${errorMsgText}`
          );
          return;
        }
      } else if (firstItem) {
        setClientError(
          `Received data is not text (type: ${firstItem.type}). Cannot process.`
        );
        return;
      } else {
        setClientError('No valid item found in received ITDE data.');
        return;
      }

      const newStateUpdate: Partial<TextCounterToolState> = {
        inputText: newText,
        lastLoadedFilename: loadedFilename,
      };

      const currentSearchText = toolState.searchText;
      setToolState(newStateUpdate);
      await saveStateNow({
        ...toolState,
        ...newStateUpdate,
        searchText: currentSearchText,
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

  useEffect(() => {
    if (
      isLoadingState ||
      initialUrlLoadProcessedRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
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
    const updates: Partial<TextCounterToolState> = {};
    let needsUpdate = false;

    const textFromUrl = params.get('text');
    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      updates.inputText = textFromUrl;
      updates.lastLoadedFilename = '(loaded from URL)';
      needsUpdate = true;
    }

    const searchFromUrl = params.get('search');
    if (searchFromUrl !== null && searchFromUrl !== toolState.searchText) {
      updates.searchText = searchFromUrl;
      needsUpdate = true;
    }

    if (needsUpdate) {
      setToolState(updates);
    }
  }, [
    isLoadingState,
    urlStateParams,
    toolState.inputText,
    toolState.searchText,
    setToolState,
  ]);

  const allCounts = useMemo((): TextCounts => {
    const inputText = toolState.inputText;
    const searchString = toolState.searchText;
    const trimmedText = inputText.trim();
    const words =
      trimmedText.length === 0
        ? 0
        : trimmedText.split(/\s+/).filter(Boolean).length;
    const characters = inputText.length;
    const lines = inputText === '' ? 0 : inputText.split(/\r\n|\r|\n/).length;
    let customCount = 0;
    if (inputText && searchString) {
      try {
        if (searchString.length > 0) {
          customCount = inputText.split(searchString).length - 1;
        } else {
          customCount = 0;
        }
      } catch (e) {
        console.warn('Error counting occurrences with search string:', e);
        customCount = -1;
      }
    }
    return { words, characters, lines, search: searchString, customCount };
  }, [toolState.inputText, toolState.searchText]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setToolState({ inputText: event.target.value, lastLoadedFilename: null });
      setClientError(null);
    },
    [setToolState]
  );

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setToolState({ searchText: event.target.value });
      setClientError(null);
    },
    [setToolState]
  );

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLoadFileModalOpen(false);
      setClientError(null);
      if (files.length === 0) return;
      const file = files[0];

      if (!file.blob) {
        setClientError(`Error: File "${file.name}" has no content.`);
        return;
      }

      if (
        !file.type?.startsWith('text/') &&
        !['application/json', 'application/xml', 'application/csv'].includes(
          file.type || ''
        ) &&
        !/\.(txt|md|csv|json|xml|log|js|ts|css|html|htm|ini|cfg|sh|py|rb|php|sql)$/i.test(
          file.name
        )
      ) {
        setClientError(
          `Error: File "${file.name}" doesn't appear to be a text-based file. Please select a text file.`
        );
        return;
      }

      try {
        const textContent = await file.blob.text();
        setToolState({ inputText: textContent, lastLoadedFilename: file.name });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setClientError(`Error reading file "${file.name}": ${msg}`);
        setToolState({ inputText: '', lastLoadedFilename: null });
      }
    },
    [setToolState]
  );

  const handleClearText = useCallback(async () => {
    setToolState((prevState) => ({
      ...prevState,
      inputText: '',
      lastLoadedFilename: null,
    }));
    setClientError(null);
    await saveStateNow({
      ...toolState,
      inputText: '',
      lastLoadedFilename: null,
    });
  }, [setToolState, saveStateNow, toolState]);

  const handleClearSearch = useCallback(async () => {
    setToolState((prevState) => ({ ...prevState, searchText: '' }));

    await saveStateNow({ ...toolState, searchText: '' });
    setClientError(null);
  }, [setToolState, saveStateNow, toolState]);

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
        Loading Text Counter Tool...
      </p>
    );
  }

  const displayError = clientError || errorLoadingState;

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
        rows={10}
        value={toolState.inputText}
        onChange={handleInputChange}
        placeholder="Paste or type your text here..."
        aria-label="Text input area"
        textareaClassName="text-base font-inherit"
        spellCheck="false"
      />

      {displayError && (
        <div
          role="alert"
          className="p-3 my-1 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0"
            aria-hidden="true"
          />
          {displayError}
        </div>
      )}

      <div className="flex flex-col border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-component))]">
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex-grow grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-semibold text-[rgb(var(--color-text-base))]">
                {allCounts.words.toLocaleString()}
              </p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                Words
              </p>
            </div>
            <div>
              <p className="text-xl font-semibold text-[rgb(var(--color-text-base))]">
                {allCounts.characters.toLocaleString()}
              </p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                Characters
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xl font-semibold text-[rgb(var(--color-text-base))]">
                {allCounts.lines.toLocaleString()}
              </p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                Lines
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <Button
              variant="neutral"
              onClick={handleClearText}
              disabled={!toolState.inputText}
              title="Clear input text"
              iconLeft={<XCircleIcon className="h-5 w-5" />}
            >
              Clear
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-center justify-between py-4 pb-4">
          <div className="text-center px-4 shrink-0 order-1 sm:order-none">
            <p className="text-2xl font-bold text-[rgb(var(--color-button-secondary-bg))]">
              {allCounts.customCount < 0
                ? 'N/A'
                : allCounts.customCount.toLocaleString()}
            </p>
            <p
              className="text-xs text-[rgb(var(--color-button-secondary-bg))] opacity-90"
              title={
                toolState.searchText
                  ? `Occurrences of "${toolState.searchText}"`
                  : 'Occurrences'
              }
            >
              Occurrences
            </p>
          </div>
          <div className="flex-grow min-w-[200px] order-3 sm:order-none w-full sm:w-auto">
            <Input
              type="text"
              id="search-input"
              name="searchText"
              value={toolState.searchText}
              onChange={handleSearchChange}
              placeholder="Text to Count Occurrences..."
              aria-label="Text to count occurrences of"
              inputClassName="text-base font-inherit"
            />
          </div>
          <div className="flex items-center shrink-0 order-2 sm:order-none">
            <Button
              variant="neutral"
              onClick={handleClearSearch}
              title="Clear occurrence search text"
              disabled={!toolState.searchText}
              iconLeft={<XCircleIcon className="h-5 w-5" />}
            >
              Clear Search
            </Button>
          </div>
        </div>
      </div>
      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".txt,text/*,.csv,.md,.json,.xml,.log,.js,.ts,.css,.html"
        selectionMode="single"
        libraryFilter={{ category: 'text' }}
        initialTab="upload"
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
