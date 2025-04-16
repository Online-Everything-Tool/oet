// FILE: app/tool/json-validate-format/_components/JsonValidateFormatClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useHistory, TriggerType } from '../../../context/HistoryContext';
import useToolUrlState, { ParamConfig, StateSetters } from '../../_hooks/useToolUrlState';

interface JsonValidateFormatClientProps {
    urlStateParams: ParamConfig[];
    toolTitle: string;
    toolRoute: string;
}

export default function JsonValidateFormatClient({
    urlStateParams,
    toolTitle,
    toolRoute
}: JsonValidateFormatClientProps) {
    const [json, setJson] = useState<string>('');
    const [indent, setIndent] = useState<number>(2);
    const [outputValue, setOutputValue] = useState<string>('');
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [error, setError] = useState<string>('');
    const { addHistoryEntry } = useHistory();

    const stateSetters = useMemo(() => ({
        json: setJson,
        indent: setIndent,
    }), []);

    const { shouldRunOnLoad, setShouldRunOnLoad } = useToolUrlState(
       urlStateParams,
       stateSetters as StateSetters
    );

    // Updated handleFormatValidate
    const handleFormatValidate = useCallback((triggerType: TriggerType, textToProcess = json) => {
        let currentIsValid: boolean | null = null;
        let currentError = '';
        let currentOutput = '';
        let status: 'success' | 'error' = 'success';
        let historyOutputObj: Record<string, unknown> = {}; // For structured output

        const trimmedInput = textToProcess.trim();

        setError('');
        setIsValid(null);
        setOutputValue('');

        if (!trimmedInput) {
          return; // Don't log history for empty input
        }

        const inputDetails = { // Define input details for logging
            json: trimmedInput.length > 1000 ? trimmedInput.substring(0, 1000) + '...' : trimmedInput,
            indent: indent
        };

        try {
          const parsedJson = JSON.parse(trimmedInput);
          if (typeof parsedJson === 'object' && parsedJson !== null) {
               currentOutput = JSON.stringify(parsedJson, null, indent);
          } else {
               // Handle valid non-object JSON (e.g., "true", 123, "\"string\"")
               // We still consider it valid, but formatting doesn't change much
               currentOutput = JSON.stringify(parsedJson);
          }
          currentIsValid = true;
          setOutputValue(currentOutput);
          setIsValid(currentIsValid);
          status = 'success';
          historyOutputObj = { // Structure the success output
              validationStatus: "Valid JSON",
              formattedJson: currentOutput.length > 1000 ? currentOutput.substring(0, 1000) + '...' : currentOutput
          };

        } catch (err) {
          console.error("JSON Processing Error:", err);
          if (err instanceof Error) {
            currentError = `Invalid JSON: ${err.message}`;
          } else {
            currentError = "Invalid JSON: An unknown error occurred during parsing.";
          }
          currentOutput = '';
          currentIsValid = false;
          setError(currentError);
          setIsValid(currentIsValid);
          status = 'error';
          (inputDetails as Record<string, unknown>).error = currentError; // Add error details
           historyOutputObj = { // Structure the error output
               validationStatus: "Invalid JSON",
               errorMessage: currentError
           };
        }

        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: triggerType,
            input: inputDetails,
            output: historyOutputObj, // Log the structured object
            status: status,
        });

    }, [json, indent, addHistoryEntry, toolTitle, toolRoute]); // Dependencies remain the same

    useEffect(() => {
          if (shouldRunOnLoad && json) {
              handleFormatValidate('query', json);
              setShouldRunOnLoad(false);
          } else if (shouldRunOnLoad && !json) {
              setShouldRunOnLoad(false);
          }
    }, [shouldRunOnLoad, setShouldRunOnLoad, json, indent, handleFormatValidate]);


    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setJson(event.target.value);
        setIsValid(null);
        setError('');
        setOutputValue('');
    };

    const handleClear = useCallback(() => {
        setJson('');
        setOutputValue('');
        setIsValid(null);
        setError('');
        setIndent(2);
        // No history log
    }, []);

    // Updated handleIndentationChange
    const handleIndentationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newIndentation = parseInt(event.target.value, 10);
        setIndent(newIndentation);

        if (isValid && json.trim()) {
           let status: 'success' | 'error' = 'success';
           let output = '';
           let historyOutputObj: Record<string, unknown> = {};
           let inputError = undefined;

           try {
             const parsed = JSON.parse(json.trim());
             if (typeof parsed === 'object' && parsed !== null) {
                output = JSON.stringify(parsed, null, newIndentation);
             } else {
                output = JSON.stringify(parsed);
             }
             setOutputValue(output);
             setError('');
             historyOutputObj = { // Structure the success output
                validationStatus: "Reformatted JSON", // Indicate action
                formattedJson: output.length > 1000 ? output.substring(0, 1000) + '...' : output
             };
           } catch (err) {
              console.error("Error reformatting on indent change:", err);
              const message = "Error reformatting with new indentation.";
              setError(message);
              setIsValid(false);
              status = 'error';
              inputError = message; // Capture error for input log
               historyOutputObj = { // Structure the error output
                   validationStatus: "Reformatting Error",
                   errorMessage: message
               };
           } finally {
                addHistoryEntry({
                    toolName: toolTitle,
                    toolRoute: toolRoute,
                    trigger: 'click',
                    input: {
                        json: '[Current Valid JSON]', // Keep input short
                        indent: newIndentation,
                        ...(inputError && {error: inputError}) // Add error if it occurred
                    },
                    output: historyOutputObj, // Log structured output
                    status: status,
                });
           }
        } else {
            setOutputValue('');
        }
    };

    return (
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
            <div>
                <label htmlFor="json-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Input JSON:</label>
                <textarea
                    id="json-input"
                    rows={8}
                    value={json}
                    onChange={handleInputChange}
                    placeholder={`Paste your JSON here...\n{\n  "example": "data",\n  "isValid": true\n}`}
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-sm font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                    spellCheck="false"
                    aria-invalid={isValid === false}
                    aria-describedby={isValid === false ? "json-error-feedback" : undefined}
                />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
                 <button
                     type="button"
                     onClick={() => handleFormatValidate('click', json)}
                     className="px-5 py-2 rounded-md text-[rgb(var(--color-button-accent-text))] font-medium bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out"
                 >
                    Validate & Format
                 </button>
                 <div className="flex items-center gap-2">
                    <label htmlFor="indent-select" className="text-sm font-medium text-[rgb(var(--color-text-muted))]">Indentation:</label>
                    <select
                        id="indent-select"
                        name="indent"
                        value={indent}
                        onChange={handleIndentationChange}
                        className="rounded-md border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm py-1.5 px-2"
                    >
                       <option value={2}>2 Spaces</option>
                       <option value={4}>4 Spaces</option>
                       <option value={0}>Compact</option>
                    </select>
                 </div>
                 <button
                    type="button"
                    onClick={handleClear}
                    title="Clear input and output"
                    className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out ml-auto"
                 >
                    Clear
                 </button>
            </div>
            {isValid !== null && (
                <div
                    id="json-error-feedback"
                    className={`p-3 border rounded-md text-sm flex items-start sm:items-center gap-2 ${isValid ? 'bg-green-100 border-green-300 text-green-800' : 'bg-[rgb(var(--color-bg-error-subtle))] border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))]'}`} role="alert">
                    {isValid ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /> </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /> </svg>
                    )}
                    <div>
                        {isValid ? (
                             <strong>Valid JSON</strong>
                        ) : (
                             <> <strong className="font-semibold">Error:</strong> {error} </>
                        )}
                    </div>
                </div>
            )}
            <div>
               <label htmlFor="json-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Output:</label>
               <textarea
                  id="json-output"
                  rows={10}
                  value={outputValue}
                  readOnly
                  placeholder="Formatted JSON will appear here..."
                  className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-sm font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                  spellCheck="false"
                  aria-live="polite"
               />
            </div>
        </div>
    );
}