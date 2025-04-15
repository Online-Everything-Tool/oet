// FILE: app/t/text-strike-through/_components/TextStrikeThroughClient.tsx
'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useHistory, TriggerType } from '../../../context/HistoryContext';
import useToolUrlState, { ParamConfig, StateSetters } from '../../_hooks/useToolUrlState';

interface TextStrikeThroughClientProps {
    urlStateParams: ParamConfig[];
    toolTitle: string;
    toolRoute: string;
}

export default function TextStrikeThroughClient({
    urlStateParams,
    toolTitle,
    toolRoute
}: TextStrikeThroughClientProps) {
    const [text, setText] = useState<string>('');
    const [skipSpaces, setSkipSpaces] = useState<boolean>(false);
    const [color, setColor] = useState<string>('#dc2626'); // Default to red-600
    const [isCopied, setIsCopied] = useState<boolean>(false);
    const lastLoggedTextRef = useRef<string | null>(null);
    const lastLoggedSkipSpacesRef = useRef<boolean | null>(null);
    const lastLoggedColorRef = useRef<string | null>(null);
    const initialLoadComplete = useRef(false);

    const { addHistoryEntry } = useHistory();

    const stateSetters = useMemo(() => ({
        text: setText,
        skipSpaces: setSkipSpaces,
        color: setColor,
    }), []);

    // Use URL state hook - Note: Initial load doesn't trigger history here directly
    useToolUrlState(
        urlStateParams,
        stateSetters as StateSetters
    );

    // Effect to initialize refs after potential hydration from URL/defaults
    useEffect(() => {
          if (!initialLoadComplete.current) {
              lastLoggedTextRef.current = text;
              lastLoggedSkipSpacesRef.current = skipSpaces;
              lastLoggedColorRef.current = color;
              initialLoadComplete.current = true;
               // We don't log the initial state setting from URL/defaults
          }
    }, [text, skipSpaces, color]);


    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(event.target.value);
        setIsCopied(false);
    }, []);

    const handleSkipSpacesChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setSkipSpaces(event.target.checked);
        setIsCopied(false);
        // Log will happen on blur
    }, []);

    const handleColorChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setColor(event.target.value);
        setIsCopied(false);
        // Log will happen on blur
    }, []);

    // --- handleTextBlur logs significant state changes ---
    const handleTextBlur = useCallback(() => {
        if (!initialLoadComplete.current) {
            return; // Don't log before initial state is set
        }

        const currentText = text;
        const currentSkipSpaces = skipSpaces;
        const currentColor = color;

        const textChanged = currentText !== lastLoggedTextRef.current;
        const skipSpacesChanged = currentSkipSpaces !== lastLoggedSkipSpacesRef.current;
        const colorChanged = currentColor !== lastLoggedColorRef.current;

        // Only log if a relevant state affecting the output has changed
        if (textChanged || skipSpacesChanged || colorChanged) {
            addHistoryEntry({
                toolName: toolTitle,
                toolRoute: toolRoute,
                trigger: 'auto', // Triggered by change + blur
                input: {
                    text: currentText.length > 500 ? currentText.substring(0, 500) + '...' : currentText,
                    skipSpaces: currentSkipSpaces,
                    color: currentColor
                },
                output: '[Visual formatting updated]', // Output is visual, not text
                status: 'success',
            });

            // Update refs to the newly logged state
            lastLoggedTextRef.current = currentText;
            lastLoggedSkipSpacesRef.current = currentSkipSpaces;
            lastLoggedColorRef.current = currentColor;
        }
    }, [text, skipSpaces, color, addHistoryEntry, toolTitle, toolRoute]);

    // --- UPDATED handleClear to REMOVE history logging ---
    const handleClear = useCallback(() => {
        setText('');
        setSkipSpaces(false);
        setColor('#dc2626');
        setIsCopied(false);
        // Reset refs to avoid logging the clear action on next blur
        lastLoggedTextRef.current = '';
        lastLoggedSkipSpacesRef.current = false;
        lastLoggedColorRef.current = '#dc2626';
        // History logging removed
    }, []); // Dependencies updated
    // --- END UPDATE ---

    // --- UPDATED handleCopy to REMOVE history logging ---
    const handleCopy = useCallback(() => {
        if (!text || !navigator.clipboard) return;

        navigator.clipboard.writeText(text).then(
          () => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 1500);
            // History logging removed
          },
          (err) => {
            console.error('Failed to copy text: ', err);
            // History logging removed
          }
        );
        // History logging removed from finally block
    }, [text]); // Dependencies updated
    // --- END UPDATE ---

    const renderedOutput = useMemo(() => {
        if (!text) {
          return <span className="italic text-[rgb(var(--color-input-placeholder))]">Output preview appears here...</span>;
        }
        const strikeStyle = {
            textDecoration: 'line-through',
            textDecorationColor: color,
            // Ensure consistent line style (optional, but good practice)
            textDecorationStyle: 'solid' as React.CSSProperties['textDecorationStyle'],
        };
        if (!skipSpaces) {
          return <span style={strikeStyle}>{text}</span>;
        } else {
          // More robust space handling: preserve multiple spaces
          const segments = text.split(/(\s+)/); // Split by whitespace, keeping delimiters
          return segments.map((segment, index) => {
            if (segment.match(/\s+/)) { // If it's whitespace
              return <React.Fragment key={index}>{segment}</React.Fragment>;
            } else if (segment) { // If it's non-empty text
              return <span key={index} style={strikeStyle}>{segment}</span>;
            }
            return null; // Handle potential empty strings from split
          });
        }
    }, [text, skipSpaces, color]);

    return (
        // --- JSX Unchanged ---
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                <div className="space-y-1 h-full flex flex-col">
                    <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
                      Input Text
                    </label>
                    <textarea
                      id="text-input"
                      name="text"
                      rows={8}
                      value={text}
                      onChange={handleInputChange}
                      onBlur={handleTextBlur}
                      className="block w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base placeholder:text-[rgb(var(--color-input-placeholder))] flex-grow"
                      placeholder="Paste or type your text here..."
                      aria-label="Input text for strikethrough formatting"
                    />
                </div>
                <div className="space-y-1 h-full flex flex-col">
                    <label htmlFor="outputTextDisplay" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
                      Strikethrough Output (Visual Preview)
                    </label>
                    <div
                      id="outputTextDisplay"
                      aria-live="polite"
                      className="block w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm resize-none overflow-auto whitespace-pre-wrap flex-grow"
                    >
                      {renderedOutput}
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap gap-4 items-center border border-[rgb(var(--color-border-base))] p-3 rounded-md bg-[rgb(var(--color-bg-subtle))]">
               <fieldset className="flex flex-wrap gap-x-4 gap-y-2 items-center">
                   <legend className="sr-only">Strikethrough Options</legend>
                   <div className="flex items-center gap-2">
                       <input
                           type="checkbox"
                           id="skipSpaces-input"
                           name="skipSpaces"
                           checked={skipSpaces}
                           onChange={handleSkipSpacesChange}
                           onBlur={handleTextBlur}
                           className="h-4 w-4 rounded border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]"
                           style={{ accentColor: `rgb(var(--color-checkbox-accent))` }}
                       />
                       <label htmlFor="skipSpaces-input" className="text-sm text-[rgb(var(--color-text-muted))] select-none cursor-pointer">
                           Skip Spaces
                       </label>
                   </div>
                   <div className="flex items-center gap-2">
                       <label htmlFor="color-input" className="text-sm text-[rgb(var(--color-text-muted))]">
                           Color:
                       </label>
                       <input
                           type="color"
                           id="color-input"
                           name="color"
                           value={color}
                           onChange={handleColorChange}
                           onBlur={handleTextBlur}
                           className="h-7 w-10 border border-[rgb(var(--color-input-border))] rounded cursor-pointer p-0.5 bg-[rgb(var(--color-input-bg))]"
                           aria-label="Strikethrough color picker"
                        />
                   </div>
               </fieldset>
               <div className="flex items-center space-x-3 ml-auto">
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!text}
                        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none transition-colors duration-150 ease-in-out
                            ${isCopied
                              ? 'bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] text-[rgb(var(--color-button-secondary-text))]'
                              : 'bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] text-[rgb(var(--color-button-accent2-text))]'
                            }
                            disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]`}
                    >
                        {isCopied ? 'Copied!' : 'Copy Text'}
                    </button>
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={!text}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Clear
                    </button>
                </div>
            </div>
        </div>
    );
}