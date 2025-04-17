'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import type { TriggerType } from '@/src/types/history';
import useToolUrlState, { StateSetters } from '../../_hooks/useToolUrlState';
import type { ParamConfig } from '@/src/types/tools';

interface RegexTesterClientProps {
  urlStateParams: ParamConfig[];
  toolTitle: string;
  toolRoute: string;
}

export default function RegexTesterClient({
  urlStateParams,
  toolTitle,
  toolRoute
}: RegexTesterClientProps) {
  const [regex, setRegex] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [matches, setMatches] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { addHistoryEntry } = useHistory();

  const stateSetters = useMemo(() => ({
    regex: setRegex,
    text: setText
  }), []);

  const { shouldRunOnLoad, setShouldRunOnLoad } = useToolUrlState(
    urlStateParams,
    stateSetters as StateSetters
  );

  const handleTest = useCallback(() => {
    setError(null);
    setMatches([]);
    try {
      const regexObj = new RegExp(regex);
      const matchArray = text.matchAll(regexObj);
      const matchesArray = [...matchArray].map((match) => match[0] || '');
      setMatches(matchesArray);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid regular expression');
    }
  }, [regex, text]);

  useEffect(() => {
    if (shouldRunOnLoad && regex && text) {
      handleTest();
      setShouldRunOnLoad(false);
    }
  }, [shouldRunOnLoad, setShouldRunOnLoad, regex, text, handleTest]);

  const handleRegexChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setRegex(event.target.value);
    setMatches([]);
    setError(null);
  }, []);

  const handleTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    setMatches([]);
    setError(null);
  }, []);

  const handleClear = useCallback(() => {
    setRegex('');
    setText('');
    setMatches([]);
    setError(null);
  }, []);

  const logHistory = useCallback(() => {
    addHistoryEntry({
      toolName: toolTitle,
      toolRoute: toolRoute,
      trigger: 'click',
      input: { regex, text },
      output: { matches, error },
      status: error ? 'error' : 'success'
    });
  }, [matches, error, regex, text, addHistoryEntry, toolTitle, toolRoute]);

  useEffect(() => {
    if (matches.length > 0 || error) {
      logHistory();
    }
  }, [matches, error, logHistory]);

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div>
        <label
          htmlFor="regex-input"
          className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"
        >
          Regular Expression:
        </label>
        <input
          type="text"
          id="regex-input"
          value={regex}
          onChange={handleRegexChange}
          placeholder="Enter your regular expression here..."
          className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm"
        />
      </div>
      <div>
        <label
          htmlFor="text-input"
          className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"
        >
          Text to Match:
        </label>
        <textarea
          id="text-input"
          rows={8}
          value={text}
          onChange={handleTextChange}
          placeholder="Enter the text you want to test against..."
          className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-sm"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleTest}
          className="px-5 py-2 rounded-md text-[rgb(var(--color-button-primary-text))] font-medium bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition duration-150 ease-in-out"
        >
          Test
        </button>
        <button
          onClick={handleClear}
          className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition duration-150 ease-in-out"
        >
          Clear
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm"
        >
          <strong className="font-semibold">Error:</strong> {error}
        </div>
      )}
      {matches.length > 0 && (
        <div>
          <label
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"
          >
            Matches:
          </label>
          <ul className="list-disc list-inside">
            {matches.map((match, index) => (
              <li key={index}>{match}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}