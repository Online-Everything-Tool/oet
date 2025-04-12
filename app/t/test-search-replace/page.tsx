'use client';

import React, { useState, useCallback } from 'react';
import { useHistory } from '../../context/HistoryContext';

export default function TestSearchReplacePage() {
  const [inputString, setInputString] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceString, setReplaceString] = useState('');
  const [outputString, setOutputString] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const { addHistoryEntry } = useHistory();

  const handleSearchReplace = useCallback(() => {
    setErrorMessage(''); // Clear previous errors
    try {
      const result = inputString.replace(new RegExp(searchQuery, 'g'), replaceString);
      setOutputString(result);
      addHistoryEntry({
        toolName: 'Test Search & Replace',
        toolRoute: '/t/test-search-replace',
        action: 'search-replace',
        input: inputString.length > 500 ? inputString.substring(0, 500) + '...' : inputString,
        output: result.length > 500 ? result.substring(0, 500) + '...' : result,
        status: 'success',
        options: { searchQuery, replaceString },
      });
    } catch (error) {
      console.error('Error during search and replace:', error);
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
      addHistoryEntry({
        toolName: 'Test Search & Replace',
        toolRoute: '/t/test-search-replace',
        action: 'search-replace',
        input: inputString.length > 500 ? inputString.substring(0, 500) + '...' : inputString,
        output: errorMessage,
        status: 'error',
        options: { searchQuery, replaceString },
      });
    }
  }, [inputString, searchQuery, replaceString, addHistoryEntry]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputString(event.target.value);
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleReplaceChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setReplaceString(event.target.value);
  }, []);

  const handleClear = useCallback(() => {
    setInputString('');
    setSearchQuery('');
    setReplaceString('');
    setOutputString('');
    setErrorMessage('');
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Test Search & Replace</h1>
      <div className="mb-4">
        <label htmlFor="inputString" className="block text-gray-700 font-bold mb-2">Input String:</label>
        <textarea
          id="inputString"
          rows={5}
          value={inputString}
          onChange={handleInputChange}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="mb-4">
        <label htmlFor="searchQuery" className="block text-gray-700 font-bold mb-2">Search Query:</label>
        <input
          id="searchQuery"
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="mb-4">
        <label htmlFor="replaceString" className="block text-gray-700 font-bold mb-2">Replace String:</label>
        <input
          id="replaceString"
          type="text"
          value={replaceString}
          onChange={handleReplaceChange}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="mb-4">
        <button
          onClick={handleSearchReplace}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Search & Replace
        </button>
        <button
          onClick={handleClear}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded ml-2 focus:outline-none focus:shadow-outline"
        >
          Clear
        </button>
      </div>
      <div className="mb-4">
        <label htmlFor="outputString" className="block text-gray-700 font-bold mb-2">Output String:</label>
        <textarea
          id="outputString"
          rows={5}
          value={outputString}
          readOnly
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {errorMessage && (
        <div className="text-red-500">Error: {errorMessage}</div>
      )}
    </div>
  );
}