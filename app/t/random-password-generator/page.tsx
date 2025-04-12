// /app/t/random-password-generator/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import { useHistory } from '../../context/HistoryContext'; // Adjust path if needed based on your project structure

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

  const generatePassword = useCallback(() => {
    let currentError = '';
    let generatedPassword = ''; // Still needed for the UI state
    let status: 'success' | 'error' = 'success';

    setError(''); // Clear previous errors
    setCopied(false); // Reset copied status
    setPassword(''); // Clear previous password

    let charset = '';
    if (includeLowercase) charset += LOWERCASE;
    if (includeUppercase) charset += UPPERCASE;
    if (includeNumbers) charset += NUMBERS;
    if (includeSymbols) charset += SYMBOLS;

    // --- Input Validation ---
    if (charset.length === 0) {
      currentError = 'Please select at least one character type.';
      setError(currentError);
      status = 'error';
    } else if (length <= 0 || !Number.isInteger(length)) { // Also check for integer
        currentError = 'Password length must be a positive whole number.';
        setError(currentError);
        status = 'error';
    }

    // --- Generation (only if no errors) ---
    if (status === 'success') {
        try {
            // Prefer crypto.getRandomValues for better randomness
            if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
                const randomValues = new Uint32Array(length);
                window.crypto.getRandomValues(randomValues);
                for (let i = 0; i < length; i++) {
                    generatedPassword += charset[randomValues[i] % charset.length];
                }
            } else {
                // Fallback to Math.random (less secure)
                console.warn("Using Math.random for password generation as window.crypto is not available.");
                for (let i = 0; i < length; i++) {
                    const randomIndex = Math.floor(Math.random() * charset.length);
                    generatedPassword += charset[randomIndex];
                }
            }
            setPassword(generatedPassword); // Update UI state
        } catch (err) {
             console.error("Password Generation Error:", err);
             currentError = "An unexpected error occurred during password generation.";
             setError(currentError);
             status = 'error';
             generatedPassword = ''; // Ensure password is empty on error
        }
    }

    // --- History Logging ---
    const historyInput = { // Log the settings used
      length: length,
      uppercase: includeUppercase,
      lowercase: includeLowercase,
      numbers: includeNumbers,
      symbols: includeSymbols,
    };

    // *** Secure History Output: Do NOT log the actual password ***
    const historyOutput = status === 'success'
        ? "[Password Generated Successfully]" // Use a placeholder for success
        : `Error: ${currentError}`;          // Log the error message on failure

    addHistoryEntry({
        toolName: 'Random Password Generator',
        toolRoute: '/t/random-password-generator', // Use the actual route
        action: 'generate',
        input: historyInput, // Store options as input
        output: historyOutput, // Store placeholder or error, NOT the password
        status: status,
    });

  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, addHistoryEntry]);

  const handleCopy = useCallback(async () => {
    if (!password || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy password: ', err);
      setError('Failed to copy password.'); // Show error to user
    }
  }, [password]);

  // Ensure at least one checkbox remains checked
  const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<boolean>>, currentValue: boolean) => {
    const othersChecked = [includeUppercase, includeLowercase, includeNumbers, includeSymbols].filter(val => val).length > (currentValue ? 1 : 0);
    if (currentValue && !othersChecked) {
        setError('At least one character type must be selected.'); // Give feedback
        return; // Prevent unchecking the last box
    }
    setter(!currentValue);
    // Clear error only if the *reason* for the error was the lack of character types
    if (error === 'Please select at least one character type.' || error === 'At least one character type must be selected.') {
        setError('');
    }
  };

  const handleLengthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(event.target.value, 10);
    setLength(isNaN(val) ? 0 : val); // Handle potential NaN if input is cleared/invalid
    // Clear error only if the *reason* for the error was the length
    if (error === 'Password length must be a positive whole number.') {
        setError('');
    }
  };


  const canGenerate = length > 0 && Number.isInteger(length) && (includeLowercase || includeUppercase || includeNumbers || includeSymbols);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <Head>
        <title>Random Password Generator - OET</title>
        <meta name="description" content="Generate strong, random passwords with customizable options." />
      </Head>

      <h1 className="text-2xl font-bold text-gray-800">Random Password Generator</h1>

      {/* Generated Password Display & Copy */}
      <div className="space-y-2">
        <label htmlFor="generated-password-output" className="block text-sm font-medium text-gray-700">Generated Password</label>
        <div className="flex items-stretch gap-2"> {/* Use items-stretch for button height */}
           <input
              id="generated-password-output"
              type="text"
              value={password}
              readOnly
              className="flex-grow p-3 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-base font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Click 'Generate' to create a password"
            />
           <button
             onClick={handleCopy}
             disabled={!password}
             title={copied ? "Copied!" : "Copy to clipboard"}
             aria-label="Copy password to clipboard"
             className={`px-4 py-2 rounded-md font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out ${
                copied
                 ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                 : 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
             } disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500`}
           >
             {copied ? 'Copied!' : 'Copy'}
           </button>
        </div>
        {/* Error Display - Consistent with Base64 Example */}
        {error && (
          <div className="mt-2 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Configuration Options */}
      <div className="space-y-4 border-t pt-4">
        <h2 className="text-lg font-semibold text-gray-700">Options</h2>

        {/* Length */}
        <div>
          <label htmlFor="password-length" className="block text-sm font-medium text-gray-700 mb-1">Password Length: {length}</label>
          <input
            id="password-length"
            type="number"
            min="1" // Minimum length is 1
            max="128" // Maximum reasonable length
            step="1" // Ensure whole numbers
            value={length} // Input type number handles string conversion
            onChange={handleLengthChange}
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
          />
        </div>

        {/* Character Types */}
        <fieldset className="space-y-3"> {/* Use fieldset for grouping related controls */}
            <legend className="sr-only">Character types</legend> {/* Hidden legend for screen readers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="include-uppercase"
                        checked={includeUppercase}
                        onChange={() => handleCheckboxChange(setIncludeUppercase, includeUppercase)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="include-uppercase" className="text-sm text-gray-700 select-none cursor-pointer"> {/* Added select-none and cursor-pointer */}
                        Uppercase (A-Z)
                    </label>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="include-lowercase"
                        checked={includeLowercase}
                        onChange={() => handleCheckboxChange(setIncludeLowercase, includeLowercase)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="include-lowercase" className="text-sm text-gray-700 select-none cursor-pointer">
                        Lowercase (a-z)
                    </label>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="include-numbers"
                        checked={includeNumbers}
                        onChange={() => handleCheckboxChange(setIncludeNumbers, includeNumbers)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="include-numbers" className="text-sm text-gray-700 select-none cursor-pointer">
                        Numbers (0-9)
                    </label>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="include-symbols"
                        checked={includeSymbols}
                        onChange={() => handleCheckboxChange(setIncludeSymbols, includeSymbols)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="include-symbols" className="text-sm text-gray-700 select-none cursor-pointer">
                        Symbols (!@#...)
                    </label>
                </div>
            </div>
        </fieldset>
      </div>

      {/* Generate Button */}
      <button
        onClick={generatePassword}
        disabled={!canGenerate}
        className="w-full sm:w-auto px-6 py-3 rounded-md text-white font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        Generate Password
      </button>

    </div>
  );
}