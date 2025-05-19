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
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';

import importedMetadata from '../metadata.json';

interface TextStrikeThroughClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

interface TextStrikeThroughToolState {
  inputText: string;
  skipSpaces: boolean;
  color: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_TEXT_STRIKE_THROUGH_STATE: TextStrikeThroughToolState = {
  inputText: '',
  skipSpaces: false,
  color: '#dc2626',
  lastLoadedFilename: null,
};

const COMBINING_LONG_STROKE_OVERLAY = '\u0336';
const metadata = importedMetadata as ToolMetadata;

export default function TextStrikeThroughClient({
  urlStateParams,
  toolRoute,
}: TextStrikeThroughClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,

    saveStateNow,
    errorLoadingState,
  } = useToolState<TextStrikeThroughToolState>(
    toolRoute,
    DEFAULT_TEXT_STRIKE_THROUGH_STATE
  );

  const [isUnicodeCopied, setIsUnicodeCopied] = useState<boolean>(false);
  const [isInputCopied, setIsInputCopied] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialUrlLoadProcessedRef = useRef(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { getToolMetadata } = useMetadata();
  const directiveName = metadata.directive;

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[TextStrikeThrough ITDE Accept] Processing signal from: ${signal.sourceDirective}`
      );
      setCopyError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setCopyError(
          `Metadata not found for source tool: ${signal.sourceToolTitle}`
        );
        return;
      }

      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );

      if (
        resolvedPayload.type === 'error' ||
        resolvedPayload.type === 'none' ||
        !resolvedPayload.data ||
        resolvedPayload.data.length === 0
      ) {
        setCopyError(
          resolvedPayload.errorMessage ||
            'No transferable data received from source.'
        );
        return;
      }

      let newText = '';
      const firstItem = resolvedPayload.data.find((item) =>
        item.type?.startsWith('text/')
      );
      let loadedFilename: string | null = null;

      if (firstItem) {
        try {
          newText = await firstItem.blob.text();
          if ('id' in firstItem && 'name' in firstItem) {
            loadedFilename = (firstItem as StoredFile).name;
          }
        } catch (e) {
          const errorMsgText = e instanceof Error ? e.message : String(e);
          setCopyError(
            `Error reading text from received data: ${errorMsgText}`
          );
          return;
        }
      } else {
        setCopyError('No valid text item found in received ITDE data.');
        return;
      }

      const newStateUpdate: Partial<TextStrikeThroughToolState> = {
        inputText: newText,
        lastLoadedFilename: loadedFilename,
      };
      setToolState(newStateUpdate);

      await saveStateNow({
        ...toolState,
        ...newStateUpdate,
        skipSpaces: toolState.skipSpaces,
        color: toolState.color,
      });
      setUserDeferredAutoPopup(false);
      setIsUnicodeCopied(false);
      setIsInputCopied(false);
    },
    [getToolMetadata, toolState, setToolState, saveStateNow]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingState) {
      if (!initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = true;
      }
    } else {
      if (initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = false;
      }
    }
  }, [isLoadingState]);

  useEffect(() => {
    const canProceed =
      !isLoadingState && initialToolStateLoadCompleteRef.current;
    if (
      canProceed &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup, directiveName]);

  useEffect(() => {
    if (
      isLoadingState ||
      initialUrlLoadProcessedRef.current ||
      !initialToolStateLoadCompleteRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      return;
    }
    initialUrlLoadProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<TextStrikeThroughToolState> = {};
    let needsUpdate = false;

    const textFromUrl = params.get('text');
    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      updates.inputText = textFromUrl;
      updates.lastLoadedFilename = '(loaded from URL)';
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
      setToolState((prev) => ({ ...prev, ...updates }));
    }
  }, [isLoadingState, urlStateParams, toolState, setToolState]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setToolState({ inputText: event.target.value, lastLoadedFilename: null });
      setIsUnicodeCopied(false);
      setIsInputCopied(false);
      setCopyError(null);
    },
    [setToolState]
  );
  const handleSkipSpacesChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setToolState({ skipSpaces: event.target.checked });
      setIsUnicodeCopied(false);
    },
    [setToolState]
  );
  const handleColorChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setToolState({ color: event.target.value });
      setIsUnicodeCopied(false);
    },
    [setToolState]
  );

  const handleClear = useCallback(async () => {
    const newState: TextStrikeThroughToolState = {
      ...DEFAULT_TEXT_STRIKE_THROUGH_STATE,
      skipSpaces: toolState.skipSpaces,
    };
    setToolState(newState);
    await saveStateNow(newState);

    setIsUnicodeCopied(false);
    setIsInputCopied(false);
    setCopyError(null);
  }, [setToolState, saveStateNow, toolState.skipSpaces]);

  const generateUnicodeStrikeThroughText = useCallback(() => {
    if (!toolState.inputText) return '';
    let result = '';
    for (let i = 0; i < toolState.inputText.length; i++) {
      const char = toolState.inputText[i];
      if (
        toolState.skipSpaces &&
        (char === ' ' || char === '\t' || char === '\n' || char === '\r')
      ) {
        result += char;
      } else {
        result += char + COMBINING_LONG_STROKE_OVERLAY;
      }
    }
    return result;
  }, [toolState.inputText, toolState.skipSpaces]);

  const handleCopyUnicodeOutput = useCallback(() => {
    const unicodeText = generateUnicodeStrikeThroughText();
    if (!unicodeText || !navigator.clipboard) {
      setCopyError('Nothing to copy or clipboard unavailable.');
      return;
    }
    setCopyError(null);
    navigator.clipboard.writeText(unicodeText).then(
      () => {
        setIsUnicodeCopied(true);
        setTimeout(() => setIsUnicodeCopied(false), 2000);
      },
      (err) => {
        console.error('Failed to copy Unicode strikethrough text: ', err);
        setCopyError('Failed to copy Unicode text.');
      }
    );
  }, [generateUnicodeStrikeThroughText]);

  const handleCopyInput = useCallback(() => {
    if (!toolState.inputText || !navigator.clipboard) {
      setCopyError('Nothing to copy or clipboard unavailable.');
      return;
    }
    setCopyError(null);
    navigator.clipboard.writeText(toolState.inputText).then(
      () => {
        setIsInputCopied(true);
        setTimeout(() => setIsInputCopied(false), 1500);
      },
      (err) => {
        console.error('Failed to copy input text: ', err);
        setCopyError('Failed to copy input text.');
      }
    );
  }, [toolState.inputText]);

  const renderedOutput = useMemo(() => {
    if (!toolState.inputText)
      return (
        <span className="italic text-[rgb(var(--color-input-placeholder))]">
          Output preview appears here...
        </span>
      );
    const strikeStyle: React.CSSProperties = {
      textDecoration: 'line-through',
      textDecorationColor: toolState.color,
      textDecorationThickness: '0.125em',
      textDecorationStyle: 'solid',
    };
    if (!toolState.skipSpaces)
      return <span style={strikeStyle}>{toolState.inputText}</span>;

    const segments = toolState.inputText.split(/(\s+)/);
    return segments.map((segment, index) => {
      if (segment.match(/^\s+$/)) {
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
  }, [toolState.inputText, toolState.skipSpaces, toolState.color]);

  const handleModalDeferAll = () => {
    setUserDeferredAutoPopup(true);
    itdeTarget.closeModal();
  };
  const handleModalIgnoreAll = () => {
    setUserDeferredAutoPopup(false);
    itdeTarget.ignoreAllSignals();
  };
  const handleModalAccept = (sourceDirective: string) => {
    itdeTarget.acceptSignal(sourceDirective);
  };
  const handleModalIgnore = (sourceDirective: string) => {
    itdeTarget.ignoreSignal(sourceDirective);
    if (
      itdeTarget.pendingSignals.filter(
        (s) => s.sourceDirective !== sourceDirective
      ).length === 0
    )
      setUserDeferredAutoPopup(false);
  };

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Text Strike Through Tool...
      </p>
    );
  }
  const displayError = copyError || errorLoadingState;

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {' '}
        {/* items-start for alignment */}
        <div className="space-y-1 h-full flex flex-col">
          <div className="flex justify-between items-center">
            <label
              htmlFor="text-input-strike"
              className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
            >
              Input Text{' '}
              {toolState.lastLoadedFilename && (
                <span className="ml-1 text-xs italic">
                  ({toolState.lastLoadedFilename})
                </span>
              )}
            </label>
            <ReceiveItdeDataTrigger
              hasDeferredSignals={
                itdeTarget.pendingSignals.length > 0 &&
                userDeferredAutoPopup &&
                !itdeTarget.isModalOpen
              }
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
          </div>
          <Textarea
            id="text-input-strike"
            label="Input text for strikethrough formatting"
            labelClassName="sr-only"
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
      {displayError && (
        <div
          role="alert"
          className="p-3 my-1 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0"
            aria-hidden="true"
          />
          {displayError}
        </div>
      )}
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
              htmlFor="color-input-strike"
              className="text-sm text-[rgb(var(--color-text-muted))]"
            >
              Color:
            </label>
            <Input
              type="color"
              id="color-input-strike"
              label="Strikethrough color"
              labelClassName="sr-only"
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
            variant="accent2-outline"
            onClick={handleCopyUnicodeOutput}
            disabled={!toolState.inputText.trim() || isUnicodeCopied}
            iconLeft={
              isUnicodeCopied ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5" />
              )
            }
            className="transition-colors duration-150 ease-in-out"
            title="Copy text with Unicode strikethrough characters"
          >
            Copy Unicode
          </Button>
          <Button
            variant="accent2"
            onClick={handleCopyInput}
            disabled={!toolState.inputText.trim() || isInputCopied}
            iconLeft={
              isInputCopied ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5" />
              )
            }
            className="transition-colors duration-150 ease-in-out"
            title="Copy original input text"
          >
            Copy
          </Button>
          <Button
            variant="neutral"
            onClick={handleClear}
            iconLeft={<XCircleIcon className="h-5 w-5" />}
            disabled={
              !toolState.inputText &&
              toolState.skipSpaces ===
                DEFAULT_TEXT_STRIKE_THROUGH_STATE.skipSpaces &&
              toolState.color === DEFAULT_TEXT_STRIKE_THROUGH_STATE.color
            }
          >
            Clear
          </Button>
        </div>
      </div>
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={handleModalAccept}
        onIgnore={handleModalIgnore}
        onDeferAll={handleModalDeferAll}
        onIgnoreAll={handleModalIgnoreAll}
      />
    </div>
  );
}
