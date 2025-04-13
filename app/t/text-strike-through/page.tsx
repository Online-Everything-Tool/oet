'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useHistory } from '../../context/HistoryContext';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';

export default function TextStrikeThroughPage() {
  const [inputText, setInputText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [skipSpaces, setSkipSpaces] = useState(false);
  const [strikeColor, setStrikeColor] = useState('#dc2626'); // Default: red-600

  const { addHistoryEntry } = useHistory();

  // Handler for input changes
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(event.target.value);
    setIsCopied(false);
  }, []);

  // Handle Skip Spaces Toggle
  const handleSkipSpacesChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSkipSpaces(event.target.checked);
    setIsCopied(false);
  }, []);

  // Handle Color Change
  const handleColorChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setStrikeColor(event.target.value);
    setIsCopied(false);
  }, []);

  // Handle Clear
  const handleClear = useCallback(() => {
    const hadInput = inputText !== '';
    setInputText('');
    setIsCopied(false);
    if (hadInput) {
       addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/text-strike-through',
          action: 'clear',
          input: '',
          output: 'Input cleared',
          status: 'success'
       });
    }
  }, [inputText, addHistoryEntry]);

  // Handle Copy (copies original text)
  const handleCopy = useCallback(() => {
    if (!inputText || !navigator.clipboard) return;

    navigator.clipboard.writeText(inputText).then(
      () => {
        setIsCopied(true);
        addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/text-strike-through',
          action: 'copy-text',
          input: inputText.length > 500 ? inputText.substring(0, 500) + '...' : inputText,
          output: `[Original text copied, length: ${inputText.length}]`,
          status: 'success',
        });
        setTimeout(() => setIsCopied(false), 1500);
      },
      (err) => {
        console.error('Failed to copy text: ', err);
        addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/text-strike-through',
          action: 'copy-text',
          input: inputText.length > 500 ? inputText.substring(0, 500) + '...' : inputText,
          output: `Error copying: ${err instanceof Error ? err.message : 'Unknown error'}`,
          status: 'error',
        });
      }
    );
  }, [inputText, addHistoryEntry]);

  // --- CORRECTED Memoized Output Rendering Logic ---
  const renderedOutput = useMemo(() => {
    if (!inputText) {
      return <span className="italic text-[rgb(var(--color-input-placeholder))]">Output preview appears here...</span>;
    }

    // Style for the strikethrough characters
    const strikeStyle = {
        textDecoration: 'line-through',
        textDecorationColor: strikeColor,
        // textDecorationThickness: '1px', // Optional: adjust thickness
        // textDecorationSkipInk: 'none', // Optional: try forcing line through descenders
    };

    if (!skipSpaces) {
      // If not skipping spaces, apply style to the whole block
      return <span style={strikeStyle}>{inputText}</span>;
    } else {
      // *** CORRECTED LOGIC FOR SKIP SPACES ***
      // Iterate through each character using spread operator for Unicode safety
      return [...inputText].map((char, index) => {
        if (char.match(/\s/)) {
          // If it's a whitespace character, render it directly
          return <React.Fragment key={index}>{char}</React.Fragment>;
        } else {
          // If it's not whitespace, wrap it in a span with the style
          return (
            <span key={index} style={strikeStyle}>
              {char}
            </span>
          );
        }
      });
    }
  }, [inputText, skipSpaces, strikeColor]);


  // --- JSX Structure ---
  return (
    <div className="flex flex-col gap-6">
      <ToolHeader
        title={metadata.title}
        description={metadata.description}
      />

      {/* Inner content container */}
      <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">

        {/* Grid for Input/Output */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Input Area Column */}
          <div className="space-y-1 h-full flex flex-col">
            <label htmlFor="inputText" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
              Input Text
            </label>
            <textarea
              id="inputText"
              name="inputText"
              rows={8}
              value={inputText}
              onChange={handleInputChange}
              className="block w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base placeholder:text-[rgb(var(--color-input-placeholder))] flex-grow"
              placeholder="Paste or type your text here..."
              aria-label="Input text for strikethrough formatting"
            />
          </div>

          {/* Output Area Column */}
          <div className="space-y-1 h-full flex flex-col">
            <label htmlFor="outputTextDisplay" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
              Strikethrough Output (Visual Preview)
            </label>
            <div
              id="outputTextDisplay"
              aria-live="polite"
              className="block w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm resize-none overflow-auto whitespace-pre-wrap flex-grow" // Keep whitespace-pre-wrap
            >
              {/* Render the memoized output */}
              {renderedOutput}
            </div>
          </div>
        </div>

        {/* Options & Action Buttons Row */}
        <div className="flex flex-wrap gap-4 items-center border border-[rgb(var(--color-border-base))] p-3 rounded-md bg-[rgb(var(--color-bg-subtle))]">
           {/* Options Group */}
           <fieldset className="flex flex-wrap gap-x-4 gap-y-2 items-center">
               <legend className="sr-only">Strikethrough Options</legend>
               {/* Skip Spaces Checkbox */}
               <div className="flex items-center gap-2">
                   <input
                       type="checkbox"
                       id="skip-spaces"
                       checked={skipSpaces}
                       onChange={handleSkipSpacesChange}
                       className="h-4 w-4 rounded border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]"
                       style={{ accentColor: `rgb(var(--color-checkbox-accent))` }}
                   />
                   <label htmlFor="skip-spaces" className="text-sm text-[rgb(var(--color-text-muted))] select-none cursor-pointer">
                       Skip Spaces
                   </label>
               </div>
               {/* Color Picker */}
               <div className="flex items-center gap-2">
                   <label htmlFor="strike-color" className="text-sm text-[rgb(var(--color-text-muted))]">
                       Color:
                   </label>
                   <input
                       type="color"
                       id="strike-color"
                       value={strikeColor}
                       onChange={handleColorChange}
                       className="h-7 w-10 border border-[rgb(var(--color-input-border))] rounded cursor-pointer p-0.5 bg-[rgb(var(--color-input-bg))]"
                       aria-label="Strikethrough color picker"
                    />
               </div>
           </fieldset>

           {/* Action Buttons (Pushed Right) */}
           <div className="flex items-center space-x-3 ml-auto">
                {/* Copy Button (Accent2 - Orange) */}
                <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!inputText}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none transition-colors duration-150 ease-in-out
                        ${isCopied
                          ? 'bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] text-[rgb(var(--color-button-secondary-text))]' // Green when copied
                          : 'bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] text-[rgb(var(--color-button-accent2-text))]' // Orange normally
                        }
                        disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]`}
                >
                    {isCopied ? 'Copied!' : 'Copy Text'}
                </button>
                {/* Clear Button (Neutral) */}
                <button
                    type="button"
                    onClick={handleClear}
                    disabled={!inputText}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Clear
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}