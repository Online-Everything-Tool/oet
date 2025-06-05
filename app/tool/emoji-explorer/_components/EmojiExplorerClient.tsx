// FILE: app/tool/emoji-explorer/_components/EmojiExplorerClient.tsx
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import Button from '@/app/tool/_components/form/Button';
import Input from '@/app/tool/_components/form/Input';

import { getUniqueSortedValues } from '@/app/lib/utils';
import { RichEmojiData } from '@/src/constants/emojis';
import {
  FunnelIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { XCircleIcon } from '@heroicons/react/24/solid';

interface EmojiExplorerToolState {
  searchTerm: string;
  selectedGroup: string;
  selectedSubgroup: string;
  selectedVersion: string;
  recentlyCopiedEmojis: RichEmojiData[];
}

const DEFAULT_EMOJI_EXPLORER_STATE: EmojiExplorerToolState = {
  searchTerm: '',
  selectedGroup: '',
  selectedSubgroup: '',
  selectedVersion: '',
  recentlyCopiedEmojis: [],
};

const MAX_RECENTLY_COPIED = 20;

interface EmojiSearchClientProps {
  initialEmojis: RichEmojiData[];
}

export default function EmojiSearchClient({
  initialEmojis,
}: EmojiSearchClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
  } = useToolState<EmojiExplorerToolState>(
    '/tool/emoji-explorer',
    DEFAULT_EMOJI_EXPLORER_STATE
  );

  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [lastCopiedValue, setLastCopiedValue] = useState<{
    type: string;
    value: string;
  } | null>(null);

  const availableGroups = useMemo(
    () => getUniqueSortedValues(initialEmojis, 'group', 'asc'),
    [initialEmojis]
  );
  const availableVersions = useMemo(
    () => getUniqueSortedValues(initialEmojis, 'version', 'version-desc'),
    [initialEmojis]
  );

  const derivedAvailableSubgroups = useMemo(() => {
    if (!toolState.selectedGroup) return [];
    const filteredByGroup = initialEmojis.filter(
      (e) => e.group === toolState.selectedGroup
    );
    return getUniqueSortedValues(filteredByGroup, 'subgroup', 'asc');
  }, [initialEmojis, toolState.selectedGroup]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (toolState.selectedGroup) count++;
    if (toolState.selectedSubgroup && toolState.selectedGroup) count++;
    if (toolState.selectedVersion) count++;
    return count;
  }, [
    toolState.selectedGroup,
    toolState.selectedSubgroup,
    toolState.selectedVersion,
  ]);

  const filteredEmojis = useMemo(() => {
    const lowerCaseSearchTerm = toolState.searchTerm.toLowerCase().trim();

    if (
      !lowerCaseSearchTerm &&
      !toolState.selectedGroup &&
      !toolState.selectedVersion
    ) {
      return initialEmojis;
    }

    return initialEmojis.filter((emoji) => {
      if (
        lowerCaseSearchTerm &&
        !emoji.name.toLowerCase().includes(lowerCaseSearchTerm)
      )
        return false;
      if (toolState.selectedGroup && emoji.group !== toolState.selectedGroup)
        return false;
      if (
        toolState.selectedGroup &&
        toolState.selectedSubgroup &&
        emoji.subgroup !== toolState.selectedSubgroup
      )
        return false;
      if (
        toolState.selectedVersion &&
        emoji.version !== toolState.selectedVersion
      )
        return false;
      return true;
    });
  }, [
    initialEmojis,
    toolState.searchTerm,
    toolState.selectedGroup,
    toolState.selectedSubgroup,
    toolState.selectedVersion,
  ]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setToolState({ searchTerm: event.target.value });
  const toggleFilterPanel = () => setIsFilterPanelOpen((prev) => !prev);
  const handleGroupChange = (event: React.ChangeEvent<HTMLSelectElement>) =>
    setToolState({ selectedGroup: event.target.value, selectedSubgroup: '' });
  const handleSubgroupChange = (event: React.ChangeEvent<HTMLSelectElement>) =>
    setToolState({ selectedSubgroup: event.target.value });
  const handleVersionChange = (event: React.ChangeEvent<HTMLSelectElement>) =>
    setToolState({ selectedVersion: event.target.value });
  const handleClearFilters = useCallback(
    () =>
      setToolState({
        selectedGroup: '',
        selectedSubgroup: '',
        selectedVersion: '',
      }),
    [setToolState]
  );
  const handleClearRecentlyCopied = useCallback(
    () => setToolState({ recentlyCopiedEmojis: [] }),
    [setToolState]
  );

  const copyToClipboardHandler = useCallback(
    async (textToCopy: string, copyContentType: string, emojiName?: string) => {
      if (!textToCopy) return;
      try {
        await navigator.clipboard.writeText(textToCopy);
        setLastCopiedValue({ type: copyContentType, value: textToCopy });
        setTimeout(() => setLastCopiedValue(null), 1500);
      } catch (err) {
        console.error(`Failed to copy ${emojiName} ${copyContentType}:`, err);
      }
    },
    []
  );

  const handleEmojiClick = useCallback(
    (
      emojiData: RichEmojiData,
      source: 'grid' | 'recent' | 'featured' = 'grid'
    ) => {
      copyToClipboardHandler(emojiData.emoji, 'emoji', emojiData.name);
      if (source !== 'recent') {
        setToolState((prev) => {
          const newRecentlyCopied = [
            emojiData,
            ...prev.recentlyCopiedEmojis.filter(
              (e) => e.codePoints !== emojiData.codePoints
            ),
          ].slice(0, MAX_RECENTLY_COPIED);
          return { ...prev, recentlyCopiedEmojis: newRecentlyCopied };
        });
      }
    },
    [copyToClipboardHandler, setToolState]
  );

  if (isLoadingToolState) {
    return (
      <div className="text-center p-4 text-gray-500 italic animate-pulse">
        Loading Emoji Explorer...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))] p-1">
      {toolState.recentlyCopiedEmojis &&
        toolState.recentlyCopiedEmojis.length > 0 && (
          <div className="p-3 border-b border-[rgb(var(--color-border-base))]">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-medium text-[rgb(var(--color-text-muted))]">
                RECENTLY COPIED:
              </h3>
              <Button
                variant="link"
                size="sm"
                onClick={handleClearRecentlyCopied}
                title="Clear recently copied emojis"
                className="!p-0.5 text-xs"
              >
                <XMarkIcon className="h-4 w-4 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-error))]" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {toolState.recentlyCopiedEmojis.map((emojiData) => (
                <Button
                  key={emojiData.codePoints}
                  variant="neutral-outline"
                  size="sm"
                  onClick={() => handleEmojiClick(emojiData, 'recent')}
                  title={`Copy: ${emojiData.name}`}
                  className="!p-1.5 !text-xl leading-none aspect-square"
                  aria-label={`Copy emoji: ${emojiData.name}`}
                >
                  {lastCopiedValue?.type === 'emoji' &&
                  lastCopiedValue?.value === emojiData.emoji ? (
                    <CheckIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    emojiData.emoji
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}

      <div className="flex gap-3 items-center pt-2">
        <div className="flex-grow">
          <Input
            type="search"
            id="emoji-search"
            value={toolState.searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by name (e.g., smile, cat, star)..."
            inputClassName="p-3 text-base"
            iconLeft={
              <MagnifyingGlassIcon className="h-5 w-5 text-[rgb(var(--color-text-muted))]" />
            }
          />
        </div>
        <div className="relative">
          <Button
            variant={
              activeFilterCount > 0 ? 'accent-outline' : 'neutral-outline'
            }
            size="sm"
            onClick={toggleFilterPanel}
            title={isFilterPanelOpen ? 'Hide Filters' : 'Show Filters'}
            aria-expanded={isFilterPanelOpen}
            className="!p-3"
            iconLeft={<FunnelIcon className="h-4 w-4" />}
          >
            Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[rgb(var(--color-button-accent-bg))] text-[10px] font-medium text-[rgb(var(--color-button-accent-text))] px-1">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {isFilterPanelOpen && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex flex-col gap-4 animate-slide-down">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-[rgb(var(--color-text-base))]">
              Filter Options
            </h3>
            <Button
              variant="neutral"
              onClick={handleClearFilters}
              disabled={activeFilterCount === 0}
              className="w-full sm:w-auto"
              iconLeft={<XCircleIcon className="h-5 w-5" />}
            >
              Clear Filters
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="filter-group"
                className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"
              >
                Group
              </label>
              <select
                id="filter-group"
                value={toolState.selectedGroup}
                onChange={handleGroupChange}
                className="w-full p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm"
              >
                <option value="">All Groups</option>
                {availableGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="filter-subgroup"
                className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"
              >
                Subgroup
              </label>
              <select
                id="filter-subgroup"
                value={toolState.selectedSubgroup}
                onChange={handleSubgroupChange}
                disabled={
                  !toolState.selectedGroup ||
                  derivedAvailableSubgroups.length === 0
                }
                className="w-full p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm disabled:bg-[rgb(var(--color-input-disabled-bg))] disabled:text-[rgb(var(--color-text-muted))] disabled:cursor-not-allowed"
              >
                <option value="">All Subgroups</option>
                {toolState.selectedGroup &&
                  derivedAvailableSubgroups.map((subgroup) => (
                    <option key={subgroup} value={subgroup}>
                      {subgroup}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="filter-version"
                className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"
              >
                Version
              </label>
              <select
                id="filter-version"
                value={toolState.selectedVersion}
                onChange={handleVersionChange}
                className="w-full p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm"
              >
                <option value="">All Versions</option>
                {availableVersions.map((version) => (
                  <option key={version} value={version}>
                    Emoji {version}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        {initialEmojis.length === 0
          ? 'Loading emojis...'
          : `Showing ${filteredEmojis.length} of ${initialEmojis.length} emojis.`}
      </p>
      {initialEmojis.length > 0 &&
        filteredEmojis.length === 0 &&
        (toolState.searchTerm || activeFilterCount > 0) && (
          <p className="text-[rgb(var(--color-text-muted))]">
            No emojis match your search or filter criteria.
          </p>
        )}
      {filteredEmojis.length > 0 && (
        <div
          className={`grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1 sm:gap-2`}
        >
          {filteredEmojis.map((emojiData) => (
            <Button
              key={emojiData.codePoints || emojiData.name}
              variant="neutral-outline"
              onClick={() => handleEmojiClick(emojiData)}
              title={`${emojiData.name}\nCode: ${emojiData.codePoints}`}
              className="!p-1.5 !text-2xl sm:!text-3xl !leading-none aspect-square flex items-center justify-center hover:!bg-[rgb(var(--color-border-base))]"
              aria-label={`Copy emoji: ${emojiData.name}`}
            >
              {lastCopiedValue?.type === 'emoji' &&
              lastCopiedValue?.value === emojiData.emoji ? (
                <CheckIcon className="h-6 w-6 text-green-500" />
              ) : (
                emojiData.emoji
              )}
            </Button>
          ))}
        </div>
      )}
      {initialEmojis.length === 0 && !isLoadingToolState && (
        <div className="text-center p-5 text-[rgb(var(--color-text-muted))]">
          <p>
            No emoji data loaded. The emoji data file might be missing or empty.
          </p>
        </div>
      )}
    </div>
  );
}
