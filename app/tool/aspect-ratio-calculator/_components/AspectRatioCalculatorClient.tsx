'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Input from '../../_components/form/Input';
import Select from '../../_components/form/Select';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import { ToolMetadata, OutputConfig } from '@/src/types/tools';
import importedMetadata from '../metadata.json';

const metadata = importedMetadata as ToolMetadata;

interface AspectRatioCalculatorState {
  originalWidth: string;
  originalHeight: string;
  newWidth: string;
  newHeight: string;
  aspectRatio: string;
  commonAspectRatio: string;
}

const DEFAULT_STATE: AspectRatioCalculatorState = {
  originalWidth: '',
  originalHeight: '',
  newWidth: '',
  newHeight: '',
  aspectRatio: '',
  commonAspectRatio: '16:9',
};

interface AspectRatioCalculatorClientProps {
  toolRoute: string;
}


const commonAspectRatios = [
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
  { value: '3:2', label: '3:2' },
];

export default function AspectRatioCalculatorClient({ toolRoute }: AspectRatioCalculatorClientProps) {
  const [state, setState] = useState<AspectRatioCalculatorState>(DEFAULT_STATE);
  const directiveName = metadata.directive;
  const outputConfig = metadata.outputConfig;


  const calculateAspectRatio = useCallback(() => {
    const originalWidth = parseFloat(state.originalWidth);
    const originalHeight = parseFloat(state.originalHeight);

    if (isNaN(originalWidth) || isNaN(originalHeight) || originalWidth <= 0 || originalHeight <= 0) {
      setState(prev => ({ ...prev, aspectRatio: '' }));
      return;
    }

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const commonDivisor = gcd(originalWidth, originalHeight);
    const ratio = `${originalWidth / commonDivisor}:${originalHeight / commonDivisor}`;

    setState(prev => ({ ...prev, aspectRatio: ratio }));
  }, [state.originalWidth, state.originalHeight]);

  const calculateNewDimension = useCallback(() => {
    const originalWidth = parseFloat(state.originalWidth);
    const originalHeight = parseFloat(state.originalHeight);

    if (isNaN(originalWidth) || isNaN(originalHeight) || originalWidth <= 0 || originalHeight <= 0) {
      return;
    }

    if (state.newWidth !== '') {
      const newWidth = parseFloat(state.newWidth);
      if (!isNaN(newWidth) && newWidth > 0) {
        const newHeight = (originalHeight / originalWidth) * newWidth;
        setState(prev => ({ ...prev, newHeight: newHeight.toString() }));
      }
    } else if (state.newHeight !== '') {
      const newHeight = parseFloat(state.newHeight);
      if (!isNaN(newHeight) && newHeight > 0) {
        const newWidth = (originalWidth / originalHeight) * newHeight;
        setState(prev => ({ ...prev, newWidth: newWidth.toString() }));
      }
    }
  }, [state.originalWidth, state.originalHeight, state.newWidth, state.newHeight]);

  const calculateFromCommonRatio = useCallback(() => {
    const [widthRatio, heightRatio] = state.commonAspectRatio.split(':').map(Number);

    if (state.newWidth !== '') {
      const newWidth = parseFloat(state.newWidth);
      if (!isNaN(newWidth) && newWidth > 0) {
        const newHeight = (heightRatio / widthRatio) * newWidth;
        setState(prev => ({ ...prev, newHeight: newHeight.toString() }));
      }
    } else if (state.newHeight !== '') {
      const newHeight = parseFloat(state.newHeight);
      if (!isNaN(newHeight) && newHeight > 0) {
        const newWidth = (widthRatio / heightRatio) * newHeight;
        setState(prev => ({ ...prev, newWidth: newWidth.toString() }));
      }
    }
  }, [state.commonAspectRatio, state.newWidth, state.newHeight]);

  useEffect(() => {
    calculateAspectRatio();
  }, [calculateAspectRatio]);

  useEffect(() => {
    calculateNewDimension();
  }, [calculateNewDimension]);

  useEffect(() => {
    calculateFromCommonRatio();
  }, [calculateFromCommonRatio]);



  const handleInputChange = useCallback((field: keyof AspectRatioCalculatorState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setState(prev => ({ ...prev, [field]: event.target.value }));
  }, []);

  const handleSelectChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setState(prev => ({ ...prev, commonAspectRatio: event.target.value }));
  }, []);

  const handleClear = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const hasOutputs = useMemo(() => state.aspectRatio !== '', [state.aspectRatio]);

  const itdeSendableItems = useMemo<StoredFile[]>(() => [], []);

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Original Width"
          type="number"
          value={state.originalWidth}
          onChange={handleInputChange('originalWidth')}
        />
        <Input
          label="Original Height"
          type="number"
          value={state.originalHeight}
          onChange={handleInputChange('originalHeight')}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="New Width"
          type="number"
          value={state.newWidth}
          onChange={handleInputChange('newWidth')}
        />
        <Input
          label="New Height"
          type="number"
          value={state.newHeight}
          onChange={handleInputChange('newHeight')}
        />
      </div>

      <div>
        <Select
          label="Common Aspect Ratio"
          options={commonAspectRatios}
          value={state.commonAspectRatio}
          onChange={handleSelectChange}
        />
        <div className="grid grid-cols-2 gap-4 mt-2">
          <Input
            label="Width"
            type="number"
            value={state.newWidth}
            onChange={handleInputChange('newWidth')}
          />
          <Input
            label="Height"
            type="number"
            value={state.newHeight}
            onChange={handleInputChange('newHeight')}
          />
        </div>

      </div>


      <div className="mt-4">
        <p>Aspect Ratio: {state.aspectRatio}</p>
      </div>

      <OutputActionButtons
        canPerform={hasOutputs}
        isSaveSuccess={false}
        isDownloadSuccess={false}
        onInitiateSave={() => { }}
        onInitiateDownload={() => { }}
        onClear={handleClear}
        directiveName={directiveName}
        outputConfig={outputConfig}
        selectedOutputItems={itdeSendableItems}
      />
    </div>
  );
}