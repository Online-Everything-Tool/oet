'use client';

import React, { useState, useCallback } from 'react';
import Select from '@/app/tool/_components/form/Select';
import Button from '@/app/tool/_components/form/Button';
import Textarea from '@/app/tool/_components/form/Textarea';
import { useToolState } from '@/app/tool/_hooks/useToolState';
import { toolRoute } from '@/app/lib/utils';
import type { ToolMetadata } from '@/src/types/tools';
import {
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';


interface ChordOption {
  value: string;
  label: string;
}

const MAJOR_CHORDS: ChordOption[] = [
  { value: 'C', label: 'C Major' },
  { value: 'G', label: 'G Major' },
  { value: 'D', label: 'D Major' },
  { value: 'A', label: 'A Major' },
  { value: 'E', label: 'E Major' },
  { value: 'B', label: 'B Major' },
  { value: 'F#', label: 'F# Major' },
  { value: 'F', label: 'F Major' },
  { value: 'Bb', label: 'Bb Major' },
  { value: 'Eb', label: 'Eb Major' },
  { value: 'Ab', label: 'Ab Major' },
  { value: 'Db', label: 'Db Major' },
  { value: 'Gb', label: 'Gb Major' },
];

const MINOR_CHORDS: ChordOption[] = MAJOR_CHORDS.map((chord) => ({
  value: chord.value + 'm',
  label: chord.label.replace('Major', 'Minor'),
}));

interface MusicChordTransitionHelperClientProps {
  toolRoute: string;
  metadata: ToolMetadata;
}

interface ToolState {
  startingChord: string;
  endingChord: string;
  suggestedProgression: string;
  isDownloadSuccess: boolean;
}

const DEFAULT_TOOL_STATE: ToolState = {
  startingChord: 'C',
  endingChord: 'G',
  suggestedProgression: 'C - G - Am - F',
  isDownloadSuccess: false,
};

export default function MusicChordTransitionHelperClient({
  toolRoute,
  metadata,
}: MusicChordTransitionHelperClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    saveStateNow,
    isPersistent,
    togglePersistence,
  } = useToolState<ToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const handleStartingChordChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setToolState({ startingChord: event.target.value });
    },
    []
  );

  const handleEndingChordChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setToolState({ endingChord: event.target.value });
    },
    []
  );

  const generateProgression = useCallback(() => {
    // Basic logic - replace with more sophisticated algorithm
    const progression = `${toolState.startingChord} - ${toolState.endingChord} - ${toolState.startingChord}m - ${toolState.endingChord}m`;
    setToolState({ suggestedProgression: progression });
  }, [toolState.startingChord, toolState.endingChord, setToolState]);

  const handleGenerateClick = useCallback(() => {
    generateProgression();
  }, [generateProgression]);

  const handleDownload = useCallback(async () => {
    const blob = new Blob([toolState.suggestedProgression], {
      type: 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chord_progression.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToolState({ ...toolState, isDownloadSuccess: true });
    setTimeout(() => setToolState({ ...toolState, isDownloadSuccess: false }), 2000);
  }, [toolState.suggestedProgression, setToolState]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(toolState.suggestedProgression);
    setToolState({ ...toolState, isDownloadSuccess: true });
    setTimeout(() => setToolState({ ...toolState, isDownloadSuccess: false }), 2000);
  }, [toolState.suggestedProgression, setToolState]);

  const handleClear = useCallback(async () => {
    await saveStateNow(DEFAULT_TOOL_STATE);
    setToolState(DEFAULT_TOOL_STATE);
  }, [saveStateNow, setToolState]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Starting Chord"
          options={MAJOR_CHORDS.concat(MINOR_CHORDS)}
          value={toolState.startingChord}
          onChange={handleStartingChordChange}
        />
        <Select
          label="Ending Chord"
          options={MAJOR_CHORDS.concat(MINOR_CHORDS)}
          value={toolState.endingChord}
          onChange={handleEndingChordChange}
        />
      </div>
      <Button onClick={handleGenerateClick}>Generate Progression</Button>
      <Textarea
        label="Suggested Chord Progression"
        value={toolState.suggestedProgression}
        readOnly
      />
      <div className="flex gap-2">
        <Button
          onClick={handleDownload}
          iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
          disabled={toolState.isDownloadSuccess}
        >
          Download
        </Button>
        <Button
          onClick={handleCopy}
          iconLeft={<ClipboardDocumentIcon className="h-5 w-5" />}
          disabled={toolState.isDownloadSuccess}
        >
          Copy
        </Button>
        <Button onClick={handleClear} variant="neutral">
          Clear
        </Button>
      </div>
      <div className="flex justify-end">
        <Button onClick={togglePersistence} variant="neutral">
          {isPersistent ? 'Make Temporary' : 'Make Persistent'}
        </Button>
      </div>
    </div>
  );
}