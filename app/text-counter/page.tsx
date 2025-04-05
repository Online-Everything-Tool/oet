// /app/text-counter/page.tsx
'use client';

import React, { useState, useMemo, useCallback } from 'react';
// import { useHistory } from '../context/HistoryContext'; // Keep if needed later, comment out for now

// Interface for all counts, calculated dynamically
interface TextCounts {
  words: number;
  characters: number;
  lines: number;
  customString: string;
  customCount: number;
}

export default function TextCounterPage() {
  // --- State ---
  const [text, setText] = useState<string>('');
  const [customStringToCount, setCustomStringToCount] = useState<string>('');

  // --- History Hook (Commented out - not used without logging action) ---
  // const { addHistoryEntry } = useHistory();

  // --- Dynamic Calculation using useMemo ---
  const allCounts = useMemo((): TextCounts => {
    const inputText = text;
    const customString = customStringToCount;
    const trimmedText = inputText.trim();
    const words = trimmedText.length === 0 ? 0 : trimmedText.split(/\s+/).filter(Boolean).length;
    const characters = inputText.length;
    const lines = inputText === '' ? 0 : inputText.split(/\r\n|\r|\n/).length;
    let customCount = 0;
    if (inputText && customString) {
       customCount = inputText.split(customString).length - 1;
    }
    return { words, characters, lines, customString: customString, customCount };
  }, [text, customStringToCount]);

  // --- Logging Handler Removed ---
  /*
  const handleLogHistory = useCallback(() => {
    addHistoryEntry({
      toolName: 'Text Counter',
      toolRoute: '/text-counter',
      action: 'count',
      input: text.length > 500 ? text.substring(0, 500) + '...' : text,
      output: allCounts,
      status: 'success',
      options: { ...(allCounts.customString && { searchedFor: allCounts.customString }) },
    });
  }, [text, allCounts, addHistoryEntry]);
  */

  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => { setText(event.target.value); };
  const handleCustomStringChange = (event: React.ChangeEvent<HTMLInputElement>) => { setCustomStringToCount(event.target.value); };
  const handleClearCustomString = () => { setCustomStringToCount(''); }
  const handleClear = () => { setText(''); }

  // --- JSX ---
  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Text Counter</h1>
      <p className="mb-6 text-gray-700">Count words, characters, lines, and occurrences of specific text.</p>

      <div className="flex flex-col gap-5"> {/* Main container with spacing */}

        {/* Input Area */}
        <div>
            <textarea
                id="text-input" rows={10} value={text} onChange={handleInputChange}
                placeholder="Paste or type your text here..."
                aria-label="Text input area"
                className="w-full p-3 border border-gray-300 rounded-md text-base font-inherit focus:ring focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            />
        </div>

        {/* Base Counts Display (Words, Chars, Lines) */}
        <div className='flex flex-cols gap-1 border rounded-md bg-gray-50'>
        <div className="w-full grid grid-cols-3 gap-4 text-center p-4">
             <div>
                 <p className="text-xl font-semibold text-gray-700">{allCounts.words}</p>
                 <p className="text-xs text-gray-500">Words</p>
              </div>
              <div>
                 <p className="text-xl font-semibold text-gray-700">{allCounts.characters}</p>
                 <p className="text-xs text-gray-500">Characters</p>
              </div>
              <div>
                 <p className="text-xl font-semibold text-gray-700">{allCounts.lines}</p>
                 <p className="text-xs text-gray-500">Lines</p>
              </div>
                
        </div>
        <div className='p-1'>
            <button
                     onClick={handleClear}
                     title="Clear count text"
                     className="px-3 py-2 rounded-md text-gray-700 text-sm font-medium bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                  >
                     Clear
                  </button>

        </div>
        </div>

        {/* Custom Count Input, Display & Clear Button Row */}


        
        <div className="flex flex-wrap gap-4 items-center justify-between border p-4 rounded-md bg-slate-50">
            <div className="text-center px-4 shrink-0">
                 <p className="text-2xl font-bold text-lime-700">{allCounts.customCount}</p>
                 <p className="text-xs text-lime-600" title={allCounts.customString ? `Occurrences of "${allCounts.customString}"` : 'Occurrences'}>
                     Occurrences
                 </p>
             </div>
             {/* Input Section */}
             <div className="flex-grow min-w-[200px]">
                 <input
                     type="text"
                     id="custom-string-input"
                     value={customStringToCount}
                     onChange={handleCustomStringChange}
                     placeholder="Text to Count Occurrences Of..."
                     aria-label="Text to count occurrences of"
                     className="w-full px-3 py-2 border border-gray-300 rounded-md text-base focus:ring focus:ring-blue-500 focus:border-blue-500 outline-none"
                 />
             </div>

             {/* Occurrence Count Display Section */}
             

             {/* Clear Button */}
             <div className="flex items-center shrink-0"> {/* Aligned with other items */}
                 <button
                     onClick={handleClearCustomString}
                     title="Clear occurrence text"
                     className="px-3 py-2 rounded-md text-gray-700 text-sm font-medium bg-gray-200 hover:bg-gray-300"
                  >
                     Clear
                  </button>
             </div>
        </div>
      </div>
    </main>
  );
}