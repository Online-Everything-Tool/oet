'use client';

import React, { useMemo, useState, useCallback } from 'react';
import Textarea from '@/app/tool/_components/form/Textarea';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import Button from '@/app/tool/_components/form/Button';
import Input from '@/app/tool/_components/form/Input';
import useToolState from '@/app/tool/_hooks/useToolState';
import { CheckCircleIcon, ClipboardDocumentIcon, ExclamationTriangleIcon, ArrowPathIcon, XCircleIcon, CheckIcon } from '@heroicons/react/24/outline';

interface PalindromeCheckerProps {
  toolRoute: string;
}

interface PalindromeCheckerState {
  text: string;
  ignoreCase: boolean;
  ignoreSpaces: boolean;
  ignorePunctuation: boolean;
}

const DEFAULT_STATE: PalindromeCheckerState = {
  text: '',
  ignoreCase: true,
  ignoreSpaces: true,
  ignorePunctuation: true,
};

type CopyState = 'idle' | 'copied' | 'error';

export default function PalindromeCheckerClient({ toolRoute }: PalindromeCheckerProps) {
  const { state, setState, isLoadingState, errorLoadingState } = useToolState<PalindromeCheckerState>(
    toolRoute,
    DEFAULT_STATE
  );
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const analysis = useMemo(() => {
    const original = state.text ?? '';
    let sanitized = original.normalize('NFC');

    if (state.ignoreSpaces) sanitized = sanitized.replace(/\s+/g, '');
    if (state.ignorePunctuation) sanitized = sanitized.replace(/[\p{P}\p{S}]/gu, '');
    if (state.ignoreCase) sanitized = sanitized.toLowerCase();

    const reversed = [...sanitized].reverse().join(''); // Spread handles astral symbols correctly.
    const isPalindrome = sanitized.length > 0 && sanitized === reversed;
    const hasContent = original.trim().length > 0;

    return {
      original,
      sanitized,
      reversed,
      isPalindrome,
      hasContent,
      sanitizedLength: [...sanitized].length,
      originalLength: [...original.normalize('NFC')].length,
    };
  }, [state]);

  const handleTextChange = useCallback(
    (value: string) => {
      setState({ text: value });
    },
    [setState]
  );

  const handleOptionToggle = useCallback(
    (key: keyof PalindromeCheckerState) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setState({ [key]: event.target.checked } as Partial<PalindromeCheckerState>);
    },
    [setState]
  );

  const handleReset = useCallback(() => {
    setState(() => ({ ...DEFAULT_STATE }));
    setCopyState('idle');
  }, [setState]);

  const handleCopySanitized = useCallback(async () => {
    if (!analysis.sanitized) {
      setCopyState('error');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setCopyState('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(analysis.sanitized);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1800);
    } catch (err) {
      console.error('Failed to copy sanitized text', err);
      setCopyState('error');
    }
  }, [analysis.sanitized]);

  const copyIcon = copyState === 'copied' ? <CheckIcon className="h-5 w-5" /> : <ClipboardDocumentIcon className="h-5 w-5" />;
  const copyLabel = copyState === 'copied' ? 'Copied' : 'Copy sanitized text';

  if (isLoadingState && !state.text) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading Palindrome Checker...
      </p>
    );
  }

  if (errorLoadingState) {
    return (
      <div className="p-4 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-status-error))] rounded">
        Error loading saved settings: {errorLoadingState}
      </div>
    );
  }

  const status = (() => {
    if (!analysis.hasContent) return 'empty';
    if (!analysis.sanitized.length) return 'noSanitized';
    return analysis.isPalindrome ? 'palindrome' : 'mismatch';
  })();

  const statusIcon = (() => {
    switch (status) {
      case 'palindrome':
        return <CheckCircleIcon className="h-6 w-6 text-[rgb(var(--color-status-success))]" aria-hidden="true" />;
      case 'mismatch':
        return <XCircleIcon className="h-6 w-6 text-[rgb(var(--color-status-error))]" aria-hidden="true" />;
      case 'noSanitized':
        return <ExclamationTriangleIcon className="h-6 w-6 text-[rgb(var(--color-text-warning))]" aria-hidden="true" />;
      default:
        return <ExclamationTriangleIcon className="h-6 w-6 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />;
    }
  })();

  const statusText = (() => {
    switch (status) {
      case 'palindrome':
        return 'Great news! This input is a palindrome with the chosen filters.';
      case 'mismatch':
        return 'The processed text does not read the same forward and backward.';
      case 'noSanitized':
        return 'The filters removed everything. Relax them or add more text.';
      default:
        return 'Enter text to check whether it forms a palindrome.';
    }
  })();

  return (
    <div className="flex flex-col gap-6 text-[rgb(var(--color-text-base))]">
      <div className="space-y-4">
        <Textarea
          label="Input text"
          placeholder="Able was I ere I saw Elba"
          value={state.text}
          onChange={(event) => handleTextChange(event.target.value)}
          rows={5}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Checkbox
            id="ignore-case"
            label="Ignore letter casing"
            checked={state.ignoreCase}
            onChange={handleOptionToggle('ignoreCase')}
          />
          <Checkbox
            id="ignore-spaces"
            label="Ignore whitespace"
            checked={state.ignoreSpaces}
            onChange={handleOptionToggle('ignoreSpaces')}
          />
          <Checkbox
            id="ignore-punctuation"
            label="Ignore punctuation and symbols"
            checked={state.ignorePunctuation}
            onChange={handleOptionToggle('ignorePunctuation')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={handleReset}
            iconLeft={<ArrowPathIcon className="h-5 w-5" />}
          >
            Reset
          </Button>
          <Button
            variant="accent2"
            onClick={handleCopySanitized}
            disabled={!analysis.sanitized.length}
            iconLeft={copyIcon}
          >
            {copyLabel}
          </Button>
          {copyState === 'error' && (
            <span className="text-sm text-[rgb(var(--color-status-error))]">
              Clipboard unavailable.
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] p-5 shadow-sm">
        <div className="flex items-start gap-3">
          {statusIcon}
          <p className="text-base leading-relaxed">{statusText}</p>
        </div>

        <dl className="mt-4 grid gap-3 text-sm">
          <div className="grid gap-1">
            <dt className="font-medium text-[rgb(var(--color-text-muted))]">Sanitized text</dt>
            <Input value={analysis.sanitized} readOnly placeholder="Sanitized result" onChange={() => {}} />
          </div>
          <div className="grid gap-1">
            <dt className="font-medium text-[rgb(var(--color-text-muted))]">Reversed sanitized text</dt>
            <Input value={analysis.reversed} readOnly placeholder="Reversed result" onChange={() => {}} />
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-[rgb(var(--color-text-muted))]">Original length</dt>
              <dd>{analysis.originalLength}</dd>
            </div>
            <div>
              <dt className="font-medium text-[rgb(var(--color-text-muted))]">Sanitized length</dt>
              <dd>{analysis.sanitizedLength}</dd>
            </div>
          </div>
        </dl>
      </div>
    </div>
  );
}
