// FILE: app/tool/url-encode-decode/_components/UrlEncodeDecodeClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useHistory, NewHistoryData } from '../../../context/HistoryContext';
import useToolUrlState, {
  UseToolUrlStateReturn,
} from '../../_hooks/useToolUrlState';
import useToolState, { UseToolStateReturn } from '../../_hooks/useToolState';
import type { ParamConfig } from '@/src/types/tools';
import Textarea from '../../_components/form/Textarea';
import RadioGroup from '../../_components/form/RadioGroup';
import Button from '../../_components/form/Button';
import Checkbox from '../../_components/form/Checkbox';
import { useDebouncedCallback } from 'use-debounce';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  XCircleIcon,
} from '@heroicons/react/20/solid';

type Operation = 'encode' | 'decode';
type EncodeMode = 'standard' | 'aggressive';

interface UrlToolState {
  text: string;
  operation: Operation;
  encodeMode: EncodeMode;
}

const DEFAULT_STATE: UrlToolState = {
  text: '',
  operation: 'encode',
  encodeMode: 'standard',
};

const STATE_SAVE_DEBOUNCE_MS = 1500;

interface UrlEncodeDecodeClientProps {
  urlStateParams: ParamConfig[];
  toolTitle: string;
  toolRoute: string;
}

export default function UrlEncodeDecodeClient({
  urlStateParams,
  toolTitle,
  toolRoute,
}: UrlEncodeDecodeClientProps) {
  const [outputValue, setOutputValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isDownloaded, setIsDownloaded] = useState<boolean>(false);

  const { urlState, isLoadingUrlState, urlParamsLoaded, urlProvidedAnyValue } =
    useToolUrlState(urlStateParams);
  const {
    state,
    setState,
    saveState,
    isLoadingState,
    isPersistent,
    togglePersistence,
    clearState,
    errorLoadingState,
  } = useToolState<UrlToolState>(toolRoute, DEFAULT_STATE);
  const { addHistoryEntry } = useHistory();

  const [isComponentInitialized, setIsComponentInitialized] = useState(false);
  const didInitialize = useRef(false);

  useEffect(() => {
    if (isLoadingUrlState || isLoadingState || isComponentInitialized) return;

    let initialState: UrlToolState = state;
    let stateWasOverridden = false;

    if (urlProvidedAnyValue) {
      const urlOverrides: Partial<UrlToolState> = {};
      if (typeof urlState.text === 'string') urlOverrides.text = urlState.text;
      if (urlState.operation === 'encode' || urlState.operation === 'decode')
        urlOverrides.operation = urlState.operation;

      const mergedState = { ...state, ...urlOverrides };
      if (JSON.stringify(mergedState) !== JSON.stringify(state)) {
        if (JSON.stringify(state) !== JSON.stringify(DEFAULT_STATE)) {
          stateWasOverridden = true;
          addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: 'query',
            input: {
              note: 'State before URL override',
              overriddenState: state,
            },
            output: {
              message:
                'Persistent state backed up before applying URL parameters.',
            },
            status: 'success',
            eventTimestamp: Date.now(),
            outputFileIds: [],
          });
        }
        initialState = mergedState;
      }
    }

    if (initialState !== state) {
      setState(initialState);
    }
    setIsComponentInitialized(true);
    didInitialize.current = true;
  }, [
    isLoadingUrlState,
    isLoadingState,
    urlState,
    state,
    urlProvidedAnyValue,
    isComponentInitialized,
    setState,
    addHistoryEntry,
    toolTitle,
    toolRoute,
  ]);

  useEffect(() => {
    if (!isComponentInitialized || isLoadingState) return;

    setError(null);
    if (!state.text) {
      setOutputValue('');
      return;
    }

    console.log(
      `[UrlEncodeDecodeClient] Calculating output for op: ${state.operation}, mode: ${state.encodeMode}`
    );
    try {
      let result = '';
      if (state.operation === 'encode') {
        const standardEncoded = encodeURIComponent(state.text);
        if (state.encodeMode === 'aggressive') {
          result = standardEncoded.replace(
            /[!'()*~]/g,
            (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
          );
        } else {
          result = standardEncoded;
        }
      } else {
        result = decodeURIComponent(state.text.replace(/\+/g, ' '));
      }
      setOutputValue(result);
    } catch (err) {
      let message = `An unexpected error occurred during ${state.operation}.`;
      if (err instanceof URIError && state.operation === 'decode')
        message = `Decoding failed: Invalid percent-encoding sequence found. Check input.`;
      setError(message);
      setOutputValue('');
    }
  }, [
    state.text,
    state.operation,
    state.encodeMode,
    isComponentInitialized,
    isLoadingState,
  ]);

  const debouncedSave = useDebouncedCallback((currentState: UrlToolState) => {
    saveState(currentState);
  }, STATE_SAVE_DEBOUNCE_MS);

  useEffect(() => {
    if (isComponentInitialized && !isLoadingState) {
      if (didInitialize.current) {
        didInitialize.current = false;
        console.log(
          '[UrlEncodeDecodeClient] Skipping initial save trigger after load.'
        );
      } else {
        console.log(
          '[UrlEncodeDecodeClient] State changed after init, triggering debounced save.'
        );
        debouncedSave(state);
      }
    }
    return () => debouncedSave.cancel();
  }, [state, isComponentInitialized, isLoadingState, debouncedSave]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState({ text: event.target.value });
  };
  const handleOperationChange = (newOperation: Operation) => {
    setState({ operation: newOperation });
  };
  const handleEncodeModeChange = (newMode: EncodeMode) => {
    setState({ encodeMode: newMode });
  };
  const handleInputFocus = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    event.target.select();
  };
  const handleClear = useCallback(async () => {
    setError(null);
    setOutputValue('');
    await clearState();
  }, [clearState]);
  const handleCopyOutput = useCallback(async () => {
    if (!outputValue || isCopied) return;
    try {
      await navigator.clipboard.writeText(outputValue);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: {
          text: state.text,
          operation: state.operation,
          ...(state.operation === 'encode' && { encodeMode: state.encodeMode }),
        },
        output: { operationResult: outputValue },
        status: 'success',
        eventTimestamp: Date.now(),
        outputFileIds: [],
      });
    } catch (err) {
      setError('Could not copy text to clipboard.');
    }
  }, [
    outputValue,
    isCopied,
    state.text,
    state.operation,
    state.encodeMode,
    addHistoryEntry,
    toolRoute,
    toolTitle,
  ]);
  const handleDownloadOutput = useCallback(() => {
    if (!outputValue) return;
    try {
      const blob = new Blob([outputValue], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `${state.operation}-${state.operation === 'encode' ? state.encodeMode : ''}-result-${Date.now()}.txt`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsDownloaded(true);
      setTimeout(() => setIsDownloaded(false), 2000);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: {
          text: state.text,
          operation: state.operation,
          ...(state.operation === 'encode' && { encodeMode: state.encodeMode }),
        },
        output: { operationResult: `Downloaded as ${filename}` },
        status: 'success',
        eventTimestamp: Date.now(),
        outputFileIds: [],
      });
    } catch (err) {
      setError('Could not prepare text for download.');
    }
  }, [
    outputValue,
    state.text,
    state.operation,
    state.encodeMode,
    addHistoryEntry,
    toolRoute,
    toolTitle,
  ]);

  if (isLoadingUrlState || (isLoadingState && !isComponentInitialized)) {
    return (
      <div className="text-center p-4 text-gray-500 italic animate-pulse">
        Loading State...
      </div>
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
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      {/* Input Area */}
      <Textarea
        label="Input (Text or URL-encoded string):"
        id="url-input"
        value={state.text}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder="Paste text or URL-encoded string here..."
        rows={8}
        disabled={isLoadingState}
        textareaClassName="text-base"
      />

      {/* Controls Row */}
      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="flex flex-wrap gap-4 items-start">
          <RadioGroup
            name="urlOperation"
            legend="Operation:"
            options={[
              { value: 'encode', label: 'Encode' },
              { value: 'decode', label: 'Decode' },
            ]}
            selectedValue={state.operation}
            onChange={handleOperationChange}
            layout="horizontal"
            disabled={isLoadingState}
            radioClassName="text-sm"
          />
          {state.operation === 'encode' && (
            <RadioGroup
              name="encodeMode"
              legend="Encoding Mode:"
              options={[
                { value: 'standard', label: 'Standard (RFC 3986)' },
                { value: 'aggressive', label: "Aggressive (!*'()~)" },
              ]}
              selectedValue={state.encodeMode}
              onChange={handleEncodeModeChange}
              layout="horizontal"
              disabled={isLoadingState}
              radioClassName="text-sm"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-4 items-center border-t pt-3 mt-2">
          <div className="flex-grow"></div>
          <Checkbox
            label={<span className="text-xs">Remember Input</span>}
            id="persistence-toggle"
            checked={isPersistent}
            onChange={togglePersistence}
            disabled={isLoadingState}
            aria-label="Toggle session persistence"
          />
          <Button
            variant="neutral"
            onClick={handleClear}
            disabled={!state.text && !outputValue && !error}
          >
            {' '}
            Clear{' '}
          </Button>
        </div>
      </div>

      {/* Calculation Error Display Area */}
      {error && (
        <div
          role="alert"
          className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-start gap-2"
        >
          {' '}
          <XCircleIcon
            className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />{' '}
          <div>
            <strong className="font-semibold">Error:</strong> {error}
          </div>{' '}
        </div>
      )}

      {/* Output Area */}
      <div className="relative">
        <Textarea
          label="Output:"
          id="url-output"
          value={outputValue}
          readOnly
          onChange={() => {}}
          placeholder="Result will appear here..."
          rows={8}
          textareaClassName="bg-[rgb(var(--color-bg-subtle))] text-base"
          aria-live="polite"
        />
        {outputValue && (
          <div className="absolute top-0 right-0 mt-1 mr-1 flex gap-1">
            {' '}
            <Button
              variant={isCopied ? 'secondary' : 'accent-outline'}
              size="sm"
              onClick={handleCopyOutput}
              title="Copy Output"
              className="!p-1.5"
              disabled={isCopied}
            >
              {' '}
              {isCopied ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                <ClipboardDocumentIcon className="h-4 w-4" />
              )}{' '}
            </Button>{' '}
            <Button
              variant={isDownloaded ? 'secondary' : 'primary-outline'}
              size="sm"
              onClick={handleDownloadOutput}
              title="Download Output"
              className="!p-1.5"
              disabled={isDownloaded}
            >
              {' '}
              {isDownloaded ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                <ArrowDownTrayIcon className="h-4 w-4" />
              )}{' '}
            </Button>{' '}
          </div>
        )}
      </div>
    </div>
  );
}
