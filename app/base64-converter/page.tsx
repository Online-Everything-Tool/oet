// /app/base64-converter/page.tsx
'use client'; // Required for state and event handlers

import React, { useState } from 'react';

export default function Base64ConverterPage() {
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  // --- Core Functions ---

  const handleEncode = () => {
    setError(''); // Clear previous errors
    setOutputValue(''); // Clear previous output
    if (!inputValue) return; // Nothing to encode

    try {
      // Use encodeURIComponent to handle potential multi-byte Unicode characters correctly,
      // then pass the URI-encoded string to btoa.
      const encoded = btoa(encodeURIComponent(inputValue).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }));
      setOutputValue(encoded);
    } catch (err) {
      console.error("Encoding Error:", err);
      setError("Failed to encode text to Base64. Ensure text is valid.");
    }
  };

  const handleDecode = () => {
    setError(''); // Clear previous errors
    setOutputValue(''); // Clear previous output
    if (!inputValue) return; // Nothing to decode

    try {
      // Decode using atob first. The result might be URI-encoded bytes.
      const decodedBytes = atob(inputValue);
      // Use decodeURIComponent to correctly interpret multi-byte characters.
      const decoded = decodeURIComponent(
        Array.prototype.map.call(decodedBytes, (c) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')
      );
      setOutputValue(decoded);
    } catch (err) {
      console.error("Decoding Error:", err);
      // Common error is invalid Base64 string
      if (err instanceof DOMException && err.name === 'InvalidCharacterError') {
         setError("Failed to decode: Input is not a valid Base64 string.");
      } else {
         setError("An unexpected error occurred during decoding.");
      }
    }
  };

  // --- Event Handlers ---

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    // Optionally clear output/error when input changes significantly
    // setOutputValue('');
    // setError('');
  };

  const handleClear = () => {
    setInputValue('');
    setOutputValue('');
    setError('');
  };

  return (
    <main className="p-4 sm:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Base64 Encoder / Decoder</h1>
      <p className="text-gray-600 mb-6">
        Enter text to encode to Base64, or enter a Base64 string to decode back to text.
      </p>

      <div className="flex flex-col gap-5">
        {/* Input Area */}
        <div>
          <label htmlFor="base64-input" className="block text-sm font-medium text-gray-700 mb-1">
            Input (Text or Base64):
          </label>
          <textarea
            id="base64-input"
            rows={8}
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Paste text or Base64 string here..."
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y text-base font-mono"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={handleEncode}
            className="px-5 py-2 rounded-md text-white font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out"
          >
            Encode to Base64
          </button>
          <button
            onClick={handleDecode}
            className="px-5 py-2 rounded-md text-white font-medium bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-150 ease-in-out"
          >
            Decode from Base64
          </button>
          <button
            onClick={handleClear}
            title="Clear input and output"
            className="px-3 py-2 rounded-md text-gray-700 font-medium bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition duration-150 ease-in-out ml-auto" // ml-auto pushes it right
          >
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
          <label htmlFor="base64-output" className="block text-sm font-medium text-gray-700 mb-1">
            Output:
          </label>
          <textarea
            id="base64-output"
            rows={8}
            value={outputValue}
            readOnly // Make output non-editable directly
            placeholder="Result will appear here..."
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm bg-gray-50 resize-y text-base font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent" // Added bg-gray-50 for visual distinction
            aria-live="polite" // Announce changes to screen readers
          />
        </div>
      </div>
    </main>
  );
}