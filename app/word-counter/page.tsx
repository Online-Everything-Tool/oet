'use client';

import React, { useState } from 'react';

export default function WordCountPage() {
    const [text, setText] = useState('');
    const [wordCount, setWordCount] = useState(0);

    const calculateWordCount = (inputText: string): number => {
        if (!inputText || inputText.trim().length === 0) {
            return 0;
        }
        const words = inputText.trim().split(/\s+/).filter(Boolean);
        return words.length;
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(event.target.value);
    };

    const handleCountWords = () => {
        setWordCount(calculateWordCount(text));
    };

    return (
        <main className="p-6 max-w-2xl mx-auto"> {/* padding, max width, horizontal centering */}
            <h1 className="text-3xl font-bold mb-4">Word Counter</h1> {/* Larger text, bold, margin bottom */}
            <p className="mb-6 text-gray-700">Enter your text below to count the number of words.</p> {/* Margin bottom, muted text color */}

            <div className="flex flex-col gap-4"> {/* Flex column layout, vertical gap */}
                <label htmlFor="text-input" className="font-semibold">Your Text:</label> {/* Bold label */}
                <textarea
                    id="text-input"
                    rows={10}
                    value={text}
                    onChange={handleInputChange}
                    onBlur={handleCountWords}
                    placeholder="Paste or type your text here..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-base font-inherit focus:ring focus:ring-blue-500 focus:border-blue-500 outline-none"
                    /* width 100%, padding, border, rounded, base font size, inherit font family, focus styles */
                />

                <button
                    onClick={handleCountWords}
                    className="px-4 py-2 text-base font-medium bg-blue-500 text-white rounded-md cursor-pointer self-start hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    /* padding, font size, medium font, blue background, white text, rounded, pointer cursor, left align, hover/focus styles */
                >
                    Count Words
                </button>

                <div
                    id="word-count-output"
                    className="mt-4 text-xl font-bold min-h-[1.5em]" /* margin top, larger text, bold, min height */
                >
                    Word Count: {wordCount}
                </div>
            </div>
        </main>
    );
}