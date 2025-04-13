'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useHistory } from '../../context/HistoryContext'; // Re-enabled import
import ToolHeader from '../_components/ToolHeader'; // Import ToolHeader
import metadata from './metadata.json'; // Import local metadata

// Interface for all counts, calculated dynamically
interface TextCounts {
  words: number;
  characters: number;
  lines: number;
  customString: string;
  customCount: number;
}

export default function TextCounterPage() {
  // --- State ---
  const [text, setText] = useState<string>('');
  const [customStringToCount, setCustomStringToCount] = useState<string>('');

  // --- History Hook ---
  const { addHistoryEntry } = useHistory(); // Re-enabled

  // --- Dynamic Calculation using useMemo ---
  const allCounts = useMemo((): TextCounts => {
    const inputText = text;
    const customString = customStringToCount;
    const trimmedText = inputText.trim();
    const words = trimmedText.length === 0 ? 0 : trimmedText.split(/\s+/).filter(Boolean).length;
    const characters = inputText.length;
    const lines = inputText === '' ? 0 : inputText.split(/\r\n|\r|\n/).length;
    let customCount = 0;
    // Only count if both text and string exist
    if (inputText && customString) {
        // Basic split count - handles overlaps correctly for simple cases
        // For more complex regex/overlapping needs, a different approach might be needed
       customCount = inputText.split(customString).length - 1;
    }
    return { words, characters, lines, customString: customString, customCount };
  }, [text, customStringToCount]);

  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    // Note: No history logging on every keystroke - too noisy.
  };

  const handleCustomStringChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newCustomString = event.target.value;
    setCustomStringToCount(newCustomString);

    // Log when the custom string changes *to* a non-empty value
    if (newCustomString) {
        // Calculate count based on current text and *new* custom string for the log
        const currentText = text;
        const countForLog = currentText ? currentText.split(newCustomString).length - 1 : 0;
        addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/text-counter',
          action: 'count-custom-string',
          input: { textLength: currentText.length, searchString: newCustomString },
          output: { count: countForLog },
          status: 'success',
        });
    }
  };

  const handleClearCustomString = () => {
    const oldString = customStringToCount;
    setCustomStringToCount('');
    // Log clearing the custom string if it wasn't already empty
    if (oldString) {
        addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/text-counter',
          action: 'clear-custom-string',
          input: { previousString: oldString },
          output: 'Custom string cleared',
          status: 'success',
        });
    }
  };

  const handleClearText = () => {
     const oldText = text;
     setText('');
     // Log clearing the main text if it wasn't already empty
     if (oldText) {
        addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/text-counter',
          action: 'clear-text',
          input: { previousLength: oldText.length },
          output: 'Text cleared',
          status: 'success',
        });
     }
  };

  // --- JSX ---
  return (
    // Main container relies on parent layout for padding, uses flex-col and gap
    <div className="flex flex-col gap-6">
        <ToolHeader
            title={metadata.title}
            description={metadata.description}
        />

        {/* Inner content container */}
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">

            {/* Input Area */}
            <div>
                {/* Added explicit label */}
                <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Your Text:
                </label>
                <textarea
                    id="text-input"
                    rows={10}
                    value={text}
                    onChange={handleInputChange}
                    placeholder="Paste or type your text here..."
                    aria-label="Text input area"
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-inherit placeholder:text-[rgb(var(--color-input-placeholder))]"
                    spellCheck="false"
                />
            </div>

            {/* Base Counts Display & Clear Button */}
            <div className='flex flex-wrap items-center gap-4 p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]'>
                {/* Counts Grid */}
                <div className="flex-grow grid grid-cols-3 gap-4 text-center">
                    {/* Words */}
                    <div>
                        <p className="text-xl font-semibold text-[rgb(var(--color-text-base))]">{allCounts.words.toLocaleString()}</p>
                        <p className="text-xs text-[rgb(var(--color-text-muted))]">Words</p>
                    </div>
                    {/* Characters */}
                    <div>
                        <p className="text-xl font-semibold text-[rgb(var(--color-text-base))]">{allCounts.characters.toLocaleString()}</p>
                        <p className="text-xs text-[rgb(var(--color-text-muted))]">Characters</p>
                    </div>
                    {/* Lines */}
                    <div>
                        <p className="text-xl font-semibold text-[rgb(var(--color-text-base))]">{allCounts.lines.toLocaleString()}</p>
                        <p className="text-xs text-[rgb(var(--color-text-muted))]">Lines</p>
                    </div>
                </div>
                {/* Clear Text Button (Neutral) */}
                <div className='flex-shrink-0'>
                    <button
                        type="button"
                        onClick={handleClearText}
                        title="Clear input text"
                        className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] text-sm font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out"
                    >
                        Clear Text
                    </button>
                </div>
            </div>

            {/* Custom Count Section */}
            <div className="flex flex-wrap gap-4 items-center justify-between border border-[rgb(var(--color-border-base))] p-4 rounded-md bg-[rgb(var(--color-bg-component))]">
                 {/* Occurrence Count Display */}
                 <div className="text-center px-4 shrink-0 order-1 sm:order-none"> {/* Order for mobile */}
                    <p className="text-2xl font-bold text-[rgb(var(--color-button-secondary-bg))]">{allCounts.customCount.toLocaleString()}</p>
                    <p className="text-xs text-[rgb(var(--color-button-secondary-bg))] opacity-90" title={allCounts.customString ? `Occurrences of "${allCounts.customString}"` : 'Occurrences'}>
                        Occurrences
                    </p>
                </div>

                {/* Custom String Input */}
                <div className="flex-grow min-w-[200px] order-3 sm:order-none w-full sm:w-auto"> {/* Take full width on small screens */}
                    <label htmlFor="custom-string-input" className="sr-only">Text to count occurrences of</label>
                    <input
                        type="text"
                        id="custom-string-input"
                        value={customStringToCount}
                        onChange={handleCustomStringChange}
                        placeholder="Text to Count Occurrences..."
                        aria-label="Text to count occurrences of"
                        className="w-full px-3 py-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
                    />
                </div>

                {/* Clear Custom String Button (Neutral) */}
                <div className="flex items-center shrink-0 order-2 sm:order-none">
                    <button
                        type="button"
                        onClick={handleClearCustomString}
                        title="Clear occurrence search text"
                        disabled={!customStringToCount} // Disable if already empty
                        className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] text-sm font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Clear Search
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}