// /app/t/hash-generator/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
// Assuming useHistory context setup exists elsewhere and works
import { useHistory } from '../../context/HistoryContext';

// --- Import MD5 library ---
import { md5 } from 'js-md5';

// Import ToolHeader and Metadata
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json'; // Will now use updated metadata

// --- Update supported algorithms type ---
type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512';

// Helper function to convert ArrayBuffer to Hex string (for SHA)
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function HashGeneratorPage() {
  // --- State Hooks ---
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  // Default to SHA-256 still seems reasonable
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // --- History Context Hook ---
  const { addHistoryEntry } = useHistory();

  // --- Core Hashing Logic (Updated for MD5) ---
  const handleGenerateHash = useCallback(async () => {
    setError('');
    setOutputValue('');
    setIsLoading(true);
    const text = inputValue;

    if (!text) {
      setError("Input text cannot be empty.");
      setIsLoading(false);
      return;
    }

    let result = '';
    let status: 'success' | 'error' = 'success';
    let errorMessage = '';

    try {
      // --- Branch logic based on algorithm ---
      if (algorithm === 'MD5') {
        // Use js-md5 library
        result = md5(text);
        setOutputValue(result);
      } else {
        // Use Web Crypto API for SHA algorithms
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(text);
        // Digest requires uppercase SHA algorithm names
        const hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
        result = bufferToHex(hashBuffer);
        setOutputValue(result);
      }
    } catch (err) {
      console.error(`Hashing error (${algorithm}):`, err);
      errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during hashing.';
      // Provide specific error for Web Crypto issues if needed
      if (algorithm !== 'MD5' && !crypto?.subtle) {
           errorMessage = 'Web Crypto API is not available in this browser or context (e.g., non-HTTPS).';
      }
      setError(`Error generating hash: ${errorMessage}`);
      setOutputValue('');
      status = 'error';
    } finally {
      setIsLoading(false);
    }

    // --- Add to History ---
    addHistoryEntry({
        toolName: metadata.title,
        toolRoute: '/t/hash-generator',
        action: algorithm,
        input: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
        output: status === 'success' ? result : `Error: ${errorMessage}`,
        status: status,
        options: { algorithm: algorithm }
    });

  }, [inputValue, algorithm, addHistoryEntry]);

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
    <div className="p-0"> {/* Layout provides padding */}
        <ToolHeader
            title={metadata.title} // Uses updated title from metadata
            description={metadata.description} // Uses updated description
        />

      <div className="space-y-6 text-[rgb(var(--color-text-base))]">
        {/* Input Area */}
        <div>
          <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
            Input Text:
          </label>
          <textarea
            id="text-input"
            rows={8}
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter text to hash..."
            className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
          />
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap gap-4 items-center border border-[rgb(var(--color-border-base))] p-3 rounded-md bg-[rgb(var(--color-bg-subtle))]">
           {/* Algorithm Selection */}
           <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
               <label htmlFor="algorithm-select" className="text-sm font-medium text-[rgb(var(--color-text-muted))] whitespace-nowrap">Algorithm:</label>
               <select
                  id="algorithm-select"
                  value={algorithm}
                  onChange={handleAlgorithmChange}
                  className="rounded-md border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm py-1.5 pl-2 pr-8"
               >
                  {/* --- Added MD5 Option --- */}
                  <option value={'MD5'}>MD5</option>
                  <option value={'SHA-1'}>SHA-1</option>
                  <option value={'SHA-256'}>SHA-256</option>
                  <option value={'SHA-512'}>SHA-512</option>
               </select>
           </div>

           {/* Action Buttons */}
           <div className="flex gap-3 ml-auto">
               <button
                 onClick={handleGenerateHash}
                 disabled={isLoading || !inputValue}
                 className="px-5 py-2 rounded-md text-[rgb(var(--color-button-accent-text))] font-medium bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] focus:outline-none transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isLoading ? 'Generating...' : 'Generate Hash'}
               </button>
               <button
                 onClick={handleClear}
                 title="Clear input and output"
                 className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition duration-150 ease-in-out"
               >
                 Clear
               </button>
           </div>
        </div>

        {/* Optional: MD5 Security Note */}
        {algorithm === 'MD5' && (
            <p className="text-xs text-[rgb(var(--color-text-muted))] italic text-center border border-dashed border-[rgb(var(--color-border-base))] p-2 rounded-md">
                Note: MD5 is useful for checksums but is not considered secure for cryptographic purposes like password storage due to known vulnerabilities.
            </p>
        )}

         {/* Error Display */}
        {error && (
          <div role="alert" className="p-3 border rounded-md text-sm bg-[rgb(var(--color-bg-error-subtle))] border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))]">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Output Area */}
        {outputValue && (
          <div>
            <label htmlFor="text-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
              Hash Output ({algorithm}):
            </label>
            <textarea
              id="text-output"
              rows={3}
              value={outputValue}
              readOnly
              className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm resize-none text-base font-mono focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none placeholder:text-[rgb(var(--color-input-placeholder))]"
              aria-live="polite"
              onClick={(e) => e.currentTarget.select()}
            />
          </div>
        )}
      </div>
    </div>
  );
}