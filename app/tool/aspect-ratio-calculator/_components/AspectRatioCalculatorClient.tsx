'use client';

import React, { useState, useCallback, useMemo } from 'react';
import useToolState from '../../_hooks/useToolState';
import Input from '../../_components/form/Input';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import { ToolMetadata } from '@/src/types/tools';
import importedMetadata from '../metadata.json';
import { XCircleIcon } from '@heroicons/react/24/solid';

const metadata = importedMetadata as ToolMetadata;

interface AspectRatioCalculatorState {
  width: string;
  height: string;
}

const DEFAULT_STATE: AspectRatioCalculatorState = {
  width: '',
  height: '',
};

interface AspectRatio {
  width: number;
  height: number;
  string: string;
}

const calculateAspectRatios = (width: number, height: number): AspectRatio[] => {
  if (width <= 0 || height <= 0) {
    return [];
  }

  const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b);
  };

  const commonDivisor = gcd(width, height);
  return [
    {
      width,
      height,
      string: `${width}x${height}`,
    },
    {
      width: width / commonDivisor,
      height: height / commonDivisor,
      string: `${width / commonDivisor}:${height / commonDivisor}`,
    },
  ];
};

const AspectRatioCalculatorClient: React.FC<{ toolRoute: string }> = ({
  toolRoute,
}) => {
  const {
    state: toolState,
    setState,
    isLoadingState,
    clearStateAndPersist: clearToolState,
  } = useToolState<AspectRatioCalculatorState>(toolRoute, DEFAULT_STATE);

  const [error, setError] = useState<string | null>(null);

  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState({ width: e.target.value });
    },
    [setState]
  );

  const handleHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState({ height: e.target.value });
    },
    [setState]
  );

  const handleClear = useCallback(() => {
    clearToolState();
    setError(null);
  }, [clearToolState]);

  const aspectRatios = useMemo(() => {
    const width = parseInt(toolState.width, 10);
    const height = parseInt(toolState.height, 10);

    if (isNaN(width) || isNaN(height)) {
      if (toolState.width !== '' || toolState.height !== '') {
        setError('Please enter valid numbers for width and height.');
      } else {
        setError(null);
      }
      return [];
    }
    setError(null);
    return calculateAspectRatios(width, height);
  }, [toolState.width, toolState.height]);

  const directiveName = metadata.directive;
  const canPerformOutputActionsOverall =
    aspectRatios.length > 0 && !isLoadingState;

  if (isLoadingState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Aspect Ratio Calculator...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="flex flex-wrap gap-x-4 gap-y-3 items-center">
          <Input
            label="Width (px)"
            type="number"
            value={toolState.width}
            onChange={handleWidthChange}
            error={error}
            containerClassName="w-full md:w-auto flex-grow"
          />
          <Input
            label="Height (px)"
            type="number"
            value={toolState.height}
            onChange={handleHeightChange}
            error={error}
            containerClassName="w-full md:w-auto flex-grow"
          />
        </div>
        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-gray-200 mt-2 justify-end">
          <OutputActionButtons
            canPerform={canPerformOutputActionsOverall}
            isSaveSuccess={false}
            isDownloadSuccess={false}
            onInitiateSave={() => {}}
            onInitiateDownload={() => {}}
            onCopy={() => {}}
            onClear={handleClear}
            directiveName={directiveName}
            outputConfig={metadata.outputConfig}
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <XCircleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        </div>
      )}

      {aspectRatios.length > 0 && (
        <div className="border border-[rgb(var(--color-border-base))] rounded-md bg-white p-4">
          <h2 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-base))]">
            Calculated Aspect Ratios:
          </h2>
          <ul className="list-disc pl-5">
            {aspectRatios.map((ratio) => (
              <li key={ratio.string} className="text-[rgb(var(--color-text-base))]">
                {ratio.string}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};


export default AspectRatioCalculatorClient