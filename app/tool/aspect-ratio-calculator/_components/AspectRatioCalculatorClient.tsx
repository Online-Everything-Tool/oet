'use client';

import React, { useState, useCallback, useMemo } from 'react';
import useToolState from '../../_hooks/useToolState';
import Button from '../../_components/form/Button';
import Input from '../../_components/form/Input';
import Select from '../../_components/form/Select';
import { ToolMetadata } from '@/src/types/tools';
import importedMetadata from '../metadata.json';
import { XCircleIcon } from '@heroicons/react/24/solid';

const metadata = importedMetadata as ToolMetadata;

interface AspectRatioCalculatorState {
  originalWidth: string;
  originalHeight: string;
  newWidth: string;
  newHeight: string;
  aspectRatio: string;
  selectedRatio: string;
}

const DEFAULT_STATE: AspectRatioCalculatorState = {
  originalWidth: '',
  originalHeight: '',
  newWidth: '',
  newHeight: '',
  aspectRatio: '',
  selectedRatio: '',
};

interface AspectRatioCalculatorClientProps {
  toolRoute: string;
}

const commonRatios = [
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
  { value: '3:2', label: '3:2' },
];

export default function AspectRatioCalculatorClient({
  toolRoute,
}: AspectRatioCalculatorClientProps) {
  const { state, setState, isLoadingState, clearStateAndPersist } =
    useToolState<AspectRatioCalculatorState>(toolRoute, DEFAULT_STATE);

  const [error, setError] = useState<string | null>(null);

  const calculateAspectRatio = useCallback(() => {
    const originalWidth = parseFloat(state.originalWidth);
    const originalHeight = parseFloat(state.originalHeight);

    if (isNaN(originalWidth) || isNaN(originalHeight) || originalWidth <= 0 || originalHeight <= 0) {
      setError('Please enter valid original dimensions.');
      return;
    }

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const commonDivisor = gcd(originalWidth, originalHeight);
    const ratio = `${originalWidth / commonDivisor}:${originalHeight / commonDivisor}`;

    setState({ aspectRatio: ratio });
    setError(null);
  }, [state.originalWidth, state.originalHeight, setState]);

  const calculateNewDimension = useCallback(() => {
    const originalWidth = parseFloat(state.originalWidth);
    const originalHeight = parseFloat(state.originalHeight);

    if (isNaN(originalWidth) || isNaN(originalHeight) || originalWidth <= 0 || originalHeight <= 0) {
      setError('Please enter valid original dimensions.');
      return;
    }
    setError(null);

    const newWidth = parseFloat(state.newWidth);
    const newHeight = parseFloat(state.newHeight);

    if (!isNaN(newWidth) && newWidth > 0) {
      const calculatedHeight = (originalHeight / originalWidth) * newWidth;
      setState({ newHeight: calculatedHeight.toString() });
    } else if (!isNaN(newHeight) && newHeight > 0) {
      const calculatedWidth = (originalWidth / originalHeight) * newHeight;
      setState({ newWidth: calculatedWidth.toString() });
    } else {
      setError('Please enter a new width OR height.');
    }
  }, [state.originalWidth, state.originalHeight, state.newWidth, state.newHeight, setState]);


  const calculateFromRatio = useCallback(() => {
    if (!state.selectedRatio || !commonRatios.find(r => r.value === state.selectedRatio)) {
      setError('Please select a common aspect ratio.');
      return;
    }
    setError(null);

    const [ratioWidth, ratioHeight] = state.selectedRatio.split(':').map(Number);
    const newWidth = parseFloat(state.newWidth);
    const newHeight = parseFloat(state.newHeight);

    if (!isNaN(newWidth) && newWidth > 0) {
      const calculatedHeight = (ratioHeight / ratioWidth) * newWidth;
      setState({ newHeight: calculatedHeight.toString() });
    } else if (!isNaN(newHeight) && newHeight > 0) {
      const calculatedWidth = (ratioWidth / ratioHeight) * newHeight;
      setState({ newWidth: calculatedWidth.toString() });
    } else {
      setError('Please enter a width OR height.');
    }
  }, [state.selectedRatio, state.newWidth, state.newHeight, setState]);

  const handleClear = useCallback(async () => {
    await clearStateAndPersist();
    setError(null);
  }, [clearStateAndPersist]);

  if (isLoadingState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Aspect Ratio Calculator...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="p-4 border rounded-md bg-white">
        <Input
          label="Original Width"
          type="number"
          value={state.originalWidth}
          onChange={(e) => setState({ originalWidth: e.target.value })}
          containerClassName="mb-2"
        />
        <Input
          label="Original Height"
          type="number"
          value={state.originalHeight}
          onChange={(e) => setState({ originalHeight: e.target.value })}
          containerClassName="mb-2"
        />
        <Button variant="primary" onClick={calculateAspectRatio}>
          Calculate Aspect Ratio
        </Button>

        {state.aspectRatio && (
          <div className="mt-2">
            <p className="font-semibold">Aspect Ratio: {state.aspectRatio}</p>
          </div>
        )}

        <div className="mt-4 border-t border-gray-200 pt-4">
          <Input
            label="New Width"
            type="number"
            value={state.newWidth}
            onChange={(e) => setState({ newWidth: e.target.value, newHeight: '' })}
            containerClassName="mb-2"
          />
          <Input
            label="New Height"
            type="number"
            value={state.newHeight}
            onChange={(e) => setState({ newHeight: e.target.value, newWidth: '' })}
            containerClassName="mb-2"
          />
          <Button variant="secondary" onClick={calculateNewDimension}>
            Calculate New Dimension
          </Button>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4">
          <Select
            label="Common Aspect Ratio"
            value={state.selectedRatio}
            onChange={(e) => setState({ selectedRatio: e.target.value })}
            options={commonRatios}
            placeholder="Select a ratio"
            containerClassName="mb-2"
          />
          <Input
            label="Width or Height"
            type="number"
            value={state.newWidth || state.newHeight}
            onChange={(e) => {
              if (!isNaN(parseFloat(state.newWidth))) {
                setState({ newWidth: e.target.value });
              } else {
                setState({ newHeight: e.target.value });
              }
            }}
            containerClassName="mb-2"
          />
          <Button variant="secondary" onClick={calculateFromRatio}>
            Calculate from Ratio
          </Button>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="neutral" onClick={handleClear} iconLeft={<XCircleIcon className="h-5 w-5" />}>
            Clear
          </Button>
        </div>
      </div>
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          <p><XCircleIcon className="h-5 w-5 inline-block mr-2" />{error}</p>
        </div>
      )}
    </div>
  );
}