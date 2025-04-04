// /app/json-formatter-validator/page.tsx
'use client'; // Required for state and event handlers

import React, { useState } from 'react';

export default function JsonFormatterValidatorPage() {
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean | null>(null); // null: initial, true: valid, false: invalid
  const [error, setError] = useState<string>('');
  const [indentation, setIndentation] = useState<number>(2); // Default indentation

  // --- Core Function ---

  const handleFormatValidate = () => {
    // Reset status before processing
    setIsValid(null);
    setError('');
    setOutputValue(''); // Clear previous output

    const trimmedInput = inputValue.trim();
    if (!trimmedInput) {
      setError("Input is empty.");
      setIsValid(false);
      return; // Nothing to process
    }

    try {
      // Step 1: Try to parse the JSON (this validates it)
      const parsedJson = JSON.parse(trimmedInput);

      // Step 2: Stringify it with selected indentation for formatting
      const formattedJson = JSON.stringify(parsedJson, null, indentation);

      // Update state on success
      setOutputValue(formattedJson);
      setIsValid(true);
      setError(''); // Clear any previous error

    } catch (err) {
      console.error("JSON Processing Error:", err);
      // Update state on failure
      setOutputValue(''); // Clear output on error
      setIsValid(false);
      if (err instanceof Error) {
        // Provide a user-friendly error message
        setError(`Invalid JSON: ${err.message}`);
      } else {
        setError("Invalid JSON: An unknown error occurred during parsing.");
      }
    }
  };

  // --- Event Handlers ---

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    // Optionally reset status when input changes
    setIsValid(null);
    setError('');
    // setOutputValue(''); // Decide if output should clear immediately on input change
  };

  const handleClear = () => {
    setInputValue('');
    setOutputValue('');
    setIsValid(null);
    setError('');
  };

  const handleIndentationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setIndentation(parseInt(event.target.value, 10));
    // Optionally re-format immediately if current input is valid JSON
    if (isValid) {
       try {
         const parsed = JSON.parse(inputValue.trim());
         const formatted = JSON.stringify(parsed, null, parseInt(event.target.value, 10));
         setOutputValue(formatted);
       } catch {
         // Ignore error here, just don't auto-update if something went wrong
       }
    }
  }

  return (
    <main className="p-4 sm:p-8 max-w-4xl mx-auto"> {/* Increased max-width slightly */}
      <h1 className="text-2xl font-bold mb-2 text-gray-800">JSON Formatter & Validator</h1>
      <p className="text-gray-600 mb-6">
        Paste your JSON data below to validate and format it beautifully.
      </p>

      <div className="flex flex-col gap-5">
        {/* Input Area */}
        <div>
          <label htmlFor="json-input" className="block text-sm font-medium text-gray-700 mb-1">
            Input JSON:
          </label>
          <textarea
            id="json-input"
            rows={12} // Slightly larger default size
            value={inputValue}
            onChange={handleInputChange}
            placeholder={`Paste your JSON here...\n{\n  "example": "data",\n  "isValid": true\n}`}
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y text-base font-mono" // Purple focus color
            spellCheck="false" // Disable spellcheck for code
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={handleFormatValidate}
            className="px-5 py-2 rounded-md text-white font-medium bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-150 ease-in-out"
          >
            Format & Validate
          </button>

          {/* Indentation Selector */}
          <div className="flex items-center gap-2">
             <label htmlFor="indentation-select" className="text-sm font-medium text-gray-700">Indentation:</label>
             <select
                id="indentation-select"
                value={indentation}
                onChange={handleIndentationChange}
                className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm py-1.5" // Adjusted padding
             >
                <option value={2}>2 Spaces</option>
                <option value={4}>4 Spaces</option>
                <option value={0}>Compact</option> {/* Using 0 for JSON.stringify compact */}
             </select>
          </div>


          <button
            onClick={handleClear}
            title="Clear input and output"
            className="px-3 py-2 rounded-md text-gray-700 font-medium bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition duration-150 ease-in-out ml-auto"
          >
            Clear
          </button>
        </div>

        {/* Status/Error Display */}
        {isValid !== null && ( // Only show after validation attempt
          <div className={`p-3 border rounded-md text-sm flex items-center gap-2 ${
            isValid
              ? 'bg-green-100 border-green-300 text-green-800'
              : 'bg-red-100 border-red-300 text-red-700'
          }`}
          role="alert" // Accessibility role
          >
            {isValid ? (
              <>
                {/* Optional: Checkmark Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <strong>Valid JSON</strong>
              </>
            ) : (
               <>
                 {/* Optional: Error Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                <strong>Error:</strong> {error}
               </>
            )}
          </div>
        )}

        {/* Output Area */}
        <div>
          <label htmlFor="json-output" className="block text-sm font-medium text-gray-700 mb-1">
            Formatted Output:
          </label>
          <textarea
            id="json-output"
            rows={16} // Make output potentially larger
            value={outputValue}
            readOnly
            placeholder="Formatted JSON will appear here..."
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm bg-gray-50 resize-y text-base font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            spellCheck="false"
            aria-live="polite"
          />
          {/* Optional: Add a "Copy to Clipboard" button here */}
        </div>
      </div>
    </main>
  );
}