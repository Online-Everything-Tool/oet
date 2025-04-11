// /app/case-converter/page.tsx
'use client';

import React, { useState, useCallback } from 'react'; // Added useCallback
import { useHistory } from '../../context/HistoryContext'; // 1. Import useHistory

export default function CaseConverterPage() {
  const [text, setText] = useState<string>('');
  const [preserveCase, setPreserveCase] = useState<boolean>(false);

  // --- History Hook ---
  const { addHistoryEntry } = useHistory(); // 2. Get addHistoryEntry function

  // --- Helper Function for Logging ---
  // Avoids repeating the addHistoryEntry call structure in each function
  const logCaseConversion = useCallback((action: string, originalText: string, resultText: string, options: { preserveCase?: boolean }) => {
      if (originalText.length > 0) { // Only log if there was original text
          addHistoryEntry({
              toolName: 'Case Converter',
              toolRoute: '/case-converter',
              action: action, // e.g., 'uppercase', 'snake_case'
              input: originalText.length > 500 ? originalText.substring(0, 500) + '...' : originalText,
              output: resultText.length > 500 ? resultText.substring(0, 500) + '...' : resultText,
              status: 'success', // Assuming simple string conversions don't fail easily
              options: options, // Log relevant options like preserveCase
          });
      }
  }, [addHistoryEntry]); // Dependency for the helper

  // --- Case Conversion Functions (Modified for logging) ---

  const convertToUppercase = useCallback(() => {
    const originalText = text;
    const result = originalText.toUpperCase();
    setText(result);
    logCaseConversion('uppercase', originalText, result, {}); // No specific options here
  }, [text, logCaseConversion]);

  const convertToLowercase = useCallback(() => {
    const originalText = text;
    const result = originalText.toLowerCase();
    setText(result);
    logCaseConversion('lowercase', originalText, result, {});
  }, [text, logCaseConversion]);

  const convertToCapitalCase = useCallback(() => {
    const originalText = text;
    // Assuming you have the implementation logic here...
    const result = originalText
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '); // Example implementation
    setText(result);
    logCaseConversion('capital_case', originalText, result, {});
  }, [text, logCaseConversion]);

  const convertToSnakeCase = useCallback(() => {
    const originalText = text;
    // Assuming implementation here, potentially using preserveCase...
    const result = originalText
        .replace(/\W+/g, " ") // Replace non-word chars with space
        .split(/ |\B(?=[A-Z])/) // Split on space or before uppercase letter
        .map(word => word.toLowerCase())
        .filter(Boolean) // Remove empty strings
        .join('_');
     // Simplified preserveCase example (you might have more complex logic)
     if (preserveCase) {
         // This is a placeholder - actual preserve case logic is complex
         // You'd need to track original casing patterns before lowercasing everything
         console.warn("Preserve case for snake_case is complex and not fully implemented in this example");
         // For logging, we still log the result achieved
     }
    setText(result);
    logCaseConversion('snake_case', originalText, result, { preserveCase }); // Log preserveCase option
  }, [text, preserveCase, logCaseConversion]);

  const convertToKebabCase = useCallback(() => {
    const originalText = text;
    // Assuming implementation here, potentially using preserveCase...
    const result = originalText
        .replace(/\W+/g, " ") // Replace non-word chars with space
        .split(/ |\B(?=[A-Z])/) // Split on space or before uppercase letter
        .map(word => word.toLowerCase())
        .filter(Boolean) // Remove empty strings
        .join('-');
    if (preserveCase) {
        console.warn("Preserve case for kebab-case is complex and not fully implemented in this example");
    }
    setText(result);
    logCaseConversion('kebab-case', originalText, result, { preserveCase }); // Log preserveCase option
  }, [text, preserveCase, logCaseConversion]);

  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => { setText(event.target.value); };
  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => { setPreserveCase(event.target.checked); };

  // Added Clear Handler
  const handleClear = useCallback(() => {
    setText('');
    // Set preserveCase back to default? Optional.
    // setPreserveCase(false);
  }, []);

  // --- JSX ---
  return (
    <main className="p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Case Converter</h1>
      <p className="text-gray-600 mb-6">
        Convert text using various case styles. The “Preserve Case” option affects snake & kebab cases.
      </p>

      <div className="flex flex-col gap-4">
        <label htmlFor="text-input" className="sr-only">Text to Convert:</label>
        <textarea
          id="text-input"
          rows={10}
          value={text}
          onChange={handleInputChange}
          placeholder="Paste or type your text here..."
          className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y text-base font-mono"
        />

        {/* Main Button/Controls Container */}
        <div className="flex flex-wrap gap-x-3 gap-y-4 items-center justify-between"> {/* Added justify-between */}

          {/* Left Group of Buttons */}
          <div className="flex flex-wrap gap-x-3 gap-y-3 items-center">
            <button onClick={convertToUppercase} className="px-5 py-2 rounded-md text-white font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out">UPPERCASE</button>
            <button onClick={convertToLowercase} className="px-5 py-2 rounded-md text-white font-medium bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-150 ease-in-out">lowercase</button>
            <button onClick={convertToCapitalCase} className="px-5 py-2 rounded-md text-white font-medium bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-150 ease-in-out">Capital Case</button>

            {/* Snake/Kebab/Options Group */}
            <div className="bg-slate-100 p-3 rounded-md border border-slate-200 inline-flex flex-wrap gap-3 items-center">
                 <input
                    id="preserve-case-checkbox" type="checkbox" checked={preserveCase} onChange={handleCheckboxChange}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="preserve-case-checkbox" className="ml-2 block text-sm font-medium text-gray-700">
                    Preserve Case
                  </label>
                 <button onClick={convertToSnakeCase} className="px-5 py-2 rounded-md text-white font-medium bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition duration-150 ease-in-out">snake_case</button>
                 <button onClick={convertToKebabCase} className="px-5 py-2 rounded-md text-white font-medium bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-150 ease-in-out">kebab-case</button>
            </div>
           </div>

           {/* Clear Button (Aligned Right) */}
           <button
              onClick={handleClear}
              title="Clear text"
              className="px-3 py-2 rounded-md text-gray-700 font-medium bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition duration-150 ease-in-out self-center" // Added self-center for alignment if needed
           >
             Clear
           </button>

        </div>
      </div>
    </main>
  );
}