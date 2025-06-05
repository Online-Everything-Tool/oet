// FILE: app/tool/songbook/_components/PlaySongView.tsx
'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useId,
  useMemo,
} from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { StoredFile } from '@/src/types/storage';
import type { SongData } from './SongbookClient';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import Button from '@/app/tool/_components/form/Button';
import Range from '@/app/tool/_components/form/Range';
import {
  XMarkIcon,
  PlayIcon as PlaySolidIcon,
  PauseIcon as PauseSolidIcon,
  MinusIcon,
  PlusIcon,
} from '@heroicons/react/24/solid';
import { useFullscreenFocus } from '@/app/context/FullscreenFocusContext';
import ChordDiagramTooltip from './ChordDiagramTooltip';
import commonChordData from '@/app/lib/directives/songbook/chordDiagrams.json';

interface PlaySongViewProps {
  isOpen: boolean;
  onClose: () => void;
  songData: SongData | null;
  file: StoredFile | null;
}

const MIN_SPEED = 1;
const MAX_SPEED = 30;
const SCROLL_INTERVAL_MS = 50;

const DEFAULT_FONT_SIZE = 16;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 32;
const FONT_SIZE_STEP = 2;

const chordRegex =
  /\[?([A-G][#b]?(?:maj|min|m|sus|dim|aug|add|M|°|ø)?\d{0,2}(?:\/[A-G][#b]?)?)\]?/g;

interface ChordDefinitionsData {
  common: Record<string, string>;
  guitarTunings: {
    standard: string[];
    [key: string]: string[];
  };
}
const typedCommonChordData = commonChordData as ChordDefinitionsData;
const DEFAULT_TUNING_INTERNAL = typedCommonChordData.guitarTunings
  ?.standard || ['E', 'A', 'D', 'G', 'B', 'e'];

let componentInstanceCounter = 0;

export default function PlaySongView({
  isOpen,
  onClose,
  songData,
  file,
}: PlaySongViewProps) {
  const instanceId = useMemo(() => ++componentInstanceCounter, []);

  const { requestFocusMode, releaseFocusMode } = useFullscreenFocus();
  const focusId = useId();

  const [tooltipData, setTooltipData] = useState<{
    name: string;
    fingering: string | null;
    position: { top: number; left: number } | null;
  }>({ name: '', fingering: null, position: null });
  const [allChordDefinitions, setAllChordDefinitions] = useState<
    Record<string, string>
  >(typedCommonChordData.common || {});

  const [currentSpeed, setCurrentSpeed] = useState(
    songData?.playbackSpeed || 10
  );
  const [currentFontSize, setCurrentFontSize] = useState(
    songData?.fontSize || DEFAULT_FONT_SIZE
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFileIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(isPlaying);

  const scrollContentFnRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const { updateFileBlob } = useFileLibrary();

  useEffect(() => {
    if (isOpen) {
      requestFocusMode(focusId);
    } else {
    }
    return () => {
      releaseFocusMode(focusId);
    };
  }, [isOpen, requestFocusMode, releaseFocusMode, focusId]);

  useEffect(() => {
    const specificChords: Record<string, string> = {};
    if (songData?.notes) {
      const noteLines = songData.notes.split('\n');
      noteLines.forEach((line) => {
        const parts = line.trim().split(/\s+/);
        if (
          parts.length >= 2 &&
          /^[A-G][#b]?(?:maj|min|m|sus|dim|aug|add|M|°|ø)?\d{0,2}(?:\/[A-G][#b]?)?$/.test(
            parts[0]
          ) &&
          /^[x0-9]{5,7}$/.test(parts[1])
        ) {
          specificChords[parts[0]] = parts[1];
        }
      });
    }
    setAllChordDefinitions({
      ...(typedCommonChordData.common || {}),
      ...specificChords,
    });

    if (songData) {
      const initialSpeed = songData.playbackSpeed;
      const newSpeed =
        initialSpeed >= MIN_SPEED && initialSpeed <= MAX_SPEED
          ? initialSpeed
          : 10;
      if (newSpeed !== currentSpeed) {
        setCurrentSpeed(newSpeed);
      }

      const initialFontSize = songData.fontSize;
      const newFontSize =
        initialFontSize &&
        initialFontSize >= MIN_FONT_SIZE &&
        initialFontSize <= MAX_FONT_SIZE
          ? initialFontSize
          : DEFAULT_FONT_SIZE;
      if (newFontSize !== currentFontSize) {
        setCurrentFontSize(newFontSize);
      }
    } else {
      setCurrentSpeed(10);
      setCurrentFontSize(DEFAULT_FONT_SIZE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songData]);

  const debouncedSaveSpeed = useDebouncedCallback(async (newSpeed: number) => {
    if (!file || !songData) {
      return;
    }
    const updatedSongData: SongData = {
      ...songData,
      playbackSpeed: newSpeed,
      fontSize: currentFontSize,
    };
    const newBlob = new Blob([JSON.stringify(updatedSongData, null, 2)], {
      type: 'application/vnd.oet.songdata+json',
    });
    try {
      await updateFileBlob(file.id, newBlob, false);
    } catch (error) {
      console.error(
        `[PlaySongView INST-${instanceId}] Failed to save playback speed:`,
        error
      );
    }
  }, 1500);

  const debouncedSaveFontSize = useDebouncedCallback(
    async (newSize: number) => {
      if (!file || !songData) {
        return;
      }
      const updatedSongData: SongData = {
        ...songData,
        fontSize: newSize,
        playbackSpeed: currentSpeed,
      };
      const newBlob = new Blob([JSON.stringify(updatedSongData, null, 2)], {
        type: 'application/vnd.oet.songdata+json',
      });
      try {
        await updateFileBlob(file.id, newBlob, false);
      } catch (error) {
        console.error(
          `[PlaySongView INST-${instanceId}] Failed to save font size:`,
          error
        );
      }
    },
    1500
  );

  const handleSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseInt(event.target.value, 10);
    setCurrentSpeed(newSpeed);
    debouncedSaveSpeed(newSpeed);
  };

  const changeFontSize = (direction: 'increase' | 'decrease') => {
    setCurrentFontSize((prevSize) => {
      let newSize =
        direction === 'increase'
          ? prevSize + FONT_SIZE_STEP
          : prevSize - FONT_SIZE_STEP;
      newSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newSize));
      if (newSize !== prevSize) {
        debouncedSaveFontSize(newSize);
      }
      return newSize;
    });
  };

  const handleLyricsContainerHover = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('song-chord') && target.dataset.chord) {
      const chordName = target.dataset.chord;
      const fingering = allChordDefinitions[chordName] || null;
      const rect = target.getBoundingClientRect();
      const tooltipEstimatedWidth = 120;
      const tooltipEstimatedHeight = 30;
      const horizontalOffset = 8;
      const verticalOffset = 0;
      let top = rect.top + window.scrollY + verticalOffset;
      let left = rect.right + window.scrollX + horizontalOffset;
      if (left + tooltipEstimatedWidth > window.innerWidth - 10)
        left =
          rect.left + window.scrollX - tooltipEstimatedWidth - horizontalOffset;
      if (left < window.scrollX + 10) left = window.scrollX + 10;
      if (
        top + tooltipEstimatedHeight >
        window.innerHeight + window.scrollY - 10
      )
        top = rect.bottom + window.scrollY - tooltipEstimatedHeight - 5;
      if (top < window.scrollY + 10) top = window.scrollY + 10;
      setTooltipData({
        name: chordName,
        fingering: fingering,
        position: { top, left },
      });
    } else {
      if (tooltipData.position)
        setTooltipData({ name: '', fingering: null, position: null });
    }
  };

  const calculateScrollAmount = useCallback(() => {
    const minScroll = 0.2;
    const maxScroll = 5;
    if (currentSpeed <= MIN_SPEED) return minScroll;
    if (currentSpeed >= MAX_SPEED) return maxScroll;
    const normalizedSpeed =
      (currentSpeed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
    const amount = minScroll + normalizedSpeed * (maxScroll - minScroll);

    return amount;
  }, [currentSpeed]);

  const scrollContent = useCallback(() => {
    if (!isPlayingRef.current) {
      return;
    }
    if (contentRef.current) {
      const scrollAmount = calculateScrollAmount();
      contentRef.current.scrollTop += scrollAmount;

      if (
        Math.ceil(
          contentRef.current.scrollTop + contentRef.current.clientHeight
        ) >= contentRef.current.scrollHeight
      ) {
        setIsPlaying(false);
      }
    } else {
    }
  }, [calculateScrollAmount]);

  if (scrollContentFnRef.current !== scrollContent) {
    scrollContentFnRef.current = scrollContent;
  }

  useEffect(() => {
    let effectIntervalId: NodeJS.Timeout | null = null;

    if (isPlaying && contentRef.current) {
      effectIntervalId = setInterval(scrollContent, SCROLL_INTERVAL_MS);
    }

    return () => {
      if (effectIntervalId) {
        clearInterval(effectIntervalId);
      } else {
      }
    };
  }, [isPlaying, scrollContent, currentFontSize, currentSpeed]);

  const processLyricsForChords = useCallback(
    (lyrics: string): React.ReactNode[] => {
      const lines = lyrics.split('\n');
      return lines.map((line, lineIndex) => {
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let matchResult;
        chordRegex.lastIndex = 0;
        while ((matchResult = chordRegex.exec(line)) !== null) {
          if (matchResult.index > lastIndex) {
            parts.push(line.substring(lastIndex, matchResult.index));
          }
          const chordName = matchResult[1];
          const originalMatch = matchResult[0];
          const isChordPro =
            originalMatch.startsWith('[') && originalMatch.endsWith(']');
          const displayChord = isChordPro ? chordName : originalMatch;
          parts.push(
            <span
              key={`${lineIndex}-${matchResult.index}`}
              className="song-chord hover:bg-yellow-200 hover:text-black px-0.5 rounded cursor-pointer transition-colors"
              data-chord={chordName}
            >
              {displayChord}
            </span>
          );
          lastIndex = matchResult.index + originalMatch.length;
        }
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }
        return (
          <div key={lineIndex} className="song-line min-h-[1em]">
            {parts.length > 0 ? parts : <> </>}
          </div>
        );
      });
    },
    []
  );

  const togglePlay = () => {
    const currentIsPlayingVal = isPlayingRef.current;
    if (!currentIsPlayingVal && contentRef.current) {
      const { scrollTop, clientHeight, scrollHeight } = contentRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 1) {
        contentRef.current.scrollTop = 0;
      }
    }
    setIsPlaying((prev) => !prev);
  };

  useEffect(() => {
    const currentContentRefVal = contentRef.current;
    if (isOpen) {
      if (currentContentRefVal) {
        const currentFileId = file?.id || null;
        if (currentFileId && currentFileId !== previousFileIdRef.current) {
          currentContentRefVal.scrollTop = 0;
          if (isPlayingRef.current) {
            setIsPlaying(false);
          }
          previousFileIdRef.current = currentFileId;
        } else if (!currentFileId && previousFileIdRef.current !== null) {
          if (isPlayingRef.current) {
            setIsPlaying(false);
          }
          previousFileIdRef.current = null;
        }
      }
      const handleKeyDown = (event: KeyboardEvent) => {
        if (!isOpen) return;
        if (event.key === 'Escape') {
          onClose();
        } else if (
          event.key === ' ' &&
          document.activeElement?.tagName !== 'INPUT'
        ) {
          event.preventDefault();
          togglePlay();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      if (isPlayingRef.current) {
        setIsPlaying(false);
      }
    }
  }, [isOpen, file?.id, onClose]);

  const processedLyricsContent = useMemo(() => {
    if (!songData?.lyricsAndChords) return [];
    return processLyricsForChords(songData.lyricsAndChords);
  }, [songData?.lyricsAndChords, processLyricsForChords]);

  if (!isOpen || !songData) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="play-song-title"
    >
      <div
        className="bg-gray-900 text-gray-100 rounded-lg shadow-xl w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 md:p-3 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <div className="min-w-0">
            <h2
              id="play-song-title"
              className="text-lg md:text-xl font-semibold truncate"
              title={songData.title || undefined}
            >
              {songData.title || 'Untitled Song'}
            </h2>
            {songData.artist && (
              <p
                className="text-xs md:text-sm text-gray-400 truncate"
                title={songData.artist}
              >
                {songData.artist}
              </p>
            )}
          </div>
          <Button
            variant="link"
            onClick={onClose}
            aria-label="Close player"
            className="p-1 text-gray-400 hover:text-white"
          >
            <XMarkIcon className="h-6 w-6" />
          </Button>
        </div>
        <div
          ref={contentRef}
          className="flex-grow overflow-y-auto p-4 md:p-6"
          style={{
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.7',
            fontSize: `${currentFontSize}px`,
          }}
          onMouseMove={handleLyricsContainerHover}
          onMouseLeave={() =>
            setTooltipData({ name: '', fingering: null, position: null })
          }
        >
          {processedLyricsContent}
        </div>
        <div className="p-3 md:p-4 border-t border-gray-700 flex-shrink-0 flex flex-col sm:flex-row items-center gap-3 md:gap-4 justify-center">
          <Button
            onClick={togglePlay}
            variant="secondary"
            size="md"
            iconLeft={
              isPlaying ? (
                <PauseSolidIcon className="h-5 w-5" />
              ) : (
                <PlaySolidIcon className="h-5 w-5" />
              )
            }
            className="min-w-[120px]"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <div className="flex items-center gap-2 w-full sm:w-auto sm:max-w-xs md:max-w-sm flex-grow sm:flex-grow-0">
            <label
              htmlFor="speed-slider-player"
              className="text-sm text-gray-300 hidden sm:inline"
            >
              Speed:
            </label>
            <Range
              id="speed-slider-player"
              label=""
              min={MIN_SPEED}
              max={MAX_SPEED}
              value={currentSpeed}
              onChange={handleSpeedChange}
              showValue={false}
              containerClassName="flex-grow min-w-[100px]"
              inputClassName="h-2.5"
            />
            <span className="text-sm text-gray-300 w-8 text-center tabular-nums">
              {currentSpeed}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => changeFontSize('decrease')}
              variant="neutral-outline"
              size="sm"
              className="!p-1.5 text-gray-300 hover:text-white !border-gray-600"
              aria-label="Decrease font size"
              title="Decrease font size"
              disabled={currentFontSize <= MIN_FONT_SIZE}
            >
              <MinusIcon className="h-5 w-5" />
            </Button>
            <span
              className="text-sm text-gray-300 w-8 text-center tabular-nums"
              title="Current font size"
            >
              {currentFontSize}px
            </span>
            <Button
              onClick={() => changeFontSize('increase')}
              variant="neutral-outline"
              size="sm"
              className="!p-1.5 text-gray-300 hover:text-white !border-gray-600"
              aria-label="Increase font size"
              title="Increase font size"
              disabled={currentFontSize >= MAX_FONT_SIZE}
            >
              <PlusIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
      <ChordDiagramTooltip
        chordName={tooltipData.name}
        fingering={tooltipData.fingering}
        position={tooltipData.position}
        tuning={DEFAULT_TUNING_INTERNAL}
      />
    </div>
  );
}
