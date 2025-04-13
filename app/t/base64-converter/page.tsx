'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useHistory } from '../../context/HistoryContext'; // Use the real history hook
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';

type Base64Likelihood = 'unknown' | 'possibly_base64_or_text' | 'likely_text';

export default function Base64ConverterPage() {
  // --- State ---
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [base64Likelihood, setBase64Likelihood] = useState<Base64Likelihood>('unknown');

  // --- History Hook ---
  const { addHistoryEntry } = useHistory(); // Use the real hook

  // --- Likelihood Calculation ---
  useEffect(() => {
    if (!inputValue) {
        setBase64Likelihood('unknown');
        setOutputValue(''); // Clear output when input is cleared
        setError(''); // Clear error when input is cleared
        return;
    }
    const cleanedInput = inputValue.replace(/\s/g, '');
    if (!cleanedInput) { setBase64Likelihood('unknown'); return; }

    // Basic Base64 check (length, characters)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    const isValidLength = cleanedInput.length % 4 === 0;
    const hasValidChars = base64Regex.test(cleanedInput);

    if (isValidLength && hasValidChars) {
        // Further check: try decoding lightly. If it fails immediately, it's less likely base64.
        try {
            atob(cleanedInput); // Just try the core decoding step
            setBase64Likelihood('possibly_base64_or_text');
        } catch { // <-- Omitted unused error variable 'e'
            // If atob fails, it's definitely not valid Base64
             setBase64Likelihood('likely_text');
        }
    } else {
        setBase64Likelihood('likely_text');
    }
  }, [inputValue]);

  // --- Core Functions ---
  const handleEncode = useCallback(() => {
    let currentOutput = '';
    let currentError = '';
    let status: 'success' | 'error' = 'success';
    setError('');
    setOutputValue('');
    const textToEncode = inputValue;
    if (!textToEncode) return;

    try {
        // Ensure correct UTF-8 handling before btoa
        currentOutput = btoa(unescape(encodeURIComponent(textToEncode)));
        setOutputValue(currentOutput);
    } catch (err) {
        console.error("Encoding Error:", err);
        currentError = "Failed to encode text to Base64. Ensure text is valid UTF-8.";
        setError(currentError);
        status = 'error';
    }

    addHistoryEntry({
      toolName: metadata.title,
      toolRoute: '/t/base64-converter',
      action: 'encode',
      input: textToEncode.substring(0, 500) + (textToEncode.length > 500 ? '...' : ''),
      output: status === 'success' ? (currentOutput.substring(0, 500) + (currentOutput.length > 500 ? '...' : '')) : `Error: ${currentError}`,
      status: status,
    });
  }, [inputValue, addHistoryEntry]);

  const handleDecode = useCallback(() => {
    let currentOutput = '';
    let currentError = '';
    let status: 'success' | 'error' = 'success';
    setError('');
    setOutputValue('');
    const textToDecode = inputValue;
    if (!textToDecode) return;

    try {
       const cleanedTextToDecode = textToDecode.replace(/\s/g, '');
       const decodedBytes = atob(cleanedTextToDecode);
       currentOutput = decodeURIComponent(
           Array.from(decodedBytes).map((byte) => ('0' + byte.charCodeAt(0).toString(16)).slice(-2)).join('%'),
       );
       setOutputValue(currentOutput);
    } catch (err) {
        console.error("Decoding Error:", err);
        if (err instanceof DOMException && err.name === 'InvalidCharacterError') {
           currentError = "Failed to decode: Input contains characters that are not valid Base64.";
        } else {
           currentError = "An unexpected error occurred during decoding.";
        }
        setError(currentError);
        status = 'error';
    }

    addHistoryEntry({
        toolName: metadata.title,
        toolRoute: '/t/base64-converter',
        action: 'decode',
        input: textToDecode.substring(0, 500) + (textToDecode.length > 500 ? '...' : ''),
        output: status === 'success' ? (currentOutput.substring(0, 500) + (currentOutput.length > 500 ? '...' : '')) : `Error: ${currentError}`,
        status: status,
    });
  }, [inputValue, addHistoryEntry]);

  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
  };

  const handleClear = () => {
    const hadInput = inputValue !== '';
    setInputValue('');
    setOutputValue('');
    setError('');
    setBase64Likelihood('unknown');
    if (hadInput) {
       addHistoryEntry({
          toolName: metadata.title,
          toolRoute: '/t/base64-converter',
          action: 'clear',
          input: '',
          output: 'Input cleared',
          status: 'success',
       });
    }
  };

  // --- Likelihood Indicator Bar State Logic ---
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
  const { text, bgColor, label, valueNow } = getLikelihoodBarState();

  // --- JSX ---
  return (
    <div className="flex flex-col gap-6">
        <ToolHeader
            title={metadata.title}
            description={metadata.description}
        />

        <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]"> {/* Original gap-5 used here */}
            {/* Input Area */}
            <div>
                <label htmlFor="base64-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Input:</label>
                <textarea
                    id="base64-input" rows={8} value={inputValue} onChange={handleInputChange}
                    placeholder="Paste text or Base64 string here..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                    aria-describedby="format-indicator"
                    spellCheck="false"
                />
                {/* Likelihood Bar */}
                <div className="relative h-3 mt-1 bg-[rgb(var(--color-indicator-track-bg))] rounded-full overflow-hidden" title={`Input Format Likelihood: ${label}`}>
                    <div
                        className={`absolute inset-0 ${bgColor} rounded-full transition-all duration-300 ease-in-out w-full`}
                        role="progressbar" aria-label={`Input Format Likelihood: ${label}`}
                        aria-valuenow={valueNow} aria-valuemin={0} aria-valuemax={100}
                    ></div>
                </div>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 h-4" id="format-indicator" aria-live="polite">
                    {text}
                </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 items-center">
                {/* Encode Button (Primary) */}
                <button
                    type="button"
                    onClick={handleEncode}
                    disabled={!inputValue}
                    className="px-5 py-2 rounded-md text-[rgb(var(--color-button-primary-text))] font-medium bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
                >
                    Encode
                </button>
                {/* Decode Button (Secondary) */}
                <button
                    type="button"
                    onClick={handleDecode}
                    disabled={!inputValue}
                    className="px-5 py-2 rounded-md text-[rgb(var(--color-button-secondary-text))] font-medium bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] focus:outline-none transition duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
                >
                    Decode
                </button>
                {/* Clear Button (Neutral) */}
                <button
                    type="button"
                    onClick={handleClear} title="Clear input and output"
                    className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition duration-150 ease-in-out ml-auto"
                >
                    Clear
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                     </svg>
                    <div>
                        <strong className="font-semibold">Error:</strong> {error}
                    </div>
                </div>
            )}

            {/* Output Area */}
            <div>
                <label htmlFor="base64-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Output:</label>
                <textarea
                    id="base64-output" rows={8} value={outputValue} readOnly
                    placeholder="Result will appear here..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                    aria-live="polite"
                    spellCheck="false"
                />
            </div>
        </div>
    </div>
  );
}