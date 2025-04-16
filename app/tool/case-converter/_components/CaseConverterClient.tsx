// FILE: app/tool/case-converter/_components/CaseConverterClient.tsx
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useHistory, TriggerType } from '../../../context/HistoryContext';
import useToolUrlState, { ParamConfig, StateSetters } from '../../_hooks/useToolUrlState';

const SENTENCE_CASE_REGEX = /(^\s*\w|[.!?]\s*\w)/g;
const TITLE_CASE_DELIMITERS = /[\s\-_]+/;

const CASE_TYPES = [
  { value: 'uppercase', label: 'UPPER CASE' },
  { value: 'lowercase', label: 'lower case' },
  { value: 'sentence', label: 'Sentence case' },
  { value: 'title', label: 'Title Case' },
  { value: 'camel', label: 'camelCase' },
  { value: 'pascal', label: 'PascalCase' },
  { value: 'snake', label: 'snake_case' },
  { value: 'kebab', label: 'kebab-case' },
] as const;

type Case = typeof CASE_TYPES[number]['value'];

// Button color cycle remains the same
const buttonColorCycle = [
    { base: '--color-button-primary-bg', hover: '--color-button-primary-hover-bg', text: '--color-button-primary-text'},
    { base: '--color-button-secondary-bg', hover: '--color-button-secondary-hover-bg', text: '--color-button-secondary-text'},
    { base: '--color-button-accent2-bg', hover: '--color-button-accent2-hover-bg', text: '--color-button-accent2-text'},
    { base: '--color-button-accent-bg', hover: '--color-button-accent-hover-bg', text: '--color-button-accent-text'},
] as const;

const activeBgColorVar = '--color-button-accent-bg';
const activeHoverBgColorVar = '--color-button-accent-hover-bg';
const activeTextColorVar = '--color-button-accent-text';


interface CaseConverterClientProps {
    urlStateParams: ParamConfig[];
    toolTitle: string;
    toolRoute: string;
}

export default function CaseConverterClient({
    urlStateParams,
    toolTitle,
    toolRoute
}: CaseConverterClientProps) {
    const [text, setText] = useState<string>('');
    const [caseType, setCaseType] = useState<Case>('lowercase');
    const [outputValue, setOutputValue] = useState<string>('');
    const [error, setError] = useState<string>('');
    const { addHistoryEntry } = useHistory();

    const stateSetters = useMemo(() => ({
        text: setText,
        case: setCaseType,
    }), []);

    const { shouldRunOnLoad, setShouldRunOnLoad } = useToolUrlState(
        urlStateParams,
        stateSetters as StateSetters
    );

    // Updated handleConvertCase
    const handleConvertCase = useCallback((triggerType: TriggerType, targetCase: Case, textToProcess = text) => {
        let result = '';
        let currentError = '';
        let status: 'success' | 'error' = 'success';
        let historyOutputObj: Record<string, unknown> = {}; // For structured output
        const targetCaseLabel = CASE_TYPES.find(ct => ct.value === targetCase)?.label || targetCase; // Get label

        setError('');
        setOutputValue('');

        if (!textToProcess) return;

        try {
            switch (targetCase) {
              case 'uppercase': result = textToProcess.toUpperCase(); break;
              case 'lowercase': result = textToProcess.toLowerCase(); break;
              case 'sentence': result = textToProcess.toLowerCase().replace(SENTENCE_CASE_REGEX, (char) => char.toUpperCase()); break;
              case 'title': result = textToProcess.toLowerCase().split(TITLE_CASE_DELIMITERS).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); break;
              case 'camel': result = textToProcess.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^./, (char) => char.toLowerCase()); break;
              case 'pascal': result = textToProcess.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^./, (char) => char.toUpperCase()); break;
              case 'snake': result = textToProcess.replace(/\W+/g, " ").split(/ |\B(?=[A-Z])/).map(word => word.toLowerCase()).filter(Boolean).join('_'); break;
              case 'kebab': result = textToProcess.replace(/\W+/g, " ").split(/ |\B(?=[A-Z])/).map(word => word.toLowerCase()).filter(Boolean).join('-'); break;
              default:
                 const exhaustiveCheck: never = targetCase;
                 throw new Error(`Unsupported case type: ${exhaustiveCheck}`);
            }
            setOutputValue(result);
            historyOutputObj = { // Structure the success output
                resultCaseTypeLabel: targetCaseLabel,
                outputValue: result.length > 500 ? result.substring(0, 500) + '...' : result
            };
        } catch (err) {
            console.error("Case conversion error:", err);
            currentError = err instanceof Error ? err.message : "Failed to convert case.";
            setError(currentError);
            status = 'error';
            historyOutputObj = { // Structure the error output
                resultCaseTypeLabel: `Error converting to ${targetCaseLabel}`,
                errorMessage: currentError
            };
        }

        // Log the conversion action
        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: triggerType,
            input: {
                text: textToProcess.length > 500 ? textToProcess.substring(0, 500) + '...' : textToProcess,
                case: targetCase // Log the internal value ('lowercase')
            },
            output: historyOutputObj, // Log the structured object
            status: status,
        });

    }, [text, addHistoryEntry, toolTitle, toolRoute]); // Dependencies remain the same

    useEffect(() => {
        if (shouldRunOnLoad && text) {
            handleConvertCase('query', caseType, text);
            setShouldRunOnLoad(false);
        } else if (shouldRunOnLoad && !text) {
            setShouldRunOnLoad(false);
        }
    }, [shouldRunOnLoad, setShouldRunOnLoad, text, caseType, handleConvertCase]);

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(event.target.value);
        setOutputValue(''); setError('');
    };

    const handleClear = useCallback(() => {
        setText('');
        setOutputValue('');
        setError('');
        setCaseType('lowercase');
        // No history log
    }, []);

    const handleCaseButtonClick = (newCaseType: Case) => {
        setCaseType(newCaseType);
        if (text) {
           handleConvertCase('click', newCaseType, text);
        } else {
           setOutputValue('');
           setError('');
        }
    };

    const currentCaseLabel = useMemo(() => {
        return CASE_TYPES.find(ct => ct.value === caseType)?.label || caseType;
    }, [caseType]);

    return (
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
            <div>
                <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Input Text:</label>
                <textarea
                    id="text-input"
                    rows={8}
                    value={text}
                    onChange={handleInputChange}
                    placeholder="Paste or type your text here..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
                    spellCheck="false"
                />
            </div>

            <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
                <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-3">Convert to:</label>
                <div className="flex flex-wrap gap-2">
                    {CASE_TYPES.map((ct, index) => {
                        const isActive = caseType === ct.value;
                        const colorIndex = index % buttonColorCycle.length;
                        const colors = buttonColorCycle[colorIndex];

                        const baseClasses = "px-3 py-1.5 rounded-md text-sm font-medium border-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1";
                        const inactiveClasses = `bg-[rgb(var(${colors.base}))] border-transparent text-[rgb(var(${colors.text}))] hover:bg-[rgb(var(${colors.hover}))] focus:ring-[rgb(var(${colors.base})/0.5)]`;
                        const activeClasses = `bg-[rgb(var(${activeBgColorVar}))] border-transparent text-[rgb(var(${activeTextColorVar}))] hover:bg-[rgb(var(${activeHoverBgColorVar}))] ring-2 ring-offset-2 ring-[rgb(var(${activeBgColorVar}))]`;

                        return (
                            <button
                                key={ct.value}
                                type="button"
                                onClick={() => handleCaseButtonClick(ct.value)}
                                disabled={!text}
                                className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
                                aria-pressed={isActive}
                            >
                                {ct.label}
                            </button>
                        );
                    })}
                     <button
                        type="button"
                        onClick={handleClear}
                        disabled={!text && !outputValue && !error}
                        title="Clear input and output"
                        className="px-3 py-1.5 rounded-md text-[rgb(var(--color-button-neutral-text))] text-sm font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] border border-[rgb(var(--color-border-base))] focus:outline-none transition-colors duration-150 ease-in-out ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {error && ( <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"> <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg> <div><strong className="font-semibold">Error:</strong> {error}</div> </div> )}
            <div>
                <label htmlFor="text-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
                    Output ({currentCaseLabel}):
                </label>
                <textarea
                    id="text-output"
                    rows={8}
                    value={outputValue}
                    readOnly
                    placeholder="Result appears here..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
                    aria-live="polite"
                    spellCheck="false"
                 />
            </div>
        </div>
    );
}