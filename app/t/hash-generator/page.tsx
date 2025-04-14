// /app/t/hash-generator/page.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
// Import hooks and types
import useToolUrlState, { ParamConfig } from '../_hooks/useToolUrlState';
import { useHistory } from '../../context/HistoryContext';
// Import MD5 library
import { md5 } from 'js-md5';
// Import components and metadata
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';

// Define supported algorithms type
type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512';

// Helper function to convert ArrayBuffer to Hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function HashGeneratorPage() {
  // --- State Hooks ---
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256'); // Default matches metadata
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { addHistoryEntry } = useHistory();

  // --- Memoize State Setters for the Hook ---
  const stateSetters = useMemo(() => ({
    inputValue: setInputValue,
    algorithm: setAlgorithm,
  }), []); // Empty deps array is correct

  // --- Use the URL State Hook ---
  const { shouldRunOnLoad, setShouldRunOnLoad } = useToolUrlState(
    // Assert the type of the imported metadata field
    (metadata.urlStateParams || []) as ParamConfig[],
    stateSetters
  );

  // --- Core Hashing Logic ---
  // Needs to accept text as argument for trigger effect
  const handleGenerateHash = useCallback(async (textToProcess = inputValue) => {
    console.log(`Running handleGenerateHash with algo: ${algorithm} for text: ${textToProcess.substring(0,20)}...`);
    setError('');
    setOutputValue('');
    setIsLoading(true);

    if (!textToProcess) {
      setOutputValue('');
      setIsLoading(false);
      return;
    }

    let result = '';
    let status: 'success' | 'error' = 'success';
    let errorMessage = '';

    try {
      if (algorithm === 'MD5') {
        result = md5(textToProcess);
        setOutputValue(result);
      } else {
        if (!crypto?.subtle) {
            throw new Error('Web Crypto API (crypto.subtle) is not available in this browser or context (requires HTTPS).');
        }
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(textToProcess);
        const hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
        result = bufferToHex(hashBuffer);
        setOutputValue(result);
      }
    } catch (err) {
      console.error(`Hashing error (${algorithm}):`, err);
      errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during hashing.';
      setError(`Error generating hash: ${errorMessage}`); // Set error state
      setOutputValue(''); // Clear output on error
      status = 'error';
    } finally {
      setIsLoading(false);
    }

    // --- Add to History (only if calculation was attempted) ---
    addHistoryEntry({
        toolName: metadata.title,
        toolRoute: '/t/hash-generator',
        action: `${algorithm}${status === 'error' ? '-failed' : ''}`, // Append -failed on error
        input: textToProcess.substring(0, 500) + (textToProcess.length > 500 ? '...' : ''),
        output: status === 'success' ? result : `Error: ${errorMessage}`,
        status: status,
        options: { algorithm: algorithm }
    });

  // Dependencies needed: algorithm (used), addHistoryEntry (used), inputValue (for default param)
  }, [inputValue, algorithm, addHistoryEntry]);

  // --- Effect to run calculation after state is set from URL ---
  useEffect(() => {
    if (shouldRunOnLoad) {
        console.log("[HashGeneratorPage] Running calculation triggered by URL state hook.");
        // Use a separate async function to handle the promise from handleGenerateHash
        const runAsync = async () => {
            await handleGenerateHash(inputValue); // Pass current input value
            setShouldRunOnLoad(false); // Reset flag *after* calculation
        };
        runAsync();
    }
  // --- ADD 'algorithm' to dependency array ---
  // Ensure effect re-runs if algorithm changes *after* shouldRunOnLoad becomes true
  // Also ensure handleGenerateHash is the latest version reflecting the new algorithm
  }, [shouldRunOnLoad, setShouldRunOnLoad, inputValue, algorithm, handleGenerateHash]);


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
     addHistoryEntry({
        toolName: metadata.title, toolRoute: '/t/hash-generator', action: 'clear',
        input: '', output: 'Input cleared', status: 'success', options: { algorithm: algorithm }
     });
  };

  // --- Render JSX ---
  return (
    <div className="flex flex-col gap-6">
        <ToolHeader
            title={metadata.title}
            description={metadata.description}
        />

      <div className="space-y-6 text-[rgb(var(--color-text-base))]">
        {/* Input Area */}
        <div>
          <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"> Input Text: </label>
          <textarea id="text-input" rows={8} value={inputValue} onChange={handleInputChange} placeholder="Enter text to hash..." className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base placeholder:text-[rgb(var(--color-input-placeholder))]" spellCheck="false" />
        </div>
        {/* Controls Row */}
        <div className="flex flex-wrap gap-4 items-center border border-[rgb(var(--color-border-base))] p-3 rounded-md bg-[rgb(var(--color-bg-subtle))]">
           <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
               <label htmlFor="algorithm-select" className="text-sm font-medium text-[rgb(var(--color-text-muted))] whitespace-nowrap">Algorithm:</label>
               <select id="algorithm-select" value={algorithm} onChange={handleAlgorithmChange} className="rounded-md border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm py-1.5 pl-2 pr-8" >
                  <option value={'MD5'}>MD5</option>
                  <option value={'SHA-1'}>SHA-1</option>
                  <option value={'SHA-256'}>SHA-256</option>
                  <option value={'SHA-512'}>SHA-512</option>
               </select>
           </div>
           <div className="flex gap-3 ml-auto">
               <button onClick={() => handleGenerateHash()} disabled={isLoading || !inputValue} className="px-5 py-2 rounded-md text-[rgb(var(--color-button-accent-text))] font-medium bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] focus:outline-none transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" > {isLoading ? 'Generating...' : 'Generate Hash'} </button>
               <button onClick={handleClear} title="Clear input and output" className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition duration-150 ease-in-out" > Clear </button>
           </div>
        </div>
        {algorithm === 'MD5' && ( <p className="text-xs text-[rgb(var(--color-text-muted))] italic text-center border border-dashed border-[rgb(var(--color-border-base))] p-2 rounded-md"> Note: MD5 is useful for checksums but is not considered secure for cryptographic purposes like password storage due to known vulnerabilities. </p> )}
        {error && ( <div role="alert" className="p-3 border rounded-md text-sm bg-[rgb(var(--color-bg-error-subtle))] border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))]"> <strong>Error:</strong> {error} </div> )}
        {(outputValue || isLoading) && (
          <div>
            <label htmlFor="text-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"> Hash Output ({algorithm}): </label>
            <textarea id="text-output" rows={3} value={isLoading ? 'Generating...' : outputValue} readOnly placeholder="Generated hash will appear here..." className={`w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm resize-none text-base font-mono focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none placeholder:text-[rgb(var(--color-input-placeholder))] ${isLoading ? 'animate-pulse' : ''}`} aria-live="polite" onClick={(e) => e.currentTarget.select()} />
          </div>
        )}
      </div>
    </div>
  );
}