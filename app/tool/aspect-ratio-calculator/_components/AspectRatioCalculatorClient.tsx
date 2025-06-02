'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import useToolState from '../../_hooks/useToolState';
import useToolUrlState from '../../_hooks/useToolUrlState';
import {
  useAspectRatioLogic,
  AspectRatioToolState,
  AspectRatioCalculations,
  COMMON_RATIO_OPTIONS,
} from '../_hooks/useAspectRatioLogic';
import Input from '../../_components/form/Input';
import Select from '../../_components/form/Select';
import RadioGroup from '../../_components/form/RadioGroup';
import Button from '../../_components/form/Button';
import type { ParamConfig } from '@/src/types/tools';
import { XCircleIcon } from '@heroicons/react/24/solid';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import metadata from '../metadata.json';


const DEFAULT_STATE: AspectRatioToolState = {
  originalWidth: '',
  originalHeight: '',
  newWidthInput: '',
  newHeightInput: '',
  lastChangedDimension: null,
  selectedAspectRatioKey: '16:9',
  customAspectRatioWidth: '',
  customAspectRatioHeight: '',
  ratioTargetDimension: 'width',
  ratioTargetValue: '',
  output: null,
};

interface AspectRatioCalculatorClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function AspectRatioCalculatorClient({
  urlStateParams,
  toolRoute,
}: AspectRatioCalculatorClientProps) {
  const {
    state,
    setState,
    isLoadingState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<AspectRatioToolState>(toolRoute, DEFAULT_STATE);

  const { urlState, urlParamsLoaded, urlProvidedAnyValue } =
    useToolUrlState(urlStateParams);

  const calculations = useAspectRatioLogic(state);
  const initialUrlLoadAppliedRef = useRef(false);

  // Apply URL state once on load if available
  useEffect(() => {
    if (isLoadingState || !urlParamsLoaded || initialUrlLoadAppliedRef.current) {
      return;
    }
    if (urlProvidedAnyValue) {
      const newState: Partial<AspectRatioToolState> = {};
      if (urlState.ow !== undefined) newState.originalWidth = String(urlState.ow);
      if (urlState.oh !== undefined) newState.originalHeight = String(urlState.oh);
      if (urlState.nw !== undefined) newState.newWidthInput = String(urlState.nw);
      if (urlState.nh !== undefined) newState.newHeightInput = String(urlState.nh);
      if (urlState.sr !== undefined) newState.selectedAspectRatioKey = String(urlState.sr);
      if (urlState.crw !== undefined) newState.customAspectRatioWidth = String(urlState.crw);
      if (urlState.crh !== undefined) newState.customAspectRatioHeight = String(urlState.crh);
      if (urlState.rtd !== undefined && (urlState.rtd === 'width' || urlState.rtd === 'height')) {
        newState.ratioTargetDimension = urlState.rtd as 'width' | 'height';
      }
      if (urlState.rtv !== undefined) newState.ratioTargetValue = String(urlState.rtv);
      
      // Determine lastChangedDimension based on URL params if possible
      if (newState.newWidthInput && !newState.newHeightInput) {
        newState.lastChangedDimension = 'newWidth';
      } else if (!newState.newWidthInput && newState.newHeightInput) {
        newState.lastChangedDimension = 'newHeight';
      } else if (newState.newWidthInput && newState.newHeightInput) {
        // If both are provided, arbitrarily pick one or leave as is from default/Dexie
        // For simplicity, let's assume if both nw and nh are in URL, nw was "last changed"
        newState.lastChangedDimension = 'newWidth';
      }

      setState(prev => ({ ...prev, ...newState, output: null })); // Reset output as inputs changed
    }
    initialUrlLoadAppliedRef.current = true;
  }, [isLoadingState, urlParamsLoaded, urlProvidedAnyValue, urlState, setState]);


  // Update persisted output state based on calculations
  useEffect(() => {
    let newOutput: AspectRatioToolState['output'] = null;

    if (state.originalWidth && state.originalHeight && !calculations.original.error) {
      newOutput = {
        width: state.originalWidth,
        height: state.originalHeight,
        aspectRatio: calculations.original.aspectRatioString,
        source: 'original',
      };
    }
    
    if (state.lastChangedDimension === 'newWidth' && state.newWidthInput && calculations.mode1.calculatedHeight && !calculations.mode1.error && calculations.original.aspectRatioString) {
      newOutput = {
        width: state.newWidthInput,
        height: calculations.mode1.calculatedHeight,
        aspectRatio: calculations.original.aspectRatioString,
        source: 'mode1',
      };
    } else if (state.lastChangedDimension === 'newHeight' && state.newHeightInput && calculations.mode1.calculatedWidth && !calculations.mode1.error && calculations.original.aspectRatioString) {
      newOutput = {
        width: calculations.mode1.calculatedWidth,
        height: state.newHeightInput,
        aspectRatio: calculations.original.aspectRatioString,
        source: 'mode1',
      };
    }

    if (state.ratioTargetValue && !calculations.mode2.error && !calculations.customRatioError) {
        let ratioString = state.selectedAspectRatioKey;
        if (state.selectedAspectRatioKey === 'custom' && state.customAspectRatioWidth && state.customAspectRatioHeight) {
            const crwNum = parseFloat(state.customAspectRatioWidth);
            const crhNum = parseFloat(state.customAspectRatioHeight);
            if (crwNum > 0 && crhNum > 0) {
                const common = gcd(Math.round(crwNum), Math.round(crhNum));
                ratioString = `${Math.round(crwNum/common)}:${Math.round(crhNum/common)}`;
            } else {
                ratioString = "Invalid Custom";
            }
        }

        if (state.ratioTargetDimension === 'width' && calculations.mode2.calculatedHeight) {
            newOutput = {
                width: state.ratioTargetValue,
                height: calculations.mode2.calculatedHeight,
                aspectRatio: ratioString,
                source: 'mode2',
            };
        } else if (state.ratioTargetDimension === 'height' && calculations.mode2.calculatedWidth) {
            newOutput = {
                width: calculations.mode2.calculatedWidth,
                height: state.ratioTargetValue,
                aspectRatio: ratioString,
                source: 'mode2',
            };
        }
    }
    
    // Only update if newOutput is different from current persisted output
    if (JSON.stringify(newOutput) !== JSON.stringify(state.output)) {
        setState(prev => ({ ...prev, output: newOutput }));
    }

  }, [state, calculations, setState]);


  const handleInputChange = useCallback(
    (field: keyof AspectRatioToolState, value: string) => {
      const updates: Partial<AspectRatioToolState> = { [field]: value };
      if (field === 'newWidthInput') updates.lastChangedDimension = 'newWidth';
      if (field === 'newHeightInput') updates.lastChangedDimension = 'newHeight';
      setState(updates);
    },
    [setState]
  );

  const handleClearAll = useCallback(async () => {
    await clearStateAndPersist();
  }, [clearStateAndPersist]);

  const handleSaveOutput = useCallback(async () => {
    // This tool's output is ephemeral and derived. "Saving" means ensuring the current
    // `state.output` is persisted if `useToolState`'s debounced save hasn't run.
    // For ITDE, the `output` field in `state` is what matters.
    await saveStateNow(); 
    // Could add a visual confirmation if needed, but not standard for inline outputs.
  }, [saveStateNow]);


  if (isLoadingState && !initialUrlLoadAppliedRef.current) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))]">Loading Aspect Ratio Calculator...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Original Dimensions */}
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <h2 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-base))]">Original Dimensions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <Input
            label="Original Width"
            type="number"
            value={state.originalWidth}
            onChange={(e) => handleInputChange('originalWidth', e.target.value)}
            placeholder="e.g., 1920"
            min="0"
            error={calculations.original.error}
          />
          <Input
            label="Original Height"
            type="number"
            value={state.originalHeight}
            onChange={(e) => handleInputChange('originalHeight', e.target.value)}
            placeholder="e.g., 1080"
            min="0"
            error={calculations.original.error}
          />
        </div>
        {calculations.original.aspectRatioString && !calculations.original.error && (
          <p className="mt-3 text-md">
            Original Aspect Ratio: <strong className="text-[rgb(var(--color-text-link))]">{calculations.original.aspectRatioString}</strong>
          </p>
        )}
      </div>

      {/* Section 2: Calculate New Dimensions (maintaining original aspect ratio) */}
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <h2 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-base))]">Maintain Aspect Ratio</h2>
        <p className="text-sm text-[rgb(var(--color-text-muted))] mb-3">Enter a new width OR height to calculate the other, based on original dimensions.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <Input
            label="New Width"
            type="number"
            value={state.newWidthInput}
            onChange={(e) => handleInputChange('newWidthInput', e.target.value)}
            placeholder="Enter new width"
            min="0"
            disabled={!state.originalWidth || !state.originalHeight || !!calculations.original.error}
            error={calculations.mode1.error && state.lastChangedDimension === 'newWidth' ? calculations.mode1.error : undefined}
          />
          <Input
            label="New Height"
            type="number"
            value={state.newHeightInput}
            onChange={(e) => handleInputChange('newHeightInput', e.target.value)}
            placeholder="Enter new height"
            min="0"
            disabled={!state.originalWidth || !state.originalHeight || !!calculations.original.error}
            error={calculations.mode1.error && state.lastChangedDimension === 'newHeight' ? calculations.mode1.error : undefined}
          />
        </div>
        {(calculations.mode1.calculatedHeight || calculations.mode1.calculatedWidth) && !calculations.mode1.error && (
          <div className="mt-3 text-md">
            Calculated:
            {state.lastChangedDimension === 'newWidth' && state.newWidthInput && calculations.mode1.calculatedHeight && (
              <span> New Width: <strong className="text-[rgb(var(--color-text-link))]">{state.newWidthInput}</strong>, New Height: <strong className="text-[rgb(var(--color-text-link))]">{calculations.mode1.calculatedHeight}</strong></span>
            )}
            {state.lastChangedDimension === 'newHeight' && state.newHeightInput && calculations.mode1.calculatedWidth && (
              <span> New Width: <strong className="text-[rgb(var(--color-text-link))]">{calculations.mode1.calculatedWidth}</strong>, New Height: <strong className="text-[rgb(var(--color-text-link))]">{state.newHeightInput}</strong></span>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Calculate from Common Aspect Ratio */}
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <h2 className="text-lg font-semibold mb-3 text-[rgb(var(--color-text-base))]">Calculate from Aspect Ratio</h2>
        <p className="text-sm text-[rgb(var(--color-text-muted))] mb-3">Select an aspect ratio and provide one dimension to calculate the other.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <Select
            label="Aspect Ratio"
            options={COMMON_RATIO_OPTIONS}
            value={state.selectedAspectRatioKey}
            onChange={(e) => setState({ selectedAspectRatioKey: e.target.value })}
          />
          {state.selectedAspectRatioKey === 'custom' && (
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <Input
                label="Custom Ratio Width"
                type="number"
                value={state.customAspectRatioWidth}
                onChange={(e) => setState({ customAspectRatioWidth: e.target.value })}
                placeholder="e.g., 21"
                min="0"
                error={calculations.customRatioError}
              />
              <Input
                label="Custom Ratio Height"
                type="number"
                value={state.customAspectRatioHeight}
                onChange={(e) => setState({ customAspectRatioHeight: e.target.value })}
                placeholder="e.g., 9"
                min="0"
                error={calculations.customRatioError}
              />
            </div>
          )}
        </div>
        <div className="mt-4">
          <RadioGroup
            legend="Calculate based on:"
            name="ratioTargetDimension"
            options={[
              { value: 'width', label: 'Known Width' },
              { value: 'height', label: 'Known Height' },
            ]}
            selectedValue={state.ratioTargetDimension}
            onChange={(val) => setState({ ratioTargetDimension: val as 'width' | 'height' })}
            layout="horizontal"
          />
        </div>
        <div className="mt-4">
          <Input
            label={state.ratioTargetDimension === 'width' ? 'Known Width Value' : 'Known Height Value'}
            type="number"
            value={state.ratioTargetValue}
            onChange={(e) => setState({ ratioTargetValue: e.target.value })}
            placeholder="Enter dimension value"
            min="0"
            disabled={state.selectedAspectRatioKey === 'custom' && (!state.customAspectRatioWidth || !state.customAspectRatioHeight || !!calculations.customRatioError)}
            error={calculations.mode2.error}
          />
        </div>
        {(calculations.mode2.calculatedHeight || calculations.mode2.calculatedWidth) && !calculations.mode2.error && (
           <div className="mt-3 text-md">
            Calculated:
            {state.ratioTargetDimension === 'width' && state.ratioTargetValue && calculations.mode2.calculatedHeight && (
              <span> Width: <strong className="text-[rgb(var(--color-text-link))]">{state.ratioTargetValue}</strong>, Height: <strong className="text-[rgb(var(--color-text-link))]">{calculations.mode2.calculatedHeight}</strong></span>
            )}
            {state.ratioTargetDimension === 'height' && state.ratioTargetValue && calculations.mode2.calculatedWidth && (
              <span> Width: <strong className="text-[rgb(var(--color-text-link))]">{calculations.mode2.calculatedWidth}</strong>, Height: <strong className="text-[rgb(var(--color-text-link))]">{state.ratioTargetValue}</strong></span>
            )}
          </div>
        )}
      </div>
      
      <div className="flex justify-end items-center gap-3 mt-6 pt-4 border-t border-[rgb(var(--color-border-base))]">
         <OutputActionButtons
            canPerform={!!state.output}
            isSaveSuccess={false} // No explicit save action for this tool's output beyond state persistence
            isDownloadSuccess={false} // No download for this tool
            onInitiateSave={handleSaveOutput} // Ensures state is flushed for ITDE
            onInitiateDownload={() => {}} // No download
            onCopy={() => {
                if(state.output) {
                    const copyText = `Width: ${state.output.width}, Height: ${state.output.height}, Ratio: ${state.output.aspectRatio}`;
                    navigator.clipboard.writeText(copyText);
                }
            }}
            onClear={handleClearAll}
            directiveName={metadata.directive}
            outputConfig={metadata.outputConfig}
            canInitiateSave={!!state.output}
         />
        <Button variant="neutral" onClick={handleClearAll} iconLeft={<XCircleIcon className="h-5 w-5" />}>
          Clear All
        </Button>
      </div>
    </div>
  );
}