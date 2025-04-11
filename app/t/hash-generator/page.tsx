// /app/hash-generator/page.tsx
'use client'; // Ensure this is the very first line

import React, { useState, useCallback } from 'react';
import { useHistory } from '../../context/HistoryContext'; // Adjust path if needed

// Supported hash algorithms by Web Crypto API's digest method
type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

// Helper function to convert ArrayBuffer to Hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Default export defining the React component
export default function HashGeneratorPage() {
  // --- State Hooks ---
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // --- History Context Hook ---
  const { addHistoryEntry } = useHistory();

  // --- Core Hashing Logic (Async) ---
  const handleGenerateHash = useCallback(async () => {
    setError('');
    setOutputValue('');
    setIsLoading(true);
    const text = inputValue; // Use current input

    if (!text) {
      setError("Input text cannot be empty.");
      setIsLoading(false);
      return;
    }

    let result = '';
    let status: 'success' | 'error' = 'success';
    let errorMessage = '';

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
      result = bufferToHex(hashBuffer);
      setOutputValue(result);

    } catch (err) {
      console.error(`Hashing error (${algorithm}):`, err);
      errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during hashing.';
      setError(`Error generating hash: ${errorMessage}`);
      setOutputValue('');
      status = 'error';
    } finally {
      setIsLoading(false);
    }

    // --- Add to History ---
    addHistoryEntry({
        toolName: 'Hash Generator',
        toolRoute: '/hash-generator',
        action: algorithm, // Algorithm name as action
        input: text.length > 500 ? text.substring(0, 500) + '...' : text,
        output: status === 'success' ? result : `Error: ${errorMessage}`,
        status: status,
        options: { algorithm: algorithm } // Store algorithm in options too
    });

  }, [inputValue, algorithm, addHistoryEntry]); // Dependencies for useCallback

  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    setError('');
  };

  const handleAlgorithmChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setAlgorithm(event.target.value as HashAlgorithm);
    setOutputValue('');
    setError('');
  };

  const handleClear = () => {
    setInputValue('');
    setOutputValue('');
    setError('');
    setIsLoading(false);
  };

  // --- Render JSX ---
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Hash Generator (SHA-1, SHA-256, SHA-512)</h1>
      <p className="text-gray-600">
        Generate cryptographic hash values for your text using standard SHA algorithms.
      </p>

      {/* Input Area */}
      <div>
        <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-1">
          Input Text:
        </label>
        <textarea
          id="text-input"
          rows={8}
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Enter text to hash..."
          className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y text-base"
        />
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap gap-4 items-center border p-3 rounded-md bg-gray-50">
         {/* Algorithm Selection */}
         <div className="flex items-center gap-2">
             <label htmlFor="algorithm-select" className="text-sm font-medium text-gray-700">Algorithm:</label>
             <select
                id="algorithm-select"
                value={algorithm}
                onChange={handleAlgorithmChange}
                className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm py-1.5 pl-2 pr-8"
             >
                <option value={'SHA-1'}>SHA-1</option>
                <option value={'SHA-256'}>SHA-256</option>
                <option value={'SHA-512'}>SHA-512</option>
             </select>
         </div>

         {/* Action Buttons */}
         <div className="flex gap-3 ml-auto">
             <button
               onClick={handleGenerateHash}
               disabled={isLoading}
               className="px-5 py-2 rounded-md text-white font-medium bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-150 ease-in-out disabled:bg-purple-300 disabled:cursor-wait"
             >
               {isLoading ? 'Generating...' : 'Generate Hash'}
             </button>
             <button
               onClick={handleClear}
               title="Clear input and output"
               className="px-3 py-2 rounded-md text-gray-700 font-medium bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition duration-150 ease-in-out"
             >
               Clear
             </button>
         </div>
      </div>

       {/* Error Display */}
      {error && (
        <div className="p-3 border rounded-md text-sm bg-red-100 border-red-300 text-red-700" role="alert">
          {error}
        </div>
      )}

      {/* Output Area */}
      {outputValue && (
        <div>
          <label htmlFor="text-output" className="block text-sm font-medium text-gray-700 mb-1">
            Hash Output ({algorithm}):
          </label>
          <textarea
            id="text-output"
            rows={3}
            value={outputValue}
            readOnly
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm resize-none text-base font-mono bg-gray-100"
            aria-live="polite"
            onClick={(e) => e.currentTarget.select()}
          />
        </div>
      )}
    </div>
  );
} // Ensure this brace correctly closes the HashGeneratorPage function