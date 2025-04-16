// FILE: app/tool/text-counter/_components/TextCounterClient.tsx
'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useHistory } from '../../../context/HistoryContext'; // Removed unused TriggerType
import useToolUrlState, { ParamConfig, StateSetters } from '../../_hooks/useToolUrlState';

interface TextCounts {
  words: number;
  characters: number;
  lines: number;
  search: string; // Keep search term here for reference in history object if needed
  customCount: number;
}

interface TextCounterClientProps {
    urlStateParams: ParamConfig[];
    toolTitle: string;
    toolRoute: string;
}

export default function TextCounterClient({
    urlStateParams,
    toolTitle,
    toolRoute
}: TextCounterClientProps) {
    const [text, setText] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    const lastLoggedTextRef = useRef<string | null>(null);
    const lastLoggedSearchRef = useRef<string | null>(null);
    const initialLoadComplete = useRef(false);

    const { addHistoryEntry } = useHistory();

    const stateSetters = useMemo(() => ({
        text: setText,
        search: setSearch,
    }), []);

    // This hook sets initial state based on URL if params are present
    useToolUrlState(
       urlStateParams,
       stateSetters as StateSetters
    );

    useEffect(() => {
        // Set initial refs *after* useToolUrlState has potentially set initial values
        if (!initialLoadComplete.current) {
            lastLoggedTextRef.current = text;
            lastLoggedSearchRef.current = search;
            initialLoadComplete.current = true;
        }
    }, [text, search]); // Run when text/search changes, but only sets refs once

    // Calculate counts whenever text or search term changes
    const allCounts = useMemo((): TextCounts => {
      const inputText = text;
      const searchString = search;
      const trimmedText = inputText.trim();
      const words = trimmedText.length === 0 ? 0 : trimmedText.split(/\s+/).filter(Boolean).length;
      const characters = inputText.length;
      const lines = inputText === '' ? 0 : inputText.split(/\r\n|\r|\n/).length;
      let customCount = 0;
      if (inputText && searchString) {
         try {
            // Use regex for more robust counting (handles special chars)
             const regex = new RegExp(searchString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
             customCount = (inputText.match(regex) || []).length;
         } catch (e) {
             console.warn("Invalid regex from search term:", searchString, e);
             customCount = 0; // Fallback if regex is invalid
         }
      }
      return { words, characters, lines, search: searchString, customCount };
    }, [text, search]);


    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
    }, []);

    const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(event.target.value);
    }, []);

    // Updated handleBlurLogging
    const handleBlurLogging = useCallback(() => {
      // Only log if initial state has been established
      if (!initialLoadComplete.current) {
          return;
      }

      const currentText = text;
      const currentSearch = search;
      const textChanged = currentText !== lastLoggedTextRef.current;
      const searchChanged = currentSearch !== lastLoggedSearchRef.current;

      // Log if either text or search term changed since last log
      if (textChanged || searchChanged) {
          const latestCounts = allCounts; // Use the already calculated memoized counts

          addHistoryEntry({
              toolName: toolTitle,
              toolRoute: toolRoute,
              trigger: 'auto', // Triggered by losing focus after potential change
              input: { // Input remains the same structure
                  text: currentText.length > 500 ? currentText.substring(0, 500) + '...' : currentText,
                  search: currentSearch
              },
              // *** Use the counts object directly as output ***
              output: {
                  words: latestCounts.words, // This matches the summaryField in metadata
                  characters: latestCounts.characters,
                  lines: latestCounts.lines,
                  customCount: latestCounts.customCount
              },
              status: 'success', // Assume success as counting itself doesn't fail here
          });

          // Update refs to current state after logging
          lastLoggedTextRef.current = currentText;
          lastLoggedSearchRef.current = currentSearch;
      }
    }, [text, search, allCounts, addHistoryEntry, toolTitle, toolRoute]);


    const handleClearSearch = useCallback(() => {
      const changed = search !== ''; // Check if search was actually cleared
      setSearch('');
      // Log only if the search term was actually cleared
      if (changed && initialLoadComplete.current) {
           handleBlurLogging(); // Trigger logging after state update
      }
    }, [search, handleBlurLogging]); // Include handleBlurLogging dependency

    const handleClearText = useCallback(() => {
       const changed = text !== ''; // Check if text was actually cleared
       setText('');
       // Log only if the text was actually cleared
       if (changed && initialLoadComplete.current) {
            handleBlurLogging(); // Trigger logging after state update
       }
    }, [text, handleBlurLogging]); // Include handleBlurLogging dependency

    return (
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
            <div>
                <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Your Text:
                </label>
                <textarea
                    id="text-input"
                    rows={10}
                    value={text}
                    onChange={handleInputChange}
                    onBlur={handleBlurLogging} // Log when focus leaves the text area
                    placeholder="Paste or type your text here..."
                    aria-label="Text input area"
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-inherit placeholder:text-[rgb(var(--color-input-placeholder))]"
                    spellCheck="false"
                />
            </div>
            <div className='flex flex-wrap items-center gap-4 p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]'>
                <div className="flex-grow grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-xl font-semibold text-[rgb(var(--color-text-base))]">{allCounts.words.toLocaleString()}</p>
                        <p className="text-xs text-[rgb(var(--color-text-muted))]">Words</p>
                    </div>
                    <div>
                        <p className="text-xl font-semibold text-[rgb(var(--color-text-base))]">{allCounts.characters.toLocaleString()}</p>
                        <p className="text-xs text-[rgb(var(--color-text-muted))]">Characters</p>
                    </div>
                    <div>
                        <p className="text-xl font-semibold text-[rgb(var(--color-text-base))]">{allCounts.lines.toLocaleString()}</p>
                        <p className="text-xs text-[rgb(var(--color-text-muted))]">Lines</p>
                    </div>
                </div>
                <div className='flex-shrink-0'>
                    <button
                        type="button"
                        onClick={handleClearText}
                        disabled={!text}
                        title="Clear input text"
                        className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] text-sm font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Clear Text
                    </button>
                </div>
            </div>
            <div className="flex flex-wrap gap-4 items-center justify-between border border-[rgb(var(--color-border-base))] p-4 rounded-md bg-[rgb(var(--color-bg-component))]">
                 <div className="text-center px-4 shrink-0 order-1 sm:order-none">
                    <p className="text-2xl font-bold text-[rgb(var(--color-button-secondary-bg))]">{allCounts.customCount.toLocaleString()}</p>
                    <p className="text-xs text-[rgb(var(--color-button-secondary-bg))] opacity-90" title={allCounts.search ? `Occurrences of "${allCounts.search}"` : 'Occurrences'}>
                        Occurrences
                    </p>
                </div>
                <div className="flex-grow min-w-[200px] order-3 sm:order-none w-full sm:w-auto">
                    <label htmlFor="search-input" className="sr-only">Text to count occurrences of</label>
                    <input
                        type="text"
                        id="search-input"
                        name="search"
                        value={search}
                        onChange={handleSearchChange}
                        onBlur={handleBlurLogging} // Log when focus leaves the search input
                        placeholder="Text to Count Occurrences..."
                        aria-label="Text to count occurrences of"
                        className="w-full px-3 py-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
                    />
                </div>
                <div className="flex items-center shrink-0 order-2 sm:order-none">
                    <button
                        type="button"
                        onClick={handleClearSearch}
                        title="Clear occurrence search text"
                        disabled={!search}
                        className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] text-sm font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Clear Search
                    </button>
                </div>
            </div>
        </div>
    );
}