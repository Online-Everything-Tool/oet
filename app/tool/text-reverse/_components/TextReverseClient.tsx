// --- FILE: app/tool/text-reverse/_components/TextReverseClient.tsx ---
'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef, // Added useRef
} from 'react';
// import useToolUrlState from '../../_hooks/useToolUrlState'; // Not needed if urlStateParams handled by useToolState directly
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import Select from '../../_components/form/Select';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal'; // Added
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal'; // Added
import type { ParamConfig } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage'; // Added
import { useDebouncedCallback } from 'use-debounce'; // Added
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowUpTrayIcon, // Added
  ArrowDownTrayIcon, // Added
  DocumentPlusIcon, // Added
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useFileLibrary } from '@/app/context/FileLibraryContext';

type ReverseMode = 'character' | 'word' | 'line';

interface TextReverseToolState {
  inputText: string;
  reverseMode: ReverseMode;
  outputValue: string; // Added: To store the reversed text
  lastLoadedFilename?: string | null; // Added
  // No outputFilename needed if each save/download is a new timestamped file
}

const DEFAULT_TEXT_REVERSE_STATE: TextReverseToolState = {
  inputText: '',
  reverseMode: 'character',
  outputValue: '', // Added
  lastLoadedFilename: null, // Added
};

const AUTO_PROCESS_DEBOUNCE_MS = 300;

interface TextReverseClientProps {
  urlStateParams: ParamConfig[]; // Keep this, useToolState can leverage it for init
  toolRoute: string;
}

const TextReverseClient = ({
  urlStateParams, // Pass this to useToolState if it's designed to use it
  toolRoute,
}: TextReverseClientProps) => {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    clearState: persistentClearState,
  } = useToolState<TextReverseToolState>(toolRoute, DEFAULT_TEXT_REVERSE_STATE);

  // Local UI state for feedback
  const [isOutputCopied, setIsOutputCopied] = useState<boolean>(false);
  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false); // Added
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false); // Added
  const [filenameActionType, setFilenameActionType] = useState<
    'download' | 'save' | null
  >(null); // Added
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] =
    useState(''); // Added
  const [saveSuccess, setSaveSuccess] = useState(false); // Added
  const [uiError, setUiError] = useState(''); // Added for file errors or other UI issues

  const initialUrlLoadProcessedRef = useRef(false); // To handle URL params only once

  const { addFile: addFileToLibrary } = useFileLibrary(); // Added

  const reverseOptions = useMemo(
    () => [
      { value: 'character' as ReverseMode, label: 'Character' },
      { value: 'word' as ReverseMode, label: 'Word' },
      { value: 'line' as ReverseMode, label: 'Line' },
    ],
    []
  );

  const performTextReversal = useCallback(
    (text: string, mode: ReverseMode) => {
      if (!text.trim()) {
        setToolState({ outputValue: '' }); // Update via setToolState
        return;
      }
      let newOutput = '';
      if (mode === 'character') {
        newOutput = text.split('').reverse().join('');
      } else if (mode === 'word') {
        newOutput = text.split(/\s+/).reverse().join(' ');
      } else if (mode === 'line') {
        newOutput = text.split(/\r?\n/).reverse().join('\n');
      }
      setToolState({ outputValue: newOutput }); // Update via setToolState
      setIsOutputCopied(false); // Reset copy status
    },
    [setToolState]
  ); // Only setToolState as it's stable

  // Effect for URL parameter handling (runs once after state is loaded)
  useEffect(() => {
    if (
      isLoadingState ||
      initialUrlLoadProcessedRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      return;
    }
    initialUrlLoadProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<TextReverseToolState> = {};
    let needsStateUpdate = false;

    const textFromUrl = params.get('text');
    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      updates.inputText = textFromUrl;
      updates.lastLoadedFilename = '(loaded from URL)';
      updates.outputValue = ''; // Invalidate output
      needsStateUpdate = true;
    }

    const reverseModeFromUrl = params.get('reverse') as ReverseMode | null; // 'reverse' is from metadata
    if (
      reverseModeFromUrl &&
      reverseOptions.some((opt) => opt.value === reverseModeFromUrl) &&
      reverseModeFromUrl !== toolState.reverseMode
    ) {
      updates.reverseMode = reverseModeFromUrl;
      updates.outputValue = ''; // Invalidate output
      needsStateUpdate = true;
    }

    if (needsStateUpdate) {
      setToolState(updates);
      // The main processing useEffect will pick up these changes.
    } else if (
      toolState.inputText.trim() &&
      !toolState.outputValue.trim() &&
      !uiError
    ) {
      // If URL params matched current state, but output is empty, process now.
      performTextReversal(toolState.inputText, toolState.reverseMode);
    }
  }, [
    isLoadingState,
    urlStateParams,
    toolState,
    setToolState,
    reverseOptions,
    performTextReversal,
    uiError,
  ]);

  const debouncedPerformTextReversal = useDebouncedCallback(
    performTextReversal,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  // Main effect to perform reversal when inputText or reverseMode changes
  useEffect(() => {
    if (isLoadingState || !initialUrlLoadProcessedRef.current) return; // Wait for tool state and URL processing

    if (!toolState.inputText.trim()) {
      if (toolState.outputValue !== '') {
        // Only update if state needs changing
        setToolState({ outputValue: '' });
      }
      debouncedPerformTextReversal.cancel();
      return;
    }
    debouncedPerformTextReversal(toolState.inputText, toolState.reverseMode);
  }, [
    toolState.inputText,
    toolState.reverseMode,
    isLoadingState,
    debouncedPerformTextReversal,
    setToolState,
    toolState.outputValue,
  ]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setToolState({
        inputText: event.target.value,
        lastLoadedFilename: null, // Input changed, so no longer from file
        outputValue: '', // Clear output, debounced reversal will run
      });
      setIsOutputCopied(false);
    },
    [setToolState]
  );

  const handleReverseChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setToolState({
        reverseMode: event.target.value as ReverseMode,
        outputValue: '', // Clear output, debounced reversal will run
      });
      setIsOutputCopied(false);
    },
    [setToolState]
  );

  const handleClear = useCallback(async () => {
    await persistentClearState(); // Resets toolState to default
    setIsOutputCopied(false);
    setSaveSuccess(false);
    setUiError('');
    debouncedPerformTextReversal.cancel();
  }, [persistentClearState, debouncedPerformTextReversal]);

  const handleCopyOutput = useCallback(() => {
    if (!toolState.outputValue || !navigator.clipboard) return;
    navigator.clipboard.writeText(toolState.outputValue).then(
      () => {
        setIsOutputCopied(true);
        setTimeout(() => setIsOutputCopied(false), 1500);
      },
      (_err) => {
        /* console.error('Failed to copy reversed text: ', err); */
      }
    );
  }, [toolState.outputValue]);

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLoadFileModalOpen(false);
      if (files.length === 0) return;
      const file = files[0];
      if (!file.blob) {
        setUiError(`Error: File "${file.name}" has no content.`);
        return;
      }
      try {
        const text = await file.blob.text();
        setToolState({
          inputText: text,
          lastLoadedFilename: file.name,
          outputValue: '', // Clear output, debounced reversal will run
        });
        setUiError('');
      } catch (e) {
        setUiError(
          `Error reading file "${file.name}": ${e instanceof Error ? e.message : 'Unknown error'}`
        );
        setToolState({
          inputText: '',
          lastLoadedFilename: null,
          outputValue: '',
        });
      }
    },
    [setToolState]
  );

  const generateOutputFilenameForAction = useCallback((): string => {
    const base =
      toolState.lastLoadedFilename?.replace(/\.[^/.]+$/, '') || 'reversed-text';
    return `${base}-${toolState.reverseMode}-${Date.now()}.txt`;
  }, [toolState.lastLoadedFilename, toolState.reverseMode]);

  const initiateOutputActionWithPrompt = (action: 'download' | 'save') => {
    if (!toolState.outputValue.trim()) {
      setUiError('No output to ' + action + '.');
      return;
    }
    setUiError(''); // Clear previous errors
    setSuggestedFilenameForPrompt(generateOutputFilenameForAction());
    setFilenameActionType(action);
    setIsFilenameModalOpen(true);
  };

  const handleFilenameConfirm = useCallback(
    async (chosenFilename: string) => {
      const action = filenameActionType;
      setIsFilenameModalOpen(false);
      setFilenameActionType(null);

      if (!action || !toolState.outputValue) return;

      let finalFilename = chosenFilename.trim();
      if (!finalFilename) finalFilename = generateOutputFilenameForAction();
      if (!/\.txt$/i.test(finalFilename)) finalFilename += '.txt';

      if (action === 'download') {
        try {
          const blob = new Blob([toolState.outputValue], {
            type: 'text/plain;charset=utf-8',
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = finalFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (_err) {
          setUiError('Failed to prepare download.');
        }
      } else if (action === 'save') {
        const blob = new Blob([toolState.outputValue], {
          type: 'text/plain;charset=utf-8',
        });
        try {
          await addFileToLibrary(blob, finalFilename, 'text/plain', false);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (_err) {
          setUiError('Failed to save to library.');
        }
      }
    },
    [
      filenameActionType,
      toolState.outputValue,
      generateOutputFilenameForAction,
      addFileToLibrary,
    ]
  );

  if (isLoadingState && !initialUrlLoadProcessedRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Text Reverse Tool...
      </p>
    );
  }

  const canPerformOutputActions =
    toolState.outputValue.trim() !== '' && !uiError;

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="flex justify-between items-center gap-2">
        <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
          {toolState.lastLoadedFilename && (
            <span className="ml-2 text-xs italic">
              (From: {toolState.lastLoadedFilename})
            </span>
          )}
        </label>
        <Button
          variant="neutral-outline"
          size="sm"
          onClick={() => setIsLoadFileModalOpen(true)}
          iconLeft={<ArrowUpTrayIcon className="h-4 w-4" />}
        >
          Load from File
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Textarea
          label="Input Text:" // Redundant label, primary one is above
          id="text-input"
          rows={8}
          value={toolState.inputText}
          onChange={handleInputChange}
          placeholder="Enter text to reverse here..."
          textareaClassName="text-base font-mono"
          spellCheck="false"
          aria-label="Enter text to reverse"
        />
        <div>
          <label
            htmlFor="reversed-text-output"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
          >
            Reversed Text ({toolState.reverseMode}): {/* Show current mode */}
          </label>
          <Textarea // Using Textarea for output for consistency and potential larger outputs
            id="reversed-text-output"
            rows={8}
            value={toolState.outputValue}
            readOnly
            placeholder="Reversed text will appear here..."
            textareaClassName="text-base font-mono bg-[rgb(var(--color-bg-subtle))]"
            aria-live="polite"
            spellCheck="false"
          />
        </div>
      </div>
      {uiError && (
        <div
          role="alert"
          className="p-3 my-1 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0"
            aria-hidden="true"
          />{' '}
          {uiError}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4 border border-[rgb(var(--color-border-base))] rounded-md p-4 bg-[rgb(var(--color-bg-component))]">
        <Select
          label="Reverse by:"
          id="reverse-select"
          name="reverseMode"
          options={reverseOptions}
          value={toolState.reverseMode}
          onChange={handleReverseChange}
          containerClassName="w-full sm:w-auto sm:min-w-[150px]"
          selectClassName="py-2"
        />
        <div className="flex items-center space-x-3 ml-auto">
          <Button
            variant={isOutputCopied ? 'secondary' : 'accent2'}
            onClick={handleCopyOutput}
            disabled={!canPerformOutputActions || isOutputCopied}
            iconLeft={
              isOutputCopied ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5" />
              )
            }
            className="transition-colors duration-150 ease-in-out"
          >
            {isOutputCopied ? 'Copied!' : 'Copy Output'}
          </Button>
          <Button
            variant="primary-outline"
            onClick={() => initiateOutputActionWithPrompt('save')}
            disabled={!canPerformOutputActions || saveSuccess}
            iconLeft={
              saveSuccess ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <DocumentPlusIcon className="h-5 w-5" />
              )
            }
          >
            {saveSuccess ? 'Saved!' : 'Save to Library'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => initiateOutputActionWithPrompt('download')}
            iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
            disabled={!canPerformOutputActions}
          >
            Download Output
          </Button>
          <Button
            variant="neutral"
            onClick={handleClear}
            disabled={
              !toolState.inputText &&
              toolState.reverseMode ===
                DEFAULT_TEXT_REVERSE_STATE.reverseMode &&
              !toolState.outputValue
            }
          >
            Clear
          </Button>
        </div>
      </div>

      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept=".txt,text/*"
        selectionMode="single"
        libraryFilter={{ category: 'text' }}
        initialTab="upload"
      />
      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => {
          setIsFilenameModalOpen(false);
          setFilenameActionType(null);
        }}
        onConfirm={handleFilenameConfirm}
        initialFilename={suggestedFilenameForPrompt}
        title={
          filenameActionType === 'download'
            ? 'Enter Download Filename'
            : 'Enter Filename for Library'
        }
        promptMessage={
          filenameActionType === 'download'
            ? 'Filename for download:'
            : 'Filename for library:'
        }
        confirmButtonText={
          filenameActionType === 'download' ? 'Download' : 'Save to Library'
        }
      />
    </div>
  );
};

export default TextReverseClient;
