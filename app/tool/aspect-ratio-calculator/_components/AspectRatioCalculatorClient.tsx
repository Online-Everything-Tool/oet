'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import Input from '../../_components/form/Input';
import useToolUrlState from '../../_hooks/useToolUrlState';
import { useAspectRatioCalculations } from '../_hooks/useAspectRatioCalculations';
import type { ParamConfig } from '@/src/types/tools';
import { InformationCircleIcon } from '@heroicons/react/20/solid';

interface AspectRatioCalculatorClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string; 
}

const DEBOUNCE_DELAY = 300;

export default function AspectRatioCalculatorClient({ urlStateParams, toolRoute }: AspectRatioCalculatorClientProps) {
  const { urlState, isLoadingUrlState, urlParamsLoaded } = useToolUrlState(urlStateParams);

  const defaultWidth = urlStateParams.find(p => p.paramName === 'width')?.defaultValue as number || 1920;
  const defaultHeight = urlStateParams.find(p => p.paramName === 'height')?.defaultValue as number || 1080;

  const [currentWidth, setCurrentWidth] = useState<number>(defaultWidth);
  const [currentHeight, setCurrentHeight] = useState<number>(defaultHeight);
  
  const [inputWidthStr, setInputWidthStr] = useState<string>(String(defaultWidth));
  const [inputHeightStr, setInputHeightStr] = useState<string>(String(defaultHeight));

  const [error, setError] = useState<string>('');

  const { simplifiedOriginalRatio, calculatedRatios } = useAspectRatioCalculations(currentWidth, currentHeight);

  useEffect(() => {
    if (!isLoadingUrlState && urlParamsLoaded) {
      const urlWidth = urlState.width as number | undefined;
      const urlHeight = urlState.height as number | undefined;

      let newW = defaultWidth;
      let newH = defaultHeight;
      let needsUpdate = false;

      if (urlWidth !== undefined && !isNaN(urlWidth) && urlWidth > 0) {
        newW = urlWidth;
        if (newW !== currentWidth) needsUpdate = true;
      }
      if (urlHeight !== undefined && !isNaN(urlHeight) && urlHeight > 0) {
        newH = urlHeight;
        if (newH !== currentHeight) needsUpdate = true;
      }
      
      if (needsUpdate) {
        setCurrentWidth(newW);
        setInputWidthStr(String(newW));
        setCurrentHeight(newH);
        setInputHeightStr(String(newH));
      } else if (currentWidth !== parseFloat(inputWidthStr) || currentHeight !== parseFloat(inputHeightStr)) {
        // Sync input strings if they are out of sync with current numeric values (e.g. on initial load with defaults)
        setInputWidthStr(String(currentWidth));
        setInputHeightStr(String(currentHeight));
      }
    }
  }, [isLoadingUrlState, urlState, urlParamsLoaded, defaultWidth, defaultHeight]);


  const updateCalculationsAndUrl = useCallback((newW: number, newH: number) => {
    if (isNaN(newW) || isNaN(newH) || newW <= 0 || newH <= 0) {
      setError('Width and Height must be positive numbers.');
      return;
    }
    setError('');
    setCurrentWidth(newW);
    setCurrentHeight(newH);

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('width', String(newW));
    newUrl.searchParams.set('height', String(newH));
    window.history.replaceState({}, '', newUrl.toString());

  }, []);

  const debouncedUpdateCalculations = useDebouncedCallback(updateCalculationsAndUrl, DEBOUNCE_DELAY);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setInputWidthStr(valStr);
    const valNum = parseInt(valStr, 10);
    if (!isNaN(valNum) && valNum > 0) {
      debouncedUpdateCalculations(valNum, parseFloat(inputHeightStr) || currentHeight);
    } else if (valStr.trim() === '') {
       setError('Width must be a positive number.');
    } else {
      setError('Invalid width: Must be a positive number.');
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setInputHeightStr(valStr);
    const valNum = parseInt(valStr, 10);
     if (!isNaN(valNum) && valNum > 0) {
      debouncedUpdateCalculations(parseFloat(inputWidthStr) || currentWidth, valNum);
    } else if (valStr.trim() === '') {
      setError('Height must be a positive number.');
    } else {
      setError('Invalid height: Must be a positive number.');
    }
  };

  if (isLoadingUrlState && !urlParamsLoaded) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))]">Loading calculator...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-subtle))]">
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-base))] mb-3">Input Dimensions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Original Width (px)"
            type="number"
            id="originalWidth"
            value={inputWidthStr}
            onChange={handleWidthChange}
            min="1"
            placeholder="e.g., 1920"
            inputClassName="text-lg"
          />
          <Input
            label="Original Height (px)"
            type="number"
            id="originalHeight"
            value={inputHeightStr}
            onChange={handleHeightChange}
            min="1"
            placeholder="e.g., 1080"
            inputClassName="text-lg"
          />
        </div>
        {error && (
          <p className="mt-2 text-sm text-[rgb(var(--color-text-error))]">{error}</p>
        )}
      </div>

      {simplifiedOriginalRatio && !error && (
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-lg">
          <h3 className="text-md font-semibold text-[rgb(var(--color-text-base))] mb-0">
            Original Aspect Ratio: 
            <span className="ml-2 font-bold text-xl text-[rgb(var(--color-text-link))]">{simplifiedOriginalRatio.string}</span>
            <span className="ml-1 font-normal text-sm text-[rgb(var(--color-text-muted))]">
              (Decimal: {(currentWidth / currentHeight).toFixed(3)})
            </span>
          </h3>
        </div>
      )}

      {!error && calculatedRatios.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-[rgb(var(--color-text-base))] mb-4">Common Aspect Ratio Conversions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {calculatedRatios.map((ratio, index) => (
              <div key={index} className="p-4 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-component))] shadow-sm flex flex-col">
                <h3 className="text-lg font-semibold text-[rgb(var(--color-text-link))] mb-1">{ratio.name}</h3>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3 flex-grow">{ratio.description}</p>
                
                <div className="space-y-2 text-sm mt-auto">
                  <div>
                    <p className="font-medium text-[rgb(var(--color-text-base))]">Keep Width ({currentWidth}px):</p>
                    <p className="text-[rgb(var(--color-text-muted))]">
                      {ratio.basedOnWidth.newW}px × <span className="font-semibold text-[rgb(var(--color-text-base))]">{ratio.basedOnWidth.newH}px</span>
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-[rgb(var(--color-text-base))]">Keep Height ({currentHeight}px):</p>
                    <p className="text-[rgb(var(--color-text-muted))]">
                      <span className="font-semibold text-[rgb(var(--color-text-base))]">{ratio.basedOnHeight.newW}px</span> × {ratio.basedOnHeight.newH}px
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
       {error && (currentWidth <=0 || currentHeight <=0 || isNaN(currentWidth) || isNaN(currentHeight)) && (
         <div className="p-6 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-subtle))] text-center">
            <InformationCircleIcon className="h-12 w-12 text-[rgb(var(--color-text-muted))] mx-auto mb-2" />
            <p className="text-[rgb(var(--color-text-muted))]">
              Please enter valid positive numbers for width and height to see calculations.
            </p>
          </div>
       )}
    </div>
  );
}