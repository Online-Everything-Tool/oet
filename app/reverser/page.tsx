// /app/reverser/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { useHistory } from '../context/HistoryContext'; // Adjust path if needed

// Define the different modes for reversing
type ReverseMode = 'characters' | 'words' | 'lines';

export default function ReverserPage() {
  const [inputValue, setInputValue] = useState<string>('');
  const [outputValue, setOutputValue] = useState<string>('');
  const [reverseMode, setReverseMode] = useState<ReverseMode>('characters'); // Default mode

  // Get the history function
  const { addHistoryEntry } = useHistory();

  // --- Core Reversing Logic ---
  const handleReverse = useCallback(() => {
    let result = '';
    const text = inputValue;

    try {
      switch (reverseMode) {
        case 'characters':
          // Correctly reverse characters, handling Unicode graphemes
          result = [...text].reverse().join('');
          break;
        case 'words':
          // Split by whitespace, reverse the array of words, join with single space
          // This handles multiple spaces between words better than just splitting by ' '
          const words = text.split(/(\s+)/); // Split by whitespace, keeping delimiters
          const reversedWords = [];
          // Reverse only the non-whitespace parts
          for (let i = words.length - 1; i >= 0; i--) {
              if (words[i] && words[i].trim() !== '') {
                 reversedWords.push(words[i]);
              } else if (words[i]) {
                 // Keep whitespace delimiters in their relative order but reversed block-wise
                 reversedWords.push(words[i]);
              }
          }
          // Simple reverse: split, filter empty, reverse, join
          result = text.split(/\s+/).filter(Boolean).reverse().join(' ');
          break;
        case 'lines':
          // Split by newline variations, reverse array, join with standard newline
          result = text.split(/\r\n|\r|\n/).reverse().join('\n');
          break;
        default:
          result = 'Invalid mode selected'; // Should not happen with TS
      }

      setOutputValue(result);

      // --- Add to History ---
      if (text.length > 0) {
        addHistoryEntry({
          toolName: 'Text Reverser',
          toolRoute: '/reverser',
          action: `reverse-${reverseMode}`, // e.g., "reverse-characters"
          input: text.length > 500 ? text.substring(0, 500) + '...' : text, // Truncate long input
          output: result.length > 500 ? result.substring(0, 500) + '...' : result, // Truncate long output too
          status: 'success',
        });
      } else {
        setOutputValue(''); // Clear output if input was empty
      }

    } catch (error) {
        console.error("Error during reversing:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        setOutputValue(`Error: ${errorMessage}`);
         // Optionally log errors to history too
        addHistoryEntry({
          toolName: 'Text Reverser',
          toolRoute: '/reverser',
          action: `reverse-${reverseMode}`,
          input: text.length > 500 ? text.substring(0, 500) + '...' : text,
          output: `Error: ${errorMessage}`,
          status: 'error',
        });
    }
  }, [inputValue, reverseMode, addHistoryEntry]);

  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
  };

  const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setReverseMode(event.target.value as ReverseMode);
    // Optionally clear output when mode changes, or auto-reverse? Let's clear for now.
    setOutputValue('');
  };

  const handleClear = () => {
    setInputValue('');
    setOutputValue('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Text Reverser</h1>
      <p className="text-gray-600">
        Reverse the order of characters, words, or lines in your text.
      </p>

      {/* Input Area */}
      <div>
        <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-1">
          Input Text:
        </label>
        <textarea
          id="text-input"
          rows={10}
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Enter text to reverse..."
          className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y text-base"
        />
      </div>

       {/* Controls Row */}
      <div className="flex flex-wrap gap-4 items-center border p-3 rounded-md bg-gray-50">
         {/* Mode Selection */}
        <fieldset className="flex gap-x-4 gap-y-2 items-center flex-wrap">
           <legend className="text-sm font-medium text-gray-700 mr-2">Reverse by:</legend>
           <div className="flex items-center">
              <input
                 type="radio"
                 id="mode-chars"
                 name="reverseMode"
                 value="characters"
                 checked={reverseMode === 'characters'}
                 onChange={handleModeChange}
                 className="h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
              />
              <label htmlFor="mode-chars" className="ml-2 block text-sm text-gray-900">
                 Characters
              </label>
           </div>
           <div className="flex items-center">
              <input
                 type="radio"
                 id="mode-words"
                 name="reverseMode"
                 value="words"
                 checked={reverseMode === 'words'}
                 onChange={handleModeChange}
                 className="h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
              />
              <label htmlFor="mode-words" className="ml-2 block text-sm text-gray-900">
                 Words
              </label>
           </div>
           <div className="flex items-center">
              <input
                 type="radio"
                 id="mode-lines"
                 name="reverseMode"
                 value="lines"
                 checked={reverseMode === 'lines'}
                 onChange={handleModeChange}
                 className="h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
              />
              <label htmlFor="mode-lines" className="ml-2 block text-sm text-gray-900">
                 Lines
              </label>
           </div>
        </fieldset>

         {/* Action Buttons */}
         <div className="flex gap-3 ml-auto">
             <button
               onClick={handleReverse}
               className="px-5 py-2 rounded-md text-white font-medium bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-150 ease-in-out"
             >
               Reverse
             </button>
             <button
               onClick={handleClear}
               title="Clear input and output"
               className="px-3 py-2 rounded-md text-gray-700 font-medium bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition duration-150 ease-in-out"
             >
               Clear
             </button>
         </div>
      </div>


      {/* Output Area */}
      {outputValue && ( // Only show if there is output (or an error message)
         <div>
           <label htmlFor="text-output" className="block text-sm font-medium text-gray-700 mb-1">
             Output Text:
           </label>
           <textarea
             id="text-output"
             rows={10}
             value={outputValue}
             readOnly
             placeholder="Reversed text will appear here..."
             className={`w-full p-3 border rounded-md shadow-sm resize-y text-base bg-gray-100 ${outputValue.startsWith('Error:') ? 'border-red-300 text-red-700' : 'border-gray-300 text-gray-800'}`}
             aria-live="polite"
           />
         </div>
      )}
    </div>
  );
}