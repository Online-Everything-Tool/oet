// FILE: app/t/json-validate-format/_components/JsonValidateFormatClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useHistory } from '../../../context/HistoryContext';
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

    const handleFormatValidate = useCallback((textToProcess = json) => {
        let currentIsValid: boolean | null = null;
        let currentError = '';
        let currentOutput = '';
        let status: 'success' | 'error' = 'success';

        const trimmedInput = textToProcess.trim();

        setError('');
        setIsValid(null);
        setOutputValue('');

        if (!trimmedInput) {
          return;
        }

        try {
          const parsedJson = JSON.parse(trimmedInput);
          if (typeof parsedJson !== 'object' || parsedJson === null) {
               currentOutput = JSON.stringify(parsedJson);
               currentIsValid = true;
          } else {
               currentOutput = JSON.stringify(parsedJson, null, indent);
               currentIsValid = true;
          }
          setOutputValue(currentOutput);
          setIsValid(currentIsValid);
          status = 'success';

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
        }

        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            action: 'format-validate',
            input: {
                json: trimmedInput.length > 1000 ? trimmedInput.substring(0, 1000) + '...' : trimmedInput,
                indent: indent
            },
            output: status === 'success'
              ? (currentOutput.length > 1000 ? currentOutput.substring(0, 1000) + '...' : currentOutput)
              : `Error: ${currentError}`,
            status: status,
        });

    }, [json, indent, addHistoryEntry, toolTitle, toolRoute]);

    useEffect(() => {
          if (shouldRunOnLoad && json) {
              handleFormatValidate(json);
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

    const handleClear = () => {
        const hadInput = json !== '';
        setJson('');
        setOutputValue('');
        setIsValid(null);
        setError('');
        setIndent(2);
        if (hadInput) {
           addHistoryEntry({
              toolName: toolTitle,
              toolRoute: toolRoute,
              action: 'clear',
              input: { json: '', indent: 2 },
              output: 'Input/output cleared',
              status: 'success'
           });
        }
    };

    const handleIndentationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newIndentation = parseInt(event.target.value, 10);
        setIndent(newIndentation);
        if (isValid && json.trim()) {
           try {
             const parsed = JSON.parse(json.trim());
             if (typeof parsed === 'object' && parsed !== null) {
                const formatted = JSON.stringify(parsed, null, newIndentation);
                setOutputValue(formatted);
             } else {
                setOutputValue(JSON.stringify(parsed));
             }
             setError('');
           } catch (err) {
              console.error("Error reformatting on indent change:", err);
              setError("Error reformatting with new indentation.");
              setIsValid(false);
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
                     onClick={() => handleFormatValidate()}
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