// FILE: app/tool/text-counter/_components/TextCounterClient.tsx
'use client';

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import useToolUrlState from '../../_hooks/useToolUrlState';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import Input from '../../_components/form/Input';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import type { ParamConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';

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
  } = useToolState<TextCounterToolState>(toolRoute, DEFAULT_TEXT_COUNTER_STATE);

  const { urlState, isLoadingUrlState, urlProvidedAnyValue } =
    useToolUrlState(urlStateParams);

  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null); // For file loading errors
  const lastLoggedStateRef = useRef<TextCounterToolState | null>(null);

  // Effect to initialize state from URL parameters
  useEffect(() => {
    if (!isLoadingState && !isLoadingUrlState && urlProvidedAnyValue) {
      const updates: Partial<TextCounterToolState> = {};
      const urlInputText = urlState.text as string | undefined;
      const urlSearchText = urlState.search as string | undefined;

      if (urlInputText !== undefined && urlInputText !== toolState.inputText) {
        updates.inputText = urlInputText;
        updates.lastLoadedFilename = '(loaded from URL)';
      }
      if (
        urlSearchText !== undefined &&
        urlSearchText !== toolState.searchText
      ) {
        updates.searchText = urlSearchText;
      }

      if (Object.keys(updates).length > 0) {
        setToolState(updates);
      }
    }
  }, [
    isLoadingState,
    isLoadingUrlState,
    urlProvidedAnyValue,
    urlState,
    toolState,
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
        // Basic string split counting. For regex, a more complex approach would be needed.
        customCount = inputText.split(searchString).length - 1;
      } catch (e) {
        // Handle potential errors if searchString is a complex regex special character
        console.warn('Error counting occurrences with search string:', e);
        customCount = -1; // Indicate error or invalid search
      }
    }
    return { words, characters, lines, search: searchString, customCount };
  }, [toolState.inputText, toolState.searchText]);

  useEffect(() => {
    if (isLoadingState) {
      lastLoggedStateRef.current = toolState;
      return;
    }
    if (
      JSON.stringify(toolState) === JSON.stringify(lastLoggedStateRef.current)
    ) {
      lastLoggedStateRef.current = toolState;
    }
  }, [toolState, allCounts, isLoadingState]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setToolState({
        inputText: event.target.value,
        lastLoadedFilename: null,
      });
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
      if (!file.type?.startsWith('text/')) {
        // Heuristic: if no type, but common text extension, allow it.
        const commonTextExtensions = [
          '.txt',
          '.md',
          '.csv',
          '.json',
          '.xml',
          '.log',
          '.js',
          '.ts',
          '.css',
          '.html',
        ];
        const hasTextExtension = commonTextExtensions.some((ext) =>
          file.name.toLowerCase().endsWith(ext)
        );
        if (!hasTextExtension) {
          setClientError(
            `Error: File "${file.name}" is not a recognized text file type.`
          );
          return;
        }
      }

      try {
        const textContent = await file.blob.text();
        setToolState({
          inputText: textContent,
          lastLoadedFilename: file.name,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setClientError(`Error reading file "${file.name}": ${msg}`);
        setToolState({ inputText: '', lastLoadedFilename: null });
      }
    },
    [setToolState]
  );

  const handleClearText = useCallback(() => {
    setToolState((prevState) => ({
      ...prevState,
      inputText: '',
      lastLoadedFilename: null,
    }));
    setClientError(null);
  }, [setToolState]);

  const handleClearSearch = useCallback(() => {
    setToolState((prevState) => ({ ...prevState, searchText: '' }));
    setClientError(null);
  }, [setToolState]);

  if (isLoadingState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Text Counter Tool...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="flex justify-between items-center gap-2">
        <label
          htmlFor="text-input"
          className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
        >
          Your Text:
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

      {clientError && (
        <p role="alert" className="text-sm text-red-600 -mt-2">
          {clientError}
        </p>
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
        accept=".txt,text/*" // Common text file types
        selectionMode="single"
        libraryFilter={{ category: 'text' }} // Suggests filtering library for text files
        initialTab="upload"
      />
    </div>
  );
}
