// /app/json-formatter-validator/page.tsx
'use client';

import React, { useState, useCallback } from 'react'; // Added useCallback for consistency
import { useHistory } from '../context/HistoryContext'; // 1. Import useHistory

export default function JsonFormatterValidatorPage() {
  // --- State ---
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  const [indentation, setIndentation] = useState<number>(2);

  // --- History Hook ---
  const { addHistoryEntry } = useHistory(); // 2. Get addHistoryEntry function

  // --- Core Function ---
  // Wrapped in useCallback, though dependencies mean it changes often anyway
  const handleFormatValidate = useCallback(() => {
    let currentIsValid: boolean | null = null;
    let currentError = '';
    let currentOutput = '';
    let status: 'success' | 'error' = 'success'; // Assume success initially

    const trimmedInput = inputValue.trim();

    if (!trimmedInput) {
      currentError = "Input is empty.";
      currentIsValid = false;
      status = 'error'; // Treat empty input submission as an error for logging perhaps? Or skip logging? Let's log as error for now.
      setError(currentError);
      setIsValid(currentIsValid);
      setOutputValue('');
      // Log empty input attempt
      addHistoryEntry({
         toolName: 'JSON Formatter & Validator',
         toolRoute: '/json-formatter-validator',
         action: 'format-validate',
         input: '', // Explicitly empty
         output: `Error: ${currentError}`,
         status: status,
         options: { indentation: indentation }
      });
      return;
    }

    try {
      const parsedJson = JSON.parse(trimmedInput);
      const formattedJson = JSON.stringify(parsedJson, null, indentation);

      // Set state values for immediate UI update
      currentOutput = formattedJson;
      currentIsValid = true;
      currentError = '';
      setOutputValue(currentOutput);
      setIsValid(currentIsValid);
      setError(currentError);
      status = 'success';

      // --- 3. Add History Entry on Success ---
      addHistoryEntry({
        toolName: 'JSON Formatter & Validator',
        toolRoute: '/json-formatter-validator',
        action: 'format-validate',
        input: trimmedInput.length > 1000 ? trimmedInput.substring(0, 1000) + '...' : trimmedInput, // Truncate long input
        output: currentOutput.length > 1000 ? currentOutput.substring(0, 1000) + '...' : currentOutput, // Truncate long output
        status: status,
        options: { indentation: indentation }, // Log the indentation used
      });

    } catch (err) {
      console.error("JSON Processing Error:", err);
      // Determine error message
      if (err instanceof Error) {
        currentError = `Invalid JSON: ${err.message}`;
      } else {
        currentError = "Invalid JSON: An unknown error occurred during parsing.";
      }
      // Set state for UI update
      currentOutput = '';
      currentIsValid = false;
      setOutputValue(currentOutput);
      setIsValid(currentIsValid);
      setError(currentError);
      status = 'error';

      // --- 4. Add History Entry on Failure ---
      addHistoryEntry({
        toolName: 'JSON Formatter & Validator',
        toolRoute: '/json-formatter-validator',
        action: 'format-validate',
        input: trimmedInput.length > 1000 ? trimmedInput.substring(0, 1000) + '...' : trimmedInput,
        output: `Error: ${currentError}`, // Log the specific error message
        status: status,
        options: { indentation: indentation },
      });
    }
  }, [inputValue, indentation, addHistoryEntry]); // Dependencies for useCallback

  // --- Event Handlers --- (No changes needed in these for history)

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    setIsValid(null);
    setError('');
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
    // Auto-reformat is a display update, maybe don't log this change?
    // Or add a separate history entry for 'reformat-on-option-change'?
    // Let's stick to logging only the main button click for now.
    if (isValid) {
       try {
         const parsed = JSON.parse(inputValue.trim());
         const formatted = JSON.stringify(parsed, null, newIndentation);
         setOutputValue(formatted);
       } catch { /* ignore */ }
    }
  };

  // --- JSX --- (No changes needed in JSX)
  return (
    <main className="p-4 sm:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">JSON Formatter & Validator</h1>
      <p className="text-gray-600 mb-6">
        Paste your JSON data below to validate and format it beautifully.
      </p>
      <div className="flex flex-col gap-5">
        {/* Input Area */}
        <div>
          <label htmlFor="json-input" className="block text-sm font-medium text-gray-700 mb-1">Input JSON:</label>
          <textarea
            id="json-input" rows={12} value={inputValue} onChange={handleInputChange}
            placeholder={`Paste your JSON here...\n{\n  "example": "data",\n  "isValid": true\n}`}
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y text-base font-mono"
            spellCheck="false"
          />
        </div>
        {/* Action Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={handleFormatValidate} className="px-5 py-2 rounded-md text-white font-medium bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-150 ease-in-out">
            Format & Validate
          </button>
          <div className="flex items-center gap-2">
             <label htmlFor="indentation-select" className="text-sm font-medium text-gray-700">Indentation:</label>
             <select id="indentation-select" value={indentation} onChange={handleIndentationChange} className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm py-1.5">
                <option value={2}>2 Spaces</option>
                <option value={4}>4 Spaces</option>
                <option value={0}>Compact</option>
             </select>
          </div>
          <button onClick={handleClear} title="Clear input and output" className="px-3 py-2 rounded-md text-gray-700 font-medium bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition duration-150 ease-in-out ml-auto">
            Clear
          </button>
        </div>
        {/* Status/Error Display */}
        {isValid !== null && (
          <div className={`p-3 border rounded-md text-sm flex items-center gap-2 ${isValid ? 'bg-green-100 border-green-300 text-green-800' : 'bg-red-100 border-red-300 text-red-700'}`} role="alert">
            {isValid ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <strong>Valid JSON</strong>
              </>
            ) : (
               <>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                 <strong>Error:</strong> {error}
               </>
            )}
          </div>
        )}
        {/* Output Area */}
        <div>
          <label htmlFor="json-output" className="block text-sm font-medium text-gray-700 mb-1">Formatted Output:</label>
          <textarea
            id="json-output" rows={16} value={outputValue} readOnly
            placeholder="Formatted JSON will appear here..."
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm bg-gray-50 resize-y text-base font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            spellCheck="false" aria-live="polite"
          />
        </div>
      </div>
    </main>
  );
}