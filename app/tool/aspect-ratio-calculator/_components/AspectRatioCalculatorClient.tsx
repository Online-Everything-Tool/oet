'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import useToolState from '../../_hooks/useToolState';
import useToolUrlState from '../../_hooks/useToolUrlState';
import { useAspectRatioCalculations, CalculatedAspectRatio } from '../_hooks/useAspectRatioCalculations';
import Input from '../../_components/form/Input';
import Button from '../../_components/form/Button';
import type { ParamConfig } from '@/src/types/tools';
import { useDebouncedCallback } from 'use-debounce';
import { XCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface AspectRatioToolState {
  width: number;
  height: number;
}

const DEFAULT_TOOL_STATE: AspectRatioToolState = {
  width: 1920,
  height: 1080,
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
    setState: setPersistedState,
    isLoadingState: isLoadingToolState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<AspectRatioToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const { urlState, isLoadingUrlState, urlParamsLoaded, urlProvidedAnyValue } =
    useToolUrlState(urlStateParams);

  const [widthStr, setWidthStr] = useState<string>(String(DEFAULT_TOOL_STATE.width));
  const [heightStr, setHeightStr] = useState<string>(String(DEFAULT_TOOL_STATE.height));
  const [inputError, setInputError] = useState<string | null>(null);

  const calculatedRatios = useAspectRatioCalculations(toolState.width, toolState.height);

  // Initialize from URL state or persisted state
  useEffect(() => {
    if (isLoadingToolState || isLoadingUrlState) return;

    let initialWidth = toolState.width;
    let initialHeight = toolState.height;

    if (urlParamsLoaded && urlProvidedAnyValue) {
      const urlWidth = typeof urlState.width === 'number' ? Number(urlState.width) : null;
      const urlHeight = typeof urlState.height === 'number' ? Number(urlState.height) : null;

      if (urlWidth !== null && urlWidth > 0) {
        initialWidth = urlWidth;
      }
      if (urlHeight !== null && urlHeight > 0) {
        initialHeight = urlHeight;
      }
      
      // If URL params were used, update persisted state if it was default
      if (initialWidth !== toolState.width || initialHeight !== toolState.height) {
         setPersistedState({ width: initialWidth, height: initialHeight });
      }
    }
    
    setWidthStr(String(initialWidth));
    setHeightStr(String(initialHeight));

  }, [
    isLoadingToolState, 
    isLoadingUrlState, 
    urlParamsLoaded, 
    urlProvidedAnyValue, 
    urlState, 
    toolState.width, 
    toolState.height,
    setPersistedState // Added setPersistedState
  ]);


  const debouncedUpdatePersistedState = useDebouncedCallback(
    (newWidth: number, newHeight: number) => {
      setPersistedState({ width: newWidth, height: newHeight });
    },
    DEBOUNCE_MS
  );

  useEffect(() => {
    const newWidthNum = parseInt(widthStr, 10);
    const newHeightNum = parseInt(heightStr, 10);
    let currentError: string | null = null;

    if (widthStr !== '' && (isNaN(newWidthNum) || newWidthNum <= 0)) {
      currentError = "Width must be a positive number.";
    } else if (heightStr !== '' && (isNaN(newHeightNum) || newHeightNum <= 0)) {
      currentError = "Height must be a positive number.";
    }
    
    if ((widthStr === '' || isNaN(newWidthNum) || newWidthNum <=0) && (heightStr === '' || isNaN(newHeightNum) || newHeightNum <=0)) {
        currentError = "Please enter a valid width or height.";
    }

    setInputError(currentError);

    if (!currentError) {
      const validWidth = (widthStr !== '' && newWidthNum > 0) ? newWidthNum : 0;
      const validHeight = (heightStr !== '' && newHeightNum > 0) ? newHeightNum : 0;
      
      if (validWidth > 0 || validHeight > 0) {
         if (validWidth !== toolState.width || validHeight !== toolState.height) {
            debouncedUpdatePersistedState(validWidth, validHeight);
         }
      } else {
        // If both are invalid or empty, but no specific error yet (e.g. both empty),
        // we might want to clear persisted state or set to 0,0
        if (toolState.width !== 0 || toolState.height !== 0) {
           debouncedUpdatePersistedState(0,0);
        }
      }
    }
  }, [widthStr, heightStr, toolState.width, toolState.height, debouncedUpdatePersistedState]);

  const handleClear = useCallback(async () => {
    await clearStateAndPersist();
    setWidthStr(String(DEFAULT_TOOL_STATE.width));
    setHeightStr(String(DEFAULT_TOOL_STATE.height));
    setInputError(null);
  }, [clearStateAndPersist]);

  if (isLoadingToolState && !urlParamsLoaded) {
     return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Aspect Ratio Calculator...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <Input
          label="Original Width"
          type="number"
          id="originalWidth"
          value={widthStr}
          onChange={(e) => setWidthStr(e.target.value)}
          placeholder="e.g., 1920"
          min="1"
          inputClassName={inputError && (widthStr !== '' && (isNaN(parseInt(widthStr,10)) || parseInt(widthStr,10) <=0)) ? 'border-[rgb(var(--color-border-error))]' : ''}
        />
        <Input
          label="Original Height"
          type="number"
          id="originalHeight"
          value={heightStr}
          onChange={(e) => setHeightStr(e.target.value)}
          placeholder="e.g., 1080"
          min="1"
          inputClassName={inputError && (heightStr !== '' && (isNaN(parseInt(heightStr,10)) || parseInt(heightStr,10) <=0)) ? 'border-[rgb(var(--color-border-error))]' : ''}
        />
        <div className="mt-0 md:mt-7">
          <Button
            variant="neutral"
            onClick={handleClear}
            iconLeft={<XCircleIcon className="h-5 w-5" />}
            fullWidth
          >
            Clear / Reset
          </Button>
        </div>
      </div>

      {inputError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-center gap-2">
          <InformationCircleIcon className="h-5 w-5" aria-hidden="true" />
          {inputError}
        </div>
      )}

      {!inputError && (toolState.width > 0 || toolState.height > 0) && (
        <div>
          <h2 className="text-xl font-semibold mb-3 text-[rgb(var(--color-text-base))]">Calculated Ratios</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {calculatedRatios.map((ratio, index) => (
              <div key={index} className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-component))] shadow-sm">
                <h3 className="text-lg font-medium text-[rgb(var(--color-text-link))]">{ratio.name}</h3>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-1">{ratio.ratioDisplayText}</p>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">{ratio.description}</p>
                
                <div className="space-y-2 text-sm">
                  {ratio.maintainingOriginalWidth && (
                    <div>
                      <p className="font-semibold">Keep Width ({ratio.maintainingOriginalWidth.width}px):</p>
                      <p className="font-mono">{ratio.maintainingOriginalWidth.width} x {ratio.maintainingOriginalWidth.height}</p>
                    </div>
                  )}
                  {ratio.maintainingOriginalHeight && (
                     <div>
                      <p className="font-semibold">Keep Height ({ratio.maintainingOriginalHeight.height}px):</p>
                      <p className="font-mono">{ratio.maintainingOriginalHeight.width} x {ratio.maintainingOriginalHeight.height}</p>
                    </div>
                  )}
                  {!ratio.maintainingOriginalWidth && !ratio.maintainingOriginalHeight && (
                    <p className="italic text-[rgb(var(--color-text-muted))]">Enter original width or height to calculate.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
       { !inputError && toolState.width <= 0 && toolState.height <= 0 && calculatedRatios.length === 0 && (
        <div className="text-center p-8 border-2 border-dashed border-[rgb(var(--color-border-base))] rounded-md">
            <p className="text-lg text-[rgb(var(--color-text-muted))]">
                Enter a width or height to see calculations.
            </p>
        </div>
      )}
    </div>
  );
}