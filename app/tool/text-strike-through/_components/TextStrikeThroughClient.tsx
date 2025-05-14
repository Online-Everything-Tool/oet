// --- FILE: app/tool/text-strike-through/_components/TextStrikeThroughClient.tsx ---
'use client';

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import Checkbox from '../../_components/form/Checkbox';
import Input from '../../_components/form/Input';
import type { ParamConfig } from '@/src/types/tools';

import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

interface TextStrikeThroughClientProps {
  urlStateParams: ParamConfig[];

  toolRoute: string;
}

interface TextStrikeThroughToolState {
  inputText: string;
  skipSpaces: boolean;
  color: string;
}

const DEFAULT_TEXT_STRIKE_THROUGH_STATE: TextStrikeThroughToolState = {
  inputText: '',
  skipSpaces: false,
  color: '#dc2626',
};

export default function TextStrikeThroughClient({
  urlStateParams,

  toolRoute,
}: TextStrikeThroughClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    clearState: persistentClearState,
    errorLoadingState,
  } = useToolState<TextStrikeThroughToolState>(
    toolRoute,
    DEFAULT_TEXT_STRIKE_THROUGH_STATE
  );

  const [isCopied, setIsCopied] = useState<boolean>(false);
  const initialUrlLoadProcessedRef = useRef(false);

  useEffect(() => {
    if (
      isLoadingState ||
      initialUrlLoadProcessedRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      if (!isLoadingState && !initialUrlLoadProcessedRef.current)
        initialUrlLoadProcessedRef.current = true;
      return;
    }
    initialUrlLoadProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<TextStrikeThroughToolState> = {};
    let needsUpdate = false;

    const textFromUrl = params.get('text');
    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      updates.inputText = textFromUrl;
      needsUpdate = true;
    }

    const skipSpacesFromUrl = params.get('skipSpaces');
    if (skipSpacesFromUrl !== null) {
      const skipBool = skipSpacesFromUrl.toLowerCase() === 'true';
      if (skipBool !== toolState.skipSpaces) {
        updates.skipSpaces = skipBool;
        needsUpdate = true;
      }
    }

    const colorFromUrl = params.get('color');

    if (
      colorFromUrl &&
      /^#([0-9A-Fa-f]{3}){1,2}$/.test(colorFromUrl) &&
      colorFromUrl !== toolState.color
    ) {
      updates.color = colorFromUrl;
      needsUpdate = true;
    }

    if (needsUpdate) {
      setToolState(updates);
    }
  }, [isLoadingState, urlStateParams, toolState, setToolState]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setToolState({ inputText: event.target.value });
      setIsCopied(false);
    },
    [setToolState]
  );

  const handleSkipSpacesChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setToolState({ skipSpaces: event.target.checked });
      setIsCopied(false);
    },
    [setToolState]
  );

  const handleColorChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setToolState({ color: event.target.value });
      setIsCopied(false);
    },
    [setToolState]
  );

  const handleClear = useCallback(async () => {
    await persistentClearState();
    setIsCopied(false);
  }, [persistentClearState]);

  const handleCopyInput = useCallback(() => {
    if (!toolState.inputText || !navigator.clipboard) return;
    navigator.clipboard.writeText(toolState.inputText).then(
      () => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
      },
      (err) => {
        console.error('Failed to copy input text: ', err);
      }
    );
  }, [toolState.inputText]);

  const renderedOutput = useMemo(() => {
    if (!toolState.inputText) {
      return (
        <span className="italic text-[rgb(var(--color-input-placeholder))]">
          Output preview appears here...
        </span>
      );
    }
    const strikeStyle: React.CSSProperties = {
      textDecoration: 'line-through',
      textDecorationColor: toolState.color,
      textDecorationStyle: 'solid',
    };

    if (!toolState.skipSpaces) {
      return <span style={strikeStyle}>{toolState.inputText}</span>;
    } else {
      const segments = toolState.inputText.split(/(\s+)/);
      return segments.map((segment, index) => {
        if (segment.match(/\s+/)) {
          return <React.Fragment key={index}>{segment}</React.Fragment>;
        } else if (segment) {
          return (
            <span key={index} style={strikeStyle}>
              {segment}
            </span>
          );
        }
        return null;
      });
    }
  }, [toolState.inputText, toolState.skipSpaces, toolState.color]);

  if (isLoadingState && !initialUrlLoadProcessedRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Text Strike Through Tool...
      </p>
    );
  }
  if (errorLoadingState) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded">
        Error loading saved state: {errorLoadingState}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <div className="space-y-1 h-full flex flex-col">
          <Textarea
            label="Input Text"
            id="text-input"
            name="text"
            rows={8}
            value={toolState.inputText}
            onChange={handleInputChange}
            containerClassName="flex-grow flex flex-col"
            textareaClassName="flex-grow text-base"
            placeholder="Paste or type your text here..."
            aria-label="Input text for strikethrough formatting"
          />
        </div>
        <div className="space-y-1 h-full flex flex-col">
          <label
            htmlFor="outputTextDisplay"
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
          >
            Strikethrough Output (Visual Preview)
          </label>
          <div
            id="outputTextDisplay"
            aria-live="polite"
            className="block w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm resize-none overflow-auto whitespace-pre-wrap flex-grow min-h-[calc(8*1.5rem+2*0.75rem+2px)] text-base"
          >
            {renderedOutput}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 items-center border border-[rgb(var(--color-border-base))] p-3 rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <fieldset className="flex flex-wrap gap-x-4 gap-y-2 items-center">
          <legend className="sr-only">Strikethrough Options</legend>
          <Checkbox
            id="skipSpaces-input"
            label="Skip Spaces"
            checked={toolState.skipSpaces}
            onChange={handleSkipSpacesChange}
            labelClassName="text-sm text-[rgb(var(--color-text-muted))] select-none"
          />
          <div className="flex items-center gap-2">
            <label
              htmlFor="color-input"
              className="text-sm text-[rgb(var(--color-text-muted))]"
            >
              Color:
            </label>
            <Input
              type="color"
              id="color-input"
              name="color"
              value={toolState.color}
              onChange={handleColorChange}
              inputClassName="h-7 w-10 p-0.5"
              aria-label="Strikethrough color picker"
            />
          </div>
        </fieldset>
        <div className="flex items-center space-x-3 ml-auto">
          <Button
            variant={isCopied ? 'secondary' : 'accent2'}
            onClick={handleCopyInput}
            disabled={!toolState.inputText.trim() || isCopied}
            iconLeft={
              isCopied ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5" />
              )
            }
            className="transition-colors duration-150 ease-in-out"
          >
            {isCopied ? 'Copied Input!' : 'Copy Input Text'}
          </Button>
          <Button
            variant="neutral"
            onClick={handleClear}
            disabled={
              !toolState.inputText &&
              !toolState.skipSpaces &&
              toolState.color === DEFAULT_TEXT_STRIKE_THROUGH_STATE.color
            }
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
