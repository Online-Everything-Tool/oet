'use client';

import React, { useState, useCallback } from 'react';
import { useHistory } from '../../context/HistoryContext';
import ToolHeader from '../_components/ToolHeader'; // Import ToolHeader
import metadata from './metadata.json'; // Import local metadata

export default function UrlDecodeEncodePage() {
  // --- State ---
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  // --- History Hook ---
  const { addHistoryEntry } = useHistory();

  // --- Core Functions ---

  const handleEncode = useCallback(() => {
    let currentOutput = '';
    let currentError = '';
    let status: 'success' | 'error' = 'success';
    const textToEncode = inputValue;

    setError(''); // Clear previous errors
    setOutputValue(''); // Clear previous output

    if (!textToEncode) return;

    try {
      // Use encodeURIComponent for proper encoding of components
      const encoded = encodeURIComponent(textToEncode);
      currentOutput = encoded;
      setOutputValue(currentOutput);
    } catch (err) {
      console.error("Encoding Error:", err);
      currentError = "An unexpected error occurred during encoding.";
      setError(currentError);
      status = 'error';
    }

    addHistoryEntry({
        toolName: metadata.title, // Use metadata title
        toolRoute: '/t/url-decode-encode', // Use correct route
        action: 'encode',
        input: textToEncode.length > 500 ? textToEncode.substring(0, 500) + '...' : textToEncode,
        output: status === 'success'
            ? (currentOutput.length > 500 ? currentOutput.substring(0, 500) + '...' : currentOutput)
            : `Error: ${currentError}`,
        status: status,
    });

  }, [inputValue, addHistoryEntry]);

  const handleDecode = useCallback(() => {
    let currentOutput = '';
    let currentError = '';
    let status: 'success' | 'error' = 'success';
    const textToDecode = inputValue;

    setError('');
    setOutputValue('');

    if (!textToDecode) return;

    try {
      // Use decodeURIComponent which handles component decoding
      const decoded = decodeURIComponent(textToDecode.replace(/\+/g, ' ')); // Also replace '+' with space for form data compatibility
      currentOutput = decoded;
      setOutputValue(currentOutput);
    } catch (err) {
      console.error("Decoding Error:", err);
      if (err instanceof URIError) {
         // Provide a more user-friendly message for common URIErrors
         currentError = `Decoding failed: The input string contains invalid percent-encoding sequences. Check for incomplete sequences (like % alone or %A without a second hex digit) or invalid characters.`;
      } else {
         currentError = "An unexpected error occurred during decoding.";
      }
      setError(currentError);
      status = 'error';
    }

    addHistoryEntry({
        toolName: metadata.title, // Use metadata title
        toolRoute: '/t/url-decode-encode', // Use correct route
        action: 'decode',
        input: textToDecode.length > 500 ? textToDecode.substring(0, 500) + '...' : textToDecode,
        output: status === 'success'
            ? (currentOutput.length > 500 ? currentOutput.substring(0, 500) + '...' : currentOutput)
            : `Error: ${currentError}`,
        status: status,
    });

  }, [inputValue, addHistoryEntry]);

  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    setError(''); // Clear error on input change
    setOutputValue(''); // Clear output on input change
  };

  const handleClear = () => {
    const hadInput = inputValue !== '';
    setInputValue('');
    setOutputValue('');
    setError('');
     if (hadInput) {
       addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/url-decode-encode',
          action: 'clear',
          input: '',
          output: 'Input cleared',
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
                <label htmlFor="url-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Input (Text or URL-encoded string):
                </label>
                <textarea
                    id="url-input"
                    rows={6} // Adjusted rows
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder="Paste text or URL-encoded string here (e.g., 'hello world' or 'hello%20world')"
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                    spellCheck="false"
                    aria-label="Input text or URL-encoded string"
                />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 items-center">
                 {/* Encode Button (Primary - Blue) */}
                 <button
                    type="button"
                    onClick={handleEncode}
                    disabled={!inputValue}
                    className="px-5 py-2 rounded-md text-[rgb(var(--color-button-primary-text))] font-medium bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
                 >
                    Encode
                 </button>
                 {/* Decode Button (Secondary - Green) */}
                 <button
                    type="button"
                    onClick={handleDecode}
                    disabled={!inputValue}
                    className="px-5 py-2 rounded-md text-[rgb(var(--color-button-secondary-text))] font-medium bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
                 >
                    Decode
                 </button>
                 {/* Clear Button (Neutral - pushed right) */}
                 <button
                    type="button"
                    onClick={handleClear}
                    title="Clear input and output"
                    className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ml-auto"
                 >
                    Clear
                 </button>
            </div>

            {/* Error Display */}
            {error && (
                <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                     </svg>
                    {/* Wrap error text */}
                    <div>
                        <strong className="font-semibold">Error:</strong> {error}
                    </div>
                </div>
             )}

            {/* Output Area */}
            <div>
                <label htmlFor="url-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Output:
                </label>
                <textarea
                    id="url-output"
                    rows={6} // Adjusted rows
                    value={outputValue}
                    readOnly
                    placeholder="Result will appear here..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                    aria-live="polite"
                    aria-label="Encoded or decoded output string"
                />
            </div>
        </div>
    </div>
  );
}