// /app/t/base64-converter/page.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';

type Base64Likelihood = 'unknown' | 'possibly_base64_or_text' | 'likely_text';

export default function Base64ConverterPage() {
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [base64Likelihood, setBase64Likelihood] = useState<Base64Likelihood>('unknown');

  // Dummy history function
  const addHistoryEntry = useCallback((_entry: any) => { console.log("History entry:", _entry); }, []);

  // useEffect for Likelihood Calculation
  useEffect(() => {
    if (!inputValue) { setBase64Likelihood('unknown'); return; }
    const cleanedInput = inputValue.replace(/\s/g, '');
    if (!cleanedInput) { setBase64Likelihood('unknown'); return; }
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    const isValidLength = cleanedInput.length % 4 === 0;
    const hasValidChars = base64Regex.test(cleanedInput);
    if (isValidLength && hasValidChars) { setBase64Likelihood('possibly_base64_or_text'); }
    else { setBase64Likelihood('likely_text'); }
  }, [inputValue]);

  // --- Core Functions (Bodies fully restored) ---
  const handleEncode = useCallback(() => {
    let currentOutput = '';
    let currentError = '';
    let status: 'success' | 'error' = 'success';
    setError('');
    setOutputValue('');
    const textToEncode = inputValue;
    if (!textToEncode) return;

    try {
      currentOutput = btoa(unescape(encodeURIComponent(textToEncode)));
      setOutputValue(currentOutput);
    } catch (err) {
      console.error("Encoding Error:", err);
      currentError = "Failed to encode text. Ensure text is valid UTF-8.";
      setError(currentError);
      status = 'error';
    }

    addHistoryEntry({
      toolName: metadata.title, toolRoute: '/t/base64-converter', action: 'encode',
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
       const decodedBytes = atob(textToDecode.replace(/\s/g, ''));
       currentOutput = decodeURIComponent(
           Array.from(decodedBytes).map((byte) => ('0' + byte.charCodeAt(0).toString(16)).slice(-2)).join('%'),
       );
       setOutputValue(currentOutput);
    } catch (err) {
        console.error("Decoding Error:", err);
        if (err instanceof DOMException && err.name === 'InvalidCharacterError') {
           currentError = "Failed to decode: Input is not valid Base64.";
        } else {
           currentError = "An unexpected error occurred during decoding.";
        }
        setError(currentError);
        status = 'error';
    }

    addHistoryEntry({
        toolName: metadata.title, toolRoute: '/t/base64-converter', action: 'decode',
        input: textToDecode.substring(0, 500) + (textToDecode.length > 500 ? '...' : ''),
        output: status === 'success' ? (currentOutput.substring(0, 500) + (currentOutput.length > 500 ? '...' : '')) : `Error: ${currentError}`,
        status: status,
    });
  }, [inputValue, addHistoryEntry]);

  // Event Handlers
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    setError('');
  };

  const handleClear = () => {
    setInputValue('');
    setOutputValue('');
    setError('');
    setBase64Likelihood('unknown');
  };

  // --- Likelihood Indicator Bar State Logic ---
  const getLikelihoodBarState = () => {
    switch (base64Likelihood) {
      case 'likely_text':
        return { text: 'Likely Plain Text', bgColor: 'bg-[rgb(var(--color-indicator-text))]', label: 'Text', valueNow: 0 };
      case 'possibly_base64_or_text':
        return { text: 'Format Ambiguous', bgColor: 'bg-[rgb(var(--color-indicator-ambiguous))]', label: 'Ambiguous', valueNow: 50 };
      case 'unknown':
      default:
        return { text: 'Enter text to analyze format', bgColor: 'bg-[rgb(var(--color-indicator-base))]', label: 'Unknown', valueNow: 50 };
    }
  };
  const { text, bgColor, label, valueNow } = getLikelihoodBarState();

  // --- JSX ---
  return (
    <div className="p-0"> {/* Layout provides padding */}
      <ToolHeader
          title={metadata.title}
          description={metadata.description}
      />

      <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
        {/* Input Area */}
        <div>
          <label htmlFor="base64-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Input:</label>
          <textarea
            id="base64-input" rows={8} value={inputValue} onChange={handleInputChange}
            placeholder="Paste text or Base64 string here..."
            className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
            aria-describedby="format-indicator"
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
          <button
             onClick={handleEncode}
             className="px-5 py-2 rounded-md text-[rgb(var(--color-button-primary-text))] font-medium bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition duration-150 ease-in-out"
          > Encode to Base64 </button>
          <button
            onClick={handleDecode}
            className="px-5 py-2 rounded-md text-[rgb(var(--color-button-secondary-text))] font-medium bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] focus:outline-none transition duration-150 ease-in-out"
          > Decode from Base64 </button>
          <button
             onClick={handleClear} title="Clear input and output"
             className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition duration-150 ease-in-out ml-auto"
          > Clear </button>
        </div>
        {/* Error Display */}
        {error && (
          <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm">
            <strong>Error:</strong> {error}
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
          />
        </div>
      </div>
    </div>
  );
}