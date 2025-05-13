// FILE: app/tool/text-strike-through/_components/TextStrikeThroughClient.tsx
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
import Checkbox from '../../_components/form/Checkbox';
import Input from '../../_components/form/Input'; // For color picker
import type { ParamConfig } from '@/src/types/tools';
import { useDebouncedCallback } from 'use-debounce';

interface TextStrikeThroughClientProps {
  urlStateParams: ParamConfig[];
  toolTitle: string;
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
  color: '#dc2626', // Default red from original component
};

export default function TextStrikeThroughClient({
  urlStateParams,
  toolTitle,
  toolRoute,
}: TextStrikeThroughClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
  } = useToolState<TextStrikeThroughToolState>(
    toolRoute,
    DEFAULT_TEXT_STRIKE_THROUGH_STATE
  );

  const { urlState, isLoadingUrlState, urlProvidedAnyValue } =
    useToolUrlState(urlStateParams);

  const [isCopied, setIsCopied] = useState<boolean>(false);
  const lastLoggedStateRef = useRef<TextStrikeThroughToolState | null>(null);

  // Effect to initialize state from URL parameters
  useEffect(() => {
    if (!isLoadingState && !isLoadingUrlState && urlProvidedAnyValue) {
      const updates: Partial<TextStrikeThroughToolState> = {};
      const urlInputText = urlState.text as string | undefined;
      const urlSkipSpaces = urlState.skipSpaces as boolean | undefined;
      const urlColor = urlState.color as string | undefined;

      if (urlInputText !== undefined && urlInputText !== toolState.inputText) {
        updates.inputText = urlInputText;
      }
      if (
        urlSkipSpaces !== undefined &&
        urlSkipSpaces !== toolState.skipSpaces
      ) {
        updates.skipSpaces = urlSkipSpaces;
      }
      if (urlColor !== undefined && urlColor !== toolState.color) {
        updates.color = urlColor;
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

  // Effect to log history on state changes
  useEffect(() => {
    if (isLoadingState) {
      // If still loading, initialize lastLoggedStateRef with the current toolState
      // to prevent logging the initial loaded state as a "change".
      lastLoggedStateRef.current = toolState;
      return;
    }
    if (toolState.inputText.trim()) {
      if (
        JSON.stringify(toolState) !== JSON.stringify(lastLoggedStateRef.current)
      ) {
      }
    } else {
      if (
        lastLoggedStateRef.current?.inputText &&
        JSON.stringify(toolState) !== JSON.stringify(lastLoggedStateRef.current)
      ) {
      } else {
        lastLoggedStateRef.current = toolState;
      }
    }
  }, [toolState, isLoadingState, toolTitle, toolRoute]);

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

  const handleClear = useCallback(() => {
    // Check if current state is different from default to decide if "cleared" log is needed
    const wasChangedFromDefault =
      JSON.stringify(toolState) !==
      JSON.stringify(DEFAULT_TEXT_STRIKE_THROUGH_STATE);

    setToolState(DEFAULT_TEXT_STRIKE_THROUGH_STATE);
    setIsCopied(false);

    lastLoggedStateRef.current = DEFAULT_TEXT_STRIKE_THROUGH_STATE; // Align ref with cleared state
  }, [setToolState, toolState]);

  const handleCopy = useCallback(() => {
    if (!toolState.inputText || !navigator.clipboard) return;
    navigator.clipboard.writeText(toolState.inputText).then(
      () => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
      },
      (err) => {
        console.error('Failed to copy text: ', err);
        // Optionally add an error state or notification
      }
    );
  }, [toolState.inputText, toolTitle, toolRoute]);

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

  if (isLoadingState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Text Strike Through Tool...
      </p>
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
            className="block w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm resize-none overflow-auto whitespace-pre-wrap flex-grow min-h-[calc(8*1.5rem+2*0.75rem+2px)]" // Approximate height match for textarea
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
              inputClassName="h-7 w-10 p-5" // Adjusted padding for color input
              aria-label="Strikethrough color picker"
            />
          </div>
        </fieldset>
        <div className="flex items-center space-x-3 ml-auto">
          <Button
            variant={isCopied ? 'secondary' : 'accent2'}
            onClick={handleCopy}
            disabled={!toolState.inputText.trim()}
            className="transition-colors duration-150 ease-in-out"
          >
            {isCopied ? 'Copied!' : 'Copy Input'}
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
