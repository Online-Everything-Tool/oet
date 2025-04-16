// FILE: app/tool/text-reverse/_components/TextReverseClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import type { TriggerType } from '@/src/types/history'
import useToolUrlState, { StateSetters } from '../../_hooks/useToolUrlState';
import type { ParamConfig } from '@/src/types/tools';

type Reverse = 'characters' | 'words' | 'lines';

interface TextReverseClientProps {
    urlStateParams: ParamConfig[];
    toolTitle: string;
    toolRoute: string;
}

export default function TextReverseClient({
    urlStateParams,
    toolTitle,
    toolRoute
}: TextReverseClientProps) {
    const [text, setText] = useState<string>('');
    const [outputValue, setOutputValue] = useState<string>('');
    const [reverse, setReverse] = useState<Reverse>('characters');
    const [error, setError] = useState<string>('');
    const { addHistoryEntry } = useHistory();

    const stateSetters = useMemo(() => ({
        text: setText,
        reverse: setReverse,
    }), []);

    const { shouldRunOnLoad, setShouldRunOnLoad } = useToolUrlState(
        urlStateParams,
        stateSetters as StateSetters
    );

    // Updated handleReverse
    const handleReverse = useCallback((triggerType: TriggerType, textToProcess = text) => {
        let result = '';
        let status: 'success' | 'error' = 'success';
        let currentError = '';
        let historyOutputObj: Record<string, unknown> = {}; // For structured output

        setError('');
        setOutputValue('');

        if (!textToProcess) {
            return; // Don't process or log history for empty input
        }

        try {
            switch (reverse) {
                case 'characters': result = [...textToProcess].reverse().join(''); break;
                case 'words': result = textToProcess.split(/\s+/).filter(Boolean).reverse().join(' '); break;
                case 'lines': result = textToProcess.split(/\r\n|\r|\n/).reverse().join('\n'); break;
                default: throw new Error(`Invalid reverse mode state: ${reverse}`);
            }
            setOutputValue(result);
            status = 'success';
             historyOutputObj = { // Structure the success output
                 reversalType: reverse.charAt(0).toUpperCase() + reverse.slice(1), // Capitalize for display
                 resultValue: result.length > 500 ? result.substring(0, 500) + '...' : result
             };
        } catch (err) {
            console.error("Error during reversing:", err);
            currentError = err instanceof Error ? err.message : "An unknown error occurred.";
            setOutputValue('');
            setError(currentError);
            status = 'error';
            historyOutputObj = { // Structure the error output
                reversalType: `Error (Reverse ${reverse})`,
                errorMessage: currentError
            };
        }

        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: triggerType,
            input: {
                text: textToProcess.length > 500 ? textToProcess.substring(0, 500) + '...' : textToProcess,
                reverse: reverse // Log the internal value
            },
            output: historyOutputObj, // Log structured object
            status: status,
        });

    }, [reverse, text, addHistoryEntry, toolTitle, toolRoute]); // Updated dependencies

    useEffect(() => {
        if (shouldRunOnLoad && text) {
            handleReverse('query', text);
            setShouldRunOnLoad(false);
        } else if (shouldRunOnLoad && !text) {
            setShouldRunOnLoad(false);
        }
    }, [shouldRunOnLoad, setShouldRunOnLoad, text, reverse, handleReverse]); // Dependencies remain the same

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(event.target.value);
        setOutputValue('');
        setError('');
    };

    const handleReverseChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newMode = event.target.value as Reverse;
        setReverse(newMode);
        setOutputValue('');
        setError('');
        if (text) {
            // Treat changing the radio as a 'click' trigger
            handleReverse('click', text);
        }
    };

    const handleClear = () => {
        setText('');
        setOutputValue('');
        setError('');
        setReverse('characters');
        // No history log
    };

    return (
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
            <div>
                <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Input Text:</label>
                <textarea
                    id="text-input"
                    rows={8}
                    value={text}
                    onChange={handleInputChange}
                    placeholder="Enter text to reverse..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-inherit placeholder:text-[rgb(var(--color-input-placeholder))]"
                    spellCheck="false"
                    aria-label="Text to be reversed"
                 />
            </div>
            <div className="flex flex-wrap gap-4 items-center border border-[rgb(var(--color-border-base))] p-3 rounded-md bg-[rgb(var(--color-bg-subtle))]">
                <fieldset className="flex gap-x-4 gap-y-2 items-center flex-wrap">
                    <legend className="text-sm font-medium text-[rgb(var(--color-text-muted))] mr-2 shrink-0">Reverse by:</legend>
                    <div className="flex items-center"> <input type="radio" id="mode-chars" name="reverse" value="characters" checked={reverse === 'characters'} onChange={handleReverseChange} className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }} /> <label htmlFor="mode-chars" className="ml-2 block text-sm text-[rgb(var(--color-text-base))] cursor-pointer"> Characters </label> </div>
                    <div className="flex items-center"> <input type="radio" id="mode-words" name="reverse" value="words" checked={reverse === 'words'} onChange={handleReverseChange} className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }} /> <label htmlFor="mode-words" className="ml-2 block text-sm text-[rgb(var(--color-text-base))] cursor-pointer"> Words </label> </div>
                    <div className="flex items-center"> <input type="radio" id="mode-lines" name="reverse" value="lines" checked={reverse === 'lines'} onChange={handleReverseChange} className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }} /> <label htmlFor="mode-lines" className="ml-2 block text-sm text-[rgb(var(--color-text-base))] cursor-pointer"> Lines </label> </div>
                </fieldset>
                <div className="flex gap-3 ml-auto">
                    <button
                        type="button"
                        onClick={() => handleReverse('click', text)} // Explicitly pass 'click' trigger
                        disabled={!text}
                        className="px-5 py-2 rounded-md text-[rgb(var(--color-button-primary-text))] font-medium bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]">
                        Reverse
                    </button>
                    <button type="button" onClick={handleClear} title="Clear input and output" className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out"> Clear </button>
                </div>
            </div>
             {error && ( <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2"> <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /> </svg> <strong>Error:</strong> {error} </div> )}
             <div>
                 <label htmlFor="text-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"> Output Text: </label>
                 <textarea
                    id="text-output"
                    rows={8}
                    value={outputValue}
                    readOnly
                    placeholder="Reversed text will appear here..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-inherit placeholder:text-[rgb(var(--color-input-placeholder))]"
                    aria-live="polite"
                    aria-label="Reversed text output" />
             </div>
        </div>
    );
}