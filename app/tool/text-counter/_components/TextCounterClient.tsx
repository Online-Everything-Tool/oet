// --- FILE: app/tool/text-counter/_components/TextCounterClient.tsx ---
'use client';

import React, {
  useState,
  useMemo,
  useCallback,
  // useRef, // Not needed if lastLoggedStateRef is removed
  useEffect,
  useRef,
} from 'react';
// import useToolUrlState from '../../_hooks/useToolUrlState'; // Not strictly needed if useToolState handles URL params adequately on init
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import Input from '../../_components/form/Input';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import type { ParamConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import {
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'; // Added ExclamationTriangleIcon

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
  // No outputValue to persist, counts are derived
}

const DEFAULT_TEXT_COUNTER_STATE: TextCounterToolState = {
  inputText: '',
  searchText: '',
  lastLoadedFilename: null,
};

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
    errorLoadingState, // Added from useToolState
  } = useToolState<TextCounterToolState>(toolRoute, DEFAULT_TEXT_COUNTER_STATE);

  // Removed useToolUrlState as useToolState can handle initial URL params if designed to,
  // or we can use a simpler effect as done previously. Let's refine the URL param effect.
  const initialUrlLoadProcessedRef = useRef(false);

  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null); // For file loading errors etc.
  // const lastLoggedStateRef = useRef<TextCounterToolState | null>(null); // Removed

  // Effect for URL parameter handling
  useEffect(() => {
    if (
      isLoadingState ||
      initialUrlLoadProcessedRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      if (!isLoadingState && !initialUrlLoadProcessedRef.current)
        initialUrlLoadProcessedRef.current = true;
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
  ]); // Dependencies refined

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
        // Basic string split counting. For regex, a more complex approach would be needed.
        // Ensure searchString is not empty to avoid infinite loop or incorrect count with empty string.
        if (searchString.length > 0) {
          customCount = inputText.split(searchString).length - 1;
        } else {
          customCount = 0; // Or perhaps an error/warning state
        }
      } catch (e) {
        console.warn('Error counting occurrences with search string:', e);
        customCount = -1;
      }
    }
    return { words, characters, lines, search: searchString, customCount };
  }, [toolState.inputText, toolState.searchText]);

  // Removed the lastLoggedStateRef useEffect as history logging is out of scope for this refactor

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setToolState({
        inputText: event.target.value,
        lastLoadedFilename: null,
      });
      setClientError(null); // Clear client-side errors on new input
    },
    [setToolState]
  );

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setToolState({ searchText: event.target.value });
      setClientError(null); // Clear client-side errors on new search
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
      // More permissive text check for file loading
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
          `Error: File "${file.name}" doesn't appear to be a text-based file.`
        );
        return;
      }

      try {
        const textContent = await file.blob.text();
        setToolState({
          inputText: textContent,
          lastLoadedFilename: file.name,
          // searchText: toolState.searchText // Keep existing search text or clear? Let's keep.
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setClientError(`Error reading file "${file.name}": ${msg}`);
        setToolState({ inputText: '', lastLoadedFilename: null });
      }
    },
    [setToolState] // Removed toolState.searchText from deps as it's read from prevState if needed
  );

  const handleClearText = useCallback(async () => {
    // If only clearing text, keep search term. If clearing all, use persistentClearState.
    // For now, this button only clears the main text input.
    setToolState((prevState) => ({
      ...prevState, // Preserve other parts of state like searchText
      inputText: '',
      lastLoadedFilename: null,
    }));
    setClientError(null);
  }, [setToolState]);

  const handleClearSearch = useCallback(async () => {
    setToolState((prevState) => ({ ...prevState, searchText: '' }));
    setClientError(null);
  }, [setToolState]);

  if (isLoadingState && !initialUrlLoadProcessedRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Text Counter Tool...
      </p>
    );
  }
  if (errorLoadingState) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded">
        Error loading saved state: {errorLoadingState}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="flex justify-between items-center gap-2">
        <label
          htmlFor="text-input"
          className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
        >
          Input Text:
          {toolState.lastLoadedFilename && (
            <span className="ml-2 text-xs italic">
              (from: {toolState.lastLoadedFilename})
            </span>
          )}
        </label>
        <Button
          variant="neutral-outline"
          size="sm"
          onClick={() => setIsLoadFileModalOpen(true)}
          iconLeft={<ArrowUpTrayIcon className="h-4 w-4" />}
        >
          Load from File
        </Button>
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

      {(clientError || errorLoadingState) && ( // Consolidate error display
        <div
          role="alert"
          className="p-3 my-1 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0"
            aria-hidden="true"
          />
          {clientError || errorLoadingState}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <div className="flex-grow grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl font-semibold text-[rgb(var(--color-text-base))]">
              {allCounts.words.toLocaleString()}
            </p>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">Words</p>
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
            <p className="text-xs text-[rgb(var(--color-text-muted))]">Lines</p>
          </div>
        </div>
        <div className="flex-shrink-0">
          <Button
            variant="neutral"
            onClick={handleClearText}
            disabled={!toolState.inputText}
            title="Clear input text"
          >
            Clear Text
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between border border-[rgb(var(--color-border-base))] p-4 rounded-md bg-[rgb(var(--color-bg-component))]">
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
          >
            Clear Search
          </Button>
        </div>
      </div>

      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".txt,text/*,.csv,.md,.json,.xml,.log,.js,.ts,.css,.html" // Expanded common text types
        selectionMode="single"
        libraryFilter={{ category: 'text' }}
        initialTab="upload"
      />
    </div>
  );
}
