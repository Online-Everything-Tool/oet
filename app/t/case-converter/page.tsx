'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useHistory } from '../../context/HistoryContext';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';

// Constants for case conversion
const SENTENCE_CASE_REGEX = /(^\s*\w|[.!?]\s*\w)/g;
const TITLE_CASE_DELIMITERS = /[\s\-_]+/; // Split words for Title Case

// List of available cases for the UI
const CASE_TYPES = [
  { value: 'uppercase', label: 'UPPER CASE' },
  { value: 'lowercase', label: 'lower case' },
  { value: 'sentence', label: 'Sentence case' },
  { value: 'title', label: 'Title Case' },
  { value: 'camel', label: 'camelCase' },
  { value: 'pascal', label: 'PascalCase' },
  { value: 'snake', label: 'snake_case' },
  { value: 'kebab', label: 'kebab-case' },
];

export default function CaseConverterPage() {
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [caseType, setCaseType] = useState<string>('lowercase'); // Default case
  const [splitSeparator, setSplitSeparator] = useState<string>('\\s+'); // Default: whitespace regex
  const [joinSeparator, setJoinSeparator] = useState<string>(' '); // Default: single space
  const [error, setError] = useState<string>('');

  const { addHistoryEntry } = useHistory();

  // --- Memoize the Split Regex ---
  const splitRegex = useMemo(() => {
    if (!splitSeparator) return /\s+/; // Default to whitespace if empty
    try {
      // User provides the regex pattern directly
      return new RegExp(splitSeparator, 'g');
    } catch (e) {
      console.error("Invalid split separator regex:", e);
      setError(`Invalid Split Separator Regex: ${e instanceof Error ? e.message : 'Unknown regex error'}`);
      return null; // Indicate error by returning null
    }
  }, [splitSeparator]);


  // --- Case Conversion Logic ---
  const handleConvertCase = useCallback(() => {
    const text = inputValue;
    let result = '';
    let currentError = '';
    let status: 'success' | 'error' = 'success';
    setError(''); // Clear previous errors

    if (!text) {
      setOutputValue('');
      return; // Don't process empty input
    }

    try {
        switch (caseType) {
          case 'uppercase':
            result = text.toUpperCase();
            break;
          case 'lowercase':
            result = text.toLowerCase();
            break;
          case 'sentence':
            result = text.toLowerCase().replace(SENTENCE_CASE_REGEX, (char) => char.toUpperCase());
            break;
          case 'title':
            result = text.toLowerCase().split(TITLE_CASE_DELIMITERS).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            break;
          case 'camel':
            result = text.toLowerCase()
                .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
                .replace(/^./, (char) => char.toLowerCase()); // Ensure first char is lower
            break;
          case 'pascal':
             result = text.toLowerCase()
                 .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
                 .replace(/^./, (char) => char.toUpperCase()); // Ensure first char is upper
             break;
          case 'snake':
            result = text.replace(/\W+/g, " ") // Replace non-alphanumeric with space
               .split(/ |\B(?=[A-Z])/) // Split by space or before uppercase
               .map(word => word.toLowerCase())
               .filter(Boolean)
               .join('_');
            break;
          case 'kebab':
             result = text.replace(/\W+/g, " ")
                .split(/ |\B(?=[A-Z])/)
                .map(word => word.toLowerCase())
                .filter(Boolean)
                .join('-');
             break;
          default:
            throw new Error(`Unsupported case type: ${caseType}`);
        }
        setOutputValue(result);
    } catch (err) {
        console.error("Case conversion error:", err);
        currentError = err instanceof Error ? err.message : "Failed to convert case.";
        setError(currentError);
        setOutputValue('');
        status = 'error';
    }

    addHistoryEntry({
        toolName: metadata.title,
        toolRoute: '/t/case-converter',
        action: `convert-${caseType}`,
        input: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
        output: status === 'success' ? (result.substring(0, 500) + (result.length > 500 ? '...' : '')) : `Error: ${currentError}`,
        status: status,
        options: { caseType: caseType }
    });

  }, [inputValue, caseType, addHistoryEntry]);

  // --- Split & Join Logic ---
  const handleConvertSplitJoin = useCallback(() => {
    const text = inputValue;
    let result = '';
    let currentError = '';
    let status: 'success' | 'error' = 'success';
    setError(''); // Clear previous errors

    if (!text) {
      setOutputValue('');
      return; // Don't process empty input
    }
    if (!splitRegex) {
        // Error is already set by useMemo in this case
        setOutputValue('');
        return;
    }

    try {
        const parts = text.split(splitRegex).filter(Boolean); // Use the memoized regex
        result = parts.join(joinSeparator);
        setOutputValue(result);
    } catch(err) {
        console.error("Split/Join error:", err);
        currentError = err instanceof Error ? err.message : "Failed to split or join text.";
        setError(currentError);
        setOutputValue('');
        status = 'error';
    }

    addHistoryEntry({
        toolName: metadata.title,
        toolRoute: '/t/case-converter',
        action: 'split-join',
        input: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
        output: status === 'success' ? (result.substring(0, 500) + (result.length > 500 ? '...' : '')) : `Error: ${currentError}`,
        status: status,
        options: { splitBy: splitSeparator, joinWith: joinSeparator }
    });

  }, [inputValue, addHistoryEntry, splitRegex, joinSeparator, splitSeparator]); // Added splitRegex, joinSeparator, splitSeparator dependencies

  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    setOutputValue(''); // Clear output on input change
    setError('');
  };

  const handleClear = () => {
    const hadInput = inputValue !== '';
    setInputValue('');
    setOutputValue('');
    setError('');
    // Reset options maybe? Keep them for now.
    // setCaseType('lowercase');
    // setSplitSeparator('\\s+');
    // setJoinSeparator(' ');
    if (hadInput) {
       addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/case-converter',
          action: 'clear',
          input: '', output: 'Input cleared', status: 'success'
       });
    }
  };

  const handleCaseTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setCaseType(event.target.value);
    // Optionally auto-convert on change? Let's require button click.
    setOutputValue('');
    setError('');
  };

  const handleSplitSeparatorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
     setSplitSeparator(event.target.value);
     setOutputValue('');
     setError(''); // Clear potential regex error
  };

  const handleJoinSeparatorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
     setJoinSeparator(event.target.value);
     setOutputValue('');
     setError('');
  };

  // --- JSX ---
  return (
    <div className="flex flex-col gap-6">
        <ToolHeader
            title={metadata.title}
            description={metadata.description}
        />

        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">

            {/* Input Area */}
            <div>
                <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Input Text:</label>
                <textarea
                    id="text-input" rows={6} value={inputValue} onChange={handleInputChange}
                    placeholder="Paste or type your text here..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
                    spellCheck="false"
                />
            </div>

            {/* Case Conversion Controls */}
            <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-3">
                <h3 className="text-md font-semibold text-[rgb(var(--color-text-base))]">Convert Case</h3>
                <div className="flex flex-wrap gap-3 items-center">
                    <label htmlFor="case-type-select" className="text-sm font-medium text-[rgb(var(--color-text-muted))]">Target Case:</label>
                    <select
                        id="case-type-select" value={caseType} onChange={handleCaseTypeChange}
                        className="flex-grow sm:flex-grow-0 rounded-md border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm py-1.5 px-2"
                    >
                        {CASE_TYPES.map(ct => (
                            <option key={ct.value} value={ct.value}>{ct.label}</option>
                        ))}
                    </select>
                    <button
                        type="button" onClick={handleConvertCase} disabled={!inputValue}
                        className="px-4 py-2 rounded-md text-[rgb(var(--color-button-accent-text))] font-medium bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
                    >
                        Convert Case
                    </button>
                </div>
            </div>

             {/* Split/Join Controls */}
            <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-3">
                <h3 className="text-md font-semibold text-[rgb(var(--color-text-base))]">Split & Join</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    {/* Split Separator */}
                    <div>
                        <label htmlFor="split-separator" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Split By (Regex):</label>
                        <input
                            type="text" id="split-separator" value={splitSeparator} onChange={handleSplitSeparatorChange}
                            placeholder="\s+" title="Enter a valid JavaScript Regex pattern (e.g., \s+, ,, -)"
                            className={`w-full px-3 py-2 border ${!splitRegex ? 'border-red-500' : 'border-[rgb(var(--color-input-border))]'} bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm font-mono placeholder:text-[rgb(var(--color-input-placeholder))]`}
                            spellCheck="false"
                        />
                    </div>
                     {/* Join Separator */}
                     <div>
                        <label htmlFor="join-separator" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Join With:</label>
                        <input
                            type="text" id="join-separator" value={joinSeparator} onChange={handleJoinSeparatorChange}
                            placeholder=" (space)" title="Enter the string to join parts with"
                            className="w-full px-3 py-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                        />
                     </div>
                 </div>
                 {/* Split/Join Button */}
                 <div className="flex justify-start">
                     <button
                         type="button" onClick={handleConvertSplitJoin} disabled={!inputValue || !splitRegex}
                         className="px-4 py-2 rounded-md text-[rgb(var(--color-button-accent2-text))] font-medium bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
                     >
                         Split & Join
                     </button>
                 </div>
            </div>


            {/* Error Display */}
            {error && (
                <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    <div><strong className="font-semibold">Error:</strong> {error}</div>
                </div>
            )}

            {/* Output Area */}
            <div>
                <div className="flex justify-between items-center mb-1">
                   <label htmlFor="text-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">Output:</label>
                   {/* Top Clear Button */}
                   <button
                       type="button" onClick={handleClear} title="Clear input and output"
                       className="text-xs text-[rgb(var(--color-button-danger-text))] hover:underline focus:outline-none"
                   > Clear All </button>
                </div>
                <textarea
                    id="text-output" rows={6} value={outputValue} readOnly
                    placeholder="Result appears here..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
                    aria-live="polite" spellCheck="false"
                />
            </div>
        </div>
    </div>
  );
}