// FILE: app/tool/html-entity-explorer/_components/HtmlEntityExplorerClient.tsx
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { RichEntityData } from '../page';
import { useHistory } from '../../../context/HistoryContext';

interface EntitySearchClientProps {
  initialEntities: RichEntityData[];
  availableCategories: string[];
}

export default function HtmlEntityExplorerClient({ initialEntities, availableCategories }: EntitySearchClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const { addHistoryEntry } = useHistory();

  const filteredEntities = useMemo(() => {
    const categoryFiltered = selectedCategory
      ? initialEntities.filter(entity => entity.category === selectedCategory)
      : initialEntities;

    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    if (!lowerCaseSearchTerm) {
      return categoryFiltered;
    }

    return categoryFiltered.filter(entity =>
      entity.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
      entity.code?.toLowerCase().includes(lowerCaseSearchTerm) ||
      entity.char?.includes(lowerCaseSearchTerm) ||
      entity.description?.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [searchTerm, initialEntities, selectedCategory]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleCategoryChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(event.target.value);
  }, []);

  const handleCopy = useCallback((textToCopy: string, type: 'name' | 'code' | 'char', entity: RichEntityData) => {
    // --- Construct Input Object ---
    const historyInput: Record<string, unknown> = {
        copiedType: type,
        copiedValue: textToCopy,
        entityDescription: entity.description || entity.name,
    };
    if (searchTerm) historyInput.searchTerm = searchTerm;
    if (selectedCategory) historyInput.category = selectedCategory;

    // --- Construct Structured Output Object ---
    const historyOutput = {
        char: entity.char,
        name: entity.name, // Entity name (e.g.,  ) or code
        code: entity.code, // Hex/Dec code
        description: entity.description // Description text
    };
    // --- End Structured Output Object ---

    if (!navigator.clipboard) {
      console.error('Clipboard API not available.');
      historyInput.error = 'Clipboard API not available';
      addHistoryEntry({
          toolName: 'HTML Entity Explorer', toolRoute: '/tool/html-entity-explorer', trigger: `click`,
          input: historyInput,
          output: historyOutput, // Log structured output even on error
          status: 'error',
      });
      return;
    }

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        addHistoryEntry({
          toolName: 'HTML Entity Explorer', toolRoute: '/tool/html-entity-explorer', trigger: `click`,
          input: historyInput,
          output: historyOutput, // Log structured output on success
          status: 'success',
        });
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        historyInput.error = `Clipboard Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
         addHistoryEntry({
          toolName: 'HTML Entity Explorer', toolRoute: '/tool/html-entity-explorer', trigger: `click`,
          input: historyInput,
          output: historyOutput, // Log structured output even on error
          status: 'error',
        });
      });
  }, [addHistoryEntry, searchTerm, selectedCategory]);

  return (
    <div className="flex flex-col gap-6 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="flex-grow w-full sm:w-auto">
           <label htmlFor="entity-search" className="sr-only">Search Entities</label>
           <input
                type="search"
                id="entity-search"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search entities..."
                className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
           />
        </div>
        <div className="w-full sm:w-auto">
            <label htmlFor="category-select" className="sr-only">Filter by Category</label>
            <select
                id="category-select"
                value={selectedCategory}
                onChange={handleCategoryChange}
                className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base"
            >
                <option value="">All Categories</option>
                {availableCategories.map(category => (
                    <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                ))}
            </select>
        </div>
      </div>

      {initialEntities.length === 0 && !searchTerm && !selectedCategory &&(
          <p className="text-[rgb(var(--color-text-error))]">Could not load entity data or no entities found.</p>
      )}
      {initialEntities.length > 0 && (
         <p className="text-sm text-[rgb(var(--color-text-muted))]">
             Showing {filteredEntities.length}
             {selectedCategory ? ` in category "${selectedCategory}"` : ''}
             {searchTerm ? ` matching "${searchTerm}"` : ''}
             {(!selectedCategory && !searchTerm && initialEntities.length > 0) ? ` of ${initialEntities.length} total` : ''} entities.
         </p>
      )}
      {initialEntities.length > 0 && filteredEntities.length === 0 && (searchTerm || selectedCategory) && (
            <p className="text-[rgb(var(--color-text-muted))]">No entities found matching your criteria.</p>
      )}

      {filteredEntities.length > 0 && (
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
           {filteredEntities.map((entity) => (
             <div
               key={entity.id}
                className="p-4 border border-[rgb(var(--color-border-base))] rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] flex flex-col items-center justify-between space-y-3 min-h-[160px]"
             >
                <div
                    className="text-5xl font-serif select-none px-4 py-2 rounded cursor-pointer bg-[rgb(var(--color-button-secondary-bg))] text-[rgb(var(--color-button-secondary-text))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out inline-flex items-center justify-center min-w-[60px] min-h-[60px]"
                    title={`Copy Character: ${entity.char.trim() === '' ? '(space)' : entity.char}`}
                    onClick={() => handleCopy(entity.char, 'char', entity)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                       if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCopy(entity.char, 'char', entity);
                       }
                    }}
                >
                    {entity.char}
                </div>
                <div className="text-center text-sm space-y-1 w-full">
                    <p className="text-[rgb(var(--color-text-muted))] truncate h-5" title={entity.description || 'No description available'}>
                       {entity.description || <> </>} {/* Use non-breaking space for empty description */}
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-1 pt-1 min-h-[30px]">
                        {entity.name && entity.name !== entity.code && entity.name.startsWith('&') && (
                            <button
                                type="button"
                                onClick={() => handleCopy(entity.name, 'name', entity)}
                                title={`Copy Name: ${entity.name}`}
                                className="px-2 py-1 bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] text-xs font-mono rounded whitespace-nowrap transition-colors duration-150 ease-in-out focus:outline-none"
                            >
                                {entity.name}
                            </button>
                        )}
                         {entity.code && (
                            <button
                                type="button"
                                onClick={() => handleCopy(entity.code, 'code', entity)}
                                title={`Copy Code: ${entity.code}`}
                                className="px-2 py-1 bg-[rgb(var(--color-button-accent-bg))] text-[rgb(var(--color-button-accent-text))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] text-xs font-mono rounded whitespace-nowrap transition-colors duration-150 ease-in-out focus:outline-none"
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