'use client';

import React from 'react';
import useToolState from '../../_hooks/useToolState';
import { useAspectRatioLogic } from '../_hooks/useAspectRatioLogic';
import Input from '../../_components/form/Input';
import Select from '../../_components/form/Select';
import RadioGroup from '../../_components/form/RadioGroup';
import Button from '../../_components/form/Button';
import { XCircleIcon } from '@heroicons/react/24/solid';
import type { ParamConfig } from '@/src/types/tools';
import { useDebouncedCallback } from 'use-debounce';

interface AspectRatioToolState {
  originalWidth: string;
  originalHeight: string;
  maintainTargetWidth: string;
  maintainTargetHeight: string;
  selectedCommonRatio: string;
  commonRatioGivenDimensionValue: string;
  commonRatioGivenDimensionType: 'width' | 'height';
  mode: 'maintain' | 'fromCommon';
}

const DEFAULT_TOOL_STATE: AspectRatioToolState = {
  originalWidth: '',
  originalHeight: '',
  maintainTargetWidth: '',
  maintainTargetHeight: '',
  selectedCommonRatio: '16:9',
  commonRatioGivenDimensionValue: '',
  commonRatioGivenDimensionType: 'width',
  mode: 'maintain',
};

const COMMON_RATIOS = [
  { value: '16:9', label: '16:9 (HD Video)' },
  { value: '4:3', label: '4:3 (Traditional TV)' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '3:2', label: '3:2 (Photography)' },
  { value: '16:10', label: '16:10 (Widescreen Monitor)' },
  { value: '21:9', label: '21:9 (Ultrawide Monitor)' },
  { value: '9:16', label: '9:16 (Vertical Video)' },
  { value: '2:3', label: '2:3 (Vertical Photo)' },
];

interface AspectRatioCalculatorClientProps {
  toolRoute: string;
  urlStateParams: ParamConfig[]; // Though not directly used in this client, passed for completeness
}

export default function AspectRatioCalculatorClient({ toolRoute }: AspectRatioCalculatorClientProps) {
  const { state, setState, isLoadingState, clearStateAndPersist } = useToolState<AspectRatioToolState>(
    toolRoute,
    DEFAULT_TOOL_STATE
  );

  const calculatedValues = useAspectRatioLogic({
    originalWidthStr: state.originalWidth,
    originalHeightStr: state.originalHeight,
    maintainTargetWidthStr: state.maintainTargetWidth,
    maintainTargetHeightStr: state.maintainTargetHeight,
    selectedCommonRatioStr: state.selectedCommonRatio,
    commonRatioGivenDimensionValueStr: state.commonRatioGivenDimensionValue,
    commonRatioGivenDimensionType: state.commonRatioGivenDimensionType,
  });

  const debouncedSetState = useDebouncedCallback(setState, 200);

  const handleInputChange = (field: keyof AspectRatioToolState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    debouncedSetState({ [field]: e.target.value } as Partial<AspectRatioToolState>);
  };
  
  const handleRadioChange = (field: keyof AspectRatioToolState, value: string) => {
     setState({ [field]: value } as Partial<AspectRatioToolState>);
  };

  const handleClear = async () => {
    await clearStateAndPersist();
  };

  if (isLoadingState) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))]">Loading calculator...</p>;
  }

  return (
    <div className="space-y-6">
      <RadioGroup
        legend="Calculation Mode"
        name="calculationMode"
        options={[
          { value: 'maintain', label: 'Maintain Aspect Ratio' },
          { value: 'fromCommon', label: 'Use Common Ratio' },
        ]}
        selectedValue={state.mode}
        onChange={(value) => handleRadioChange('mode', value as 'maintain' | 'fromCommon')}
        layout="horizontal"
      />

      {state.mode === 'maintain' && (
        <fieldset className="space-y-4 p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <legend className="text-lg font-semibold px-1 text-[rgb(var(--color-text-base))]">Calculate from Original Dimensions</legend>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Original Width"
              id="originalWidth"
              type="text"
              value={state.originalWidth}
              onChange={handleInputChange('originalWidth')}
              placeholder="e.g., 1920"
              error={calculatedValues.errors.original}
            />
            <Input
              label="Original Height"
              id="originalHeight"
              type="text"
              value={state.originalHeight}
              onChange={handleInputChange('originalHeight')}
              placeholder="e.g., 1080"
              error={calculatedValues.errors.original}
            />
          </div>

          {calculatedValues.simplifiedRatio && (
            <div className="p-2 bg-[rgb(var(--color-bg-subtle))] rounded text-center">
              <span className="text-sm text-[rgb(var(--color-text-muted))]">Original Aspect Ratio: </span>
              <strong className="text-lg text-[rgb(var(--color-text-base))]">{calculatedValues.simplifiedRatio}</strong>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <h3 className="text-md font-medium text-[rgb(var(--color-text-muted))]">Calculate New Dimensions:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <Input
                label="If New Width is"
                id="maintainTargetWidth"
                type="text"
                value={state.maintainTargetWidth}
                onChange={handleInputChange('maintainTargetWidth')}
                placeholder="e.g., 1280"
                error={calculatedValues.errors.maintainTargetWidth}
              />
              <Input
                label="Calculated Height"
                id="calculatedHeightFromTargetWidth"
                type="text"
                value={calculatedValues.heightFromTargetWidth}
                readOnly
                inputClassName="bg-[rgb(var(--color-bg-subtle))] cursor-default"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
               <Input
                label="If New Height is"
                id="maintainTargetHeight"
                type="text"
                value={state.maintainTargetHeight}
                onChange={handleInputChange('maintainTargetHeight')}
                placeholder="e.g., 720"
                error={calculatedValues.errors.maintainTargetHeight}
              />
              <Input
                label="Calculated Width"
                id="calculatedWidthFromTargetHeight"
                type="text"
                value={calculatedValues.widthFromTargetHeight}
                readOnly
                inputClassName="bg-[rgb(var(--color-bg-subtle))] cursor-default"
              />
            </div>
          </div>
        </fieldset>
      )}

      {state.mode === 'fromCommon' && (
        <fieldset className="space-y-4 p-4 border border-[rgb(var(--color-border-base))] rounded-md">
          <legend className="text-lg font-semibold px-1 text-[rgb(var(--color-text-base))]">Calculate from Common Ratio</legend>
          <Select
            label="Select Common Aspect Ratio"
            id="selectedCommonRatio"
            options={COMMON_RATIOS}
            value={state.selectedCommonRatio}
            onChange={handleInputChange('selectedCommonRatio')}
          />
          <RadioGroup
            legend="Given Dimension is"
            name="commonRatioDimensionType"
            options={[
              { value: 'width', label: 'Width' },
              { value: 'height', label: 'Height' },
            ]}
            selectedValue={state.commonRatioGivenDimensionType}
            onChange={(value) => handleRadioChange('commonRatioDimensionType', value as 'width' | 'height')}
            layout="horizontal"
          />
          <Input
            label={`Enter Known ${state.commonRatioGivenDimensionType.charAt(0).toUpperCase() + state.commonRatioGivenDimensionType.slice(1)}`}
            id="commonRatioGivenDimensionValue"
            type="text"
            value={state.commonRatioGivenDimensionValue}
            onChange={handleInputChange('commonRatioGivenDimensionValue')}
            placeholder="e.g., 1000"
            error={calculatedValues.errors.commonRatioInput}
          />
          {state.commonRatioGivenDimensionType === 'width' && (
            <Input
              label="Calculated Height"
              id="commonRatioCalculatedHeight"
              type="text"
              value={calculatedValues.commonRatioCalculatedHeight}
              readOnly
              inputClassName="bg-[rgb(var(--color-bg-subtle))] cursor-default"
            />
          )}
          {state.commonRatioGivenDimensionType === 'height' && (
            <Input
              label="Calculated Width"
              id="commonRatioCalculatedWidth"
              type="text"
              value={calculatedValues.commonRatioCalculatedWidth}
              readOnly
              inputClassName="bg-[rgb(var(--color-bg-subtle))] cursor-default"
            />
          )}
        </fieldset>
      )}
      
      <div className="flex justify-end mt-6">
        <Button
          variant="neutral"
          onClick={handleClear}
          iconLeft={<XCircleIcon className="h-5 w-5" />}
        >
          Clear All Inputs
        </Button>
      </div>
    </div>
  );
}