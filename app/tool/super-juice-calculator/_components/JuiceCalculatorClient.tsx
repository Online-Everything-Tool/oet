'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import useToolState from '@/app/tool/_hooks/useToolState';
import useToolUrlState from '@/app/tool/_hooks/useToolUrlState';
import Input from '@/app/tool/_components/form/Input';
import Button from '@/app/tool/_components/form/Button';
import RadioGroup from '@/app/tool/_components/form/RadioGroup';
import { XCircleIcon } from '@heroicons/react/24/outline';
import type { ParamConfig } from '@/src/types/tools';

// Type definitions
type JuiceType = 'lime' | 'lemon' | 'orange' | 'grapefruit' | 'kumquat';

interface OutputConfig {
  label: string;
  key: string;
  factor?: number;
  value?: number;
}

interface JuiceConfig {
  label: string;
  inputLabel: string;
  outputs: OutputConfig[];
}

// Tool State Interface
interface JuiceCalculatorToolState {
  selectedJuice: JuiceType;
  weight: string;
}

// Constants
const DEFAULT_TOOL_STATE: JuiceCalculatorToolState = {
  selectedJuice: 'lime',
  weight: '',
};

const JUICE_CONFIGS: Record<JuiceType, JuiceConfig> = {
  lime: {
    label: 'Lime Super Juice',
    inputLabel: 'Weight of Lime Peels (g)',
    outputs: [
      { label: 'Citric Acid (g)', key: 'citricAcid', factor: 2 / 3 },
      { label: 'Malic Acid (g)', key: 'malicAcid', factor: 1 / 3 },
      { label: 'Water (g)', key: 'water', factor: 50 / 3 },
    ],
  },
  lemon: {
    label: 'Lemon Super Juice',
    inputLabel: 'Weight of Lemon Peels (g)',
    outputs: [
      { label: 'Citric Acid (g)', key: 'citricAcid', factor: 1 },
      { label: 'Malic Acid (g)', key: 'malicAcid', value: 0 },
      { label: 'Water (g)', key: 'water', factor: 50 / 3 },
    ],
  },
  orange: {
    label: 'Orange Super Juice',
    inputLabel: 'Weight of Orange Peels (g)',
    outputs: [
      { label: 'Citric Acid (g)', key: 'citricAcid', factor: 0.9 },
      { label: 'Malic Acid (g)', key: 'malicAcid', factor: 0.11 },
      { label: 'Water (g)', key: 'water', factor: 50 / 3 },
    ],
  },
  grapefruit: {
    label: 'Grapefruit Super Juice',
    inputLabel: 'Weight of Grapefruit Peels (g)',
    outputs: [
      { label: 'Citric Acid (g)', key: 'citricAcid', factor: 0.8 },
      { label: 'Malic Acid (g)', key: 'malicAcid', factor: 0.2 },
      { label: 'MSG (g)', key: 'msg', factor: 1 / 30 },
      { label: 'Water (g)', key: 'water', factor: 50 / 3 },
    ],
  },
  kumquat: {
    label: 'Kumquat Super Juice',
    inputLabel: 'Weight of Kumquat Fruit (g)',
    outputs: [
      { label: 'Citric Acid (g)', key: 'citricAcid', factor: 0.25 },
      { label: 'Ascorbic Acid (g)', key: 'ascorbicAcid', factor: 0.002 },
      { label: 'Water (g)', key: 'water', factor: 4.2 },
    ],
  },
};

interface JuiceCalculatorClientProps {
  urlStateParams?: ParamConfig[];
  toolRoute: string;
}

export default function JuiceCalculatorClient({
  urlStateParams,
  toolRoute,
}: JuiceCalculatorClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    clearStateAndPersist,
  } = useToolState<JuiceCalculatorToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const { urlState, isLoadingUrlState, urlProvidedAnyValue } =
    useToolUrlState(urlStateParams);

  const [results, setResults] = useState<Record<string, number>>({});
  const [localWeight, setLocalWeight] = useState(toolState.weight);

  const debouncedSetWeight = useDebouncedCallback((value: string) => {
    setToolState({ weight: value });
  }, 300);

  useEffect(() => {
    if (!isLoadingState) {
      setLocalWeight(toolState.weight);
    }
  }, [toolState.weight, isLoadingState]);

  // Sync URL state to tool state on initial load
  useEffect(() => {
    if (isLoadingUrlState || !urlProvidedAnyValue || isLoadingState) {
      return;
    }

    const updates: Partial<JuiceCalculatorToolState> = {};
    let needsUpdate = false;

    if (
      typeof urlState.juice === 'string' &&
      Object.keys(JUICE_CONFIGS).includes(urlState.juice) &&
      urlState.juice !== toolState.selectedJuice
    ) {
      updates.selectedJuice = urlState.juice as JuiceType;
      needsUpdate = true;
    }

    if (
      typeof urlState.weight === 'number' &&
      String(urlState.weight) !== toolState.weight
    ) {
      updates.weight = String(urlState.weight);
      needsUpdate = true;
    }

    if (needsUpdate) {
      setToolState(updates);
    }
  }, [
    urlState,
    isLoadingUrlState,
    urlProvidedAnyValue,
    isLoadingState,
    setToolState,
    toolState.selectedJuice,
    toolState.weight,
  ]);

  // Perform calculations
  useEffect(() => {
    const weightNum = parseFloat(toolState.weight) || 0;
    const config = JUICE_CONFIGS[toolState.selectedJuice];

    if (!config) {
      setResults({});
      return;
    }

    const newResults: Record<string, number> = {};
    config.outputs.forEach(output => {
      if (weightNum <= 0) {
        newResults[output.key] = 0;
      } else if (output.value !== undefined) {
        newResults[output.key] = output.value;
      } else if (output.factor !== undefined) {
        newResults[output.key] = weightNum * output.factor;
      } else {
        newResults[output.key] = 0;
      }
    });

    setResults(newResults);
  }, [toolState.weight, toolState.selectedJuice]);

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setLocalWeight(value);
      debouncedSetWeight(value);
    }
  };

  const handleJuiceChange = (value: JuiceType) => {
    setToolState({ selectedJuice: value });
  };

  const handleClear = useCallback(async () => {
    await clearStateAndPersist();
  }, [clearStateAndPersist]);

  const juiceOptions = useMemo(() => {
    return (Object.keys(JUICE_CONFIGS) as JuiceType[]).map(juiceKey => ({
      value: juiceKey,
      label: JUICE_CONFIGS[juiceKey].label,
    }));
  }, []);

  const currentConfig = JUICE_CONFIGS[toolState.selectedJuice];

  if (isLoadingState) {
    return (
      <p className="text-center p-4 text-[rgb(var(--color-text-muted))]">
        Loading Juice Calculator...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-subtle))] shadow-sm">
        <RadioGroup
          legend="Select Juice Type"
          name="juiceType"
          options={juiceOptions}
          selectedValue={toolState.selectedJuice}
          onChange={handleJuiceChange}
          layout="horizontal"
          className="mb-4"
        />
        <div className="flex items-end gap-4">
          <Input
            label={currentConfig.inputLabel}
            id="weightInput"
            type="text" // Use text to allow for more flexible input handling
            inputMode="decimal" // Better for mobile keyboards
            value={localWeight}
            onChange={handleWeightChange}
            placeholder="e.g., 30"
            containerClassName="flex-grow"
          />
          <Button
            onClick={handleClear}
            variant="neutral"
            iconLeft={<XCircleIcon className="h-5 w-5" />}
          >
            Clear
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-3 text-[rgb(var(--color-text-base))] border-b border-[rgb(var(--color-border-base))] pb-1">
          Recipe Output
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {currentConfig.outputs.map(output => (
            <div key={output.key}>
              <label
                htmlFor={`output-${output.key}`}
                className="block text-sm font-medium mb-1 text-[rgb(var(--color-text-muted))]"
              >
                {output.label}
              </label>
              <div
                id={`output-${output.key}`}
                className="p-3 border rounded-md shadow-sm bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-text-emphasis))] font-mono text-lg border-[rgb(var(--color-border-soft))]"
              >
                {(results[output.key] || 0).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}