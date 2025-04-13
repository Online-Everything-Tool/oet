// /app/t/case-converter/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
// Assuming useHistory context setup exists elsewhere and works
// If not, replace with the dummy implementation like in Base64 example
import { useHistory } from '../../context/HistoryContext';

import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json'; // Assumes metadata.json exists here

export default function CaseConverterPage() {
  const [text, setText] = useState<string>('');
  const [preserveCase, setPreserveCase] = useState<boolean>(false);

  // --- History Hook ---
  const { addHistoryEntry } = useHistory();

  // --- Helper Function for Logging ---
  const logCaseConversion = useCallback((action: string, originalText: string, resultText: string, options: { preserveCase?: boolean }) => {
      if (originalText.length > 0) {
          addHistoryEntry({
              toolName: metadata.title, // Use title from metadata
              toolRoute: '/t/case-converter',
              action: action,
              input: originalText.substring(0, 500) + (originalText.length > 500 ? '...' : ''),
              output: resultText.substring(0, 500) + (resultText.length > 500 ? '...' : ''),
              status: 'success',
              options: options,
          });
      }
  }, [addHistoryEntry]);

  // --- Case Conversion Functions ---

  const convertToUppercase = useCallback(() => {
    const originalText = text;
    const result = originalText.toUpperCase();
    setText(result);
    logCaseConversion('uppercase', originalText, result, {});
  }, [text, logCaseConversion]);

  const convertToLowercase = useCallback(() => {
    const originalText = text;
    const result = originalText.toLowerCase();
    setText(result);
    logCaseConversion('lowercase', originalText, result, {});
  }, [text, logCaseConversion]);

  const convertToCapitalCase = useCallback(() => {
    const originalText = text;
    const result = originalText
      .toLowerCase()
      .split(' ')
      .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
      .join(' ');
    setText(result);
    logCaseConversion('capital_case', originalText, result, {});
  }, [text, logCaseConversion]);

  // --- UPDATED Split Regex ---
  const splitRegex = /[\s_]+|\B(?=[A-Z])/;

  const convertToSnakeCase = useCallback(() => {
    const originalText = text;
    const result = originalText
        .replace(/\W+/g, " ") // Optional: Clean other non-word chars first
        .split(splitRegex)     // USE UPDATED REGEX
        .map(word => word.toLowerCase())
        .filter(Boolean)
        .join('_');
     if (preserveCase) {
         console.warn("Preserve case for snake_case is complex and not fully implemented.");
     }
    setText(result);
    logCaseConversion('snake_case', originalText, result, { preserveCase });
  }, [text, preserveCase, logCaseConversion]);

  const convertToKebabCase = useCallback(() => {
    const originalText = text;
    const result = originalText
        .replace(/\W+/g, " ") // Optional: Clean other non-word chars first
        .split(splitRegex)     // USE UPDATED REGEX
        .map(word => word.toLowerCase())
        .filter(Boolean)
        .join('-');
    if (preserveCase) {
        console.warn("Preserve case for kebab-case is complex and not fully implemented.");
    }
    setText(result);
    logCaseConversion('kebab-case', originalText, result, { preserveCase });
  }, [text, preserveCase, logCaseConversion]);


  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => { setText(event.target.value); };
  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => { setPreserveCase(event.target.checked); };
  const handleClear = useCallback(() => { setText(''); }, []);

  // --- JSX ---
  return (
    <div className="p-0"> {/* Rely on layout for padding */}
        <ToolHeader
            title={metadata.title}
            description={metadata.description}
        />

      {/* Main content area */}
      <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
        <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">Text to Convert:</label>
        <textarea
          id="text-input"
          rows={10}
          value={text}
          onChange={handleInputChange}
          placeholder="Paste or type your text here..."
          className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
        />

        {/* Controls Container */}
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">

          {/* Left Group of Buttons */}
          <div className="flex flex-wrap gap-x-3 gap-y-3 items-center">
            <button onClick={convertToUppercase} className="px-5 py-2 rounded-md text-[rgb(var(--color-button-primary-text))] font-medium bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition duration-150 ease-in-out">UPPERCASE</button>
            <button onClick={convertToLowercase} className="px-5 py-2 rounded-md text-[rgb(var(--color-button-secondary-text))] font-medium bg-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] focus:outline-none transition duration-150 ease-in-out">lowercase</button>
            <button onClick={convertToCapitalCase} className="px-5 py-2 rounded-md text-[rgb(var(--color-button-accent-text))] font-medium bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] focus:outline-none transition duration-150 ease-in-out">Capital Case</button>
          </div>

          {/* Right Group (Snake/Kebab/Options) */}
          <div className="flex flex-col gap-3 items-start">
            <div className="flex items-center gap-2 p-3 rounded-md border border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] w-full md:w-auto">
                 <input
                    id="preserve-case-checkbox" type="checkbox" checked={preserveCase} onChange={handleCheckboxChange}
                    className="h-4 w-4 border-[rgb(var(--color-border-base))] rounded text-[rgb(var(--color-checkbox-accent))] focus:ring-offset-0 focus:ring-0 focus:outline-none" // Simple focus
                  />
                  <label htmlFor="preserve-case-checkbox" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
                    Preserve Case (snake/kebab)
                  </label>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
                 <button onClick={convertToSnakeCase} className="px-5 py-2 rounded-md text-[rgb(var(--color-button-accent2-text))] font-medium bg-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))] focus:outline-none transition duration-150 ease-in-out">snake_case</button>
                 <button onClick={convertToKebabCase} className="px-5 py-2 rounded-md text-[rgb(var(--color-button-danger-text))] font-medium bg-[rgb(var(--color-button-danger-bg))] hover:bg-[rgb(var(--color-button-danger-hover-bg))] focus:outline-none transition duration-150 ease-in-out">kebab-case</button>
            </div>
          </div>

        </div> {/* End Controls Container */}

        <div className="mt-2 text-right">
             <button
                onClick={handleClear}
                title="Clear text"
                className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition duration-150 ease-in-out"
             >
               Clear
             </button>
        </div>

      </div> {/* End Main content area */}
    </div>
  );
}