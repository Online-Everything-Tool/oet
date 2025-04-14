// /app/t/case-converter/page.tsx
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useHistory } from '../../context/HistoryContext';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';
// Import hook and type
import useToolUrlState, { ParamConfig } from '../_hooks/useToolUrlState';

// Constants for case conversion
const SENTENCE_CASE_REGEX = /(^\s*\w|[.!?]\s*\w)/g;
const TITLE_CASE_DELIMITERS = /[\s\-_]+/;

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

// Define CaseType for state clarity
type CaseType = 'uppercase' | 'lowercase' | 'sentence' | 'title' | 'camel' | 'pascal' | 'snake' | 'kebab';


export default function CaseConverterPage() {
  // --- State ---
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [caseType, setCaseType] = useState<CaseType>('lowercase'); // Default case
  const [error, setError] = useState<string>('');
  const { addHistoryEntry } = useHistory();

  // --- Memoize State Setters ---
  const stateSetters = useMemo(() => ({
    inputValue: setInputValue,
    caseType: setCaseType,
  }), []);

  // --- Use URL State Hook ---
  // --- Now we need shouldRunOnLoad again ---
  const { shouldRunOnLoad, setShouldRunOnLoad } = useToolUrlState(
      (metadata.urlStateParams || []) as ParamConfig[],
      stateSetters
  );

  // --- Case Conversion Logic ---
  // Add inputValue and caseType to dependency array
  const handleConvertCase = useCallback(() => {
    const text = inputValue; // Use current state
    console.log(`Running handleConvertCase with type: ${caseType} for text: ${text.substring(0,20)}...`);
    let result = '';
    let currentError = '';
    let status: 'success' | 'error' = 'success';
    setError('');
    setOutputValue(''); // Clear previous output

    if (!text) return;

    try {
        switch (caseType) { // Use current state
          case 'uppercase': result = text.toUpperCase(); break;
          case 'lowercase': result = text.toLowerCase(); break;
          case 'sentence': result = text.toLowerCase().replace(SENTENCE_CASE_REGEX, (char) => char.toUpperCase()); break;
          case 'title': result = text.toLowerCase().split(TITLE_CASE_DELIMITERS).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); break;
          case 'camel': result = text.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^./, (char) => char.toLowerCase()); break;
          case 'pascal': result = text.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^./, (char) => char.toUpperCase()); break;
          case 'snake': result = text.replace(/\W+/g, " ").split(/ |\B(?=[A-Z])/).map(word => word.toLowerCase()).filter(Boolean).join('_'); break;
          case 'kebab': result = text.replace(/\W+/g, " ").split(/ |\B(?=[A-Z])/).map(word => word.toLowerCase()).filter(Boolean).join('-'); break;
          default: throw new Error(`Unsupported case type: ${caseType}`);
        }
        setOutputValue(result);
    } catch (err) {
        console.error("Case conversion error:", err);
        currentError = err instanceof Error ? err.message : "Failed to convert case.";
        setError(currentError);
        status = 'error';
    }

    // Log history only if calculation was attempted (input wasn't empty)
    addHistoryEntry({
        toolName: metadata.title,
        toolRoute: '/t/case-converter',
        action: `convert-${caseType}`,
        input: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
        output: status === 'success' ? (result.substring(0, 500) + (result.length > 500 ? '...' : '')) : `Error: ${currentError}`,
        status: status,
        options: { caseType: caseType }
    });

  }, [inputValue, caseType, addHistoryEntry]); // Depends on input and selected case

  // --- ADD BACK: Effect to run calculation after state is set from URL ---
  useEffect(() => {
    if (shouldRunOnLoad) {
        console.log("[CaseConverterPage] Running calculation triggered by URL state hook.");
        handleConvertCase(); // Call the main conversion function
        setShouldRunOnLoad(false); // Reset the flag
    }
    // Depend on the flag, the state values used in the calculation, and the calculation function itself
  }, [shouldRunOnLoad, setShouldRunOnLoad, inputValue, caseType, handleConvertCase]);


  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    setOutputValue('');
    setError('');
  };

  const handleClear = () => {
    const hadInput = inputValue !== '';
    setInputValue(''); setOutputValue(''); setError('');
    setCaseType('lowercase');
    if (hadInput) {
       addHistoryEntry({
          toolName: metadata.title, toolRoute: '/t/case-converter', action: 'clear',
          input: '', output: 'Input cleared', status: 'success'
       });
    }
  };

  const handleCaseTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setCaseType(event.target.value as CaseType);
    setOutputValue('');
    setError('');
    // Do NOT auto-convert here
  };


  // --- JSX ---
  return (
    <div className="flex flex-col gap-6">
        <ToolHeader title={metadata.title} description={metadata.description} />
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
            {/* Input Area */}
            <div>
                <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Input Text:</label>
                <textarea id="text-input" rows={8} value={inputValue} onChange={handleInputChange} placeholder="Paste or type your text here..." className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base placeholder:text-[rgb(var(--color-input-placeholder))]" spellCheck="false" />
            </div>
            {/* Case Conversion Controls */}
            <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-3 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <label htmlFor="case-type-select" className="text-sm font-medium text-[rgb(var(--color-text-muted))] shrink-0">Target Case:</label>
                        <select id="case-type-select" value={caseType} onChange={handleCaseTypeChange} className="rounded-md border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm py-1.5 px-2">
                            {CASE_TYPES.map(ct => (<option key={ct.value} value={ct.value}>{ct.label}</option>))}
                        </select>
                    </div>
                     <div className="flex gap-3">
                        <button type="button" onClick={handleConvertCase} disabled={!inputValue} className="px-4 py-2 rounded-md text-[rgb(var(--color-button-accent-text))] font-medium bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"> Convert Case </button>
                         <button type="button" onClick={handleClear} title="Clear input and output" className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out"> Clear </button>
                     </div>
                </div>
            </div>
            {/* Error Display */}
            {error && ( <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"> <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg> <div><strong className="font-semibold">Error:</strong> {error}</div> </div> )}
            {/* Output Area */}
            <div>
                <label htmlFor="text-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Output:</label>
                <textarea id="text-output" rows={8} value={outputValue} readOnly placeholder="Result appears here..." className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base placeholder:text-[rgb(var(--color-input-placeholder))]" aria-live="polite" spellCheck="false" />
            </div>
        </div>
    </div>
  );
}