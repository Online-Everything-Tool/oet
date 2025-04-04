// /app/history/page.tsx
'use client'; // This page needs client-side hooks and interaction

import React from 'react';
import { useHistory } from '../context/HistoryContext'; // Adjust path if needed
import type { HistoryEntry } from '../context/HistoryContext'; // Import the type

export default function HistoryPage() {
  // Get history data and functions from the context
  const { history, deleteHistoryEntry, clearHistory, isLoaded } = useHistory();

  // Helper function to format timestamp (basic example)
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString(); // Adjust locale/options as needed
  };

  // Handle deleting a single entry
  const handleDelete = (id: string) => {
    // Optional: Add a confirmation dialog
    // if (confirm('Are you sure you want to delete this history entry?')) {
      deleteHistoryEntry(id);
    // }
  };

  // Handle clearing all history
  const handleClearAll = () => {
    // Optional: Add a confirmation dialog
    // if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      clearHistory();
    // }
  };

  return (
    <div className="space-y-6"> {/* Add some vertical spacing */}
      <div className="flex justify-between items-center border-b pb-2 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Usage History</h1>
        <button
          onClick={handleClearAll}
          disabled={!isLoaded || history.length === 0} // Disable if not loaded or empty
          className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 ease-in-out"
        >
          Clear All History
        </button>
      </div>

      {/* Loading State */}
      {!isLoaded && (
        <p className="text-gray-500 italic">Loading history...</p>
      )}

      {/* Empty State */}
      {isLoaded && history.length === 0 && (
        <p className="text-gray-500">No history recorded yet.</p>
      )}

      {/* History List */}
      {isLoaded && history.length > 0 && (
        <ul className="space-y-4">
          {history.map((entry: HistoryEntry) => (
            <li key={entry.id} className="p-4 border rounded-md shadow-sm bg-white flex justify-between items-start gap-4">
              {/* Minimal Entry Display */}
              <div className="flex-grow overflow-hidden"> {/* Prevent long text overflow */}
                <p className="text-sm text-gray-500">{formatTimestamp(entry.timestamp)}</p>
                <p className="font-semibold text-gray-700">{entry.toolName}</p>
                {/* ---- Placeholder for future detailed display ---- */}
                 <pre className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap break-words">
                   {/* Display raw data for now during development */}
                   {JSON.stringify({ action: entry.action, input: entry.input, output: entry.output, status: entry.status }, null, 2)}
                 </pre>
                {/* ---- End Placeholder ---- */}
              </div>

              {/* Delete Button */}
              <button
                onClick={() => handleDelete(entry.id)}
                title="Delete this entry"
                className="px-2 py-1 rounded text-xs font-medium text-red-600 hover:bg-red-100 focus:outline-none focus:ring-1 focus:ring-red-500 flex-shrink-0"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}