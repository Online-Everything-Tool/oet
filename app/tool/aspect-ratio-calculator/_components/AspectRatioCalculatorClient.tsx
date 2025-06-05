'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebouncedCallback }
from 'use-debounce';
import useToolState from '../../_hooks/useToolState';
import useToolUrlState, { UrlStateObject } from '../../_hooks/useToolUrlState';
import { useAspectRatioCalculations, CalculatedRatioResult } from '../_hooks/useAspectRatioCalculations';
import Input from '../../_components/form/Input';
import Button from '../../_components/form/Button';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import importedMetadata from '../metadata.json';
import { XCircleIcon } from '@heroicons/react/24/solid';

const metadata = importedMetadata as ToolMetadata;

interface AspectRatioToolState {
  inputWidth: string;
  inputHeight: string;
  calculatedRatiosJson: string;
}

const DEFAULT_ASPECT_RATIO_TOOL_STATE: AspectRatioToolState = {
  inputWidth: '1920',
  inputHeight: '1080',
  calculatedRatiosJson: '',
};

const DEBOUNCE_MS = 500;

interface AspectRatioCalculatorClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function AspectRatioCalculatorClient({
  urlStateParams,
  toolRoute,
}: AspectRatioCalculatorClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<AspectRatioToolState>(toolRoute, DEFAULT_ASPECT_RATIO_TOOL_STATE);

  const { urlState, isLoadingUrlState, urlProvidedAnyValue } = useToolUrlState(urlStateParams);

  const [calculatedRatios, setCalculatedRatios] = useState<CalculatedRatioResult[]>([]);
  const [uiError, setUiError] = useState<string | null>(null);

  const { calculate: calculateRatiosHook } = useAspectRatioCalculations();

  // Effect to initialize state from URL params
  useEffect(() => {
    if (!isLoadingUrlState && urlProvidedAnyValue) {
      const updates: Partial<AspectRatioToolState> = {};
      if (urlState.width !== undefined && String(urlState.width) !== toolState.inputWidth) {
        updates.inputWidth = String(urlState.width);
      }
      if (urlState.height !== undefined && String(urlState.height) !== toolState.inputHeight) {
        updates.inputHeight = String(urlState.height);
      }
      if (Object.keys(updates).length > 0) {
        setToolState(prev => ({...prev, ...updates, calculatedRatiosJson: ''}));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingUrlState, urlState, urlProvidedAnyValue, setToolState]); // toolState.inputWidth/Height intentionally omitted to avoid loop with debounced updates

  const debouncedCalculate = useDebouncedCallback(
    (widthStr: string, heightStr: string) => {
      setUiError(null);
      const numWidth = parseFloat(widthStr);
      const numHeight = parseFloat(heightStr);

      if (isNaN(numWidth) || isNaN(numHeight) || numWidth <= 0 || numHeight <= 0) {
        if (widthStr.trim() !== '' || heightStr.trim() !== '') {
           setUiError('Please enter valid positive numbers for width and height.');
        }
        setCalculatedRatios([]);
        setToolState(prev => ({ ...prev, calculatedRatiosJson: '' }));
        return;
      }

      const results = calculateRatiosHook(numWidth, numHeight);
      setCalculatedRatios(results);
      setToolState(prev => ({ ...prev, calculatedRatiosJson: JSON.stringify(results) }));
    },
    DEBOUNCE_MS
  );

  useEffect(() => {
    if (!isLoadingState) {
       debouncedCalculate(toolState.inputWidth, toolState.inputHeight);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolState.inputWidth, toolState.inputHeight, isLoadingState]);


  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToolState({ inputWidth: e.target.value });
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToolState({ inputHeight: e.target.value });
  };
  
  const handleClear = async () => {
    await clearStateAndPersist();
    setCalculatedRatios([]);
    setUiError(null);
  };

  const handleBeforeSignal = async () => {
    await saveStateNow();
    return true;
  };


  if (isLoadingState && !urlProvidedAnyValue) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))]">Loading Aspect Ratio Calculator...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <Input
          label="Original Width"
          id="originalWidth"
          type="number"
          value={toolState.inputWidth}
          onChange={handleWidthChange}
          placeholder="e.g., 1920"
          min="1"
        />
        <Input
          label="Original Height"
          id="originalHeight"
          type="number"
          value={toolState.inputHeight}
          onChange={handleHeightChange}
          placeholder="e.g., 1080"
          min="1"
        />
        <div className="md:col-start-3 flex items-end gap-2">
           <Button
            variant="neutral"
            onClick={handleClear}
            iconLeft={<XCircleIcon className="h-5 w-5" />}
            className="w-full md:w-auto"
          >
            Clear
          </Button>
          <SendToToolButton
            currentToolDirective={metadata.directive}
            currentToolOutputConfig={metadata.outputConfig}
            onBeforeSignal={handleBeforeSignal}
            buttonText="Send Results"
            className="w-full md:w-auto"
          />
        </div>
      </div>

      {uiError && (
        <p className="text-sm text-[rgb(var(--color-text-error))] bg-[rgb(var(--color-bg-error-subtle))] p-3 rounded-md">
          {uiError}
        </p>
      )}

      {calculatedRatios.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[rgb(var(--color-border-base))] border border-[rgb(var(--color-border-base))] rounded-md">
            <thead className="bg-[rgb(var(--color-bg-subtle))]">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--color-text-muted))] uppercase tracking-wider">Name</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--color-text-muted))] uppercase tracking-wider hidden md:table-cell">Ratio</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--color-text-muted))] uppercase tracking-wider hidden lg:table-cell">Description</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--color-text-muted))] uppercase tracking-wider">Fit to Original Width</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--color-text-muted))] uppercase tracking-wider">Fit to Original Height</th>
              </tr>
            </thead>
            <tbody className="bg-[rgb(var(--color-bg-component))] divide-y divide-[rgb(var(--color-border-base))]">
              {calculatedRatios.map((ratio, index) => (
                <tr key={index} className={index % 2 === 0 ? undefined : 'bg-[rgb(var(--color-bg-subtle))]'}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[rgb(var(--color-text-base))]">{ratio.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-[rgb(var(--color-text-muted))] hidden md:table-cell">{ratio.targetRatio}</td>
                  <td className="px-4 py-3 text-sm text-[rgb(var(--color-text-muted))] hidden lg:table-cell max-w-xs truncate" title={ratio.description}>{ratio.description}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-[rgb(var(--color-text-base))]">
                    {ratio.basedOnOriginalWidth.width} x {ratio.basedOnOriginalWidth.height}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-[rgb(var(--color-text-base))]">
                    {ratio.basedOnOriginalHeight.width} x {ratio.basedOnOriginalHeight.height}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}