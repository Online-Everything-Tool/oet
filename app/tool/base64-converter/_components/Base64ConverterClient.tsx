// FILE: app/tool/base64-converter/_components/Base64ConverterClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import type { TriggerType } from '@/src/types/history'
import useToolUrlState, { StateSetters } from '../../_hooks/useToolUrlState';
import type { ParamConfig } from '@/src/types/tools'

type Operation = 'encode' | 'decode';
type Base64Likelihood = 'unknown' | 'possibly_base64_or_text' | 'likely_text';

interface Base64ConverterClientProps {
    urlStateParams: ParamConfig[];
    toolTitle: string;
    toolRoute: string;
}

export default function Base64ConverterClient({
    urlStateParams,
    toolTitle,
    toolRoute
}: Base64ConverterClientProps) {
    const [text, setText] = useState<string>('');
    const [operation, setOperation] = useState<Operation>('encode');
    const [outputValue, setOutputValue] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [base64Likelihood, setBase64Likelihood] = useState<Base64Likelihood>('unknown');

    const { addHistoryEntry } = useHistory();
    const stateSetters = useMemo(() => ({
        text: setText,
        operation: setOperation,
    }), []);
    const { shouldRunOnLoad, setShouldRunOnLoad } = useToolUrlState(
        urlStateParams,
        stateSetters as StateSetters
    );

    useEffect(() => {
        if (!text) {
            setBase64Likelihood('unknown');
            return;
        }
        const cleanedInput = text.replace(/\s/g, '');
        if (!cleanedInput) { setBase64Likelihood('unknown'); return; }
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        const isValidLength = cleanedInput.length % 4 === 0;
        const hasValidChars = base64Regex.test(cleanedInput);
        if (isValidLength && hasValidChars) {
            try {
                atob(cleanedInput);
                setBase64Likelihood('possibly_base64_or_text');
            } catch {
                 setBase64Likelihood('likely_text');
            }
        } else {
            setBase64Likelihood('likely_text');
        }
      }, [text]);

    const handleEncode = useCallback((triggerType: TriggerType, textToProcess = text) => {
        let currentOutput = '';
        let currentError = '';
        let status: 'success' | 'error' = 'success';
        let historyOutputObj: Record<string, unknown> = {}; // For structured output

        setError('');
        setOutputValue('');
        if (!textToProcess) return;

        try {
            currentOutput = btoa(unescape(encodeURIComponent(textToProcess)));
            setOutputValue(currentOutput);
            historyOutputObj = { // Structure the success output
                operationResult: "Encoded Text",
                outputValue: currentOutput.length > 500 ? currentOutput.substring(0, 500) + '...' : currentOutput
            };
        } catch (err) {
            console.error("Encoding Error:", err);
            currentError = "Failed to encode text to Base64. Ensure text is valid UTF-8.";
            setError(currentError);
            status = 'error';
            historyOutputObj = { // Structure the error output
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
            output: historyOutputObj, // Log the structured object
            status: status,
        });
      }, [addHistoryEntry, text, toolTitle, toolRoute]);

    const handleDecode = useCallback((triggerType: TriggerType, textToProcess = text) => {
        let currentOutput = '';
        let currentError = '';
        let status: 'success' | 'error' = 'success';
        let historyOutputObj: Record<string, unknown> = {}; // For structured output

        setError('');
        setOutputValue('');
        if (!textToProcess) return;

        try {
           const cleanedTextToDecode = textToProcess.replace(/\s/g, '');
           const decodedBytes = atob(cleanedTextToDecode);
           currentOutput = decodeURIComponent(
               Array.from(decodedBytes).map((byte) => ('0' + byte.charCodeAt(0).toString(16)).slice(-2)).join('%'),
           );
           setOutputValue(currentOutput);
           historyOutputObj = { // Structure the success output
                operationResult: "Decoded Text",
                outputValue: currentOutput.length > 500 ? currentOutput.substring(0, 500) + '...' : currentOutput
            };
        } catch (err) {
            console.error("Decoding Error:", err);
            if (err instanceof DOMException && err.name === 'InvalidCharacterError') {
               currentError = "Failed to decode: Input contains characters that are not valid Base64.";
            } else {
               currentError = "An unexpected error occurred during decoding.";
            }
            setError(currentError);
            status = 'error';
             historyOutputObj = { // Structure the error output
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
            output: historyOutputObj, // Log the structured object
            status: status,
        });
      }, [addHistoryEntry, text, toolTitle, toolRoute]);

    useEffect(() => {
        if (shouldRunOnLoad && text) {
          if (operation === 'encode') {
            handleEncode('query', text);
          } else if (operation === 'decode') {
            handleDecode('query', text);
          }
          setShouldRunOnLoad(false);
        } else if (shouldRunOnLoad && !text) {
            setShouldRunOnLoad(false);
        }
      }, [shouldRunOnLoad, setShouldRunOnLoad, text, operation, handleEncode, handleDecode]);

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(event.target.value);
        setOutputValue('');
        setError('');
    };

    const handleClear = () => {
        setText('');
        setOutputValue('');
        setError('');
        setOperation('encode');
        setBase64Likelihood('unknown');
        // No history log
    };

    const getLikelihoodBarState = () => {
        switch (base64Likelihood) {
          case 'likely_text':
            return { text: 'Format: Likely Plain Text', bgColor: 'bg-[rgb(var(--color-indicator-text))]', label: 'Text', valueNow: 0 };
          case 'possibly_base64_or_text':
            return { text: 'Format: Potentially Base64', bgColor: 'bg-[rgb(var(--color-indicator-ambiguous))]', label: 'Ambiguous', valueNow: 50 };
          case 'unknown':
          default:
            return { text: 'Enter text to analyze format', bgColor: 'bg-[rgb(var(--color-indicator-base))]', label: 'Unknown', valueNow: 50 };
        }
    };
    const { text: likelihoodText, bgColor, label, valueNow } = getLikelihoodBarState();

    return (
         <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
            <div>
                <label htmlFor="base64-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Input:</label>
                <textarea
                    id="base64-input" rows={8} value={text} onChange={handleInputChange}
                    placeholder="Paste text or Base64 string here..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                    aria-describedby="format-indicator" spellCheck="false"
                />
                <div className="relative h-3 mt-1 bg-[rgb(var(--color-indicator-track-bg))] rounded-full overflow-hidden" title={`Input Format Likelihood: ${label}`}>
                    <div className={`absolute inset-0 ${bgColor} rounded-full transition-all duration-300 ease-in-out w-full`} role="progressbar" aria-label={`Input Format Likelihood: ${label}`} aria-valuenow={valueNow} aria-valuemin={0} aria-valuemax={100}></div>
                </div>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 h-4" id="format-indicator" aria-live="polite">{likelihoodText}</p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
                <button type="button" onClick={() => handleEncode('click', text)} disabled={!text} className="px-5 py-2 rounded-md text-[rgb(var(--color-button-primary-text))] font-medium bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]">Encode</button>
                <button type="button" onClick={() => handleDecode('click', text)} disabled={!text} className="px-5 py-2 rounded-md text-[rgb(var(--color-button-secondary-text))] font-medium bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] focus:outline-none transition duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]">Decode</button>
                <button type="button" onClick={handleClear} title="Clear input and output" className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition duration-150 ease-in-out ml-auto">Clear</button>
            </div>
            {error && ( <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"> <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg> <div><strong className="font-semibold">Error:</strong> {error}</div> </div> )}
            <div>
                <label htmlFor="base64-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Output:</label>
                <textarea id="base64-output" rows={8} value={outputValue} readOnly placeholder="Result will appear here..." className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]" aria-live="polite" spellCheck="false" />
            </div>
        </div>
    );
}