'use client';

import React, { useState, useCallback } from 'react';
// Removed Head import: import Head from 'next/head';
import { useHistory } from '../../context/HistoryContext';
import ToolHeader from '../_components/ToolHeader'; // Import ToolHeader
import metadata from './metadata.json'; // Import local metadata

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+~=`|}{[]:;?><,./-='; // Customize as needed

export default function RandomPasswordGeneratorPage() {
  const [password, setPassword] = useState<string>('');
  const [length, setLength] = useState<number>(16);
  const [includeUppercase, setIncludeUppercase] = useState<boolean>(true);
  const [includeLowercase, setIncludeLowercase] = useState<boolean>(true);
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [includeSymbols, setIncludeSymbols] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // --- History Hook ---
  const { addHistoryEntry } = useHistory();

  // --- Generation Logic ---
  const generatePassword = useCallback(() => {
    let currentError = '';
    let generatedPassword = '';
    let status: 'success' | 'error' = 'success';

    setError('');
    setCopied(false);
    setPassword('');

    let charset = '';
    if (includeLowercase) charset += LOWERCASE;
    if (includeUppercase) charset += UPPERCASE;
    if (includeNumbers) charset += NUMBERS;
    if (includeSymbols) charset += SYMBOLS;

    if (charset.length === 0) {
      currentError = 'Please select at least one character type.';
      setError(currentError);
      status = 'error';
    } else if (length <= 0 || !Number.isInteger(length)) {
        currentError = 'Password length must be a positive whole number.';
        setError(currentError);
        status = 'error';
    } else if (length > 256) { // Add a reasonable upper limit
        currentError = 'Password length is too long (max 256 recommended).';
        setError(currentError);
        status = 'error';
    }

    if (status === 'success') {
        try {
            if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
                const randomValues = new Uint32Array(length);
                window.crypto.getRandomValues(randomValues);
                for (let i = 0; i < length; i++) {
                    generatedPassword += charset[randomValues[i] % charset.length];
                }
            } else {
                console.warn("Using Math.random for password generation as window.crypto is not available.");
                for (let i = 0; i < length; i++) {
                    const randomIndex = Math.floor(Math.random() * charset.length);
                    generatedPassword += charset[randomIndex];
                }
            }
            setPassword(generatedPassword);
        } catch (err) {
             console.error("Password Generation Error:", err);
             currentError = "An unexpected error occurred during password generation.";
             setError(currentError);
             status = 'error';
             generatedPassword = '';
        }
    }

    // --- History Logging ---
    const historyInput = {
      length: length,
      uppercase: includeUppercase,
      lowercase: includeLowercase,
      numbers: includeNumbers,
      symbols: includeSymbols,
    };
    const historyOutput = status === 'success'
        ? "[Password Generated Successfully]"
        : `Error: ${currentError}`;

    addHistoryEntry({
        toolName: metadata.title, // Use metadata title
        toolRoute: '/t/random-password-generator', // Use actual route
        action: 'generate',
        input: historyInput,
        output: historyOutput, // DO NOT log the password
        status: status,
    });

  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, addHistoryEntry]);

  // --- Copy Handler ---
  const handleCopy = useCallback(async () => {
    if (!password || !navigator.clipboard) {
      setError(!navigator.clipboard ? 'Clipboard API not available.' : 'No password to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setError(''); // Clear any previous copy errors
      setTimeout(() => setCopied(false), 2000);
      // Optionally log successful copy to history (without password)
      addHistoryEntry({
          toolName: metadata.title, toolRoute: '/t/random-password-generator',
          action: 'copy', input: { length: password.length }, output: '[Password Copied]', status: 'success'
      });
    } catch (err) {
      console.error('Failed to copy password: ', err);
      setError('Failed to copy password.');
      // Optionally log copy failure
      addHistoryEntry({
         toolName: metadata.title, toolRoute: '/t/random-password-generator',
         action: 'copy', input: { length: password.length }, output: `Error: Failed to copy`, status: 'error'
      });
    }
  }, [password, addHistoryEntry]); // Added addHistoryEntry dependency

  // --- Input Handlers ---
  const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<boolean>>, currentValue: boolean) => {
    const othersChecked = [includeUppercase, includeLowercase, includeNumbers, includeSymbols].filter(val => val).length > (currentValue ? 1 : 0);
    if (currentValue && !othersChecked) {
        setError('At least one character type must be selected.');
        return;
    }
    setter(!currentValue);
    if (error === 'Please select at least one character type.' || error === 'At least one character type must be selected.') {
        setError('');
    }
     setPassword(''); // Clear password when options change
     setCopied(false);
  };

  const handleLengthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(event.target.value, 10);
    setLength(isNaN(val) ? 0 : val);
    if (error === 'Password length must be a positive whole number.' || error.includes('length is too long')) {
        setError('');
    }
     setPassword(''); // Clear password when options change
     setCopied(false);
  };

  const canGenerate = length > 0 && Number.isInteger(length) && length <= 256 && (includeLowercase || includeUppercase || includeNumbers || includeSymbols);

  // --- JSX Structure ---
  return (
    // Main container relies on parent layout for padding, uses flex-col and gap
    <div className="flex flex-col gap-6">
        <ToolHeader
            title={metadata.title}
            description={metadata.description}
        />

        {/* Inner content container */}
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">

            {/* Generated Password Display & Copy */}
            <div className="space-y-2">
                <label htmlFor="generated-password-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">Generated Password</label>
                <div className="flex items-stretch gap-2">
                   {/* Output Input */}
                   <input
                      id="generated-password-output"
                      type="text"
                      value={password}
                      readOnly
                      className="flex-grow p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                      placeholder="Click 'Generate' to create a password"
                      aria-live="polite" // Announce password generation
                    />
                   {/* Copy Button (Secondary - Green when copied, Neutral otherwise) */}
                   <button
                     type="button"
                     onClick={handleCopy}
                     disabled={!password}
                     title={copied ? "Copied!" : "Copy to clipboard"}
                     aria-label="Copy password to clipboard"
                     className={`px-4 py-2 rounded-md font-medium focus:outline-none transition-colors duration-150 ease-in-out
                        ${copied
                         ? 'bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] text-[rgb(var(--color-button-secondary-text))]'
                         : 'bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] text-[rgb(var(--color-button-neutral-text))]'
                        }
                        disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]`}
                   >
                     {copied ? 'Copied!' : 'Copy'}
                   </button>
                </div>
                {/* Error Display */}
                {error && (
                    <div role="alert" className="mt-2 p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2">
                         {/* Error Icon (Heroicon x-circle) */}
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                         </svg>
                        <strong>Error:</strong> {error}
                    </div>
                )}
            </div>

            {/* Configuration Options */}
            <div className="space-y-4 border-t border-[rgb(var(--color-border-base))] pt-4">
                <h2 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">Options</h2>

                {/* Length Input */}
                <div>
                    <label htmlFor="password-length" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Password Length: {length}</label>
                    <input
                        id="password-length"
                        type="number"
                        min="1"
                        max="256" // Increased max, added check in generatePassword
                        step="1"
                        value={length}
                        onChange={handleLengthChange}
                        className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
                    />
                </div>

                {/* Character Types Checkboxes */}
                <fieldset className="space-y-3">
                    <legend className="sr-only">Character types to include</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                        {/* Uppercase */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="include-uppercase"
                                checked={includeUppercase}
                                onChange={() => handleCheckboxChange(setIncludeUppercase, includeUppercase)}
                                className="h-4 w-4 rounded border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]" // Use accent color, remove ring
                                style={{ accentColor: `rgb(var(--color-checkbox-accent))` }} // Explicit accent color
                            />
                            <label htmlFor="include-uppercase" className="text-sm text-[rgb(var(--color-text-muted))] select-none cursor-pointer">
                                Uppercase (A-Z)
                            </label>
                        </div>
                        {/* Lowercase */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="include-lowercase"
                                checked={includeLowercase}
                                onChange={() => handleCheckboxChange(setIncludeLowercase, includeLowercase)}
                                className="h-4 w-4 rounded border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]"
                                style={{ accentColor: `rgb(var(--color-checkbox-accent))` }}
                            />
                            <label htmlFor="include-lowercase" className="text-sm text-[rgb(var(--color-text-muted))] select-none cursor-pointer">
                                Lowercase (a-z)
                            </label>
                        </div>
                        {/* Numbers */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="include-numbers"
                                checked={includeNumbers}
                                onChange={() => handleCheckboxChange(setIncludeNumbers, includeNumbers)}
                                className="h-4 w-4 rounded border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]"
                                style={{ accentColor: `rgb(var(--color-checkbox-accent))` }}
                            />
                            <label htmlFor="include-numbers" className="text-sm text-[rgb(var(--color-text-muted))] select-none cursor-pointer">
                                Numbers (0-9)
                            </label>
                        </div>
                        {/* Symbols */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="include-symbols"
                                checked={includeSymbols}
                                onChange={() => handleCheckboxChange(setIncludeSymbols, includeSymbols)}
                                className="h-4 w-4 rounded border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]"
                                style={{ accentColor: `rgb(var(--color-checkbox-accent))` }}
                            />
                            <label htmlFor="include-symbols" className="text-sm text-[rgb(var(--color-text-muted))] select-none cursor-pointer">
                                Symbols (!@#...)
                            </label>
                        </div>
                    </div>
                </fieldset>
            </div>

            {/* Generate Button (Primary - Blue) */}
            <button
                type="button" // Explicit type
                onClick={generatePassword}
                disabled={!canGenerate}
                className="w-full sm:w-auto px-6 py-3 rounded-md text-[rgb(var(--color-button-primary-text))] font-medium bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
            >
                Generate Password
            </button>

        </div> {/* End inner flex container */}
    </div> // End main container
  );
}