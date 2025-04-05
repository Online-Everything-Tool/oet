// /app/word-count/page.tsx
'use client';

import React, { useState, useCallback } from 'react'; // Added useCallback
import { useHistory } from '../context/HistoryContext'; // 1. Import useHistory

export default function WordCountPage() {
    // --- State ---
    const [text, setText] = useState('');
    const [wordCount, setWordCount] = useState(0);
    // Optional: Add state for char/line counts if desired later
    // const [charCount, setCharCount] = useState(0);
    // const [lineCount, setLineCount] = useState(0);

    // --- History Hook ---
    const { addHistoryEntry } = useHistory(); // 2. Get addHistoryEntry function

    // --- Core Calculation Logic ---
    // Separated calculation logic
    const calculateCounts = (inputText: string) => {
        const trimmedText = inputText.trim();
        const words = trimmedText.length === 0 ? 0 : trimmedText.split(/\s+/).filter(Boolean).length;
        const characters = inputText.length; // Count raw characters including leading/trailing space
        const lines = inputText === '' ? 0 : inputText.split(/\r\n|\r|\n/).length;
        return { words, characters, lines };
    };

    // --- Action Handler ---
    const handleCountWords = useCallback(() => {
        const counts = calculateCounts(text);
        setWordCount(counts.words);
        // If you add state for chars/lines, set them here:
        // setCharCount(counts.characters);
        // setLineCount(counts.lines);

        // --- 3. Add History Entry ---
        // Log only if text was actually processed (even if word count is 0)
        if (text.length > 0) {
            addHistoryEntry({
                toolName: 'Word Counter',
                toolRoute: '/word-count',
                action: 'count',
                input: text.length > 500 ? text.substring(0, 500) + '...' : text, // Truncate
                output: counts, // Log the full counts object
                status: 'success',
                // No specific options needed here
            });
        } else {
            // If input text is empty, ensure count is 0
            setWordCount(0);
            // Optionally log empty submission? Decided against it for other tools. Let's be consistent.
            // addHistoryEntry({ ... entry for empty input ... });
        }

    }, [text, addHistoryEntry]); // Dependencies

    // --- Event Handlers ---
    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(event.target.value);
        // Optionally trigger count on change? Or clear count?
        // setWordCount(0); // Clear count on input change?
    };

    // Note: onBlur counting might feel odd with an explicit button, keeping both for now
    // Consider removing onBlur or the button if only one trigger is desired.

    const handleClear = () => { // Added a Clear button handler
        setText('');
        setWordCount(0);
        // setCharCount(0);
        // setLineCount(0);
    }

    // --- JSX ---
    return (
        <main className="p-6 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-4">Word Counter</h1>
            <p className="mb-6 text-gray-700">Enter your text below to count the number of words, characters, and lines.</p>

            <div className="flex flex-col gap-4">
                <label htmlFor="text-input" className="font-semibold">Your Text:</label>
                <textarea
                    id="text-input"
                    rows={10}
                    value={text}
                    onChange={handleInputChange}
                    // onBlur={handleCountWords} // Maybe remove onBlur if button is primary action
                    placeholder="Paste or type your text here..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-base font-inherit focus:ring focus:ring-blue-500 focus:border-blue-500 outline-none"
                />

                {/* Added Clear button */}
                 <div className="flex flex-wrap gap-3 items-center">
                    <button
                        onClick={handleCountWords}
                        className="px-4 py-2 text-base font-medium bg-blue-500 text-white rounded-md cursor-pointer hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    >
                        Count Words
                    </button>
                    <button
                        onClick={handleClear}
                        title="Clear input text"
                        className="px-3 py-2 rounded-md text-gray-700 font-medium bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition duration-150 ease-in-out"
                     >
                        Clear
                     </button>
                 </div>


                {/* Updated results display */}
                <div
                    id="word-count-output"
                    className="mt-4 text-xl font-bold min-h-[1.5em]"
                >
                    {/* Display the word count specifically */}
                    Word Count: {wordCount}
                    {/* You could add char/line count here too if state is added */}
                    {/* | Character Count: {charCount} | Line Count: {lineCount} */}
                </div>
            </div>
        </main>
    );
}