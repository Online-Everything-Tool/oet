// FILE: app/tool/url-encode-decode/_components/UrlEncodeDecodeClient.tsx
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import type { TriggerType } from '@/src/types/history'
import useToolUrlState, { StateSetters } from '../../_hooks/useToolUrlState';
import type { ParamConfig } from '@/src/types/tools';

type Operation = 'encode' | 'decode';

interface UrlEncodeDecodeClientProps {
    urlStateParams: ParamConfig[];
    toolTitle: string;
    toolRoute: string;
}

export default function UrlEncodeDecodeClient({
    urlStateParams,
    toolTitle,
    toolRoute
}: UrlEncodeDecodeClientProps) {
    const [text, setText] = useState<string>('');
    const [operation, setOperation] = useState<Operation>('encode');
    const [outputValue, setOutputValue] = useState<string>('');
    const [error, setError] = useState<string>('');

    const { addHistoryEntry } = useHistory();

    const stateSetters = useMemo(() => ({
        text: setText,
        operation: setOperation,
    }), []);

    const { shouldRunOnLoad, setShouldRunOnLoad } = useToolUrlState(
        urlStateParams,
        stateSetters as StateSetters
    );

    // Updated handleEncode
    const handleEncode = useCallback((triggerType: TriggerType, textToProcess = text) => {
        let currentOutput = '';
        let currentError = '';
        let status: 'success' | 'error' = 'success';
        let historyOutputObj: Record<string, unknown> = {}; // For structured output

        setError('');
        setOutputValue('');
        if (!textToProcess) return;

        try {
          currentOutput = encodeURIComponent(textToProcess);
          setOutputValue(currentOutput);
          historyOutputObj = { // Structure success output
              operationResult: "Encoded URL", // Summary field
              resultValue: currentOutput.length > 500 ? currentOutput.substring(0, 500) + '...' : currentOutput
          };
        } catch (err) {
          console.error("Encoding Error:", err);
          currentError = "An unexpected error occurred during encoding.";
          setError(currentError);
          status = 'error';
           historyOutputObj = { // Structure error output
               operationResult: "Encoding Error",
               errorMessage: currentError
           };
        }

        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: triggerType,
            input: {
                text: textToProcess.length > 500 ? textToProcess.substring(0, 500) + '...' : textToProcess,
                operation: 'encode'
            },
            output: historyOutputObj, // Log structured object
            status: status,
        });

    }, [text, addHistoryEntry, toolTitle, toolRoute]); // Added text dependency

    // Updated handleDecode
    const handleDecode = useCallback((triggerType: TriggerType, textToProcess = text) => {
        let currentOutput = '';
        let currentError = '';
        let status: 'success' | 'error' = 'success';
        let historyOutputObj: Record<string, unknown> = {}; // For structured output

        setError('');
        setOutputValue('');
        if (!textToProcess) return;

        try {
          // Replace '+' with space *before* decoding for form-encoded compatibility
          currentOutput = decodeURIComponent(textToProcess.replace(/\+/g, ' '));
          setOutputValue(currentOutput);
           historyOutputObj = { // Structure success output
               operationResult: "Decoded Text", // Summary field
               resultValue: currentOutput.length > 500 ? currentOutput.substring(0, 500) + '...' : currentOutput
           };
        } catch (err) {
          console.error("Decoding Error:", err);
          if (err instanceof URIError) {
             currentError = `Decoding failed: The input string contains invalid percent-encoding sequences. Check for incomplete sequences (like % alone or %A without a second hex digit) or invalid characters.`;
          } else {
             currentError = "An unexpected error occurred during decoding.";
          }
          setError(currentError);
          status = 'error';
           historyOutputObj = { // Structure error output
               operationResult: "Decoding Error",
               errorMessage: currentError
           };
        }

         addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: triggerType,
            input: {
                text: textToProcess.length > 500 ? textToProcess.substring(0, 500) + '...' : textToProcess,
                operation: 'decode'
            },
            output: historyOutputObj, // Log structured object
            status: status,
        });
      }, [text, addHistoryEntry, toolTitle, toolRoute]); // Added text dependency

    useEffect(() => {
          if (shouldRunOnLoad && text) {
              if (operation === 'encode') {
                  handleEncode('query', text); // Pass trigger type
              } else if (operation === 'decode') {
                  handleDecode('query', text); // Pass trigger type
              }
              setShouldRunOnLoad(false);
          } else if (shouldRunOnLoad && !text) {
              setShouldRunOnLoad(false);
          }
    }, [shouldRunOnLoad, setShouldRunOnLoad, text, operation, handleEncode, handleDecode]); // Dependencies remain same


    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(event.target.value);
        setError('');
        setOutputValue('');
    };

    const handleClear = () => {
        setText('');
        setOutputValue('');
        setError('');
        setOperation('encode');
        // No history log
    };

    return (
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
            <div>
                <label htmlFor="url-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Input (Text or URL-encoded string):
                </label>
                <textarea
                    id="url-input"
                    rows={6}
                    value={text}
                    onChange={handleInputChange}
                    placeholder="Paste text or URL-encoded string here (e.g., 'hello world' or 'hello%20world')"
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                    spellCheck="false"
                    aria-label="Input text or URL-encoded string"
                />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
                 <button
                    type="button"
                    onClick={() => handleEncode('click', text)} // Pass trigger type
                    disabled={!text}
                    className="px-5 py-2 rounded-md text-[rgb(var(--color-button-primary-text))] font-medium bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
                 >
                    Encode
                 </button>
                 <button
                    type="button"
                    onClick={() => handleDecode('click', text)} // Pass trigger type
                    disabled={!text}
                    className="px-5 py-2 rounded-md text-[rgb(var(--color-button-secondary-text))] font-medium bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
                 >
                    Decode
                 </button>
                 <button
                    type="button"
                    onClick={handleClear}
                    title="Clear input and output"
                    className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ml-auto"
                 >
                    Clear
                 </button>
            </div>
            {error && (
                <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /> </svg>
                    <div>
                        <strong className="font-semibold">Error:</strong> {error}
                    </div>
                </div>
             )}
            <div>
                <label htmlFor="url-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Output:
                </label>
                <textarea
                    id="url-output"
                    rows={6}
                    value={outputValue}
                    readOnly
                    placeholder="Result will appear here..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                    aria-live="polite"
                    aria-label="Encoded or decoded output string"
                />
            </div>
        </div>
    );
}