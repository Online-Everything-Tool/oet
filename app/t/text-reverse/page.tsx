'use client';

import React, { useState, useCallback } from 'react';
import { useHistory } from '../../context/HistoryContext';
import ToolHeader from '../_components/ToolHeader'; // Import ToolHeader
import metadata from './metadata.json'; // Import local metadata

// Define the different modes for reversing
type ReverseMode = 'characters' | 'words' | 'lines';

export default function TextReversePage() {
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [reverseMode, setReverseMode] = useState<ReverseMode>('characters'); // Default mode
  const [error, setError] = useState<string>(''); // State for potential errors

  // Get the history function
  const { addHistoryEntry } = useHistory();

  // --- Core Reversing Logic ---
  const handleReverse = useCallback(() => {
    let result = '';
    const text = inputValue;
    let status: 'success' | 'error' = 'success';
    let currentError = '';
    setError(''); // Clear previous errors

    try {
      if (!text) {
        setOutputValue(''); // Clear output if input is empty
        // Optionally log clear/empty action if desired, but maybe not needed
        return; // Exit early if input is empty
      }

      switch (reverseMode) {
        case 'characters':
          // Correctly reverse characters, handling Unicode graphemes
          result = [...text].reverse().join('');
          break;
        case 'words':
          // Simple reverse: split by whitespace, filter empty strings, reverse, join with single space
          result = text.split(/\s+/).filter(Boolean).reverse().join(' ');
          break;
        case 'lines':
          // Split by newline variations, reverse array, join with standard newline
          result = text.split(/\r\n|\r|\n/).reverse().join('\n');
          break;
        default:
           // This case should theoretically not be reachable with TypeScript
           throw new Error('Invalid reverse mode selected.');
      }

      setOutputValue(result);
      status = 'success';

      // --- Add to History ---
      addHistoryEntry({
        toolName: metadata.title, // Use metadata title
        toolRoute: '/t/text-reverse', // Use correct route
        action: `reverse-${reverseMode}`, // e.g., "reverse-characters"
        input: text.length > 500 ? text.substring(0, 500) + '...' : text,
        output: result.length > 500 ? result.substring(0, 500) + '...' : result,
        status: status,
        options: { mode: reverseMode }, // Include mode in options
      });

    } catch (err) {
      console.error("Error during reversing:", err);
      currentError = err instanceof Error ? err.message : "An unknown error occurred during reversing.";
      setOutputValue(''); // Clear output on error
      setError(currentError); // Set error state for display
      status = 'error';

      // Log errors to history
      addHistoryEntry({
        toolName: metadata.title, // Use metadata title
        toolRoute: '/t/text-reverse', // Use correct route
        action: `reverse-${reverseMode}`,
        input: text.length > 500 ? text.substring(0, 500) + '...' : text,
        output: `Error: ${currentError}`,
        status: status,
        options: { mode: reverseMode },
      });
    }
  }, [inputValue, reverseMode, addHistoryEntry]);

  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    setOutputValue(''); // Clear output on input change
    setError(''); // Clear error on input change
  };

  const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setReverseMode(event.target.value as ReverseMode);
    // Automatically reverse when mode changes if there's input text
    if (inputValue) {
        // Trigger reverse calculation but use the new mode value directly
        // This avoids waiting for the state update if handleReverse relies on state
        handleReverse(); // handleReverse will use the latest state internally via closure or re-run
    } else {
        setOutputValue(''); // Clear output if input is empty
    }
    setError(''); // Clear error when mode changes
  };

  const handleClear = () => {
    const hadInput = inputValue !== '';
    setInputValue('');
    setOutputValue('');
    setError('');
    if (hadInput) {
       // Log clear action only if there was text before
       addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/text-reverse',
          action: 'clear',
          input: '',
          output: 'Input cleared',
          status: 'success',
       });
    }
  };

  // --- JSX Structure ---
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
                <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Input Text:
                </label>
                <textarea
                    id="text-input"
                    rows={8} // Reduced rows slightly
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder="Enter text to reverse..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-inherit placeholder:text-[rgb(var(--color-input-placeholder))]"
                    spellCheck="false"
                    aria-label="Text to be reversed"
                />
            </div>

            {/* Controls Row */}
            <div className="flex flex-wrap gap-4 items-center border border-[rgb(var(--color-border-base))] p-3 rounded-md bg-[rgb(var(--color-bg-subtle))]">
                {/* Mode Selection Radio Buttons */}
                <fieldset className="flex gap-x-4 gap-y-2 items-center flex-wrap">
                    <legend className="text-sm font-medium text-[rgb(var(--color-text-muted))] mr-2 shrink-0">Reverse by:</legend>
                    {/* Characters */}
                    <div className="flex items-center">
                        <input
                            type="radio"
                            id="mode-chars"
                            name="reverseMode"
                            value="characters"
                            checked={reverseMode === 'characters'}
                            onChange={handleModeChange}
                            className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]"
                            style={{ accentColor: `rgb(var(--color-checkbox-accent))` }}
                        />
                        <label htmlFor="mode-chars" className="ml-2 block text-sm text-[rgb(var(--color-text-base))] cursor-pointer">
                            Characters
                        </label>
                    </div>
                    {/* Words */}
                    <div className="flex items-center">
                        <input
                            type="radio"
                            id="mode-words"
                            name="reverseMode"
                            value="words"
                            checked={reverseMode === 'words'}
                            onChange={handleModeChange}
                            className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]"
                            style={{ accentColor: `rgb(var(--color-checkbox-accent))` }}
                        />
                        <label htmlFor="mode-words" className="ml-2 block text-sm text-[rgb(var(--color-text-base))] cursor-pointer">
                            Words
                        </label>
                    </div>
                    {/* Lines */}
                    <div className="flex items-center">
                        <input
                            type="radio"
                            id="mode-lines"
                            name="reverseMode"
                            value="lines"
                            checked={reverseMode === 'lines'}
                            onChange={handleModeChange}
                            className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]"
                            style={{ accentColor: `rgb(var(--color-checkbox-accent))` }}
                        />
                        <label htmlFor="mode-lines" className="ml-2 block text-sm text-[rgb(var(--color-text-base))] cursor-pointer">
                            Lines
                        </label>
                    </div>
                </fieldset>

                {/* Action Buttons (pushed to the right) */}
                <div className="flex gap-3 ml-auto">
                    {/* Reverse Button (Accent - Purple) */}
                    <button
                        type="button"
                        onClick={handleReverse}
                        disabled={!inputValue} // Disable if no input
                        className="px-5 py-2 rounded-md text-[rgb(var(--color-button-accent-text))] font-medium bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
                    >
                        Reverse
                    </button>
                    {/* Clear Button (Neutral) */}
                    <button
                        type="button"
                        onClick={handleClear}
                        title="Clear input and output"
                        className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out"
                    >
                        Clear
                    </button>
                </div>
            </div>

             {/* Error Display Area */}
             {error && (
                <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                     </svg>
                    <strong>Error:</strong> {error}
                </div>
             )}

            {/* Output Area - Conditionally Rendered */}
            {(outputValue || (!error && inputValue && !outputValue)) && ( // Show if output exists, or if input exists without error/output yet
                 <div>
                     <label htmlFor="text-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                         Output Text:
                     </label>
                     <textarea
                         id="text-output"
                         rows={8} // Reduced rows slightly
                         value={outputValue}
                         readOnly
                         placeholder="Reversed text will appear here..."
                         className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-inherit placeholder:text-[rgb(var(--color-input-placeholder))]"
                         aria-live="polite"
                         aria-label="Reversed text output"
                     />
                 </div>
            )}
        </div>
    </div>
  );
}