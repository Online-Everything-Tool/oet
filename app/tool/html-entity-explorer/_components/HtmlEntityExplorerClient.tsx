// FILE: app/tool/html-entity-explorer/_components/HtmlEntityExplorerClient.tsx
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react'; // useEffect might be needed if we add more complex effects
import type { RichEntityData } from '../page';
import { useHistory } from '../../../context/HistoryContext';
import useToolState from '../../_hooks/useToolState';
import Button from '../../_components/form/Button';
import Input from '../../_components/form/Input';
import Select from '../../_components/form/Select';
import { getUniqueSortedValues } from '@/app/lib/utils'; // This might not be needed here anymore if categories are passed directly
import {
  ClipboardDocumentIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface HtmlEntityToolState {
  searchTerm: string;
  selectedCategory: string;
  recentlyCopiedEntities: RichEntityData[];
}

const DEFAULT_ENTITY_TOOL_STATE: HtmlEntityToolState = {
  searchTerm: '',
  selectedCategory: '',
  recentlyCopiedEntities: [],
};

const MAX_RECENTLY_COPIED_ENTITIES = 10;

interface EntitySearchClientProps {
  initialEntities: RichEntityData[];
  availableCategories: string[];
  featuredEntity?: RichEntityData;
}

export default function HtmlEntityExplorerClient({
  initialEntities,
  availableCategories,
  featuredEntity,
}: EntitySearchClientProps) {
  // --- ALL HOOKS AT THE TOP ---
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
  } = useToolState<HtmlEntityToolState>(
    '/tool/html-entity-explorer',
    DEFAULT_ENTITY_TOOL_STATE
  );

  const [lastCopiedInfo, setLastCopiedInfo] = useState<{
    id: string;
    type: 'char' | 'name' | 'code';
  } | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const { addHistoryEntry } = useHistory(); // useContext

  // --- MEMOIZED VALUES (HOOKS) ---
  const filteredEntities = useMemo(() => {
    const categoryFiltered = toolState.selectedCategory
      ? initialEntities.filter(
          (entity) => entity.category === toolState.selectedCategory
        )
      : initialEntities;
    const lowerCaseSearchTerm = toolState.searchTerm.toLowerCase().trim();
    if (!lowerCaseSearchTerm) {
      return categoryFiltered;
    }
    return categoryFiltered.filter(
      (entity) =>
        entity.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
        entity.code?.toLowerCase().includes(lowerCaseSearchTerm) ||
        (entity.char && entity.char.includes(lowerCaseSearchTerm)) ||
        entity.description?.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [initialEntities, toolState.searchTerm, toolState.selectedCategory]);

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'All Categories' },
      ...availableCategories.map((cat) => ({
        value: cat,
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
      })),
    ],
    [availableCategories]
  );

  const activeFilterCount = useMemo(() => {
    // Recalculated activeFilterCount based on current filters
    let count = 0;
    if (toolState.selectedCategory && toolState.selectedCategory !== '')
      count++;
    // If other filters were added to toolState, they'd be checked here
    return count;
  }, [toolState.selectedCategory]);

  // --- CALLBACKS (HOOKS) ---
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setToolState((prev) => ({ ...prev, searchTerm: event.target.value }));
    },
    [setToolState]
  );

  const handleCategoryChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setToolState((prev) => ({
        ...prev,
        selectedCategory: event.target.value,
      }));
    },
    [setToolState]
  );

  const handleClearRecents = useCallback(() => {
    setToolState((prev) => ({ ...prev, recentlyCopiedEntities: [] }));
  }, [setToolState]);

  const handleClearFilters = useCallback(() => {
    setToolState((prev) => ({ ...prev, selectedCategory: '', searchTerm: '' }));
  }, [setToolState]);

  const handleCopy = useCallback(
    async (
      textToCopy: string,
      type: 'name' | 'code' | 'char',
      entity: RichEntityData,
      source: 'card' | 'recent' | 'featured' = 'card'
    ) => {
      setCopyError(null);
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        const errorMsg = 'Clipboard API not available in this browser.';
        setCopyError(errorMsg);
        addHistoryEntry({
          toolName: 'HTML Entity Explorer',
          toolRoute: '/tool/html-entity-explorer',
          trigger: 'click',
          input: {
            copiedType: type,
            value: textToCopy,
            entityName: entity.name,
            source,
            error: errorMsg,
          },
          output: { char: entity.char, name: entity.name },
          status: 'error',
          eventTimestamp: Date.now(),
        });
        return;
      }
      try {
        await navigator.clipboard.writeText(textToCopy);
        setLastCopiedInfo({ id: entity.id, type });
        setTimeout(() => setLastCopiedInfo(null), 1500);

        if (source !== 'recent') {
          setToolState((prev) => {
            const newRecents = [
              entity,
              ...prev.recentlyCopiedEntities.filter((e) => e.id !== entity.id),
            ].slice(0, MAX_RECENTLY_COPIED_ENTITIES);
            return { ...prev, recentlyCopiedEntities: newRecents };
          });
        }
        addHistoryEntry({
          toolName: 'HTML Entity Explorer',
          toolRoute: '/tool/html-entity-explorer',
          trigger: 'click',
          input: {
            copiedType: type,
            value: textToCopy,
            entityName: entity.name,
            source,
          },
          output: { char: entity.char, name: entity.name, code: entity.code },
          status: 'success',
          eventTimestamp: Date.now(),
        });
      } catch (err) {
        const errorMsg = `Failed to copy ${type}: ${err instanceof Error ? err.message : 'Unknown clipboard error'}`;
        console.error(errorMsg, err);
        setCopyError(errorMsg);
        addHistoryEntry({
          toolName: 'HTML Entity Explorer',
          toolRoute: '/tool/html-entity-explorer',
          trigger: 'click',
          input: {
            copiedType: type,
            value: textToCopy,
            entityName: entity.name,
            source,
            error: errorMsg,
          },
          output: { char: entity.char, name: entity.name },
          status: 'error',
          eventTimestamp: Date.now(),
        });
      }
    },
    [addHistoryEntry, setToolState] // Removed toolState from deps as it's accessed via functional update in setToolState
  );

  // --- CONDITIONAL RETURN MOVED AFTER ALL HOOKS ---
  if (isLoadingToolState) {
    return (
      <div className="text-center p-4 text-gray-500 italic animate-pulse">
        Loading Entity Explorer...
      </div>
    );
  }

  // --- JSX RENDER ---
  return (
    <div className="flex flex-col gap-6 text-[rgb(var(--color-text-base))] p-1">
      {/* Featured Entity Section */}
      {featuredEntity && (
        <div className="p-4 md:p-6 border rounded-lg bg-[rgb(var(--color-bg-subtle))] shadow-sm mb-4">
          <div className="flex flex-col items-center text-center">
            <div
              className="text-6xl font-serif py-2 px-4 rounded bg-white shadow"
              title={featuredEntity.name}
            >
              {featuredEntity.char}
            </div>
            <h2 className="text-xl font-semibold mt-3">
              {featuredEntity.name}
            </h2>
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              {featuredEntity.description}
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() =>
                  handleCopy(
                    featuredEntity.char,
                    'char',
                    featuredEntity,
                    'featured'
                  )
                }
                iconLeft={
                  lastCopiedInfo?.id === featuredEntity.id &&
                  lastCopiedInfo?.type === 'char' ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  )
                }
              >
                {lastCopiedInfo?.id === featuredEntity.id &&
                lastCopiedInfo?.type === 'char'
                  ? 'Copied!'
                  : 'Char'}
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  handleCopy(
                    featuredEntity.name,
                    'name',
                    featuredEntity,
                    'featured'
                  )
                }
                iconLeft={
                  lastCopiedInfo?.id === featuredEntity.id &&
                  lastCopiedInfo?.type === 'name' ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  )
                }
              >
                {lastCopiedInfo?.id === featuredEntity.id &&
                lastCopiedInfo?.type === 'name'
                  ? 'Copied!'
                  : `Name`}
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  handleCopy(
                    featuredEntity.code,
                    'code',
                    featuredEntity,
                    'featured'
                  )
                }
                iconLeft={
                  lastCopiedInfo?.id === featuredEntity.id &&
                  lastCopiedInfo?.type === 'code' ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  )
                }
              >
                {lastCopiedInfo?.id === featuredEntity.id &&
                lastCopiedInfo?.type === 'code'
                  ? 'Copied!'
                  : `Code`}
              </Button>
            </div>
            {typeof window !== 'undefined' &&
              window.location.pathname !== '/tool/html-entity-explorer/' && (
                <div className="mt-4">
                  <Link
                    href="/tool/html-entity-explorer/"
                    className="text-sm text-[rgb(var(--color-text-link))] hover:underline"
                  >
                    ← Back to Full Explorer
                  </Link>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Recently Copied Section */}
      {toolState.recentlyCopiedEntities &&
        toolState.recentlyCopiedEntities.length > 0 && (
          <div className="p-3 border-b border-[rgb(var(--color-border-base))]">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-medium text-[rgb(var(--color-text-muted))] uppercase tracking-wider">
                Recently Copied:
              </h3>
              <Button
                variant="link"
                size="sm"
                onClick={handleClearRecents}
                title="Clear recently copied"
                className="!p-0.5"
              >
                <XMarkIcon className="h-4 w-4 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-error))]" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {toolState.recentlyCopiedEntities.map((entity) => (
                <Button
                  key={entity.id}
                  variant="neutral-outline"
                  size="sm"
                  onClick={() =>
                    handleCopy(entity.char, 'char', entity, 'recent')
                  }
                  title={`Copy ${entity.char} (${entity.name})`}
                  className="!px-2 !py-1 !text-lg font-serif leading-none"
                  aria-label={`Copy character ${entity.name}`}
                >
                  {lastCopiedInfo?.id === entity.id &&
                  lastCopiedInfo?.type === 'char' ? (
                    <CheckIcon className="h-4 w-4 text-green-500" />
                  ) : (
                    entity.char
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-center pt-2">
        <div className="flex-grow w-full sm:w-auto">
          <Input
            type="search"
            id="entity-search"
            value={toolState.searchTerm}
            onChange={handleSearchChange}
            placeholder="Search entities by name, code, or character..."
            inputClassName="p-3 text-base"
          />
        </div>
        <div className="w-full sm:w-auto sm:min-w-[220px]">
          <Select
            id="category-select"
            value={toolState.selectedCategory}
            onChange={handleCategoryChange}
            options={categoryOptions}
            selectClassName="w-full p-3 text-base"
          />
        </div>
        {(toolState.searchTerm || toolState.selectedCategory) && (
          <Button
            variant="neutral-outline"
            size="sm"
            onClick={handleClearFilters}
            className="!py-3"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Copy Error Display */}
      {copyError && (
        <div
          role="alert"
          className="p-3 my-2 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0"
            aria-hidden="true"
          />
          {copyError}
        </div>
      )}

      {/* Status Message & Entity Grid */}
      {initialEntities.length > 0 && (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">
          Showing {filteredEntities.length}
          {toolState.selectedCategory
            ? ` in category "${toolState.selectedCategory}"`
            : ''}
          {toolState.searchTerm ? ` matching "${toolState.searchTerm}"` : ''}
          {!toolState.selectedCategory && !toolState.searchTerm
            ? ` of ${initialEntities.length} total`
            : ''}{' '}
          entities.
        </p>
      )}
      {initialEntities.length === 0 && !isLoadingToolState && (
        <p className="text-[rgb(var(--color-text-error))]">
          Could not load entity data or no entities found.
        </p>
      )}
      {initialEntities.length > 0 &&
        filteredEntities.length === 0 &&
        (toolState.searchTerm || toolState.selectedCategory) && (
          <p className="text-[rgb(var(--color-text-muted))]">
            No entities found matching your criteria.
          </p>
        )}

      {filteredEntities.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredEntities.map((entity) => (
            <div
              key={entity.id}
              className="p-3 border border-[rgb(var(--color-border-base))] rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] flex flex-col items-center justify-between space-y-2 min-h-[150px]"
            >
              <Button
                variant="secondary"
                onClick={() => handleCopy(entity.char, 'char', entity)}
                title={`Copy Character: ${entity.char.trim() === '' ? '(space)' : entity.char}`}
                className="text-4xl font-serif !px-3 !py-1 min-w-[50px] min-h-[50px] flex items-center justify-center"
                aria-label={`Copy character ${entity.name}`}
              >
                {lastCopiedInfo?.id === entity.id &&
                lastCopiedInfo?.type === 'char' ? (
                  <CheckIcon className="h-8 w-8 text-white" />
                ) : (
                  entity.char
                )}
              </Button>
              <div className="text-center text-xs space-y-1 w-full">
                <p
                  className="text-[rgb(var(--color-text-muted))] truncate h-4"
                  title={entity.description || 'No description'}
                >
                  {entity.description || <> </>}
                </p>
                <div className="flex flex-wrap justify-center items-center gap-1 pt-1">
                  {entity.name &&
                    entity.name !== entity.code &&
                    entity.name.startsWith('&') && (
                      <Button
                        size="sm"
                        variant="primary-outline"
                        onClick={() => handleCopy(entity.name, 'name', entity)}
                        title={`Copy Name: ${entity.name}`}
                        className="!px-1.5 !py-0.5 !text-[10px] font-mono"
                      >
                        {lastCopiedInfo?.id === entity.id &&
                        lastCopiedInfo?.type === 'name' ? (
                          <CheckIcon className="h-3 w-3" />
                        ) : (
                          entity.name
                        )}
                      </Button>
                    )}
                  {entity.code && (
                    <Button
                      size="sm"
                      variant="accent-outline"
                      onClick={() => handleCopy(entity.code, 'code', entity)}
                      title={`Copy Code: ${entity.code}`}
                      className="!px-1.5 !py-0.5 !text-[10px] font-mono"
                    >
                      {lastCopiedInfo?.id === entity.id &&
                      lastCopiedInfo?.type === 'code' ? (
                        <CheckIcon className="h-3 w-3" />
                      ) : (
                        entity.code
                      )}
                    </Button>
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
