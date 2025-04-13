'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { RichEntityData } from '../page';
import { useHistory } from '../../../context/HistoryContext'; // Assuming this path is correct

interface EntitySearchClientProps {
  initialEntities: RichEntityData[];
  availableCategories: string[];
}

export default function HtmlEntitySearchClient({ initialEntities, availableCategories }: EntitySearchClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const { addHistoryEntry } = useHistory();
  // Removed copySuccess state: const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Memoized filtering logic
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

  // Search input handler
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    // Removed: setCopySuccess(null);
  };

  // Category select handler
  const handleCategoryChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(event.target.value);
    // Removed: setCopySuccess(null);
  }, []);

  // Copy handler (handles name, code, and char) - Simplified without visual feedback state
  const handleCopy = useCallback((textToCopy: string, type: 'name' | 'code' | 'char', entity: RichEntityData) => {
    // Removed: setCopySuccess(null);

    if (!navigator.clipboard) {
      console.error('Clipboard API not available.');
      // Removed: setCopySuccess('Clipboard not supported by your browser.');
      // Removed: setTimeout(() => setCopySuccess(null), 2000);
      addHistoryEntry({
          toolName: 'HTML Entity Explorer', toolRoute: '/t/html-entity-explorer', action: `copy_${type}`,
          input: entity.description || entity.name, output: textToCopy, status: 'error',
          options: { char: entity.char, category: entity.category, error: 'Clipboard API not available' }
      });
      return;
    }
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        // Removed visual feedback logic
        // const successMessage = `Copied ${type}: ${displayValue}`;
        // setCopySuccess(successMessage);
        // setTimeout(() => setCopySuccess(null), 1500);

        // Log success to history
        addHistoryEntry({
          toolName: 'HTML Entity Explorer', toolRoute: '/t/html-entity-explorer', action: `copy_${type}`,
          input: entity.description || entity.name, output: textToCopy, status: 'success',
          options: { char: entity.char, category: entity.category }
        });
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        // Removed visual feedback logic
        // const errorMessage = `Failed to copy ${type}`;
        // setCopySuccess(errorMessage);
        // setTimeout(() => setCopySuccess(null), 2000);

        // Log error to history
         addHistoryEntry({
          toolName: 'HTML Entity Explorer', toolRoute: '/t/html-entity-explorer', action: `copy_${type}`,
          input: entity.description || entity.name, output: textToCopy, status: 'error',
          options: { char: entity.char, category: entity.category, error: String(err) }
        });
      });
  }, [addHistoryEntry]);

  return (
    <div className="flex flex-col gap-6 text-[rgb(var(--color-text-base))]">
      {/* --- Filter Row --- */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
         {/* Search Input */}
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
         {/* Category Select */}
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

      {/* Removed Copy Success/Error Feedback Div */}

      {/* Results Count/Messages */}
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

      {/* Entity Display Grid */}
      {filteredEntities.length > 0 && (
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
           {filteredEntities.map((entity) => (
             <div
               key={entity.id}
                className="p-4 border border-[rgb(var(--color-border-base))] rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] flex flex-col items-center justify-between space-y-3 min-h-[160px]"
             >
                {/* Clickable Character Display - Styled as Secondary Button */}
                <div
                    className="text-5xl font-serif select-none px-4 py-2 rounded cursor-pointer bg-[rgb(var(--color-button-secondary-bg))] text-[rgb(var(--color-button-secondary-text))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out inline-flex items-center justify-center min-w-[60px] min-h-[60px]"
                    title={`Copy Character: ${entity.char.trim() === '' ? '(space)' : entity.char}`} // Tooltip clarifies action
                    onClick={() => handleCopy(entity.char, 'char', entity)}
                    role="button" // Accessibility: Semantically a button
                    tabIndex={0} // Accessibility: Make focusable
                    onKeyDown={(e) => { // Accessibility: Allow activation with Enter/Space
                       if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault(); // Prevent scrolling on Space
                          handleCopy(entity.char, 'char', entity);
                       }
                    }}
                >
                    {entity.char}
                </div>
                {/* Entity Info & Copy Buttons */}
                <div className="text-center text-sm space-y-1 w-full">
                    {/* Description */}
                    <p className="text-[rgb(var(--color-text-muted))] truncate h-5" title={entity.description || 'No description available'}>
                       {entity.description || <> </>} {/* Keep nbsp for spacing */}
                    </p>
                    {/* Buttons Row (Name and Code only) */}
                    <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-1 pt-1 min-h-[30px]">
                        {/* Copy Name Button (Primary Style) */}
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
                         {/* Copy Code Button (Accent Style - Purple) */}
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