// FILE: /app/tool/_components/shared/EmojiExplorerModal.tsx
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
import useToolState from '@/app/tool/_hooks/useToolState';

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

const MAX_RECENTLY_INTERACTED = 20;

interface EmojiExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;

  outputMode?: 'copy' | 'select';
  onEmojiCopied?: (emoji: string, name: string) => void;
  onEmojiSelectedForForm?: (emoji: string) => void;

  toolRouteForRecentState?: string;
}

export default function EmojiExplorerModal({
  isOpen,
  onClose,
  outputMode = 'copy',
  onEmojiCopied,
  onEmojiSelectedForForm,
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

  const [copiedEmojiString, setCopiedEmojiString] = useState<string | null>(
    null
  );

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
          if (data.error) throw new Error(data.error);
          setModalEmojisList(data.emojis || []);
          hasFetchedDataRef.current = true;
        })
        .catch((err) => {
          console.error('Error fetching emojis for modal:', err);
          setModalDataError(err.message || 'Could not load emoji data.');
          setModalEmojisList([]);
        })
        .finally(() => setIsLoadingModalData(false));
    } else if (!isOpen) {
      setSearchTerm('');
      setSelectedGroup('');
      setSelectedSubgroup('');
      setSelectedVersion('');
      setIsFilterPanelOpen(false);
      setCopiedEmojiString(null);
    }
  }, [isOpen, isLoadingModalData]);

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
    if (modalEmojisList.length === 0) return [];
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    return modalEmojisList.filter((emoji) => {
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
        if (!acc[groupName]) acc[groupName] = [];
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

  const handleEmojiInteraction = useCallback(
    async (emojiData: RichEmojiData, source: 'grid' | 'recent' = 'grid') => {
      if (outputMode === 'select' && onEmojiSelectedForForm) {
        onEmojiSelectedForForm(emojiData.emoji);
      } else {
        try {
          await navigator.clipboard.writeText(emojiData.emoji);
          setCopiedEmojiString(emojiData.emoji);
          setTimeout(() => setCopiedEmojiString(null), 1500);
          if (onEmojiCopied) onEmojiCopied(emojiData.emoji, emojiData.name);
        } catch (err) {
          console.error(`Failed to copy ${emojiData.name} emoji:`, err);
        }
      }

      if (source === 'grid' && !isLoadingEmojiExplorerToolState) {
        setEmojiExplorerToolState((prev) => {
          const newRecentlyCopied = [
            emojiData,
            ...prev.recentlyCopiedEmojis.filter(
              (e) => e.codePoints !== emojiData.codePoints
            ),
          ].slice(0, MAX_RECENTLY_INTERACTED);
          return { ...prev, recentlyCopiedEmojis: newRecentlyCopied };
        });
      }
    },
    [
      outputMode,
      onEmojiSelectedForForm,
      onEmojiCopied,
      isLoadingEmojiExplorerToolState,
      setEmojiExplorerToolState,
    ]
  );

  const handleClearRecentlyInteracted = useCallback(() => {
    if (!isLoadingEmojiExplorerToolState) {
      setEmojiExplorerToolState((prev) => ({
        ...prev,
        recentlyCopiedEmojis: [],
      }));
    }
  }, [isLoadingEmojiExplorerToolState, setEmojiExplorerToolState]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) =>
      event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (modalBodyRef.current) modalBodyRef.current.scrollTop = 0;
  }, [filteredEmojis, selectedGroup, selectedSubgroup, selectedVersion]);

  if (!isOpen) return null;

  const renderContent = () => {
    if (isLoadingModalData) {
      return (
        <p className="text-center text-[rgb(var(--color-text-muted))] py-10 animate-pulse">
          Loading emojis...
        </p>
      );
    }
    if (modalDataError) {
      return (
        <p className="text-center text-[rgb(var(--color-status-error))] py-10">
          Error: {modalDataError}
        </p>
      );
    }
    if (modalEmojisList.length === 0 && hasFetchedDataRef.current) {
      return (
        <p className="text-center text-[rgb(var(--color-text-muted))] py-10">
          No emoji data found.
        </p>
      );
    }
    if (modalEmojisList.length === 0 && !hasFetchedDataRef.current) {
      return (
        <p className="text-center text-[rgb(var(--color-text-muted))] py-10 animate-pulse">
          Preparing emoji list...
        </p>
      );
    }

    return (
      <>
        {filteredEmojis.length === 0 &&
          (searchTerm || activeFilterCount > 0) && (
            <p className="text-center text-[rgb(var(--color-text-muted))] py-10">
              No emojis match your search or filter.
            </p>
          )}
        {sortedGroupNames.map((groupName) => (
          <div key={groupName} className="mb-4">
            <h3 className="text-sm font-semibold text-[rgb(var(--color-text-muted))] py-1 mb-1">
              {groupName}
            </h3>
            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1">
              {emojisGroupedByName[groupName].map((emojiData) => (
                <button
                  key={emojiData.codePoints || emojiData.name}
                  onClick={() => handleEmojiInteraction(emojiData, 'grid')}
                  className="text-2xl p-1 rounded hover:bg-[rgb(var(--color-bg-neutral))] aspect-square flex items-center justify-center transition-colors duration-100"
                  title={
                    outputMode === 'copy'
                      ? `Copy: ${emojiData.name}`
                      : `Select: ${emojiData.name}`
                  }
                  aria-label={
                    outputMode === 'copy'
                      ? `Copy emoji: ${emojiData.name}`
                      : `Select emoji: ${emojiData.name}`
                  }
                >
                  {outputMode === 'copy' &&
                  copiedEmojiString === emojiData.emoji ? (
                    <CheckIcon className="h-5 w-5 text-[rgb(var(--color-status-success))]" />
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
      className="fixed inset-0 bg-[rgb(var(--color-overlay-backdrop))]/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="emoji-modal-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center flex-shrink-0 gap-2">
          <h2
            id="emoji-modal-title"
            className="text-lg font-semibold text-[rgb(var(--color-text-emphasis))] whitespace-nowrap"
          >
            {outputMode === 'select' ? 'Select an Emoji' : 'Emoji Explorer'}
          </h2>
          <Input
            type="search"
            id="modal-emoji-search"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by name..."
            inputClassName="px-2 py-1 text-sm"
            containerClassName="mx-2 flex-grow min-w-0"
            iconLeft={
              <MagnifyingGlassIcon className="h-4 w-4 text-[rgb(var(--color-text-disabled))]" />
            }
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
            className="p-1 text-[rgb(var(--color-text-disabled))] hover:text-[rgb(var(--color-text-subtle))] flex-shrink-0"
          >
            <XMarkIcon className="h-6 w-6" />
          </Button>
        </div>

        {isFilterPanelOpen && (
          <div className="p-3 border-b border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] flex flex-col gap-3 flex-shrink-0 animate-slide-down">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-[rgb(var(--color-text-emphasis))]">
                Filter Options
              </h3>
              <button
                onClick={handleClearFilters}
                disabled={activeFilterCount === 0}
                className="px-2 py-0.5 rounded text-xs font-medium text-[rgb(var(--color-text-link))] hover:underline disabled:text-[rgb(var(--color-text-disabled))] disabled:opacity-70 disabled:no-underline"
              >
                Clear Filters
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="modal-filter-group"
                  className="block text-xs font-medium text-[rgb(var(--color-text-subtle))] mb-0.5"
                >
                  Group
                </label>
                <select
                  id="modal-filter-group"
                  value={selectedGroup}
                  onChange={handleGroupChange}
                  className="w-full p-1.5 border border-[rgb(var(--color-border-soft))] bg-white text-[rgb(var(--color-text-base))] rounded shadow-sm focus:border-[rgb(var(--color-border-focus))] focus:outline-none text-xs"
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
                  className="block text-xs font-medium text-[rgb(var(--color-text-subtle))] mb-0.5"
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
                  className="w-full p-1.5 border border-[rgb(var(--color-border-soft))] bg-white text-[rgb(var(--color-text-base))] rounded shadow-sm focus:border-[rgb(var(--color-border-focus))] focus:outline-none text-xs disabled:bg-[rgb(var(--color-bg-subtle-hover))] disabled:text-[rgb(var(--color-text-disabled))]"
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
                  className="block text-xs font-medium text-[rgb(var(--color-text-subtle))] mb-0.5"
                >
                  Version
                </label>
                <select
                  id="modal-filter-version"
                  value={selectedVersion}
                  onChange={handleVersionChange}
                  className="w-full p-1.5 border border-[rgb(var(--color-border-soft))] bg-white text-[rgb(var(--color-text-base))] rounded shadow-sm focus:border-[rgb(var(--color-border-focus))] focus:outline-none text-xs"
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
            <div className="p-3 border-b border-[rgb(var(--color-border-base))] flex-shrink-0 bg-[rgb(var(--color-bg-subtle))]">
              <div className="flex justify-between items-center mb-1.5">
                <h3 className="text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider">
                  {/* Title changes based on mode, or could be generic "Recently Used" */}
                  {outputMode === 'select'
                    ? 'Recently Selected'
                    : 'Recently Copied'}
                </h3>
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleClearRecentlyInteracted}
                  title="Clear recently used emojis"
                  className="!p-0.5 text-xs"
                >
                  <XMarkIcon className="h-4 w-4 text-[rgb(var(--color-text-disabled))] hover:text-[rgb(var(--color-status-error))]" />
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
                        handleEmojiInteraction(emojiData, 'recent')
                      }
                      title={
                        outputMode === 'copy'
                          ? `Copy: ${emojiData.name}`
                          : `Select: ${emojiData.name}`
                      }
                      className="!p-1.5 !text-lg leading-none aspect-square"
                      aria-label={
                        outputMode === 'copy'
                          ? `Copy emoji: ${emojiData.name}`
                          : `Select emoji: ${emojiData.name}`
                      }
                    >
                      {outputMode === 'copy' &&
                      copiedEmojiString === emojiData.emoji ? (
                        <CheckIcon className="h-4 w-4 text-[rgb(var(--color-status-success))]" />
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
