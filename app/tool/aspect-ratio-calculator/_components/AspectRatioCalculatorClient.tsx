'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import useToolState from '@/app/tool/_hooks/useToolState';
import useToolUrlState from '@/app/tool/_hooks/useToolUrlState';
import Input from '@/app/tool/_components/form/Input';
import Button from '@/app/tool/_components/form/Button';
import { XCircleIcon } from '@heroicons/react/24/outline';
import type { ParamConfig } from '@/src/types/tools';
import { useAspectRatioDefinitions, RatioConfig, ParsedRatio } from '../_hooks/useAspectRatioDefinitions';
import CalculatedRatioDisplay from './CalculatedRatioDisplay';

interface AspectRatioToolState {
  widthInput: string;
  heightInput: string;
}

const DEFAULT_TOOL_STATE: AspectRatioToolState = {
  widthInput: '',
  heightInput: '',
};

const DEBOUNCE_CALCULATION_MS = 300;

interface AspectRatioCalculatorClientProps {
  urlStateParams?: ParamConfig[];
  toolRoute: string;
}

export default function AspectRatioCalculatorClient({
  urlStateParams,
  toolRoute,
}: AspectRatioCalculatorClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolSettings,
    clearStateAndPersist,
  } = useToolState<AspectRatioToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const { urlState, isLoadingUrlState, urlProvidedAnyValue } = useToolUrlState(urlStateParams);

  const [parsedWidth, setParsedWidth] = useState<number | null>(null);
  const [parsedHeight, setParsedHeight] = useState<number | null>(null);
  const [inputError, setInputError] = useState<string>('');

  const { categorizedRatioConfigs, calculateOutputDimensions } = useAspectRatioDefinitions();

  useEffect(() => {
    if (!isLoadingUrlState && urlProvidedAnyValue && !isLoadingToolSettings) {
      let widthFromUrl = '';
      if (typeof urlState.width === 'number' && urlState.width > 0) {
        widthFromUrl = String(urlState.width);
      }
      let heightFromUrl = '';
      if (typeof urlState.height === 'number' && urlState.height > 0) {
        heightFromUrl = String(urlState.height);
      }

      if (widthFromUrl !== toolState.widthInput || heightFromUrl !== toolState.heightInput) {
         // Only update if URL actually provides values and they differ from current state
        if ((widthFromUrl && widthFromUrl !== toolState.widthInput) || (heightFromUrl && heightFromUrl !== toolState.heightInput)) {
            setToolState(prevState => ({
                ...prevState,
                widthInput: widthFromUrl || prevState.widthInput,
                heightInput: heightFromUrl || prevState.heightInput,
            }));
        }
      }
    }
  }, [urlState, isLoadingUrlState, urlProvidedAnyValue, isLoadingToolSettings, setToolState, toolState.widthInput, toolState.heightInput]);


  const debouncedParseAndValidateInputs = useDebouncedCallback(() => {
    let w: number | null = null;
    let h: number | null = null;
    let currentError = '';

    if (toolState.widthInput.trim() !== '') {
      const numW = parseFloat(toolState.widthInput);
      if (isNaN(numW) || numW <= 0) {
        currentError += 'Width must be a positive number. ';
      } else {
        w = numW;
      }
    }

    if (toolState.heightInput.trim() !== '') {
      const numH = parseFloat(toolState.heightInput);
      if (isNaN(numH) || numH <= 0) {
        currentError += 'Height must be a positive number.';
      } else {
        h = numH;
      }
    }
    
    if (toolState.widthInput.trim() === '' && toolState.heightInput.trim() === '') {
        // Both empty, clear error and parsed values
        currentError = '';
    }


    setInputError(currentError.trim());
    setParsedWidth(w);
    setParsedHeight(h);
  }, DEBOUNCE_CALCULATION_MS);

  useEffect(() => {
    if (!isLoadingToolSettings) {
        debouncedParseAndValidateInputs();
    }
  }, [toolState.widthInput, toolState.heightInput, isLoadingToolSettings, debouncedParseAndValidateInputs]);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToolState({ widthInput: e.target.value });
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToolState({ heightInput: e.target.value });
  };

  const handleClear = async () => {
    await clearStateAndPersist();
    setParsedWidth(null);
    setParsedHeight(null);
    setInputError('');
  };
  
  const categoryOrder = useMemo(() => [
    "Common Screen & Video",
    "Mobile & Vertical",
    "Social Media & Square",
    "Ultrawide & Cinematic Monitors",
    "Cinema",
    "Photography",
    "Other", // Fallback for any uncategorized
  ], []);


  if (isLoadingToolSettings && !isLoadingUrlState) {
    return <p className="text-center p-4">Loading Aspect Ratio Calculator...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-subtle))] shadow-sm">
        <div className="flex items-end">
        <div className="flex-1 flex flex-wrap gap-4 justify-center">
          <Input
            label="Original Width (px)"
            id="originalWidth"
            type="number"
            value={toolState.widthInput}
            onChange={handleWidthChange}
            placeholder="e.g., 1920"
            min="1"
            error={inputError.includes('Width') ? inputError : null}
          />
          <Input
            label="Original Height (px)"
            id="originalHeight"
            type="number"
            value={toolState.heightInput}
            onChange={handleHeightChange}
            placeholder="e.g., 1080"
            min="1"
            error={inputError.includes('Height') ? inputError : null}
          />
        </div>
        <div className="flex-0">
          <Button 
            onClick={handleClear} 
            variant="neutral" 
            iconLeft={<XCircleIcon className="h-5 w-5" />}
          >
            Clear
          </Button>
        </div>
        </div>
        {inputError && (
          <p className="mt-2 text-sm text-[rgb(var(--color-text-error))]">{inputError}</p>
        )}
      </div>

      {(!parsedWidth && !parsedHeight && !inputError) && (
         <p className="text-center text-gray-500 italic">Enter a width and/or height to see calculations.</p>
      )}

      {(parsedWidth || parsedHeight) && !inputError && (
        <div className="space-y-6">
          {categoryOrder.map(categoryName => {
            const ratiosInCategory = categorizedRatioConfigs[categoryName];
            if (!ratiosInCategory || ratiosInCategory.length === 0) return null;

            return (
              <div key={categoryName}>
                <h2 className="text-xl font-semibold mb-3 text-[rgb(var(--color-text-base))] border-b border-[rgb(var(--color-border-base))] pb-1">
                  {categoryName}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ratiosInCategory.map((ratioConf) => {
                    if (!ratioConf.parsedRatio) return null;
                    
                    const calcFromW = parsedWidth
                      ? calculateOutputDimensions(parsedWidth, 'width', ratioConf.parsedRatio)
                      : null;
                    const calcFromH = parsedHeight
                      ? calculateOutputDimensions(parsedHeight, 'height', ratioConf.parsedRatio)
                      : null;

                    return (
                      <CalculatedRatioDisplay
                        key={ratioConf.id}
                        ratioConfig={ratioConf}
                        calculatedFromInputWidth={calcFromW}
                        calculatedFromInputHeight={calcFromH}
                        originalInputWidth={parsedWidth}
                        originalInputHeight={parsedHeight}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}