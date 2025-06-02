'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import useToolState from '../../_hooks/useToolState';
import Input from '../../_components/form/Input';
import Select from '../../_components/form/Select';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import { ToolMetadata } from '@/src/types/tools';
import importedMetadata from '../metadata.json';
import { useDebounce } from 'use-debounce';

const metadata = importedMetadata as ToolMetadata;

interface AspectRatioCalculatorState {
  originalWidth: string;
  originalHeight: string;
  newWidth: string;
  newHeight: string;
  aspectRatio: string;
  selectedAspectRatio: string;
}

const DEFAULT_STATE: AspectRatioCalculatorState = {
  originalWidth: '',
  originalHeight: '',
  newWidth: '',
  newHeight: '',
  aspectRatio: '',
  selectedAspectRatio: '',
};

const commonAspectRatios = [
  { value: '', label: 'Custom' },
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
  { value: '3:2', label: '3:2' },
];

const AspectRatioCalculatorClient = ({ toolRoute }: { toolRoute: string }) => {
  const { state, setState } = useToolState(toolRoute, DEFAULT_STATE);
  const [debouncedState, setDebouncedState] = useDebounce(state, 300);

  const calculateAspectRatio = useCallback(() => {
    const originalWidth = parseFloat(debouncedState.originalWidth);
    const originalHeight = parseFloat(debouncedState.originalHeight);

    if (
      isNaN(originalWidth) ||
      isNaN(originalHeight) ||
      originalWidth <= 0 ||
      originalHeight <= 0
    ) {
      setState((prev) => ({ ...prev, aspectRatio: '' }));
      return;
    }

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(originalWidth, originalHeight);
    const ratio = `${originalWidth / divisor}:${originalHeight / divisor}`;
    setState((prev) => ({ ...prev, aspectRatio: ratio }));
  }, [debouncedState.originalWidth, debouncedState.originalHeight, setState]);

  const calculateNewDimension = useCallback(() => {
    const originalWidth = parseFloat(debouncedState.originalWidth);
    const originalHeight = parseFloat(debouncedState.originalHeight);

    if (debouncedState.selectedAspectRatio) {
      const [w, h] = debouncedState.selectedAspectRatio.split(':').map(parseFloat);
      if (debouncedState.newWidth) {
        const newWidth = parseFloat(debouncedState.newWidth);
        const newHeight = (newWidth * h) / w;
        setState((prev) => ({ ...prev, newHeight: isNaN(newHeight) ? '' : String(newHeight) }));
      } else if (debouncedState.newHeight) {
        const newHeight = parseFloat(debouncedState.newHeight);
        const newWidth = (newHeight * w) / h;
        setState((prev) => ({ ...prev, newWidth: isNaN(newWidth) ? '' : String(newWidth) }));
      }
      return;
    }

    if (
      isNaN(originalWidth) ||
      isNaN(originalHeight) ||
      originalWidth <= 0 ||
      originalHeight <= 0
    ) {
      setState((prev) => ({ ...prev, newWidth: '', newHeight: '' }));
      return;
    }

    if (debouncedState.newWidth) {
      const newWidth = parseFloat(debouncedState.newWidth);
      if (isNaN(newWidth) || newWidth <= 0) {
        setState((prev) => ({ ...prev, newHeight: '' }));
        return;
      }
      const newHeight = (newWidth * originalHeight) / originalWidth;
      setState((prev) => ({ ...prev, newHeight: isNaN(newHeight) ? '' : String(newHeight) }));
    } else if (debouncedState.newHeight) {
      const newHeight = parseFloat(debouncedState.newHeight);
      if (isNaN(newHeight) || newHeight <= 0) {
        setState((prev) => ({ ...prev, newWidth: '' }));
        return;
      }
      const newWidth = (newHeight * originalWidth) / originalHeight;
      setState((prev) => ({ ...prev, newWidth: isNaN(newWidth) ? '' : String(newWidth) }));
    } else {
      setState((prev) => ({ ...prev, newWidth: '', newHeight: '' }));
    }
  }, [debouncedState, setState]);

  useEffect(() => {
    calculateAspectRatio();
    calculateNewDimension();
  }, [debouncedState, calculateAspectRatio, calculateNewDimension]);

  const directiveName = metadata.directive;
  const outputConfig = metadata.outputConfig;

  const handleInputChange = (field: keyof AspectRatioCalculatorState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setState((prev) => ({ ...prev, selectedAspectRatio: e.target.value, newWidth: '', newHeight: '' }));
  };

  const handleClear = useCallback(() => {
    setState(DEFAULT_STATE);
  }, [setState]);

  const canPerformOutputActions = useMemo(() => !!state.aspectRatio, [state.aspectRatio]);

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Original Width" type="number" value={state.originalWidth} onChange={handleInputChange('originalWidth')} />
        <Input label="Original Height" type="number" value={state.originalHeight} onChange={handleInputChange('originalHeight')} />
      </div>
      <div>
        <Select
          label="Common Aspect Ratios"
          options={commonAspectRatios}
          value={state.selectedAspectRatio}
          onChange={handleSelectChange}
          placeholder="Select a common aspect ratio"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="New Width" type="number" value={state.newWidth} onChange={handleInputChange('newWidth')} />
        <Input label="New Height" type="number" value={state.newHeight} onChange={handleInputChange('newHeight')} />
      </div>
      <div className="flex justify-between items-center border-t border-[rgb(var(--color-border-base))] pt-4 mt-1">
        <div className="text-lg font-medium">Aspect Ratio: {state.aspectRatio}</div>
        <OutputActionButtons
          canPerform={canPerformOutputActions}
          isSaveSuccess={false}
          isDownloadSuccess={false}
          onInitiateSave={() => {}}
          onInitiateDownload={() => {}}
          onCopy={() => {
            navigator.clipboard.writeText(state.aspectRatio);
          }}
          onClear={handleClear}
          directiveName={directiveName}
          outputConfig={outputConfig}
        />
      </div>
    </div>
  );
};

export default AspectRatioCalculatorClient;