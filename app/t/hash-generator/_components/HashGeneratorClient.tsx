// FILE: app/t/hash-generator/_components/HashGeneratorClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import useToolUrlState, { ParamConfig, StateSetters } from '../../_hooks/useToolUrlState';
import { md5 } from 'js-md5';

type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512';

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

interface HashGeneratorClientProps {
    urlStateParams: ParamConfig[];
    toolTitle: string;
    toolRoute: string;
}

export default function HashGeneratorClient({
    urlStateParams,
    toolTitle,
    toolRoute
}: HashGeneratorClientProps) {
    const [text, setText] = useState<string>('');
    const [algorithm, setAlgorithm] = useState<HashAlgorithm>('MD5');
    const [outputValue, setOutputValue] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const { addHistoryEntry } = useHistory();

    const stateSetters = useMemo(() => ({
        text: setText,
        algorithm: setAlgorithm,
    }), []);

    const { shouldRunOnLoad, setShouldRunOnLoad } = useToolUrlState(
        urlStateParams,
        stateSetters as StateSetters
    );

    const handleGenerateHash = useCallback(async (textToProcess = text) => {
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
            const subtleAlgo = algorithm as AlgorithmIdentifier;
            const hashBuffer = await crypto.subtle.digest(subtleAlgo, dataBuffer);
            result = bufferToHex(hashBuffer);
            setOutputValue(result);
          }
        } catch (err) {
          console.error(`Hashing error (${algorithm}):`, err);
          errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during hashing.';
          setError(`Error generating hash: ${errorMessage}`);
          setOutputValue('');
          status = 'error';
        } finally {
          setIsLoading(false);
        }

        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            action: `${algorithm}${status === 'error' ? '-failed' : ''}`,
            input: {
                text: textToProcess.substring(0, 500) + (textToProcess.length > 500 ? '...' : ''),
                algorithm: algorithm
            },
            output: status === 'success' ? result : `Error: ${errorMessage}`,
            status: status,
        });

    }, [text, algorithm, addHistoryEntry, toolTitle, toolRoute]);

    useEffect(() => {
        if (shouldRunOnLoad && text) {
            const runAsync = async () => {
                await handleGenerateHash(text);
                setShouldRunOnLoad(false);
            };
            runAsync();
        } else if (shouldRunOnLoad && !text) {
            setShouldRunOnLoad(false);
        }
    }, [shouldRunOnLoad, setShouldRunOnLoad, text, algorithm, handleGenerateHash]);


    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(event.target.value);
        setOutputValue('');
        setError('');
    };

    const handleAlgorithmChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setAlgorithm(event.target.value as HashAlgorithm);
        setOutputValue('');
        setError('');
    };

    const handleClear = () => {
        const hadInput = text !== '';
        setText('');
        setOutputValue('');
        setError('');
        setAlgorithm('MD5');
        setIsLoading(false);
        if (hadInput) {
            addHistoryEntry({
               toolName: toolTitle,
               toolRoute: toolRoute,
               action: 'clear',
               input: { text: '', algorithm: 'MD5' },
               output: 'Input cleared',
               status: 'success',
            });
        }
    };

    return (
        <div className="space-y-6 text-[rgb(var(--color-text-base))]">
            <div>
              <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"> Input Text: </label>
              <textarea
                id="text-input"
                rows={8}
                value={text}
                onChange={handleInputChange}
                placeholder="Enter text to hash..."
                className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base placeholder:text-[rgb(var(--color-input-placeholder))]" spellCheck="false" />
            </div>
            <div className="flex flex-wrap gap-4 items-center border border-[rgb(var(--color-border-base))] p-3 rounded-md bg-[rgb(var(--color-bg-subtle))]">
               <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
                   <label htmlFor="algorithm-select" className="text-sm font-medium text-[rgb(var(--color-text-muted))] whitespace-nowrap">Algorithm:</label>
                   <select
                        id="algorithm-select"
                        name="algorithm"
                        value={algorithm}
                        onChange={handleAlgorithmChange}
                        className="rounded-md border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm py-1.5 pl-2 pr-8" >
                      <option value={'MD5'}>MD5</option>
                      <option value={'SHA-1'}>SHA-1</option>
                      <option value={'SHA-256'}>SHA-256</option>
                      <option value={'SHA-512'}>SHA-512</option>
                   </select>
               </div>
               <div className="flex gap-3 ml-auto">
                   <button
                        onClick={() => handleGenerateHash()}
                        disabled={isLoading || !text}
                        className="px-5 py-2 rounded-md text-[rgb(var(--color-button-accent-text))] font-medium bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] focus:outline-none transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" > {isLoading ? 'Generating...' : 'Generate Hash'} </button>
                   <button onClick={handleClear} title="Clear input and output" className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition duration-150 ease-in-out" > Clear </button>
               </div>
            </div>
            {algorithm === 'MD5' && ( <p className="text-xs text-[rgb(var(--color-text-muted))] italic text-center border border-dashed border-[rgb(var(--color-border-base))] p-2 rounded-md"> Note: MD5 is useful for checksums but is not considered secure for cryptographic purposes like password storage due to known vulnerabilities. </p> )}
            {error && ( <div role="alert" className="p-3 border rounded-md text-sm bg-[rgb(var(--color-bg-error-subtle))] border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))]"> <strong>Error:</strong> {error} </div> )}
            {(outputValue || isLoading) && (
              <div>
                <label htmlFor="text-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"> Hash Output ({algorithm}): </label>
                <textarea
                    id="text-output"
                    rows={3}
                    value={isLoading ? 'Generating...' : outputValue}
                    readOnly
                    placeholder="Generated hash will appear here..."
                    className={`w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm resize-none text-base font-mono focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none placeholder:text-[rgb(var(--color-input-placeholder))] ${isLoading ? 'animate-pulse' : ''}`} aria-live="polite" onClick={(e) => e.currentTarget.select()} />
              </div>
            )}
        </div>
    );
}