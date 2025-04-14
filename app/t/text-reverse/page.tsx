// /app/t/text-reverse/page.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
// Import the hook AND the ParamConfig type it uses
import useToolUrlState, { ParamConfig } from '../_hooks/useToolUrlState';
import { useHistory } from '../../context/HistoryContext';
import ToolHeader from '../_components/ToolHeader';
// Import metadata - TS will infer general types initially
import metadata from './metadata.json';

// Define the different modes for reversing (needed for state type)
type ReverseMode = 'characters' | 'words' | 'lines';

export default function TextReversePage() {
    // --- State Definitions ---
    const [inputValue, setInputValue] = useState<string>('');
    const [outputValue, setOutputValue] = useState<string>('');
    const [reverseMode, setReverseMode] = useState<ReverseMode>('characters');
    const [error, setError] = useState<string>('');
    const { addHistoryEntry } = useHistory();

    // --- Create a stable reference for the state setters object ---
    const stateSetters = useMemo(() => ({
        inputValue: setInputValue,
        reverseMode: setReverseMode,
    }), []);

    // --- Use the URL State Hook ---
    // Assert the type of metadata.urlStateParams when passing it
    const { shouldRunOnLoad, setShouldRunOnLoad } = useToolUrlState(
        (metadata.urlStateParams || []) as ParamConfig[], // Assert type here
        stateSetters
    );

    // --- Core Reversing Logic ---
    const handleReverse = useCallback((textToProcess = inputValue) => {
        console.log(`Running handleReverse with mode: ${reverseMode} and text: ${textToProcess}`);
        let result = '';
        let status: 'success' | 'error' = 'success';
        let currentError = '';
        setError('');

        try {
            if (!textToProcess) {
                setOutputValue(''); return;
            }
            switch (reverseMode) {
                case 'characters': result = [...textToProcess].reverse().join(''); break;
                case 'words': result = textToProcess.split(/\s+/).filter(Boolean).reverse().join(' '); break;
                case 'lines': result = textToProcess.split(/\r\n|\r|\n/).reverse().join('\n'); break;
                default: throw new Error(`Invalid reverse mode state: ${reverseMode}`);
            }
            setOutputValue(result);
            status = 'success';

            const inputString = typeof textToProcess === 'string' ? textToProcess : JSON.stringify(textToProcess);
            const outputString = typeof result === 'string' ? result : JSON.stringify(result);
            addHistoryEntry({
                toolName: metadata.title, toolRoute: '/t/text-reverse', action: `reverse-${reverseMode}`,
                input: inputString.length > 500 ? inputString.substring(0, 500) + '...' : inputString,
                output: outputString.length > 500 ? outputString.substring(0, 500) + '...' : outputString,
                status: status, options: { mode: reverseMode },
            });
        } catch (err) {
            console.error("Error during reversing:", err);
            currentError = err instanceof Error ? err.message : "An unknown error occurred.";
            setOutputValue(''); setError(currentError); status = 'error';
            const inputStringOnError = typeof textToProcess === 'string' ? textToProcess : JSON.stringify(textToProcess);
            addHistoryEntry({
                toolName: metadata.title, toolRoute: '/t/text-reverse', action: `reverse-${reverseMode}-failed`,
                input: inputStringOnError.length > 500 ? inputStringOnError.substring(0, 500) + '...' : inputStringOnError,
                output: `Error: ${currentError}`, status: status, options: { mode: reverseMode },
            });
        }
    }, [reverseMode, addHistoryEntry, inputValue]); // inputValue needed here

    // --- Effect to run calculation after state is set from URL (via hook) ---
    useEffect(() => {
        if (shouldRunOnLoad) {
            console.log("[TextReversePage] Running calculation triggered by URL state hook.");
            handleReverse(inputValue);
            setShouldRunOnLoad(false);
        }
    }, [shouldRunOnLoad, setShouldRunOnLoad, inputValue, handleReverse]);


    // --- Event Handlers ---
    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(event.target.value);
        setOutputValue('');
        setError('');
    };

    const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newMode = event.target.value as ReverseMode;
        setReverseMode(newMode);
        setOutputValue('');
        setError('');
    };

    const handleClear = () => {
        const hadInput = inputValue !== '';
        setInputValue('');
        setOutputValue('');
        setError('');
        if (hadInput) {
           addHistoryEntry({
              toolName: metadata.title, toolRoute: '/t/text-reverse', action: 'clear',
              input: '', output: 'Input cleared', status: 'success',
           });
        }
    };

    // --- JSX Structure (Remains the same) ---
    return (
        <div className="flex flex-col gap-6">
            <ToolHeader title={metadata.title} description={metadata.description} />
            <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
                {/* Input Area */}
                <div>
                    <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Input Text:</label>
                    <textarea id="text-input" rows={8} value={inputValue} onChange={handleInputChange} placeholder="Enter text to reverse..." className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-inherit placeholder:text-[rgb(var(--color-input-placeholder))]" spellCheck="false" aria-label="Text to be reversed" />
                </div>
                {/* Controls Row */}
                <div className="flex flex-wrap gap-4 items-center border border-[rgb(var(--color-border-base))] p-3 rounded-md bg-[rgb(var(--color-bg-subtle))]">
                    <fieldset className="flex gap-x-4 gap-y-2 items-center flex-wrap">
                        <legend className="text-sm font-medium text-[rgb(var(--color-text-muted))] mr-2 shrink-0">Reverse by:</legend>
                        <div className="flex items-center"> <input type="radio" id="mode-chars" name="reverseMode" value="characters" checked={reverseMode === 'characters'} onChange={handleModeChange} className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }} /> <label htmlFor="mode-chars" className="ml-2 block text-sm text-[rgb(var(--color-text-base))] cursor-pointer"> Characters </label> </div>
                        <div className="flex items-center"> <input type="radio" id="mode-words" name="reverseMode" value="words" checked={reverseMode === 'words'} onChange={handleModeChange} className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }} /> <label htmlFor="mode-words" className="ml-2 block text-sm text-[rgb(var(--color-text-base))] cursor-pointer"> Words </label> </div>
                        <div className="flex items-center"> <input type="radio" id="mode-lines" name="reverseMode" value="lines" checked={reverseMode === 'lines'} onChange={handleModeChange} className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }} /> <label htmlFor="mode-lines" className="ml-2 block text-sm text-[rgb(var(--color-text-base))] cursor-pointer"> Lines </label> </div>
                    </fieldset>
                    <div className="flex gap-3 ml-auto">
                        <button type="button" onClick={() => handleReverse()} disabled={!inputValue} className="px-5 py-2 rounded-md text-[rgb(var(--color-button-accent-text))] font-medium bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"> Reverse </button>
                        <button type="button" onClick={handleClear} title="Clear input and output" className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out"> Clear </button>
                    </div>
                </div>
                 {/* Error Display Area */}
                 {error && ( <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2"> <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /> </svg> <strong>Error:</strong> {error} </div> )}
                {/* Output Area */}
                 <div>
                     <label htmlFor="text-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"> Output Text: </label>
                     <textarea id="text-output" rows={8} value={outputValue} readOnly placeholder="Reversed text will appear here..." className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-inherit placeholder:text-[rgb(var(--color-input-placeholder))]" aria-live="polite" aria-label="Reversed text output" />
                 </div>
            </div>
        </div>
    );
}