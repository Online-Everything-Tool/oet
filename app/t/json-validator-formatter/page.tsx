'use client';

import React, { useState, useCallback } from 'react';
import { useHistory } from '../../context/HistoryContext';
import ToolHeader from '../_components/ToolHeader'; // Import ToolHeader
import metadata from './metadata.json'; // Import local metadata

export default function JsonValidatorFormatterPage() {
  // --- State ---
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  const [indentation, setIndentation] = useState<number>(2);

  // --- History Hook ---
  const { addHistoryEntry } = useHistory();

  // --- Core Function ---
  const handleFormatValidate = useCallback(() => {
    let currentIsValid: boolean | null = null;
    let currentError = '';
    let currentOutput = '';
    let status: 'success' | 'error' = 'success';

    const trimmedInput = inputValue.trim();

    if (!trimmedInput) {
      currentError = "Input is empty.";
      currentIsValid = false;
      status = 'error';
      setError(currentError);
      setIsValid(currentIsValid);
      setOutputValue('');
      addHistoryEntry({
         toolName: metadata.title, // Use metadata title
         toolRoute: '/t/json-validator-formatter', // Ensure route matches folder structure if needed
         action: 'format-validate',
         input: '',
         output: `Error: ${currentError}`,
         status: status,
         options: { indentation: indentation }
      });
      return;
    }

    try {
      const parsedJson = JSON.parse(trimmedInput);
      // Handle non-object/array inputs which are valid JSON but might not be what users expect to format
      if (typeof parsedJson !== 'object' || parsedJson === null) {
           currentOutput = JSON.stringify(parsedJson); // No indentation for primitives/null
           currentIsValid = true;
           currentError = ''; // Valid, but not formatted with indentation
      } else {
           currentOutput = JSON.stringify(parsedJson, null, indentation);
           currentIsValid = true;
           currentError = '';
      }

      setOutputValue(currentOutput);
      setIsValid(currentIsValid);
      setError(currentError);
      status = 'success';

      addHistoryEntry({
        toolName: metadata.title, // Use metadata title
        toolRoute: '/t/json-validator-formatter',
        action: 'format-validate',
        input: trimmedInput.length > 1000 ? trimmedInput.substring(0, 1000) + '...' : trimmedInput,
        output: currentOutput.length > 1000 ? currentOutput.substring(0, 1000) + '...' : currentOutput,
        status: status,
        options: { indentation: indentation },
      });

    } catch (err) {
      console.error("JSON Processing Error:", err);
      if (err instanceof Error) {
        currentError = `Invalid JSON: ${err.message}`;
      } else {
        currentError = "Invalid JSON: An unknown error occurred during parsing.";
      }
      currentOutput = ''; // Clear output on error
      currentIsValid = false;
      setOutputValue(currentOutput);
      setIsValid(currentIsValid);
      setError(currentError);
      status = 'error';

      addHistoryEntry({
        toolName: metadata.title, // Use metadata title
        toolRoute: '/t/json-validator-formatter',
        action: 'format-validate',
        input: trimmedInput.length > 1000 ? trimmedInput.substring(0, 1000) + '...' : trimmedInput,
        output: `Error: ${currentError}`,
        status: status,
        options: { indentation: indentation },
      });
    }
  }, [inputValue, indentation, addHistoryEntry]);

  // --- Event Handlers ---

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    // Reset validation status on input change
    setIsValid(null);
    setError('');
    setOutputValue(''); // Clear output when input changes
  };

  const handleClear = () => {
    setInputValue('');
    setOutputValue('');
    setIsValid(null);
    setError('');
  };

  const handleIndentationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newIndentation = parseInt(event.target.value, 10);
    setIndentation(newIndentation);
    // Attempt to reformat immediately if current input was valid JSON
    if (isValid && inputValue.trim()) {
       try {
         const parsed = JSON.parse(inputValue.trim());
         // Only format objects/arrays with indentation
         if (typeof parsed === 'object' && parsed !== null) {
            const formatted = JSON.stringify(parsed, null, newIndentation);
            setOutputValue(formatted);
         } else {
            // If it was valid but primitive/null, keep the unindented stringified version
            setOutputValue(JSON.stringify(parsed));
         }
         setError(''); // Clear any previous format error
       } catch (err) {
          // Should not happen if isValid was true, but handle defensively
          console.error("Error reformatting on indent change:", err);
          setError("Error reformatting with new indentation.");
          setIsValid(false); // Mark as invalid if reformatting fails unexpectedly
       }
    } else if (!isValid && inputValue.trim()) {
        // If input exists but wasn't valid, clear the output as indentation change won't fix it
        setOutputValue('');
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
                <label htmlFor="json-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Input JSON:</label>
                <textarea
                    id="json-input"
                    rows={8} // Increased rows for better initial view
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder={`Paste your JSON here...\n{\n  "example": "data",\n  "isValid": true\n}`}
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-sm font-mono placeholder:text-[rgb(var(--color-input-placeholder))]" // Text-sm for more content view
                    spellCheck="false"
                    aria-invalid={isValid === false}
                    aria-describedby={isValid === false ? "json-error-feedback" : undefined}
                />
            </div>

            {/* Action Controls */}
            <div className="flex flex-wrap gap-3 items-center">
                 {/* Validate Button (Accent - Purple) */}
                 <button
                     type="button"
                     onClick={handleFormatValidate}
                     className="px-5 py-2 rounded-md text-[rgb(var(--color-button-accent-text))] font-medium bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out"
                 >
                    Validate & Format
                 </button>

                 {/* Indentation Select */}
                 <div className="flex items-center gap-2">
                    <label htmlFor="indentation-select" className="text-sm font-medium text-[rgb(var(--color-text-muted))]">Indentation:</label>
                    <select
                        id="indentation-select"
                        value={indentation}
                        onChange={handleIndentationChange}
                        className="rounded-md border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm py-1.5 px-2" // Added padding
                    >
                       <option value={2}>2 Spaces</option>
                       <option value={4}>4 Spaces</option>
                       <option value={0}>Compact</option>
                    </select>
                 </div>

                 {/* Clear Button (Neutral) */}
                 <button
                    type="button"
                    onClick={handleClear}
                    title="Clear input and output"
                    className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ml-auto" // ml-auto pushes to the right
                 >
                    Clear
                 </button>
            </div>

            {/* Status/Error Display */}
            {isValid !== null && (
                <div
                    id="json-error-feedback" // ID for aria-describedby
                    className={`p-3 border rounded-md text-sm flex items-start sm:items-center gap-2 ${isValid ? 'bg-green-100 border-green-300 text-green-800' : 'bg-[rgb(var(--color-bg-error-subtle))] border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))]'}`} role="alert">
                    {isValid ? (
                        <>
                            {/* Success Icon (Heroicon check-circle) */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <strong>Valid JSON</strong>
                        </>
                    ) : (
                        <>
                            {/* Error Icon (Heroicon x-circle) */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                               <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {/* Wrap error text for better layout */}
                            <div>
                                <strong className="font-semibold">Error:</strong> {error}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Output Area */}
            <div>
               <label htmlFor="json-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Output:</label>
               <textarea
                  id="json-output"
                  rows={10} // Increased rows for better initial view
                  value={outputValue}
                  readOnly
                  placeholder="Formatted JSON will appear here..."
                  className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-sm font-mono placeholder:text-[rgb(var(--color-input-placeholder))]" // Text-sm, subtle bg
                  spellCheck="false"
                  aria-live="polite" // Announce changes
               />
            </div>
        </div> {/* End inner flex container */}
    </div> // End main container
  );
}