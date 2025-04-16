// FILE: app/tool/password-generator/_components/PasswordGeneratorClient.tsx
'use client';

// Removed unused useEffect, LoggingPreference
import React, { useState, useCallback } from 'react';
// Only need TriggerType for generatePassword
import { useHistory, TriggerType } from '../../../context/HistoryContext';
// Removed Shoelace imports as they are in ToolSettings now

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+~=`|}{[]:;?><,./-=';

interface PasswordGeneratorClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function PasswordGeneratorClient({
  toolTitle,
  toolRoute
}: PasswordGeneratorClientProps) {
  const [password, setPassword] = useState<string>('');
  const [length, setLength] = useState<number>(16);
  const [includeUppercase, setIncludeUppercase] = useState<boolean>(true);
  const [includeLowercase, setIncludeLowercase] = useState<boolean>(true);
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [includeSymbols, setIncludeSymbols] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const { addHistoryEntry } = useHistory();

  const generatePassword = useCallback((trigger: TriggerType = 'click') => {
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
      status = 'error';
    } else if (length <= 0 || !Number.isInteger(length)) {
        currentError = 'Password length must be a positive whole number.';
        status = 'error';
    } else if (length > 256) {
        setError('Warning: Password length is very long (> 256). Generation might be slow or browser may struggle.');
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
             status = 'error';
             generatedPassword = '';
             setPassword('');
        }
    }

    if (status === 'error') {
         setError(currentError);
    }

    const historyInput: Record<string, unknown> = {
      length: length,
      uppercase: includeUppercase,
      lowercase: includeLowercase,
      numbers: includeNumbers,
      symbols: includeSymbols,
    };
    if (status === 'error') {
        historyInput.error = currentError;
    }

    addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: trigger,
        input: historyInput,
        output: generatedPassword || `Error: ${currentError}`,
        status: status,
    });

  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, addHistoryEntry, toolTitle, toolRoute]);

  const handleCopy = useCallback(async () => {
    if (!password || !navigator.clipboard) {
        setError(!navigator.clipboard ? 'Clipboard API not available.' : 'No password to copy.');
        return;
     }
    setError('');
    // Removed unused history variables
    // let status: 'success' | 'error' = 'success';
    // let historyOutput = '[Password copied to clipboard]';
    // const inputDetails = { copiedPasswordLength: password.length };
    // let historyError = undefined;

    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err: unknown) {
      console.error('Failed to copy password: ', err);
      const message = 'Failed to copy password.';
      setError(message);
      // status = 'error';
      // historyOutput = `Error: ${message}`;
      // historyError = historyOutput;
    }
    // History logging removed
  }, [password]); // Dependencies updated

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
     setPassword('');
     setCopied(false);
  };

  const handleLengthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
     const val = parseInt(event.target.value, 10);
     setLength(isNaN(val) ? 0 : Math.max(1, Math.min(256, val)));
     if (error === 'Password length must be a positive whole number.' || error.includes('length is very long')) {
         setError('');
     }
      setPassword('');
      setCopied(false);
  };

  const canGenerate = length > 0 && length <= 256 && (includeLowercase || includeUppercase || includeNumbers || includeSymbols);

  // --- Render function ---
  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
            {/* Settings button DIV removed from here */}
            <div className="space-y-2">
                <label htmlFor="generated-password-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">Generated Password</label>
                <div className="flex items-stretch gap-2">
                   <input
                      id="generated-password-output"
                      type="text"
                      value={password}
                      readOnly
                      className="flex-grow p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                      placeholder="Click 'Generate New Password' below"
                      aria-live="polite"
                    />
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
                {error && !error.startsWith('Warning:') && (
                    <div role="alert" className="mt-2 p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                         </svg>
                        <strong>Error:</strong> {error}
                    </div>
                )}
                 {error && error.startsWith('Warning:') && (
                    <div role="alert" className="mt-2 p-3 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-md text-sm flex items-center gap-2">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.6-.63 1.703-.184 1.703.702V12a1 1 0 102 0V3.801c0-.886 1.104-1.332 1.703-.702l1.09 1.144A9.98 9.98 0 0118 10c0 5.523-4.477 10-10 10S-2 15.523-2 10a9.98 9.98 0 014.247-8.057l1.09-1.144zM10 14a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
                        {error}
                    </div>
                )}
            </div>

            <div className="space-y-4 border-t border-[rgb(var(--color-border-base))] pt-4">
                <h2 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">Options</h2>
                <div>
                    <label htmlFor="password-length" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Password Length: {length}</label>
                    <input
                        id="password-length"
                        type="number"
                        min="1"
                        max="256"
                        step="1"
                        value={length}
                        onChange={handleLengthChange}
                        className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
                    />
                </div>
                <fieldset className="space-y-3">
                    <legend className="sr-only">Character types to include</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="include-uppercase" checked={includeUppercase} onChange={() => handleCheckboxChange(setIncludeUppercase, includeUppercase)} className="h-4 w-4 rounded border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }}/>
                            <label htmlFor="include-uppercase" className="text-sm text-[rgb(var(--color-text-muted))] select-none cursor-pointer">Uppercase (A-Z)</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="include-lowercase" checked={includeLowercase} onChange={() => handleCheckboxChange(setIncludeLowercase, includeLowercase)} className="h-4 w-4 rounded border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }}/>
                            <label htmlFor="include-lowercase" className="text-sm text-[rgb(var(--color-text-muted))] select-none cursor-pointer">Lowercase (a-z)</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="include-numbers" checked={includeNumbers} onChange={() => handleCheckboxChange(setIncludeNumbers, includeNumbers)} className="h-4 w-4 rounded border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }}/>
                            <label htmlFor="include-numbers" className="text-sm text-[rgb(var(--color-text-muted))] select-none cursor-pointer">Numbers (0-9)</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="include-symbols" checked={includeSymbols} onChange={() => handleCheckboxChange(setIncludeSymbols, includeSymbols)} className="h-4 w-4 rounded border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] focus:outline-none focus:border-[rgb(var(--color-input-focus-border))]" style={{ accentColor: `rgb(var(--color-checkbox-accent))` }}/>
                            <label htmlFor="include-symbols" className="text-sm text-[rgb(var(--color-text-muted))] select-none cursor-pointer">Symbols (!@#...)</label>
                        </div>
                    </div>
                </fieldset>
            </div>

            <button
                type="button"
                onClick={() => generatePassword('click')}
                disabled={!canGenerate}
                className="w-full sm:w-auto px-6 py-3 rounded-md text-[rgb(var(--color-button-primary-text))] font-medium bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
            >
                Generate New Password
            </button>
            {/* Dialog removed */}
    </div>
  );
}