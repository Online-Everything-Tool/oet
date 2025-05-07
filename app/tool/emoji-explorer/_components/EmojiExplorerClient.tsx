// FILE: app/tool/emoji-explorer/_components/EmojiExplorerClient.tsx
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import { getUniqueSortedValues } from '@/app/lib/utils';

export interface RichEmojiData {
  emoji: string;
  name: string;
  codePoints: string;
  version: string;
  status: string;
  group: string;
  subgroup: string;
}

interface EmojiSearchClientProps {
  initialEmojis: RichEmojiData[];
}

export default function EmojiSearchClient({
  initialEmojis,
}: EmojiSearchClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedSubgroup, setSelectedSubgroup] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const { addHistoryEntry } = useHistory();

  useEffect(() => {
    if (!initialEmojis || initialEmojis.length === 0) {
      console.warn(
        'EmojiSearchClient received empty or no initialEmojis array.'
      );
    }
  }, [initialEmojis]);
  const availableGroups = useMemo(
    () => getUniqueSortedValues(initialEmojis, 'group', 'asc'),
    [initialEmojis]
  );
  const availableVersions = useMemo(
    () => getUniqueSortedValues(initialEmojis, 'version', 'version-desc'),
    [initialEmojis]
  );
  const derivedAvailableSubgroups = useMemo(() => {
    if (!selectedGroup) return [];
    const filteredByGroup = initialEmojis.filter(
      (e) => e.group === selectedGroup
    );
    return getUniqueSortedValues(filteredByGroup, 'subgroup', 'asc');
  }, [initialEmojis, selectedGroup]);
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedGroup) count++;
    if (selectedSubgroup && selectedGroup) count++;
    if (selectedVersion) count++;
    return count;
  }, [selectedGroup, selectedSubgroup, selectedVersion]);
  const filteredEmojis = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    if (!lowerCaseSearchTerm && !selectedGroup && !selectedVersion) {
      return initialEmojis;
    }
    return initialEmojis.filter((emoji) => {
      if (
        lowerCaseSearchTerm &&
        !emoji.name.toLowerCase().includes(lowerCaseSearchTerm)
      )
        return false;
      if (selectedGroup && emoji.group !== selectedGroup) return false;
      if (
        selectedGroup &&
        selectedSubgroup &&
        emoji.subgroup !== selectedSubgroup
      )
        return false;
      if (selectedVersion && emoji.version !== selectedVersion) return false;
      return true;
    });
  }, [
    searchTerm,
    initialEmojis,
    selectedGroup,
    selectedSubgroup,
    selectedVersion,
  ]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setSearchTerm(event.target.value);
  const toggleFilterPanel = () => setIsFilterPanelOpen((prev) => !prev);
  const handleGroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGroup(event.target.value);
    setSelectedSubgroup('');
  };
  const handleSubgroupChange = (event: React.ChangeEvent<HTMLSelectElement>) =>
    setSelectedSubgroup(event.target.value);
  const handleVersionChange = (event: React.ChangeEvent<HTMLSelectElement>) =>
    setSelectedVersion(event.target.value);
  const handleClearFilters = useCallback(() => {
    setSelectedGroup('');
    setSelectedSubgroup('');
    setSelectedVersion('');
  }, []);

  const handleEmojiClick = useCallback(
    (emojiData: RichEmojiData) => {
      const historyInput: Record<string, unknown> = {
        copiedType: 'emoji',
        copiedValue: emojiData.emoji,
        entityDescription: emojiData.name,
      };
      if (searchTerm) historyInput.searchTerm = searchTerm;
      if (selectedGroup) historyInput.group = selectedGroup;
      if (selectedSubgroup) historyInput.subgroup = selectedSubgroup;
      if (selectedVersion) historyInput.version = selectedVersion;

      const historyOutput = { emoji: emojiData.emoji, name: emojiData.name };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(emojiData.emoji)
          .then(() => {
            addHistoryEntry({
              toolName: 'Emoji Explorer',
              toolRoute: '/tool/emoji-explorer',
              trigger: 'click',
              input: historyInput,
              output: historyOutput,
              status: 'success',
              eventTimestamp: Date.now(),
            });
            console.log(`Copied ${emojiData.emoji} to clipboard.`);
          })
          .catch((err) => {
            console.error('Failed to copy emoji:', err);
            historyInput.error = `Clipboard Error: ${err instanceof Error ? err.message : 'Unknown error'}`;

            addHistoryEntry({
              toolName: 'Emoji Explorer',
              toolRoute: '/tool/emoji-explorer',
              trigger: 'click',
              input: historyInput,
              output: historyOutput,
              status: 'error',
              eventTimestamp: Date.now(),
            });
          });
      } else {
        console.warn('Clipboard API not available.');
        historyInput.error = 'Clipboard API not available';

        addHistoryEntry({
          toolName: 'Emoji Explorer',
          toolRoute: '/tool/emoji-explorer',
          trigger: 'click',
          input: historyInput,
          output: historyOutput,
          status: 'error',
          eventTimestamp: Date.now(),
        });
      }
    },
    [
      addHistoryEntry,
      searchTerm,
      selectedGroup,
      selectedSubgroup,
      selectedVersion,
    ]
  );

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex gap-3 items-center">
        <div className="flex-grow">
          <label htmlFor="emoji-search" className="sr-only">
            Search Emojis
          </label>
          <input
            type="search"
            id="emoji-search"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by name..."
            className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base placeholder:text-[rgb(var(--color-input-placeholder))]"
          />
        </div>
        <div className="relative">
          <button
            onClick={toggleFilterPanel}
            title={isFilterPanelOpen ? 'Hide Filters' : 'Show Filters'}
            aria-expanded={isFilterPanelOpen}
            className="p-3 border border-[rgb(var(--color-border-base))] rounded-md shadow-sm bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-[rgb(var(--color-text-muted))]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          {activeFilterCount > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--color-button-accent-bg))] text-xs font-medium text-[rgb(var(--color-button-accent-text))]">
              {' '}
              {activeFilterCount}{' '}
            </span>
          )}
        </div>
      </div>

      {isFilterPanelOpen && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-[rgb(var(--color-text-base))]">
              Filter Options
            </h3>
            <button
              onClick={handleClearFilters}
              disabled={activeFilterCount === 0}
              className="px-3 py-1 rounded text-sm font-medium text-[rgb(var(--color-text-link))] hover:underline disabled:text-[rgb(var(--color-text-muted))] disabled:opacity-50 disabled:no-underline focus:outline-none"
            >
              {' '}
              Clear Filters{' '}
            </button>
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
                value={selectedGroup}
                onChange={handleGroupChange}
                className="w-full p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm"
              >
                {' '}
                <option key="all-groups" value="">
                  All Groups
                </option>{' '}
                {availableGroups &&
                  availableGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}{' '}
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
                value={selectedSubgroup}
                onChange={handleSubgroupChange}
                disabled={
                  !selectedGroup || derivedAvailableSubgroups.length === 0
                }
                className="w-full p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm disabled:bg-[rgb(var(--color-input-disabled-bg))] disabled:text-[rgb(var(--color-text-muted))] disabled:cursor-not-allowed"
              >
                {' '}
                <option key="all-subgroups" value="">
                  All Subgroups
                </option>{' '}
                {selectedGroup &&
                  derivedAvailableSubgroups &&
                  derivedAvailableSubgroups.map((subgroup) => (
                    <option key={subgroup} value={subgroup}>
                      {subgroup}
                    </option>
                  ))}{' '}
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
                value={selectedVersion}
                onChange={handleVersionChange}
                className="w-full p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm"
              >
                {' '}
                <option key="all-versions" value="">
                  All Versions
                </option>{' '}
                {availableVersions &&
                  availableVersions.map((version) => (
                    <option key={version} value={version}>
                      Emoji {version}
                    </option>
                  ))}{' '}
              </select>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        {' '}
        {initialEmojis.length === 0
          ? 'Loading emojis...'
          : `Showing ${filteredEmojis.length} of ${initialEmojis.length} emojis.`}{' '}
      </p>

      {initialEmojis.length > 0 &&
        filteredEmojis.length === 0 &&
        (searchTerm || activeFilterCount > 0) && (
          <p className="text-[rgb(var(--color-text-muted))]">
            No emojis match your search or filter criteria.
          </p>
        )}

      {filteredEmojis.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
          {filteredEmojis.map((emojiData) => (
            <button
              key={emojiData.codePoints || emojiData.name}
              title={`${emojiData.name}\nCode: ${emojiData.codePoints}`}
              className="flex items-center justify-center p-2 text-3xl sm:text-4xl bg-[rgb(var(--color-bg-subtle))] rounded-lg hover:bg-[rgb(var(--color-border-base))] focus:outline-none focus:border-[rgb(var(--color-border-focus))] border-2 border-transparent transition duration-150 ease-in-out aspect-square"
              onClick={() => handleEmojiClick(emojiData)}
              aria-label={`Copy emoji: ${emojiData.name}`}
            >
              {' '}
              {emojiData.emoji}{' '}
            </button>
          ))}
        </div>
      )}
      {initialEmojis.length === 0 && (
        <div className="text-center p-5 text-[rgb(var(--color-text-muted))]">
          {' '}
          <p>Loading emoji data...</p>{' '}
        </div>
      )}
    </div>
  );
}
