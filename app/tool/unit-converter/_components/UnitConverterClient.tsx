'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import useToolState from '@/app/tool/_hooks/useToolState';
import useToolUrlState from '@/app/tool/_hooks/useToolUrlState';
import { useUnitConverter, CategoryId } from '../_hooks/useUnitConverter';
import Input from '@/app/tool/_components/form/Input';
import Select from '@/app/tool/_components/form/Select';
import Button from '@/app/tool/_components/form/Button';
import {
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import SendToToolButton from '@/app/tool/_components/shared/SendToToolButton';
import type { ParamConfig } from '@/src/types/tools';
import metadata from '../metadata.json';

interface UnitConverterToolState {
  category: CategoryId;
  fromUnit: string;
  toUnit: string;
  inputValue: string;
  outputValue: string;
}

const DEFAULT_TOOL_STATE: UnitConverterToolState = {
  category: 'length',
  fromUnit: 'meter',
  toUnit: 'foot',
  inputValue: '1',
  outputValue: '',
};

const DEBOUNCE_MS = 300;

interface UnitConverterClientProps {
  urlStateParams?: ParamConfig[];
  toolRoute: string;
}

export default function UnitConverterClient({
  urlStateParams,
  toolRoute,
}: UnitConverterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
  } = useToolState<UnitConverterToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const { urlState, isLoadingUrlState, urlProvidedAnyValue } =
    useToolUrlState(urlStateParams);

  const { categories, getUnitsForCategory, convert } = useUnitConverter();
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const unitsForSelectedCategory = useMemo(
    () => getUnitsForCategory(toolState.category),
    [toolState.category, getUnitsForCategory]
  );

  const performConversion = useCallback(
    (state: UnitConverterToolState) => {
      setError('');
      if (state.inputValue.trim() === '') {
        setToolState({ outputValue: '' });
        return;
      }

      const value = parseFloat(state.inputValue);
      if (isNaN(value)) {
        setError('Invalid input value. Please enter a number.');
        setToolState({ outputValue: '' });
        return;
      }

      const result = convert(
        value,
        state.category,
        state.fromUnit,
        state.toUnit
      );

      if (result !== null) {
        const formattedResult =
          Math.abs(result) > 1e-6 && Math.abs(result) < 1e6
            ? parseFloat(result.toPrecision(10)).toString()
            : result.toExponential(6);
        setToolState({ outputValue: formattedResult });
      } else {
        setError('Conversion failed. Please check units.');
        setToolState({ outputValue: '' });
      }
    },
    [convert, setToolState]
  );

  const debouncedConvert = useDebouncedCallback(performConversion, DEBOUNCE_MS);

  useEffect(() => {
    if (!isLoadingState && !isLoadingUrlState && urlProvidedAnyValue) {
      const updates: Partial<UnitConverterToolState> = {};
      let needsUpdate = false;

      if (
        urlState.category &&
        typeof urlState.category === 'string' &&
        categories.some(c => c.id === urlState.category)
      ) {
        updates.category = urlState.category as CategoryId;
        needsUpdate = true;
      }
      if (urlState.value && typeof urlState.value === 'string') {
        updates.inputValue = urlState.value;
        needsUpdate = true;
      }
      if (urlState.from && typeof urlState.from === 'string') {
        updates.fromUnit = urlState.from;
        needsUpdate = true;
      }
      if (urlState.to && typeof urlState.to === 'string') {
        updates.toUnit = urlState.to;
        needsUpdate = true;
      }

      if (needsUpdate) {
        setToolState(prevState => ({ ...prevState, ...updates }));
      }
    }
  }, [
    urlState,
    isLoadingUrlState,
    urlProvidedAnyValue,
    isLoadingState,
    setToolState,
    categories,
  ]);

  useEffect(() => {
    if (!isLoadingState) {
      debouncedConvert(toolState);
    }
  }, [
    toolState.inputValue,
    toolState.fromUnit,
    toolState.toUnit,
    toolState.category,
    isLoadingState,
    debouncedConvert,
    toolState,
  ]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategory = e.target.value as CategoryId;
    const newUnits = getUnitsForCategory(newCategory);
    setToolState({
      category: newCategory,
      fromUnit: newUnits[0]?.id || '',
      toUnit: newUnits[1]?.id || newUnits[0]?.id || '',
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToolState({ inputValue: e.target.value });
  };

  const handleFromUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setToolState({ fromUnit: e.target.value });
  };

  const handleToUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setToolState({ toUnit: e.target.value });
  };

  const handleSwap = () => {
    setToolState(prevState => ({
      ...prevState,
      fromUnit: prevState.toUnit,
      toUnit: prevState.fromUnit,
      inputValue: prevState.outputValue,
    }));
  };

  const handleCopy = async () => {
    if (toolState.outputValue) {
      try {
        await navigator.clipboard.writeText(toolState.outputValue);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        setError('Failed to copy to clipboard.');
      }
    }
  };

  const unitOptions = unitsForSelectedCategory.map(unit => ({
    value: unit.id,
    label: `${unit.name} (${unit.symbol})`,
  }));

  if (isLoadingState) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))]">
        Loading Unit Converter...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-subtle))] shadow-sm">
        <Select
          label="Category"
          id="category-select"
          options={categories.map(c => ({ value: c.id, label: c.name }))}
          value={toolState.category}
          onChange={handleCategoryChange}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-end">
        <div className="md:col-span-5">
          <Select
            label="From"
            id="from-unit-select"
            options={unitOptions}
            value={toolState.fromUnit}
            onChange={handleFromUnitChange}
          />
        </div>

        <div className="md:col-span-1 flex justify-center">
          <Button
            variant="neutral"
            onClick={handleSwap}
            title="Swap Units"
            className="p-2"
          >
            <ArrowPathIcon className="h-6 w-6" />
          </Button>
        </div>

        <div className="md:col-span-5">
          <Select
            label="To"
            id="to-unit-select"
            options={unitOptions}
            value={toolState.toUnit}
            onChange={handleToUnitChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <Input
          label="Value to Convert"
          id="input-value"
          type="text"
          inputMode="decimal"
          value={toolState.inputValue}
          onChange={handleInputChange}
          placeholder="Enter a value"
          error={error}
        />
        <div>
          <label
            htmlFor="output-value"
            className="block text-sm font-medium mb-1 text-[rgb(var(--color-text-muted))]"
          >
            Result
          </label>
          <div className="relative">
            <div
              id="output-value"
              className="w-full p-3 min-h-[46px] border rounded-md shadow-sm bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-text-emphasis))] font-mono text-lg border-[rgb(var(--color-border-soft))]"
            >
              {toolState.outputValue || '...'}
            </div>
            {toolState.outputValue && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                <Button
                  variant="neutral"
                  size="sm"
                  onClick={handleCopy}
                  disabled={copySuccess}
                  iconLeft={
                    copySuccess ? (
                      <CheckIcon className="h-5 w-5 text-[rgb(var(--color-status-success))]" />
                    ) : (
                      <ClipboardDocumentIcon className="h-5 w-5" />
                    )
                  }
                  title={copySuccess ? 'Copied!' : 'Copy to clipboard'}
                >
                  {copySuccess ? 'Copied' : 'Copy'}
                </Button>
                <SendToToolButton
                  currentToolDirective={metadata.directive}
                  currentToolOutputConfig={metadata.outputConfig}
                  buttonText=""
                  className="ml-1"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}