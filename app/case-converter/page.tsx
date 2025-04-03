// /app/case-converter/page.tsx
'use client'; // Required for useState and event handlers

import React, { useState } from 'react';

export default function CaseConverterPage() {
  const [text, setText] = useState<string>('');
  const [preserveCase, setPreserveCase] = useState<boolean>(false);

  // --- Case Conversion Functions (unchanged) ---
  const convertToUppercase = () => { setText(text.toUpperCase()); };
  const convertToLowercase = () => { setText(text.toLowerCase()); };
  const convertToCapitalCase = () => { /* ... */ }; // Keep implementations
  const convertToSnakeCase = () => { /* ... */ }; // Keep implementations
  const convertToKebabCase = () => { /* ... */ }; // Keep implementations

  // --- Event Handlers (unchanged) ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => { setText(event.target.value); };
  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => { setPreserveCase(event.target.checked); };


  return (
    <main className="p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Case Converter</h1>
      <p className="text-gray-600 mb-6">
        Convert text using various case styles. The "Preserve Case" option affects snake & kebab cases.
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
        <div className="flex flex-wrap gap-x-3 gap-y-4 items-center">

          {/* Standard Case Buttons */}
          <button onClick={convertToUppercase} className="px-5 py-2 rounded-md text-white font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out">UPPERCASE</button>
          <button onClick={convertToLowercase} className="px-5 py-2 rounded-md text-white font-medium bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-150 ease-in-out">lowercase</button>
          <button onClick={convertToCapitalCase} className="px-5 py-2 rounded-md text-white font-medium bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-150 ease-in-out">Capital Case</button>

          {/* Grouping Div - Changed to inline-flex */}
          <div className="bg-slate-100 p-3 rounded-md border border-slate-200 inline-flex flex-wrap gap-3 items-center"> {/* Use inline-flex */}

                <input
                  id="preserve-case-checkbox"
                  type="checkbox"
                  checked={preserveCase}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="preserve-case-checkbox" className="ml-2 block text-sm font-medium text-gray-700">
                  Preserve<br/>Case
                </label>
              
              {/* Snake Case Button */}
              <button
                onClick={convertToSnakeCase}
                className="px-5 py-2 rounded-md text-white font-medium bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition duration-150 ease-in-out"
              >
                snake_case
              </button>

              {/* Kebab Case Button */}
              <button
                onClick={convertToKebabCase}
                className="px-5 py-2 rounded-md text-white font-medium bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-150 ease-in-out"
              >
                kebab-case
              </button>
          </div> {/* End of Grouping Div */}

        </div> {/* End of Main Button/Controls Container */}
      </div>
    </main>
  );
}