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
import Input from '../form/Input';
import {
  XMarkIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from '@heroicons/react/20/solid';
import { RichEmojiData } from '@/src/constants/emojis';
import useToolState from '../../_hooks/useToolState';

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

interface EmojiExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;

  toolRouteForRecentState?: string;
}

export default function EmojiExplorerModal({
  isOpen,
  onClose,
  onEmojiSelect,
  toolRouteForRecentState = '/tool/emoji-explorer',
}: EmojiExplorerModalProps) {
  const [modalEmojisList, setModalEmojisList] = useState<RichEmojiData[]>([]);
  const [isLoadingModalData, setIsLoadingModalData] = useState<boolean>(false);
  const [modalDataError, setModalDataError] = useState<string | null>(null);
  const hasFetchedDataRef = useRef(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedSubgroup, setSelectedSubgroup] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const [lastCopiedValue, setLastCopiedValue] = useState<{
    type: string;
    value: string;
  } | null>(null);

  const {
    state: emojiExplorerToolState,
    setState: setEmojiExplorerToolState,
    isLoadingState: isLoadingEmojiExplorerToolState,
  } = useToolState<EmojiExplorerToolState>(
    toolRouteForRecentState,
    DEFAULT_EMOJI_EXPLORER_STATE
  );

  useEffect(() => {
    if (isOpen && !hasFetchedDataRef.current && !isLoadingModalData) {
      setIsLoadingModalData(true);
      setModalDataError(null);
      fetch('/api/get-emojis')
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(
              errorData.error || `Failed to fetch emojis: ${res.status}`
            );
          }
          return res.json();
        })
        .then((data: { emojis: RichEmojiData[]; error?: string }) => {
          if (data.error) {
            throw new Error(data.error);
          }
          setModalEmojisList(data.emojis || []);
          hasFetchedDataRef.current = true;
        })
        .catch((err) => {
          console.error('Error fetching emojis for modal:', err);
          setModalDataError(err.message || 'Could not load emoji data.');
          setModalEmojisList([]);
        })
        .finally(() => {
          setIsLoadingModalData(false);
        });
    } else if (!isOpen) {
    }
  }, [isOpen, isLoadingModalData]);

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
    () => getUniqueSortedValues(modalEmojisList, 'group', 'asc'),
    [modalEmojisList]
  );
  const availableVersions = useMemo(
    () => getUniqueSortedValues(modalEmojisList, 'version', 'version-desc'),
    [modalEmojisList]
  );
  const derivedAvailableSubgroups = useMemo(() => {
    if (!selectedGroup) return [];
    const filteredByGroup = modalEmojisList.filter(
      (e) => e.group === selectedGroup
    );
    return getUniqueSortedValues(filteredByGroup, 'subgroup', 'asc');
  }, [modalEmojisList, selectedGroup]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedGroup) count++;
    if (selectedSubgroup && selectedGroup) count++;
    if (selectedVersion) count++;
    return count;
  }, [selectedGroup, selectedSubgroup, selectedVersion]);

  const filteredEmojis = useMemo<RichEmojiData[]>(() => {
    if (modalEmojisList.length === 0) {
      return [];
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    let emojisToReturn = modalEmojisList;

    if (lowerCaseSearchTerm || selectedGroup || selectedVersion) {
      emojisToReturn = modalEmojisList.filter((emoji) => {
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
    }
    return emojisToReturn;
  }, [
    searchTerm,
    modalEmojisList,
    selectedGroup,
    selectedSubgroup,
    selectedVersion,
  ]);

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
    if (modalEmojisList.length === 0) return [];
    return Object.keys(emojisGroupedByName).sort((a, b) => {
      const indexA = modalEmojisList.findIndex((e) => e.group === a);
      const indexB = modalEmojisList.findIndex((e) => e.group === b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      return a.localeCompare(b);
    });
  }, [emojisGroupedByName, modalEmojisList]);

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

  const copyToClipboardInternal = useCallback(
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

  const handleEmojiSelectInternal = useCallback(
    (emojiData: RichEmojiData, source: 'grid' | 'recent' = 'grid') => {
      onEmojiSelect(emojiData.emoji);
      copyToClipboardInternal(emojiData.emoji, 'emoji', emojiData.name);

      if (source === 'grid') {
        setEmojiExplorerToolState((prev) => {
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
    [onEmojiSelect, copyToClipboardInternal, setEmojiExplorerToolState]
  );

  const handleClearRecentlyCopiedInModal = useCallback(() => {
    setEmojiExplorerToolState({ recentlyCopiedEmojis: [] });
  }, [setEmojiExplorerToolState]);

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
  }, [filteredEmojis, selectedGroup, selectedSubgroup, selectedVersion]);

  if (!isOpen) {
    return null;
  }

  const renderContent = () => {
    if (isLoadingModalData) {
      return (
        <p className="text-center text-gray-500 py-10 animate-pulse">
          Loading emojis...
        </p>
      );
    }
    if (modalDataError) {
      return (
        <p className="text-center text-red-500 py-10">
          Error: {modalDataError}
        </p>
      );
    }
    if (modalEmojisList.length === 0 && hasFetchedDataRef.current) {
      return (
        <p className="text-center text-gray-500 py-10">
          No emoji data found or loaded.
        </p>
      );
    }
    if (modalEmojisList.length === 0 && !hasFetchedDataRef.current) {
      return (
        <p className="text-center text-gray-500 py-10 animate-pulse">
          Preparing emoji list...
        </p>
      );
    }

    return (
      <>
        {filteredEmojis.length === 0 &&
          (searchTerm || activeFilterCount > 0) && (
            <p className="text-center text-gray-500 py-10">
              No emojis match your search or filter.
            </p>
          )}
        {sortedGroupNames.map((groupName) => (
          <div key={groupName} className="mb-4">
            <h3 className="text-sm font-semibold text-gray-500 py-1 mb-1">
              {groupName}
            </h3>
            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1">
              {emojisGroupedByName[groupName].map((emojiData) => (
                <button
                  key={emojiData.codePoints || emojiData.name}
                  onClick={() => handleEmojiSelectInternal(emojiData, 'grid')}
                  className="text-2xl p-1 rounded hover:bg-gray-200 aspect-square flex items-center justify-center transition-colors duration-100"
                  title={emojiData.name}
                  aria-label={`Insert emoji: ${emojiData.name}`}
                >
                  {lastCopiedValue?.type === 'emoji' &&
                  lastCopiedValue?.value === emojiData.emoji ? (
                    <CheckIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    emojiData.emoji
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </>
    );
  };

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
          <Input
            type="search"
            id="modal-emoji-search"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by name..."
            inputClassName="px-2 py-1 text-sm"
            containerClassName="mx-2 flex-grow min-w-0"
            iconLeft={<MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />}
          />
          <div className="relative flex-shrink-0">
            <Button
              variant={
                activeFilterCount > 0 ? 'accent-outline' : 'neutral-outline'
              }
              size="sm"
              onClick={toggleFilterPanel}
              title={isFilterPanelOpen ? 'Hide Filters' : 'Show Filters'}
              aria-expanded={isFilterPanelOpen}
              className="!p-2"
              iconLeft={<FunnelIcon className="h-5 w-5" />}
            >
              Filter
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
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex flex-col gap-3 flex-shrink-0 animate-slide-down">
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

        {!isLoadingEmojiExplorerToolState &&
          emojiExplorerToolState.recentlyCopiedEmojis.length > 0 && (
            <div className="p-3 border-b border-gray-200 flex-shrink-0 bg-gray-50">
              <div className="flex justify-between items-center mb-1.5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Recently Copied
                </h3>
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleClearRecentlyCopiedInModal}
                  title="Clear recently copied emojis from Emoji Explorer tool"
                  className="!p-0.5 text-xs"
                >
                  <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-red-500" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {emojiExplorerToolState.recentlyCopiedEmojis.map(
                  (emojiData) => (
                    <Button
                      key={`${emojiData.codePoints}-recent-modal`}
                      variant="neutral-outline"
                      size="sm"
                      onClick={() =>
                        handleEmojiSelectInternal(emojiData, 'recent')
                      }
                      title={`Copy: ${emojiData.name}`}
                      className="!p-1.5 !text-lg leading-none aspect-square"
                      aria-label={`Copy emoji: ${emojiData.name}`}
                    >
                      {lastCopiedValue?.type === 'emoji' &&
                      lastCopiedValue?.value === emojiData.emoji ? (
                        <CheckIcon className="h-4 w-4 text-green-500" />
                      ) : (
                        emojiData.emoji
                      )}
                    </Button>
                  )
                )}
              </div>
            </div>
          )}

        <div ref={modalBodyRef} className="p-4 overflow-y-auto flex-grow">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
