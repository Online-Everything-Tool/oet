// --- FILE: app/tool/_components/shared/EmojiExplorerModal.tsx ---
'use client';

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { getUniqueSortedValues } from '@/app/lib/utils';
import Button from '../form/Button';
import { XMarkIcon, FunnelIcon } from '@heroicons/react/20/solid';
import { getEmojis, RichEmojiData } from '@/src/constants/emojis';

interface EmojiExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
}

export default function EmojiExplorerModal({
  isOpen,
  onClose,
  onEmojiSelect,
}: EmojiExplorerModalProps) {
  const allEmojis: RichEmojiData[] = getEmojis(); // Load all emojis directly
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedSubgroup, setSelectedSubgroup] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // Reset filters and search when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedGroup('');
      setSelectedSubgroup('');
      setSelectedVersion('');
      setIsFilterPanelOpen(false);
    }
  }, [isOpen]);

  const availableGroups = useMemo(
    () => getUniqueSortedValues(allEmojis, 'group', 'asc'),
    [allEmojis]
  );
  const availableVersions = useMemo(
    () => getUniqueSortedValues(allEmojis, 'version', 'version-desc'),
    [allEmojis]
  );
  const derivedAvailableSubgroups = useMemo(() => {
    if (!selectedGroup) return [];
    const filteredByGroup = allEmojis.filter((e) => e.group === selectedGroup);
    return getUniqueSortedValues(filteredByGroup, 'subgroup', 'asc');
  }, [allEmojis, selectedGroup]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedGroup) count++;
    if (selectedSubgroup && selectedGroup) count++; // Subgroup only counts if group is also selected
    if (selectedVersion) count++;
    return count;
  }, [selectedGroup, selectedSubgroup, selectedVersion]);

  const filteredEmojis = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    // Start with all emojis if no primary filters are active
    let emojisToFilter = allEmojis;

    if (selectedGroup) {
      emojisToFilter = emojisToFilter.filter(
        (emoji) => emoji.group === selectedGroup
      );
      if (selectedSubgroup) {
        // Only filter subgroup if a group is selected
        emojisToFilter = emojisToFilter.filter(
          (emoji) => emoji.subgroup === selectedSubgroup
        );
      }
    }
    if (selectedVersion) {
      emojisToFilter = emojisToFilter.filter(
        (emoji) => emoji.version === selectedVersion
      );
    }
    if (lowerCaseSearchTerm) {
      emojisToFilter = emojisToFilter.filter((emoji) =>
        emoji.name.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }
    return emojisToFilter;
  }, [searchTerm, allEmojis, selectedGroup, selectedSubgroup, selectedVersion]);

  const emojisGroupedByName = useMemo(() => {
    if (filteredEmojis.length === 0) return {};
    return filteredEmojis.reduce(
      (acc, emoji) => {
        const groupName = emoji.group;
        if (!acc[groupName]) {
          acc[groupName] = [];
        }
        acc[groupName].push(emoji);
        return acc;
      },
      {} as Record<string, RichEmojiData[]>
    );
  }, [filteredEmojis]);

  const sortedGroupNames = useMemo(() => {
    return Object.keys(emojisGroupedByName).sort((a, b) => {
      const indexA = allEmojis.findIndex((e) => e.group === a); // Maintain original group order if possible
      const indexB = allEmojis.findIndex((e) => e.group === b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      return a.localeCompare(b); // Fallback sort
    });
  }, [emojisGroupedByName, allEmojis]);

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
  const handleEmojiSelectInternal = useCallback(
    (emojiData: RichEmojiData) => {
      onEmojiSelect(emojiData.emoji);
    },
    [onEmojiSelect]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
    }
  }, [filteredEmojis, selectedGroup, selectedSubgroup, selectedVersion]); // Scroll on any filter change

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="emoji-modal-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-gray-200 flex justify-between items-center flex-shrink-0 gap-2">
          <h2
            id="emoji-modal-title"
            className="text-lg font-semibold text-gray-800 whitespace-nowrap"
          >
            Select Emoji
          </h2>
          <input
            type="search"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="border border-gray-300 rounded px-2 py-1 text-sm mx-2 flex-grow min-w-0"
            aria-label="Search emojis"
          />
          <div className="relative flex-shrink-0">
            <Button
              variant="neutral-outline"
              size="sm"
              onClick={toggleFilterPanel}
              title={isFilterPanelOpen ? 'Hide Filters' : 'Show Filters'}
              aria-expanded={isFilterPanelOpen}
              className="!p-2"
            >
              <FunnelIcon className="h-5 w-5" />
            </Button>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[rgb(var(--color-button-accent-bg))] text-[10px] font-medium text-[rgb(var(--color-button-accent-text))] px-1">
                {activeFilterCount}
              </span>
            )}
          </div>
          <Button
            variant="link"
            size="sm"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <XMarkIcon className="h-6 w-6" />
          </Button>
        </div>

        {isFilterPanelOpen && (
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex flex-col gap-3 flex-shrink-0">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-700">
                Filter Options
              </h3>
              <button
                onClick={handleClearFilters}
                disabled={activeFilterCount === 0}
                className="px-2 py-0.5 rounded text-xs font-medium text-blue-600 hover:underline disabled:text-gray-400 disabled:opacity-70 disabled:no-underline"
              >
                Clear Filters
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="modal-filter-group"
                  className="block text-xs font-medium text-gray-600 mb-0.5"
                >
                  Group
                </label>
                <select
                  id="modal-filter-group"
                  value={selectedGroup}
                  onChange={handleGroupChange}
                  className="w-full p-1.5 border border-gray-300 bg-white text-gray-900 rounded shadow-sm focus:border-indigo-500 focus:outline-none text-xs"
                >
                  <option value="">All</option>
                  {availableGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="modal-filter-subgroup"
                  className="block text-xs font-medium text-gray-600 mb-0.5"
                >
                  Subgroup
                </label>
                <select
                  id="modal-filter-subgroup"
                  value={selectedSubgroup}
                  onChange={handleSubgroupChange}
                  disabled={
                    !selectedGroup || derivedAvailableSubgroups.length === 0
                  }
                  className="w-full p-1.5 border border-gray-300 bg-white text-gray-900 rounded shadow-sm focus:border-indigo-500 focus:outline-none text-xs disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">All</option>
                  {selectedGroup &&
                    derivedAvailableSubgroups.map((subgroup) => (
                      <option key={subgroup} value={subgroup}>
                        {subgroup}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="modal-filter-version"
                  className="block text-xs font-medium text-gray-600 mb-0.5"
                >
                  Version
                </label>
                <select
                  id="modal-filter-version"
                  value={selectedVersion}
                  onChange={handleVersionChange}
                  className="w-full p-1.5 border border-gray-300 bg-white text-gray-900 rounded shadow-sm focus:border-indigo-500 focus:outline-none text-xs"
                >
                  <option value="">All</option>
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

        <div ref={modalBodyRef} className="p-4 overflow-y-auto flex-grow">
          {allEmojis.length === 0 && (
            <p className="text-center text-gray-500 py-10">
              No emoji data found or loaded.
            </p>
          )}
          {allEmojis.length > 0 && (
            <>
              {filteredEmojis.length === 0 &&
                (searchTerm || activeFilterCount > 0) && (
                  <p className="text-center text-gray-500 py-10">
                    No emojis match your search or filter.
                  </p>
                )}
              {sortedGroupNames.map((groupName) => (
                <div key={groupName} className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 bg-white py-1 mb-1 z-5">
                    {groupName}
                  </h3>

                  <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1">
                    {emojisGroupedByName[groupName].map((emojiData) => (
                      <button
                        key={emojiData.codePoints || emojiData.name}
                        onClick={() => handleEmojiSelectInternal(emojiData)}
                        className="text-2xl p-1 rounded hover:bg-gray-200 aspect-square flex items-center justify-center transition-colors duration-100"
                        title={emojiData.name}
                        aria-label={`Insert emoji: ${emojiData.name}`}
                      >
                        {emojiData.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
