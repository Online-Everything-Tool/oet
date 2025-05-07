// FILE: app/tool/text-reverse/_components/TextReverseClient.tsx
'use client';

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { useHistory } from '../../../context/HistoryContext';
import useToolUrlState, { StateSetters } from '../../_hooks/useToolUrlState';
import type { ParamConfig } from '@/src/types/tools';

type Reverse = 'character' | 'word';

interface TextReverseClientProps {
  urlStateParams: ParamConfig[];
  toolTitle: string;
  toolRoute: string;
}
const TextReverseClient = ({
  urlStateParams,
  toolTitle,
  toolRoute,
}: TextReverseClientProps) => {
  const [text, setText] = useState<string>('');
  const [reverse, setReverse] = useState<Reverse>('character');
  const lastLoggedTextRef = useRef<string | null>(null);
  const lastLoggedReverseRef = useRef<Reverse | null>(null);
  const initialLoadComplete = useRef(false);

  const { addHistoryEntry } = useHistory();

  const stateSetters = useMemo(
    () => ({
      text: setText,
      reverse: setReverse,
    }),
    []
  );

  useToolUrlState(urlStateParams, stateSetters as StateSetters);

  useEffect(() => {
    if (!initialLoadComplete.current) {
      lastLoggedTextRef.current = text;
      lastLoggedReverseRef.current = reverse;
      initialLoadComplete.current = true;
    }
  }, [text, reverse]);

  const reversedText = useMemo(() => {
    if (!text) return '';
    if (reverse === 'character') {
      return text.split('').reverse().join('');
    } else {
      return text.split(/\s+/).reverse().join(' ');
    }
  }, [text, reverse]);

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
    },
    []
  );

  const handleReverseChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setReverse(event.target.value as Reverse);
    },
    []
  );

  const handleTextBlur = useCallback(() => {
    if (!initialLoadComplete.current) {
      return;
    }

    const currentText = text;
    const currentReverse = reverse;

    const textChanged = currentText !== lastLoggedTextRef.current;
    const reverseChanged = currentReverse !== lastLoggedReverseRef.current;

    if (textChanged || reverseChanged) {
      const limitedOutput =
        reversedText.length > 500
          ? reversedText.substring(0, 500) + '...'
          : reversedText;

      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'auto',
        input: {
          text:
            currentText.length > 500
              ? currentText.substring(0, 500) + '...'
              : currentText,
          reverse: currentReverse,
        },
        output: {
          reverseMethod: currentReverse,
          limitedReversedText: limitedOutput,
        },
        status: 'success',
        eventTimestamp: Date.now(),
      });
      lastLoggedTextRef.current = currentText;
      lastLoggedReverseRef.current = currentReverse;
    }
  }, [text, reverse, reversedText, addHistoryEntry, toolTitle, toolRoute]);

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="text-input"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
          >
            {' '}
            Input Text:{' '}
          </label>
          <textarea
            id="text-input"
            rows={8}
            value={text}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            placeholder="Enter text to reverse here..."
            className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
            spellCheck="false"
            aria-label="Enter text to reverse"
          />
        </div>
        <div>
          <label
            htmlFor="reversed-text"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
          >
            Reversed Text:
          </label>
          <div
            id="reversed-text"
            className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm text-base font-mono whitespace-pre-wrap break-words overflow-auto h-[12rem]"
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
        <label
          htmlFor="reverse-select"
          className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
        >
          Reverse by:
        </label>
        <select
          id="reverse-select"
          name="reverse"
          value={reverse}
          onChange={handleReverseChange}
          onBlur={handleTextBlur}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-[rgb(var(--color-input-border))] focus:outline-none focus:ring-[rgb(var(--color-input-focus-border))] focus:border-[rgb(var(--color-input-focus-border))] sm:text-sm rounded-md bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))]"
        >
          <option value="character">Character</option>
          <option value="word">Word</option>
        </select>
        {/* TODO : Add Copy Function - Not Needed, Just Visual */}
      </div>
    </div>
  );
};

export default TextReverseClient;
