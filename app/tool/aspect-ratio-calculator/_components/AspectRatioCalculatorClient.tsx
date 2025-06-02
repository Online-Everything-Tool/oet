'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Input from '../../_components/form/Input';
import Button from '../../_components/form/Button';
import { useToolUrlState } from '@/app/tool/_hooks/useToolUrlState';
import { useToolState } from '@/app/tool/_hooks/useToolState';
import { safeStringify } from '@/app/lib/utils';
import {
  XCircleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

interface AspectRatioCalculatorState {
  width: string;
  height: string;
  ratio: string;
  ratioWidth: number | null;
  ratioHeight: number | null;
}

const DEFAULT_ASPECT_RATIO_STATE: AspectRatioCalculatorState = {
  width: '',
  height: '',
  ratio: '',
  ratioWidth: null,
  ratioHeight: null,
};

const calculateRatio = (width: number, height: number): string => {
  if (width === 0 || height === 0) return 'N/A';
  const gcd = (a: number, b: number): number => {
    if (b === 0) return a;
    return gcd(b, a % b);
  };
  const commonDivisor = gcd(width, height);
  return `${width / commonDivisor}:${height / commonDivisor}`;
};

interface AspectRatioCalculatorClientProps {
  toolRoute: string;
}

export default function AspectRatioCalculatorClient({
  toolRoute,
}: AspectRatioCalculatorClientProps) {
  const { urlState, isLoadingUrlState } = useToolUrlState(undefined);
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
  } = useToolState<AspectRatioCalculatorState>(
    toolRoute,
    DEFAULT_ASPECT_RATIO_STATE
  );
  const [uiError, setUiError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (isLoadingUrlState) return;
    const widthFromUrl = urlState.width;
    const heightFromUrl = urlState.height;
    if (widthFromUrl && heightFromUrl) {
      const numWidth = parseFloat(widthFromUrl as string);
      const numHeight = parseFloat(heightFromUrl as string);
      if (!isNaN(numWidth) && !isNaN(numHeight)) {
        setToolState({
          width: String(numWidth),
          height: String(numHeight),
          ratio: calculateRatio(numWidth, numHeight),
          ratioWidth: numWidth,
          ratioHeight: numHeight,
        });
      }
    }
  }, [urlState, setToolState, isLoadingUrlState]);

  const handleWidthChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newWidth = event.target.value;
      const numWidth = parseFloat(newWidth);
      setToolState((prevState) => ({
        ...prevState,
        width: newWidth,
        ratio: !isNaN(numWidth) && prevState.height.trim() !== ''
          ? calculateRatio(numWidth, parseFloat(prevState.height))
          : '',
        ratioWidth: isNaN(numWidth) ? null : numWidth,
      }));
      setUiError(null);
      setCopySuccess(false);
    },
    [setToolState]
  );

  const handleHeightChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newHeight = event.target.value;
      const numHeight = parseFloat(newHeight);
      setToolState((prevState) => ({
        ...prevState,
        height: newHeight,
        ratio: !isNaN(numHeight) && prevState.width.trim() !== ''
          ? calculateRatio(parseFloat(prevState.width), numHeight)
          : '',
        ratioHeight: isNaN(numHeight) ? null : numHeight,
      }));
      setUiError(null);
      setCopySuccess(false);
    },
    [setToolState]
  );

  const handleClear = useCallback(() => {
    setToolState(DEFAULT_ASPECT_RATIO_STATE);
    setUiError(null);
    setCopySuccess(false);
  }, [setToolState]);

  const handleCopy = useCallback(async () => {
    if (!toolState.ratio) {
      setUiError('No ratio to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(toolState.ratio);
      setCopySuccess(true);
      setUiError(null);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setUiError(
        err instanceof Error ? err.message : 'Failed to copy to clipboard.'
      );
    }
  }, [toolState.ratio, setUiError, setCopySuccess]);

  const isLoading = isLoadingState || isLoadingUrlState;

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          type="number"
          id="width-input"
          label="Width"
          value={toolState.width}
          onChange={handleWidthChange}
          placeholder="Enter width"
          min="0"
          aria-label="Width input"
          disabled={isLoading}
        />
        <Input
          type="number"
          id="height-input"
          label="Height"
          value={toolState.height}
          onChange={handleHeightChange}
          placeholder="Enter height"
          min="0"
          aria-label="Height input"
          disabled={isLoading}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label
            className="block text-sm font-medium text-[rgb(var(--color-text-muted))] whitespace-nowrap"
          >
            Aspect Ratio:
          </label>
          <span className="text-xl font-mono text-[rgb(var(--color-text-base))]">
            {toolState.ratio}
          </span>
        </div>
        {toolState.ratioWidth && toolState.ratioHeight && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            {safeStringify({
              width: toolState.ratioWidth,
              height: toolState.ratioHeight,
            })}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-4">
        <Button variant="neutral" onClick={handleClear} disabled={isLoading}>
          Clear
        </Button>
        <Button
          variant="accent2"
          onClick={handleCopy}
          disabled={isLoading || copySuccess}
          iconLeft={
            copySuccess ? (
              <CheckIcon className="h-5 w-5" />
            ) : (
              <ClipboardDocumentIcon className="h-5 w-5" />
            )
          }
          title={copySuccess ? 'Copied!' : 'Copy Aspect Ratio'}
        >
          Copy
        </Button>
      </div>
      {uiError && (
        <div
          role="alert"
          className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2"
        >
          <XCircleIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {uiError}
        </div>
      )}
    </div>
  );
}
