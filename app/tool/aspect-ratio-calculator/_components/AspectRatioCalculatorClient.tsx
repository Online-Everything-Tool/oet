'use client';

import React, { useState, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import useToolState from '../../_hooks/useToolState';
import useToolUrlState from '../../_hooks/useToolUrlState';
import { useAspectRatioCalculations, CalculatedRatioResult } from '../_hooks/useAspectRatioCalculations';
import Input from '../../_components/form/Input';
import Button from '../../_components/form/Button';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import importedMetadata from '../metadata.json';
import { XCircleIcon } from '@heroicons/react/24/solid';

const metadata = importedMetadata as unknown as ToolMetadata;

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
    setToolState(prev => ({ ...prev, inputWidth: e.target.value }));
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToolState(prev => ({ ...prev, inputHeight: e.target.value }));
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
    // ... rest of the component
  );
}
