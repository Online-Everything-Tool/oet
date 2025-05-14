// --- FILE: app/tool/password-generator/_components/PasswordGeneratorClient.tsx ---
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react'; // Added useRef
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
  ArrowPathIcon, // For the generate button
} from '@heroicons/react/24/outline';

interface PasswordGeneratorClientProps {
  toolRoute: string;
  // No urlStateParams needed for this tool as per metadata
}

interface PasswordGeneratorToolState {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  // generatedPassword is NOT part of the persisted state
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
    state: toolSettings, // Renamed for clarity, these are the settings
    setState: setToolSettings, // Renamed
    isLoadingState,
    errorLoadingState, // From useToolState
    // clearState, isPersistent, togglePersistence could be used for ToolSettings.tsx
  } = useToolState<PasswordGeneratorToolState>(
    toolRoute,
    DEFAULT_PASSWORD_GENERATOR_STATE
  );

  const [generatedPassword, setGeneratedPassword] = useState<string>(''); // Local state for the current password
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string>(''); // For UI-related errors/warnings

  const initialSettingsLoadedRef = useRef(false);

  // Effect to clear generated password if settings change (after initial load)
  useEffect(() => {
    if (!isLoadingState && initialSettingsLoadedRef.current) {
      // Only clear if settings changed *after* initial load and settings application
      console.log(
        '[PasswordGenerator] Settings changed, clearing old generated password.'
      );
      setGeneratedPassword('');
      setIsCopied(false); // Reset copy status as well
      setUiError(''); // Clear any errors related to previous password
    } else if (!isLoadingState && !initialSettingsLoadedRef.current) {
      initialSettingsLoadedRef.current = true; // Mark initial load complete
      console.log('[PasswordGenerator] Initial settings loaded/applied.');
    }
  }, [
    toolSettings.length,
    toolSettings.includeUppercase,
    toolSettings.includeLowercase,
    toolSettings.includeNumbers,
    toolSettings.includeSymbols,
    isLoadingState, // Ensure this runs after settings are truly loaded
  ]);

  const handleGeneratePassword = useCallback(() => {
    // Renamed for clarity
    let currentError = '';
    let newPassword = '';

    setUiError('');
    setIsCopied(false);
    // setGeneratedPassword(''); // Clear previous password - done by useEffect or explicitly below

    let charset = '';
    if (toolSettings.includeLowercase) charset += LOWERCASE;
    if (toolSettings.includeUppercase) charset += UPPERCASE;
    if (toolSettings.includeNumbers) charset += NUMBERS;
    if (toolSettings.includeSymbols) charset += SYMBOLS;

    if (!charset) {
      currentError = 'Please select at least one character type.';
    } else if (
      toolSettings.length <= 0 ||
      !Number.isInteger(toolSettings.length)
    ) {
      currentError = 'Password length must be a positive whole number.';
    } else if (toolSettings.length > 256) {
      // This is a warning, not a hard error for generation itself
      setUiError(
        'Warning: Password length is very long (> 256). Generation might be slow or browser may struggle.'
      );
    } else if (toolSettings.length < 4 && charset.length < 20) {
      // Arbitrary threshold for very weak
      setUiError('Warning: Settings may result in a very weak password.');
    }

    if (charset && !currentError) {
      // Only proceed if no hard errors yet
      try {
        if (
          typeof window !== 'undefined' &&
          window.crypto &&
          window.crypto.getRandomValues
        ) {
          const randomValues = new Uint32Array(toolSettings.length);
          window.crypto.getRandomValues(randomValues);
          for (let i = 0; i < toolSettings.length; i++) {
            newPassword += charset[randomValues[i] % charset.length];
          }
        } else {
          console.warn(
            '[PasswordGenerator] Using Math.random for password generation as window.crypto is not available.'
          );
          for (let i = 0; i < toolSettings.length; i++) {
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
    } else if (!charset) {
      // If charset was empty, ensure generatedPassword is also empty
      setGeneratedPassword('');
    }

    if (currentError) {
      // If there was a hard error during validation or generation
      setUiError((prevError) =>
        prevError.startsWith('Warning:') ? prevError : currentError
      ); // Don't overwrite warning with hard error unless no warning
      setGeneratedPassword(''); // Clear password on hard error
    }
  }, [toolSettings]);

  const handleCopy = useCallback(async () => {
    if (!generatedPassword || !navigator.clipboard) {
      setUiError(
        !navigator.clipboard
          ? 'Clipboard API not available.'
          : 'No password to copy.'
      );
      return;
    }
    // Don't clear uiError here if it's a warning
    if (uiError && !uiError.startsWith('Warning:')) setUiError('');

    try {
      await navigator.clipboard.writeText(generatedPassword);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err: unknown) {
      console.error('Failed to copy password: ', err);
      setUiError('Failed to copy password to clipboard.');
    }
  }, [generatedPassword, uiError]); // Added uiError

  const handleOptionChange = useCallback(
    (optionKey: keyof PasswordGeneratorToolState, value: boolean | number) => {
      const newUiError = uiError; // Preserve existing warning if any
      if (typeof value === 'boolean') {
        const currentOptions = {
          includeUppercase: toolSettings.includeUppercase,
          includeLowercase: toolSettings.includeLowercase,
          includeNumbers: toolSettings.includeNumbers,
          includeSymbols: toolSettings.includeSymbols,
        };
        // Temporarily apply the change to check number of selected options
        const tempOptions = { ...currentOptions, [optionKey]: value };
        const numChecked = Object.values(tempOptions).filter(
          (v) => v === true
        ).length;

        if (numChecked < 1) {
          setUiError('At least one character type must be selected.'); // This is a hard error
          return; // Prevent unchecking the last one
        }
      }
      // If we pass the check or it's not a boolean option change
      setToolSettings({ [optionKey]: value });
      // Clear specific errors if the change makes the options valid again
      if (
        newUiError === 'Please select at least one character type.' ||
        newUiError === 'At least one character type must be selected.' ||
        newUiError === 'Password length must be a positive whole number.'
      ) {
        setUiError('');
      } else if (
        newUiError.startsWith('Warning:') &&
        optionKey === 'length' &&
        typeof value === 'number' &&
        value <= 256 &&
        value >= 4
      ) {
        // Clear length related warnings if length is now in a reasonable range
        setUiError('');
      }
    },
    [toolSettings, setToolSettings, uiError] // Added uiError
  );

  const canGenerate =
    toolSettings.length > 0 &&
    toolSettings.length <= 256 && // Keep practical upper limit for UI
    (toolSettings.includeLowercase ||
      toolSettings.includeUppercase ||
      toolSettings.includeNumbers ||
      toolSettings.includeSymbols);

  if (isLoadingState && !initialSettingsLoadedRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Password Generator...
      </p>
    );
  }
  if (errorLoadingState) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded">
        Error loading saved settings: {errorLoadingState}
      </div>
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
            onChange={() => {}}
          />
          <Button
            variant={isCopied ? 'secondary' : 'neutral'}
            onClick={handleCopy}
            disabled={!generatedPassword.trim() || isCopied}
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
        {uiError && (
          <div
            role="alert"
            className={`mt-2 p-3 border rounded-md text-sm flex items-start gap-2 ${
              uiError.startsWith('Warning:')
                ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                : 'bg-[rgb(var(--color-bg-error-subtle))] border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))]'
            }`}
          >
            {uiError.startsWith('Warning:') ? (
              <InformationCircleIcon
                className="h-5 w-5 flex-shrink-0 mt-0.5 text-yellow-600"
                aria-hidden="true"
              />
            ) : (
              <ExclamationTriangleIcon
                className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-600"
                aria-hidden="true"
              />
            )}
            <div>
              {!uiError.startsWith('Warning:') && (
                <strong className="font-semibold">Error: </strong>
              )}
              {uiError}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 border-t border-[rgb(var(--color-border-base))] pt-4">
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">
          Options
        </h2>
        <Input
          label={`Password Length: ${toolSettings.length}`}
          id="password-length"
          type="number"
          min={1}
          max={256}
          step={1}
          value={toolSettings.length}
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
              checked={toolSettings.includeUppercase}
              onChange={(e) =>
                handleOptionChange('includeUppercase', e.target.checked)
              }
            />
            <Checkbox
              id="include-lowercase"
              label="Lowercase (a-z)"
              checked={toolSettings.includeLowercase}
              onChange={(e) =>
                handleOptionChange('includeLowercase', e.target.checked)
              }
            />
            <Checkbox
              id="include-numbers"
              label="Numbers (0-9)"
              checked={toolSettings.includeNumbers}
              onChange={(e) =>
                handleOptionChange('includeNumbers', e.target.checked)
              }
            />
            <Checkbox
              id="include-symbols"
              label="Symbols (!@#...)"
              checked={toolSettings.includeSymbols}
              onChange={(e) =>
                handleOptionChange('includeSymbols', e.target.checked)
              }
            />
          </div>
        </fieldset>
      </div>

      <Button
        variant="primary"
        onClick={handleGeneratePassword}
        disabled={!canGenerate}
        fullWidth
        size="lg"
        iconLeft={<ArrowPathIcon className="h-5 w-5" />}
      >
        Generate New Password
      </Button>
    </div>
  );
}
