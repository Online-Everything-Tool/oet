// /app/base64-converter/page.tsx
'use client';

import React, { useState, useCallback } from 'react'; // Added useCallback
import { useHistory } from '../context/HistoryContext'; // 1. Import useHistory

export default function Base64ConverterPage() {
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  // --- History Hook ---
  const { addHistoryEntry } = useHistory(); // 2. Get addHistoryEntry function

  // --- Core Functions ---

  const handleEncode = useCallback(() => { // Added useCallback
    let currentOutput = '';
    let currentError = '';
    let status: 'success' | 'error' = 'success';

    setError(''); // Clear previous errors
    setOutputValue('');

    const textToEncode = inputValue; // Use full input value for processing
    if (!textToEncode) {
      // Don't process or log empty input
      return;
    }

    try {
      const encoded = btoa(unescape(encodeURIComponent(textToEncode))); // Improved UTF-8 handling
      currentOutput = encoded;
      setOutputValue(currentOutput);
    } catch (err) {
      console.error("Encoding Error:", err);
      currentError = "Failed to encode text to Base64. Ensure text is valid.";
      setError(currentError);
      status = 'error';
    }

    // --- 3. Add History Entry for Encode ---
    addHistoryEntry({
        toolName: 'Base64 Converter',
        toolRoute: '/base64-converter',
        action: 'encode',
        input: textToEncode.length > 500 ? textToEncode.substring(0, 500) + '...' : textToEncode,
        output: status === 'success'
            ? (currentOutput.length > 500 ? currentOutput.substring(0, 500) + '...' : currentOutput)
            : `Error: ${currentError}`,
        status: status,
        // No specific options needed here
    });

  }, [inputValue, addHistoryEntry]); // Dependencies

  const handleDecode = useCallback(() => { // Added useCallback
    let currentOutput = '';
    let currentError = '';
    let status: 'success' | 'error' = 'success';

    setError('');
    setOutputValue('');

    const textToDecode = inputValue; // Use full input value for processing
    if (!textToDecode) {
      // Don't process or log empty input
      return;
    }

    try {
        const decodedBytes = atob(textToDecode);
        // Correct UTF-8 decoding after atob
        const decoded = decodeURIComponent(
            Array.from(decodedBytes)
            .map((byte) => ('0' + byte.charCodeAt(0).toString(16)).slice(-2))
            .join('%'),
        );
        currentOutput = decoded;
        setOutputValue(currentOutput);

    } catch (err) {
        console.error("Decoding Error:", err);
        if (err instanceof DOMException && err.name === 'InvalidCharacterError') {
           currentError = "Failed to decode: Input is not a valid Base64 string.";
        } else {
           currentError = "An unexpected error occurred during decoding.";
        }
        setError(currentError);
        status = 'error';
    }

    // --- 4. Add History Entry for Decode ---
    addHistoryEntry({
        toolName: 'Base64 Converter',
        toolRoute: '/base64-converter',
        action: 'decode',
        input: textToDecode.length > 500 ? textToDecode.substring(0, 500) + '...' : textToDecode,
        output: status === 'success'
            ? (currentOutput.length > 500 ? currentOutput.substring(0, 500) + '...' : currentOutput)
            : `Error: ${currentError}`,
        status: status,
         // No specific options needed here
    });

  }, [inputValue, addHistoryEntry]); // Dependencies

  // --- Event Handlers ---

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
     // Maybe clear errors immediately on input change?
     // setError('');
  };

  const handleClear = () => {
    setInputValue('');
    setOutputValue('');
    setError('');
  };

  // --- JSX --- (No changes needed)
  return (
    <main className="p-4 sm:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Base64 Encoder / Decoder</h1>
      <p className="text-gray-600 mb-6">
        Enter text to encode to Base64, or enter a Base64 string to decode back to text.
      </p>

      <div className="flex flex-col gap-5">
        {/* Input Area */}
        <div>
          <label htmlFor="base64-input" className="block text-sm font-medium text-gray-700 mb-1">Input (Text or Base64):</label>
          <textarea
            id="base64-input" rows={8} value={inputValue} onChange={handleInputChange}
            placeholder="Paste text or Base64 string here..."
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y text-base font-mono"
          />
        </div>
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={handleEncode} className="px-5 py-2 rounded-md text-white font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out">
            Encode to Base64
          </button>
          <button onClick={handleDecode} className="px-5 py-2 rounded-md text-white font-medium bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-150 ease-in-out">
            Decode from Base64
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
          <label htmlFor="base64-output" className="block text-sm font-medium text-gray-700 mb-1">Output:</label>
          <textarea
            id="base64-output" rows={8} value={outputValue} readOnly
            placeholder="Result will appear here..."
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm bg-gray-50 resize-y text-base font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            aria-live="polite"
          />
        </div>
      </div>
    </main>
  );
}