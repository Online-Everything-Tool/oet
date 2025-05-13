// FILE: app/tool/password-generator/_components/PasswordGeneratorClient.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import useToolState from '../../_hooks/useToolState';
import Input from '../../_components/form/Input';
import Button from '../../_components/form/Button';
import Checkbox from '../../_components/form/Checkbox';
import {
  LOWERCASE,
  UPPERCASE,
  NUMBERS,
  SYMBOLS,
} from '@/src/constants/charset';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'; // Using outline for better visual distinction from solid elsewhere

interface PasswordGeneratorClientProps {
  toolRoute: string;
}

interface PasswordGeneratorToolState {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
}

const DEFAULT_PASSWORD_GENERATOR_STATE: PasswordGeneratorToolState = {
  length: 16,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
};

export default function PasswordGeneratorClient({
  toolRoute,
}: PasswordGeneratorClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
  } = useToolState<PasswordGeneratorToolState>(
    toolRoute,
    DEFAULT_PASSWORD_GENERATOR_STATE
  );

  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string>(''); // For UI-related errors/warnings

  // Effect to clear generated password if options change and not loading
  useEffect(() => {
    if (!isLoadingState) {
      setGeneratedPassword('');
      setIsCopied(false);
    }
  }, [
    toolState.length,
    toolState.includeUppercase,
    toolState.includeLowercase,
    toolState.includeNumbers,
    toolState.includeSymbols,
    isLoadingState,
  ]);

  const generatePassword = useCallback(() => {
    let currentError = '';
    let newPassword = '';

    setUiError('');
    setIsCopied(false);
    setGeneratedPassword(''); // Clear previous password before generating

    let charset = '';
    if (toolState.includeLowercase) charset += LOWERCASE;
    if (toolState.includeUppercase) charset += UPPERCASE;
    if (toolState.includeNumbers) charset += NUMBERS;
    if (toolState.includeSymbols) charset += SYMBOLS;

    if (!charset) {
      currentError = 'Please select at least one character type.';
    } else if (toolState.length <= 0 || !Number.isInteger(toolState.length)) {
      currentError = 'Password length must be a positive whole number.';
    } else if (toolState.length > 256) {
      setUiError(
        'Warning: Password length is very long (> 256). Generation might be slow or browser may struggle.'
      );
    }

    if (charset) {
      try {
        if (
          typeof window !== 'undefined' &&
          window.crypto &&
          window.crypto.getRandomValues
        ) {
          const randomValues = new Uint32Array(toolState.length);
          window.crypto.getRandomValues(randomValues);
          for (let i = 0; i < toolState.length; i++) {
            newPassword += charset[randomValues[i] % charset.length];
          }
        } else {
          console.warn(
            'Using Math.random for password generation as window.crypto is not available.'
          );
          for (let i = 0; i < toolState.length; i++) {
            const randomIndex = Math.floor(Math.random() * charset.length);
            newPassword += charset[randomIndex];
          }
        }
        setGeneratedPassword(newPassword);
      } catch (err) {
        console.error('Password Generation Error:', err);
        currentError =
          'An unexpected error occurred during password generation.';
        newPassword = ''; // Ensure no password shown on error
      }
    }
    if (currentError) {
      setUiError(currentError); // Show hard errors in UI
      setGeneratedPassword(''); // Clear password on hard error
    }
  }, [
    toolState, // Now depends on the whole toolState object
  ]);

  const handleCopy = useCallback(async () => {
    if (!generatedPassword || !navigator.clipboard) {
      setUiError(
        !navigator.clipboard
          ? 'Clipboard API not available.'
          : 'No password to copy.'
      );
      return;
    }
    setUiError(''); // Clear previous errors on successful action attempt

    try {
      await navigator.clipboard.writeText(generatedPassword);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err: unknown) {
      console.error('Failed to copy password: ', err);
      setUiError('Failed to copy password to clipboard.');
    }
  }, [generatedPassword]);

  const handleOptionChange = useCallback(
    (option: keyof PasswordGeneratorToolState, value: boolean | number) => {
      if (typeof value === 'boolean') {
        // For checkboxes: ensure at least one character type remains selected
        const currentOptions = {
          includeUppercase: toolState.includeUppercase,
          includeLowercase: toolState.includeLowercase,
          includeNumbers: toolState.includeNumbers,
          includeSymbols: toolState.includeSymbols,
        };
        const changingToFalse =
          currentOptions[option as keyof typeof currentOptions] === true &&
          value === false;
        const numChecked = Object.values(currentOptions).filter(
          (v) => v
        ).length;

        if (changingToFalse && numChecked <= 1) {
          setUiError('At least one character type must be selected.');
          return; // Prevent unchecking the last one
        }
      }
      setToolState({ [option]: value });
      if (
        uiError === 'Please select at least one character type.' ||
        uiError === 'At least one character type must be selected.' ||
        uiError === 'Password length must be a positive whole number.' ||
        uiError.includes('length is very long')
      ) {
        setUiError(''); // Clear specific errors when options are validly changed
      }
      // Clearing generatedPassword and isCopied is now handled by the useEffect
    },
    [toolState, setToolState, uiError]
  );

  const canGenerate =
    toolState.length > 0 &&
    toolState.length <= 256 &&
    (toolState.includeLowercase ||
      toolState.includeUppercase ||
      toolState.includeNumbers ||
      toolState.includeSymbols);

  if (isLoadingState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Password Generator...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="space-y-2">
        <label
          htmlFor="generated-password-output"
          className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
        >
          Generated Password
        </label>
        <div className="flex items-stretch gap-2">
          <Input
            id="generated-password-output"
            type="text"
            value={generatedPassword}
            readOnly
            inputClassName="text-base font-mono flex-grow"
            placeholder="Click 'Generate New Password' below"
            aria-label="Generated Password"
            aria-describedby="password-generation-success" // Consider changing this if success message is removed
            onChange={() => {}} // Added onChange as it's required by the Input component
          />
          <Button
            variant={isCopied ? 'secondary' : 'neutral'}
            onClick={handleCopy}
            disabled={!generatedPassword.trim()}
            iconLeft={
              isCopied ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5" />
              )
            }
            title={isCopied ? 'Copied!' : 'Copy to clipboard'}
            aria-label="Copy password to clipboard"
          >
            {isCopied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        {uiError && !uiError.startsWith('Warning:') && (
          <div
            role="alert"
            className="mt-2 p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
          >
            <ExclamationTriangleIcon
              className="h-5 w-5 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <strong className="font-semibold">Error:</strong> {uiError}
            </div>
          </div>
        )}
        {uiError && uiError.startsWith('Warning:') && (
          <div
            role="alert"
            className="mt-2 p-3 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-md text-sm flex items-start gap-2"
          >
            <InformationCircleIcon
              className="h-5 w-5 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>{uiError}</div>
          </div>
        )}
      </div>

      <div className="space-y-4 border-t border-[rgb(var(--color-border-base))] pt-4">
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">
          Options
        </h2>
        <Input
          label={`Password Length: ${toolState.length}`}
          id="password-length"
          type="number"
          min={1}
          max={256}
          step={1}
          value={toolState.length}
          onChange={(e) =>
            handleOptionChange('length', parseInt(e.target.value, 10) || 0)
          }
          inputClassName="text-base"
        />
        <fieldset className="space-y-3">
          <legend className="sr-only">Character types to include</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <Checkbox
              id="include-uppercase"
              label="Uppercase (A-Z)"
              checked={toolState.includeUppercase}
              onChange={(e) =>
                handleOptionChange('includeUppercase', e.target.checked)
              }
            />
            <Checkbox
              id="include-lowercase"
              label="Lowercase (a-z)"
              checked={toolState.includeLowercase}
              onChange={(e) =>
                handleOptionChange('includeLowercase', e.target.checked)
              }
            />
            <Checkbox
              id="include-numbers"
              label="Numbers (0-9)"
              checked={toolState.includeNumbers}
              onChange={(e) =>
                handleOptionChange('includeNumbers', e.target.checked)
              }
            />
            <Checkbox
              id="include-symbols"
              label="Symbols (!@#...)"
              checked={toolState.includeSymbols}
              onChange={(e) =>
                handleOptionChange('includeSymbols', e.target.checked)
              }
            />
          </div>
        </fieldset>
      </div>

      <Button
        variant="primary"
        onClick={generatePassword}
        disabled={!canGenerate}
        fullWidth
        size="lg"
      >
        Generate New Password
      </Button>
    </div>
  );
}
