// /app/url-decode-encode/page.tsx
'use client';

import React, { useState, useCallback } from 'react'; // Added useCallback
import { useHistory } from '../context/HistoryContext'; // 1. Import useHistory

export default function UrlDecodeEncodePage() {
  // --- State ---
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  // --- History Hook ---
  const { addHistoryEntry } = useHistory(); // 2. Get addHistoryEntry

  // --- Core Functions ---

  const handleEncode = useCallback(() => { // Added useCallback
    let currentOutput = '';
    let currentError = '';
    let status: 'success' | 'error' = 'success';
    const textToEncode = inputValue; // Use original input value

    setError('');
    setOutputValue('');

    if (!textToEncode) return; // Nothing to encode or log

    try {
      const encoded = encodeURIComponent(textToEncode);
      currentOutput = encoded;
      setOutputValue(currentOutput);
    } catch (err) {
      console.error("Encoding Error:", err);
      currentError = "An unexpected error occurred during encoding.";
      setError(currentError);
      status = 'error';
    }

    // --- 3. Add History Entry for Encode ---
    addHistoryEntry({
        toolName: 'URL Encoder / Decoder',
        toolRoute: '/url-decode-encode',
        action: 'encode',
        input: textToEncode.length > 500 ? textToEncode.substring(0, 500) + '...' : textToEncode,
        output: status === 'success'
            ? (currentOutput.length > 500 ? currentOutput.substring(0, 500) + '...' : currentOutput)
            : `Error: ${currentError}`,
        status: status,
        // No specific options needed
    });

  }, [inputValue, addHistoryEntry]); // Dependencies

  const handleDecode = useCallback(() => { // Added useCallback
    let currentOutput = '';
    let currentError = '';
    let status: 'success' | 'error' = 'success';
    const textToDecode = inputValue; // Use original input value

    setError('');
    setOutputValue('');

    if (!textToDecode) return; // Nothing to decode or log

    try {
      const decoded = decodeURIComponent(textToDecode);
      currentOutput = decoded;
      setOutputValue(currentOutput);
    } catch (err) {
      console.error("Decoding Error:", err);
      if (err instanceof URIError) {
         currentError = `Failed to decode: Input contains invalid URL encoding sequences. (${err.message})`;
      } else {
         currentError = "An unexpected error occurred during decoding.";
      }
      setError(currentError);
      status = 'error';
    }

    // --- 4. Add History Entry for Decode ---
    addHistoryEntry({
        toolName: 'URL Encoder / Decoder',
        toolRoute: '/url-decode-encode',
        action: 'decode',
        input: textToDecode.length > 500 ? textToDecode.substring(0, 500) + '...' : textToDecode,
        output: status === 'success'
            ? (currentOutput.length > 500 ? currentOutput.substring(0, 500) + '...' : currentOutput)
            : `Error: ${currentError}`,
        status: status,
        // No specific options needed
    });

  }, [inputValue, addHistoryEntry]); // Dependencies

  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    // setError(''); // Optionally clear errors on input change
  };

  const handleClear = () => {
    setInputValue('');
    setOutputValue('');
    setError('');
  };

  // --- JSX --- (No changes needed)
  return (
    <main className="p-4 sm:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">URL Encoder / Decoder</h1>
      <p className="text-gray-600 mb-6">
        Encode special characters in text for safe use in URLs, or decode URL-encoded strings back to readable text.
      </p>
      <div className="flex flex-col gap-5">
        {/* Input Area */}
        <div>
          <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-1">Input (Text or URL-encoded string):</label>
          <textarea
            id="url-input" rows={8} value={inputValue} onChange={handleInputChange}
            placeholder="Paste text or URL-encoded string here..."
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y text-base font-mono"
          />
        </div>
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={handleEncode} className="px-5 py-2 rounded-md text-white font-medium bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition duration-150 ease-in-out">
            Encode URL Component
          </button>
          <button onClick={handleDecode} className="px-5 py-2 rounded-md text-white font-medium bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition duration-150 ease-in-out">
            Decode URL Component
          </button>
          <button onClick={handleClear} title="Clear input and output" className="px-3 py-2 rounded-md text-gray-700 font-medium bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition duration-150 ease-in-out ml-auto">
            Clear
          </button>
        </div>
        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
        {/* Output Area */}
        <div>
          <label htmlFor="url-output" className="block text-sm font-medium text-gray-700 mb-1">Output:</label>
          <textarea
            id="url-output" rows={8} value={outputValue} readOnly
            placeholder="Result will appear here..."
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm bg-gray-50 resize-y text-base font-mono focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            aria-live="polite"
          />
        </div>
      </div>
    </main>
  );
}