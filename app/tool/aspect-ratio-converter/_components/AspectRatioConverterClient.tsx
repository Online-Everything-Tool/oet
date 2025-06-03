```typescript
'use client';

import React, { useState, useCallback } from 'react';
import Input from '../../_components/form/Input';
import Select from '../../_components/form/Select';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import { useToolState } from '../../_hooks/useToolState'; //Fixed import
import { ToolMetadata, OutputConfig } from '@/src/types/tools';
import importedMetadata from '../metadata.json';
import Button from '../../_components/form/Button'; // Added import for Button

const metadata = importedMetadata as ToolMetadata;

interface AspectRatioConverterToolState {
  width: number;
  height: number;
  aspectRatio: string;
  convertedWidth: number | null;
  convertedHeight: number | null;
}

const DEFAULT_TOOL_STATE: AspectRatioConverterToolState = {
  width: 0,
  height: 0,
  aspectRatio: '16:9',
  convertedWidth: null,
  convertedHeight: null,
};

const aspectRatios = [
  '16:9',
  '4:3',
  '1:1',
  '9:16',
  '21:9',
  '1.85:1',
  '2.39:1',
  '3:2',
  '5:4',
  '2.76:1',
  '2.59:1',
  '2.65:1',
  '2.35:1',
  '1.37:1',
  '2.35-2.40:1', // Treat as 2.375:1 average
];

interface AspectRatioConverterClientProps {
  toolRoute: string;
}

export default function AspectRatioConverterClient({
  toolRoute,
}: AspectRatioConverterClientProps) {
  const {
    state: toolState,
    setState,
    isLoadingState,
    clearStateAndPersist,
  } = useToolState<AspectRatioConverterToolState>(
    toolRoute,
    DEFAULT_TOOL_STATE
  );

  const [error, setError] = useState<string | null>(null);

  const handleInputChange = useCallback(
    (field: 'width' | 'height') =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (isNaN(value) || value < 0) {
          setError('Please enter a valid positive number.');
          return;
        }
        setError(null);
        setState({ ...toolState, [field]: value, convertedWidth: null, convertedHeight: null });
      },
    [toolState, setState]
  );

  const handleAspectRatioChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setState({ ...toolState, aspectRatio: e.target.value, convertedWidth: null, convertedHeight: null });
    },
    [toolState, setState]
  );

  const convertDimensions = useCallback(() => {
    if (toolState.width <= 0 || toolState.height <= 0) {
      setError('Width and height must be greater than 0.');
      return;
    }
    setError(null);

    const [aspectRatioW, aspectRatioH] = toolState.aspectRatio
      .replace('-', ':') // Handle range 2.35-2.40:1
      .split(':')
      .map(parseFloat);

    if (isNaN(aspectRatioW) || isNaN(aspectRatioH) || aspectRatioW <= 0 || aspectRatioH <= 0) {
      setError('Invalid aspect ratio selected.');
      return;
    }
    const targetRatio = aspectRatioW / aspectRatioH;
    const currentRatio = toolState.width / toolState.height;

    let newWidth, newHeight;
    if (currentRatio > targetRatio) {
      newWidth = toolState.width;
      newHeight = toolState.width / targetRatio;
    } else {
      newHeight = toolState.height;
      newWidth = toolState.height * targetRatio;
    }
    setState({
      ...toolState,
      convertedWidth: Math.round(newWidth),
      convertedHeight: Math.round(newHeight),
    });
  }, [toolState, setState, setError]);

  const handleClear = useCallback(async () => {
    await clearStateAndPersist();
    setError(null);
  }, [clearStateAndPersist]);

  const canPerformActions =
    toolState.convertedWidth !== null && toolState.convertedHeight !== null;

    const outputConfig = { transferableContent: 'none' } as OutputConfig;

  if (isLoadingState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Aspect Ratio Converter...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Width"
            type="number"
            value={toolState.width}
            onChange={handleInputChange('width')}
            error={error}
          />
          <Input
            label="Height"
            type="number"
            value={toolState.height}
            onChange={handleInputChange('height')}
            error={error}
          />
        </div>
        <div className="mt-4">
          <Select
            label="Aspect Ratio"
            options={aspectRatios.map((ratio) => ({
              value: ratio,
              label: ratio,
            }))}
            value={toolState.aspectRatio}
            onChange={handleAspectRatioChange}
          />
        </div>
        <div className="mt-4 flex justify-center">
          <Button variant="primary" onClick={convertDimensions}> {/* Fixed undefined Button */}
            Convert
          </Button>
        </div>
      </div>

      {canPerformActions && (
        <div className="p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
          <p className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Converted Dimensions:
          </p>
          <p className="font-mono text-lg">
            {toolState.convertedWidth} x {toolState.convertedHeight}
          </p>
          <div className="mt-2 flex gap-2">
            <OutputActionButtons
              canPerform={canPerformActions}
              isSaveSuccess={false}
              isDownloadSuccess={false}
              onInitiateSave={() => {}}
              onInitiateDownload={() => {}}
              onCopy={() => {
                navigator.clipboard.writeText(`${toolState.convertedWidth} x ${toolState.convertedHeight}`);
              }}
              onClear={handleClear}
              directiveName={metadata.directive}
              outputConfig={outputConfig}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```
