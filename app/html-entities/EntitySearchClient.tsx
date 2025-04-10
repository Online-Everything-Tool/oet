// /app/html-entities/EntitySearchClient.tsx
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { RichEntityData } from './page'; // Includes 'id'
import { useHistory } from '../context/HistoryContext'; // Adjust path if needed

interface EntitySearchClientProps {
  initialEntities: RichEntityData[];
}

export default function EntitySearchClient({ initialEntities }: EntitySearchClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { addHistoryEntry } = useHistory();
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const filteredEntities = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    if (!lowerCaseSearchTerm) {
      return initialEntities;
    }
    return initialEntities.filter(entity =>
      entity.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
      entity.code?.toLowerCase().includes(lowerCaseSearchTerm) ||
      entity.char?.includes(lowerCaseSearchTerm) ||
      entity.description?.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [searchTerm, initialEntities]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCopySuccess(null);
  };

  const handleCopy = useCallback((textToCopy: string, type: 'name' | 'code' | 'char', entity: RichEntityData) => {
    if (!navigator.clipboard) {
      console.error('Clipboard API not available.');
      setCopySuccess('Clipboard not supported by your browser.');
      setTimeout(() => setCopySuccess(null), 2000);
      return;
    }

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        const successMessage = `Copied ${type}: ${textToCopy}`;
        setCopySuccess(successMessage);
        setTimeout(() => setCopySuccess(null), 1500);

        addHistoryEntry({
          toolName: 'HTML Entity Explorer',
          toolRoute: '/html-entities',
          action: `copy_${type}`,
          input: entity.description || entity.name,
          output: textToCopy,
          status: 'success',
          options: { char: entity.char, category: entity.category }
        });
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        setCopySuccess(`Failed to copy ${type}`);
        setTimeout(() => setCopySuccess(null), 2000);
         addHistoryEntry({
          toolName: 'HTML Entity Explorer',
          toolRoute: '/html-entities',
          action: `copy_${type}`,
          input: entity.description || entity.name,
          output: textToCopy,
          status: 'error',
          options: { char: entity.char, category: entity.category, error: String(err) }
        });
      });
  }, [addHistoryEntry]);

  return (
    <div className="flex flex-col gap-5">
      {/* Search Row */}
      <div className="flex gap-3 items-center">
        <div className="flex-grow">
           <label htmlFor="entity-search" className="sr-only">Search Entities</label>
           <input
                type="search"
                id="entity-search"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search by name, code, character, or description..."
                className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
           />
        </div>
      </div>

      {/* Copy Success Feedback */}
      {copySuccess && (
          <div className={`p-2 border text-sm rounded-md transition duration-150 ease-in-out ${copySuccess.startsWith('Failed') ? 'bg-red-100 border-red-300 text-red-800' : 'bg-green-100 border-green-300 text-green-800'}`}>
              {copySuccess}
          </div>
      )}

      {/* Results Count/Messages */}
      {initialEntities.length === 0 && !searchTerm && (
          <p className="text-red-600">Could not load entity data or no entities found.</p>
      )}
      {initialEntities.length > 0 && (
         <p className="text-sm text-gray-500">
             Showing {filteredEntities.length} of {initialEntities.length} unique entities.
         </p>
      )}
       {initialEntities.length > 0 && filteredEntities.length === 0 && searchTerm && (
            <p className="text-gray-600">No entities found matching '{searchTerm}'.</p>
       )}

      {/* Entity Display Grid */}
      {filteredEntities.length > 0 && (
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
           {filteredEntities.map((entity) => (
             <div
               key={entity.id} // Use the unique ID generated on the server
               className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white flex flex-col items-center justify-between space-y-3 min-h-[160px]"
             >
                {/* Character Display */}
                <div className="text-5xl font-serif select-all" title={entity.description || entity.name}>
                    {entity.char}
                </div>
                {/* Entity Info & Copy Buttons */}
                <div className="text-center text-sm space-y-1 w-full">
                    {/* Description */}
                    <p className="text-gray-500 truncate h-5" title={entity.description || 'No description available'}>
                       {entity.description || <> </>} {/* Use non-breaking space if empty */}
                    </p>
                    {/* Buttons */}
                    <div className="flex justify-center items-center space-x-2 pt-1 min-h-[30px]">
                        {/* Render name button only if entity name is valid (&...;) and different from code */}
                        {entity.name && entity.name !== entity.code && entity.name.startsWith('&') && (
                            <button
                                onClick={() => handleCopy(entity.name, 'name', entity)}
                                title={`Copy Name: ${entity.name}`}
                                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-mono rounded border border-blue-200 whitespace-nowrap"
                            >
                                {entity.name}
                            </button>
                        )}
                         {/* Always render code button */}
                         {entity.code && (
                            <button
                                onClick={() => handleCopy(entity.code, 'code', entity)}
                                title={`Copy Code: ${entity.code}`}
                                className="px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-mono rounded border border-purple-200 whitespace-nowrap"
                            >
                                {entity.code}
                            </button>
                         )}
                    </div>
                </div>
             </div>
           ))}
         </div>
       )}
    </div>
  );
}