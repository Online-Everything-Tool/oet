// /app/t/text-strike-through/page.tsx
'use client'; // This tool requires client-side interaction and state

import React, { useState, useCallback } from 'react';
import { useHistory } from '../../context/HistoryContext'; // <-- Import useHistory

export default function TextStrikeThroughPage() {
  const [inputText, setInputText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const { addHistoryEntry } = useHistory(); // <-- Get the history function

  // The "output" is just the input text styled differently.
  const outputText = inputText;

  // Handler for input changes
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(event.target.value);
    setIsCopied(false); // Reset copied status if input changes
  }, []);

  const handleClear = useCallback(() => {
    setInputText('');
    setIsCopied(false);
    // Log clear action to history
    addHistoryEntry({ toolName: 'Text Strikethrough', toolRoute: '/t/text-strike-through', action: 'clear', input: '', output: '', status: 'success' }); // UNCOMMENTED
  }, [addHistoryEntry]);

  // Handler for copying the output
  const handleCopy = useCallback(() => {
    if (!outputText) return; // Don't copy if empty

    navigator.clipboard.writeText(outputText).then(
      () => {
        setIsCopied(true);
        // Log copy action to history
        addHistoryEntry({
          toolName: 'Text Strikethrough',
          toolRoute: '/t/text-strike-through', // <-- Update route
          action: 'copy-output',
          input: inputText.length > 500 ? inputText.substring(0, 500) + '...' : inputText,
          output: outputText.length > 500 ? outputText.substring(0, 500) + '...' : outputText, // Output is same as input here
          status: 'success',
        });
        // Reset copied status after a short delay
        setTimeout(() => setIsCopied(false), 1500);
      },
      (err) => {
        console.error('Failed to copy text: ', err);
        addHistoryEntry({ // Log copy failure
          toolName: 'Text Strikethrough',
          toolRoute: '/t/text-strike-through',
          action: 'copy-output',
          input: inputText.length > 500 ? inputText.substring(0, 500) + '...' : inputText,
          output: `Error copying: ${err instanceof Error ? err.message : 'Unknown error'}`,
          status: 'error',
        });
      }
    );
  }, [outputText, inputText, addHistoryEntry]); // <-- Add inputText and addHistoryEntry dependencies

  // Note: For a purely visual tool like strikethrough, there isn't a primary "transform"
  // action to log like in text-reverse. We log the 'copy' action instead. If there was
  // a "Generate" button, we'd log that.

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Text Strikethrough</h1>
      <p className="text-gray-600 mb-6">
        Enter text below to see it displayed with strikethrough formatting. Use the copy button to copy the original text.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Area */}
        <div className="space-y-2">
          <label htmlFor="inputText" className="block text-sm font-medium text-gray-700">
            Input Text
          </label>
          <textarea
            id="inputText"
            name="inputText"
            rows={8}
            value={inputText}
            onChange={handleInputChange}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#900027] focus:border-[#900027] sm:text-sm resize-y"
            placeholder="Paste or type your text here..."
          />
        </div>

        {/* Output Area */}
        <div className="space-y-2">
          <label htmlFor="outputText" className="block text-sm font-medium text-gray-700">
            Strikethrough Output (Visual)
          </label>
          <textarea
            id="outputText"
            name="outputText"
            readOnly
            rows={8}
            value={outputText}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 focus:outline-none focus:ring-[#900027] focus:border-[#900027] sm:text-sm resize-y line-through text-gray-700"
            placeholder="Output will appear here..."
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex items-center space-x-3">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!outputText}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#900027] hover:bg-[#7a0021] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#900027] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCopied ? 'Copied!' : 'Copy Text'} {/* Changed label slightly */}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={!inputText}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#900027] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}