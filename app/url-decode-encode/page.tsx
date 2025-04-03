// /app/url-decode-encode/page.tsx
'use client'; // Required for state and event handlers

import React, { useState } from 'react';

export default function UrlDecodeEncodePage() {
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  // --- Core Functions ---

  const handleEncode = () => {
    setError(''); // Clear previous errors
    setOutputValue(''); // Clear previous output
    if (!inputValue) return; // Nothing to encode

    try {
      // encodeURIComponent is the standard for encoding URL components (query params, paths)
      const encoded = encodeURIComponent(inputValue);
      setOutputValue(encoded);
    } catch (err) {
      console.error("Encoding Error:", err);
      // Errors here are highly unlikely but good practice to have the catch
      setError("An unexpected error occurred during encoding.");
    }
  };

  const handleDecode = () => {
    setError(''); // Clear previous errors
    setOutputValue(''); // Clear previous output
    if (!inputValue) return; // Nothing to decode

    try {
      // decodeURIComponent reverses encodeURIComponent
      const decoded = decodeURIComponent(inputValue);
      setOutputValue(decoded);
    } catch (err) {
      console.error("Decoding Error:", err);
      // This can happen if the input string contains invalid percent-encoding sequences
      if (err instanceof URIError) {
         setError(`Failed to decode: Input contains invalid URL encoding sequences. (${err.message})`);
      } else {
         setError("An unexpected error occurred during decoding.");
      }
    }
  };

  // --- Event Handlers ---

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    // Optionally clear output/error when input changes
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
      <h1 className="text-2xl font-bold mb-2 text-gray-800">URL Encoder / Decoder</h1>
      <p className="text-gray-600 mb-6">
        Encode special characters in text for safe use in URLs, or decode URL-encoded strings back to readable text.
      </p>

      <div className="flex flex-col gap-5">
        {/* Input Area */}
        <div>
          <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-1">
            Input (Text or URL-encoded string):
          </label>
          <textarea
            id="url-input"
            rows={8}
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Paste text or URL-encoded string here..."
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y text-base font-mono" // Changed focus color for variety
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={handleEncode}
            className="px-5 py-2 rounded-md text-white font-medium bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition duration-150 ease-in-out" // Teal color scheme
          >
            Encode URL Component
          </button>
          <button
            onClick={handleDecode}
            className="px-5 py-2 rounded-md text-white font-medium bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition duration-150 ease-in-out" // Cyan color scheme
          >
            Decode URL Component
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
          <label htmlFor="url-output" className="block text-sm font-medium text-gray-700 mb-1">
            Output:
          </label>
          <textarea
            id="url-output"
            rows={8}
            value={outputValue}
            readOnly // Output is not directly editable
            placeholder="Result will appear here..."
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm bg-gray-50 resize-y text-base font-mono focus:ring-2 focus:ring-teal-500 focus:border-transparent" // Added bg-gray-50
            aria-live="polite" // Announce changes
          />
        </div>
      </div>
    </main>
  );
}