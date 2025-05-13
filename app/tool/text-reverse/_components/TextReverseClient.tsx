// FILE: app/tool/text-reverse/_components/TextReverseClient.tsx
'use client';

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import useToolUrlState from '../../_hooks/useToolUrlState';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import Select from '../../_components/form/Select';
import type { ParamConfig } from '@/src/types/tools';
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

type ReverseMode = 'character' | 'word' | 'line'; // Added 'line'

interface TextReverseToolState {
  inputText: string;
  reverseMode: ReverseMode;
}

const DEFAULT_TEXT_REVERSE_STATE: TextReverseToolState = {
  inputText: '',
  reverseMode: 'character', // Default remains character
};

interface TextReverseClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

const TextReverseClient = ({
  urlStateParams,
  toolRoute,
}: TextReverseClientProps) => {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
  } = useToolState<TextReverseToolState>(toolRoute, DEFAULT_TEXT_REVERSE_STATE);

  const { urlState, isLoadingUrlState, urlProvidedAnyValue } =
    useToolUrlState(urlStateParams);

  const [isOutputCopied, setIsOutputCopied] = useState<boolean>(false);
  const lastLoggedStateRef = useRef<TextReverseToolState | null>(null);

  const reverseOptions = useMemo(
    () => [
      { value: 'character' as ReverseMode, label: 'Character' },
      { value: 'word' as ReverseMode, label: 'Word' },
      { value: 'line' as ReverseMode, label: 'Line' }, // Added Line option
    ],
    []
  );

  // Effect to initialize state from URL parameters
  useEffect(() => {
    if (!isLoadingState && !isLoadingUrlState && urlProvidedAnyValue) {
      const updates: Partial<TextReverseToolState> = {};
      const urlInputText = urlState.text as string | undefined;
      const urlReverseMode = urlState.reverse as ReverseMode | undefined;

      if (urlInputText !== undefined && urlInputText !== toolState.inputText) {
        updates.inputText = urlInputText;
      }
      if (
        urlReverseMode !== undefined &&
        (urlReverseMode === 'character' ||
          urlReverseMode === 'word' ||
          urlReverseMode === 'line') && // Ensure 'line' is valid here
        urlReverseMode !== toolState.reverseMode
      ) {
        updates.reverseMode = urlReverseMode;
      }

      if (Object.keys(updates).length > 0) {
        setToolState(updates);
      }
    }
  }, [
    isLoadingState,
    isLoadingUrlState,
    urlProvidedAnyValue,
    urlState,
    toolState,
    setToolState,
  ]);

  const reversedText = useMemo(() => {
    if (!toolState.inputText) return '';
    if (toolState.reverseMode === 'character') {
      return toolState.inputText.split('').reverse().join('');
    } else if (toolState.reverseMode === 'word') {
      return toolState.inputText.split(/\s+/).reverse().join(' ');
    } else if (toolState.reverseMode === 'line') {
      // Added line reversal logic
      return toolState.inputText.split(/\r?\n/).reverse().join('\n');
    }
    return toolState.inputText; // Fallback, should not be reached
  }, [toolState.inputText, toolState.reverseMode]);

  // Effect to log history on state changes
  useEffect(() => {
    if (isLoadingState) {
      lastLoggedStateRef.current = toolState;
      return;
    }
    if (
      toolState.inputText.trim() &&
      JSON.stringify(toolState) !== JSON.stringify(lastLoggedStateRef.current)
    ) {
    } else if (
      !toolState.inputText.trim() &&
      lastLoggedStateRef.current?.inputText &&
      JSON.stringify(toolState) !== JSON.stringify(lastLoggedStateRef.current)
    ) {
    } else {
      lastLoggedStateRef.current = toolState;
    }
  }, [toolState, reversedText, isLoadingState, toolRoute]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setToolState({ inputText: event.target.value });
      setIsOutputCopied(false);
    },
    [setToolState]
  );

  const handleReverseChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setToolState({ reverseMode: event.target.value as ReverseMode });
      setIsOutputCopied(false);
    },
    [setToolState]
  );

  const handleClear = useCallback(() => {
    setToolState(DEFAULT_TEXT_REVERSE_STATE);
    setIsOutputCopied(false);
    lastLoggedStateRef.current = DEFAULT_TEXT_REVERSE_STATE;
  }, [setToolState]);

  const handleCopyOutput = useCallback(() => {
    if (!reversedText || !navigator.clipboard) return;
    navigator.clipboard.writeText(reversedText).then(
      () => {
        setIsOutputCopied(true);
        setTimeout(() => setIsOutputCopied(false), 1500);
      },
      (err) => {
        console.error('Failed to copy reversed text: ', err);
      }
    );
  }, [reversedText]);

  if (isLoadingState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Text Reverse Tool...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Textarea
          label="Input Text:"
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
            Reversed Text:
          </label>
          <div
            id="reversed-text-output"
            className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm text-base font-mono whitespace-pre-wrap break-words overflow-auto min-h-[calc(8*1.5rem+2*0.75rem+2px)]"
            aria-live="polite"
          >
            {reversedText || (
              <span className="italic text-[rgb(var(--color-input-placeholder))]">
                Reversed text will appear here...
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 border border-[rgb(var(--color-border-base))] rounded-md p-4 bg-[rgb(var(--color-bg-component))]">
        <Select
          label="Reverse by:"
          id="reverse-select"
          name="reverseMode"
          options={reverseOptions} // Updated options will be used here
          value={toolState.reverseMode}
          onChange={handleReverseChange}
          containerClassName="w-full sm:w-auto sm:min-w-[150px]"
          selectClassName="py-2"
        />
        <div className="flex items-center space-x-3 ml-auto">
          <Button
            variant={isOutputCopied ? 'secondary' : 'accent2'}
            onClick={handleCopyOutput}
            disabled={!reversedText.trim()}
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
            variant="neutral"
            onClick={handleClear}
            disabled={
              !toolState.inputText &&
              toolState.reverseMode === DEFAULT_TEXT_REVERSE_STATE.reverseMode
            }
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TextReverseClient;
