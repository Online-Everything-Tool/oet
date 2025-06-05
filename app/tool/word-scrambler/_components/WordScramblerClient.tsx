'use client';

import React, { useState, useCallback, useEffect } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import Textarea from '@/app/tool/_components/form/Textarea';
import Button from '@/app/tool/_components/form/Button';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import importedMetadata from '../metadata.json';
import type { ToolMetadata } from '@/src/types/tools';
import { useDebouncedCallback } from 'use-debounce';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';

const AUTO_PROCESS_DEBOUNCE_MS = 300;

interface WordScramblerToolState {
  inputText: string;
  outputValue: string;
  errorMsg: string;
}

const DEFAULT_WORD_SCRAMBLER_STATE: WordScramblerToolState = {
  inputText: '',
  outputValue: '',
  errorMsg: '',
};

const metadata = importedMetadata as ToolMetadata;

interface WordScramblerClientProps {
  toolRoute: string;
}

export default function WordScramblerClient({
  toolRoute,
}: WordScramblerClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    saveStateNow,
  } = useToolState<WordScramblerToolState>(
    toolRoute,
    DEFAULT_WORD_SCRAMBLER_STATE
  );

  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameAction, setFilenameAction] = useState<'download' | 'save' | null>(null);
  const [currentOutputFilename, setCurrentOutputFilename] = useState<string | null>(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const { addFile: addFileToLibrary } = useFileLibrary();

  const debouncedScrambler = useDebouncedCallback(handleScrambling, AUTO_PROCESS_DEBOUNCE_MS);

  useEffect(() => {
    if (!isLoadingState) {
      debouncedScrambler(toolState.inputText);
    }
  }, [isLoadingState, toolState.inputText, debouncedScrambler]);

  const handleScrambling = useCallback((text: string) => {
    if (!text.trim()) {
      setToolState({ ...toolState, outputValue: '', errorMsg: '' });
      setCurrentOutputFilename(null);
      return;
    }
    try {
      const words = text.split(/\s+/);
      const scrambledWords = words.map((word) => {
        if (word.length <= 3) return word;
        const letters = word.split('');
        for (let i = letters.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [letters[i], letters[j]] = [letters[j], letters[i]];
        }
        return letters.join('');
      });
      const scrambledText = scrambledWords.join(' ');
      setToolState({ ...toolState, outputValue: scrambledText, errorMsg: '' });
      setCurrentOutputFilename(generateOutputFilename());
    } catch (error) {
      setToolState({ ...toolState, outputValue: '', errorMsg: 'Scramble failed' });
      setCurrentOutputFilename(null);
    }
  }, [toolState, setToolState]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({ inputText: event.target.value, errorMsg: '' });
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
  }, [setToolState]);

  const handleClear = useCallback(async () => {
    const newState = { ...DEFAULT_WORD_SCRAMBLER_STATE };
    setToolState(newState);
    await saveStateNow(newState);
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    debouncedScrambler.cancel();
  }, [setToolState, saveStateNow, debouncedScrambler]);

  const generateOutputFilename = useCallback(() => {
    const base = toolState.lastLoadedFilename?.replace(/\.[^/.]+$/, '') || 'scrambled-text';
    return `${base}.txt`;
  }, [toolState.lastLoadedFilename]);

  const handleCopyToClipboard = useCallback(() => {
    if (!toolState.outputValue) {
      setToolState((prev) => ({ ...prev, errorMsg: 'No output to copy.' }));
      return;
    }
    navigator.clipboard.writeText(toolState.outputValue).then(
      () => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      },
      () => {
        setToolState((prev) => ({ ...prev, errorMsg: 'Failed to copy to clipboard.' }));
      }
    );
  }, [toolState, setToolState]);

  const handleFilenameConfirm = useCallback(async (filename: string) => {
    setIsFilenameModalOpen(false);
    setFilenameAction(null);
    if (!filenameAction || !toolState.outputValue) return;

    let finalFilename = filename.trim();
    if (!finalFilename) finalFilename = generateOutputFilename();
    if (!/\.txt$/i.test(finalFilename)) finalFilename += '.txt';
    setCurrentOutputFilename(finalFilename);

    if (filenameAction === 'download') {
      try {
        const blob = new Blob([toolState.outputValue], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        setDownloadSuccess(true);
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setTimeout(() => setDownloadSuccess(false), 2000);
      } catch (_err) {
        setToolState((prev) => ({ ...prev, errorMsg: 'Failed to prepare download.' }));
      }
    } else if (filenameAction === 'save') {
      const blob = new Blob([toolState.outputValue], { type: 'text/plain;charset=utf-8' });
      try {
        await addFileToLibrary(blob, finalFilename, 'text/plain', false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (_err) {
        setToolState((prev) => ({ ...prev, errorMsg: 'Failed to save to library.' }));
      }
    }
  }, [filenameAction, toolState, addFileToLibrary, generateOutputFilename]);

  const initiateOutputAction = useCallback((action: 'download' | 'save') => {
    if (!toolState.outputValue.trim()) {
      setToolState((prev) => ({ ...prev, errorMsg: 'No output to ' + action + '.' }));
      return;
    }
    if (currentOutputFilename) {
      handleFilenameConfirm(currentOutputFilename);
    } else {
      setSuggestedFilenameForPrompt(generateOutputFilename());
      setFilenameAction(action);
      setIsFilenameModalOpen(true);
    }
  }, [currentOutputFilename, handleFilenameConfirm, toolState, generateOutputFilename]);

  if (isLoadingState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Word Scrambler...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <Textarea
        id="word-scrambler-input"
        label="Enter text to scramble"
        rows={8}
        value={toolState.inputText}
        onChange={handleInputChange}
        placeholder="Enter text here..."
        textareaClassName="text-base font-mono"
        spellCheck="false"
      />
      <div className="flex flex-row gap-4 items-center">
        <OutputActionButtons
          canPerform={toolState.outputValue.trim() !== ''}
          isSaveSuccess={saveSuccess}
          isCopySuccess={copySuccess}
          isDownloadSuccess={downloadSuccess}
          onInitiateSave={() => initiateOutputAction('save')}
          onInitiateDownload={() => initiateOutputAction('download')}
          onCopy={handleCopyToClipboard}
          onClear={handleClear}
          directiveName={metadata.directive}
          outputConfig={metadata.outputConfig}
        />
      </div>
      {toolState.errorMsg && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="font-semibold">Error:</strong> {toolState.errorMsg}
          </div>
        </div>
      )}
      <Textarea
        label="Scrambled Text:"
        id="word-scrambler-output"
        rows={8}
        value={toolState.outputValue}
        readOnly
        placeholder="Scrambled text will appear here..."
        textareaClassName="text-base font-mono bg-[rgb(var(--color-bg-subtle))]"
        aria-live="polite"
        spellCheck="false"
      />
      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => {
          setIsFilenameModalOpen(false);
          setFilenameAction(null);
        }}
        onConfirm={handleFilenameConfirm}
        initialFilename={suggestedFilenameForPrompt}
        title={filenameAction === 'download' ? 'Enter Download Filename' : 'Enter Filename for Library'}
        filenameAction={filenameAction || 'download'}
        promptMessage={filenameAction === 'download' ? 'Filename for download:' : 'Filename for library:'}
        confirmButtonText={filenameAction === 'download' ? 'Download' : 'Save to Library'}
      />
    </div>
  );
}