'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import Input from '../../../_components/form/Input';
import Button from '../../../_components/form/Button';
import useToolUrlState from '../../../_hooks/useToolUrlState';
import { useAspectRatioCalculations } from '../_hooks/useAspectRatioCalculations';
import type { ToolMetadata, ParamConfig } from '@/src/types/tools';
import importedMetadata from '../metadata.json';
import { XCircleIcon } from '@heroicons/react/24/outline';

const metadata = importedMetadata as ToolMetadata;
const urlStateParams = (metadata.urlStateParams || []) as ParamConfig[];

const DEBOUNCE_DELAY = 500;

export default function AspectRatioCalculatorClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { urlState, isLoadingUrlState } = useToolUrlState(urlStateParams);

  const [widthInput, setWidthInput] = useState<string>('');
  const [heightInput, setHeightInput] = useState<string>('');

  const [numericWidth, setNumericWidth] = useState<number | null>(null);
  const [numericHeight, setNumericHeight] = useState<number | null>(null);

  const [widthError, setWidthError] = useState<string>('');
  const [heightError, setHeightError] = useState<string>('');

  useEffect(() => {
    if (isLoadingUrlState) return;

    const defaultWConfig = urlStateParams.find(p => p.paramName === 'width');
    const defaultHConfig = urlStateParams.find(p => p.paramName === 'height');
    
    const defaultW = (defaultWConfig?.defaultValue as number) ?? 1920;
    const defaultH = (defaultHConfig?.defaultValue as number) ?? 1080;

    const wVal = typeof urlState.width === 'number' ? urlState.width : defaultW;
    const hVal = typeof urlState.height === 'number' ? urlState.height : defaultH;
    
    setWidthInput(String(wVal));
    setHeightInput(String(hVal));

    setNumericWidth(wVal > 0 ? wVal : null);
    setNumericHeight(hVal > 0 ? hVal : null);
    
    setWidthError('');
    setHeightError('');

  }, [isLoadingUrlState, urlState.width, urlState.height]);

  const debouncedProcessInputs = useDebouncedCallback(() => {
    let wNum: number | null = null;
    let hNum: number | null = null;
    let wErr = '';
    let hErr = '';

    const parsedW = parseFloat(widthInput);
    if (widthInput.trim() !== '' && (isNaN(parsedW) || parsedW <= 0)) {
      wErr = 'Width must be a positive number.';
    } else if (widthInput.trim() !== '') {
      wNum = parsedW;
    }

    const parsedH = parseFloat(heightInput);
    if (heightInput.trim() !== '' && (isNaN(parsedH) || parsedH <= 0)) {
      hErr = 'Height must be a positive number.';
    } else if (heightInput.trim() !== '') {
      hNum = parsedH;
    }
    
    setWidthError(wErr);
    setHeightError(hErr);

    setNumericWidth(wErr ? null : wNum);
    setNumericHeight(hErr ? null : hNum);

    if (!wErr && !hErr) {
      const currentParams = new URLSearchParams(window.location.search);
      const newSearchQuery = new URLSearchParams();

      if (wNum !== null) newSearchQuery.set('width', String(wNum));
      if (hNum !== null) newSearchQuery.set('height', String(hNum));
      
      const newQueryString = newSearchQuery.toString();
      const currentQueryString = currentParams.toString();

      if (newQueryString !== currentQueryString) {
         router.push(`${pathname}?${newQueryString}`, { scroll: false });
      }
    }
  }, DEBOUNCE_DELAY);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWidthInput(e.target.value);
    debouncedProcessInputs();
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHeightInput(e.target.value);
    debouncedProcessInputs();
  };

  const handleClear = () => {
    const defaultW = (urlStateParams.find(p => p.paramName === 'width')?.defaultValue as number) ?? 1920;
    const defaultH = (urlStateParams.find(p => p.paramName === 'height')?.defaultValue as number) ?? 1080;

    setWidthInput(String(defaultW));
    setHeightInput(String(defaultH));
    
    // Trigger URL update to defaults
    const newSearchQuery = new URLSearchParams();
    // Not setting params will make useToolUrlState use defaults
    router.push(`${pathname}?${newSearchQuery.toString()}`, { scroll: false });

    // debouncedProcessInputs will be called by the state change, 
    // or call it directly if preferred to ensure numeric states update.
    // Forcing an immediate update of numeric states for calculation:
    setNumericWidth(defaultW > 0 ? defaultW : null);
    setNumericHeight(defaultH > 0 ? defaultH : null);
    setWidthError('');
    setHeightError('');
  };

  const { calculatedRatios } = useAspectRatioCalculations(numericWidth, numericHeight);

  if (isLoadingUrlState) {
    return <p className="text-center p-4">Loading calculator...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <Input
          label="Original Width"
          id="originalWidth"
          type="text" // Using text for flexible input, parsing manually
          inputMode="decimal"
          value={widthInput}
          onChange={handleWidthChange}
          error={widthError || null}
          placeholder="e.g., 1920"
          containerClassName="md:col-span-1"
        />
        <Input
          label="Original Height"
          id="originalHeight"
          type="text" // Using text for flexible input, parsing manually
          inputMode="decimal"
          value={heightInput}
          onChange={handleHeightChange}
          error={heightError || null}
          placeholder="e.g., 1080"
          containerClassName="md:col-span-1"
        />
        <div className="md:col-span-1 flex items-end h-full">
          <Button 
            onClick={handleClear} 
            variant="neutral" 
            iconLeft={<XCircleIcon className="h-5 w-5" />}
            fullWidth
            className="py-2.5" // Match Input height
          >
            Clear / Reset
          </Button>
        </div>
      </div>

      { (numericWidth === null || numericHeight === null || numericWidth <=0 || numericHeight <=0) && !widthError && !heightError && (
         <p className="text-center text-sm text-[rgb(var(--color-text-muted))]">
           Enter a valid width and height to see calculations.
         </p>
      )}

      {(numericWidth !== null && numericHeight !== null && numericWidth > 0 && numericHeight > 0 && !widthError && !heightError) && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[rgb(var(--color-border-base))] border border-[rgb(var(--color-border-base))] rounded-md">
            <thead className="bg-[rgb(var(--color-bg-subtle))]">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--color-text-muted))] uppercase tracking-wider">Aspect Ratio</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--color-text-muted))] uppercase tracking-wider">Dimensions (Keeping Input Width)</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--color-text-muted))] uppercase tracking-wider">Dimensions (Keeping Input Height)</th>
              </tr>
            </thead>
            <tbody className="bg-[rgb(var(--color-bg-component))] divide-y divide-[rgb(var(--color-border-base))]">
              {calculatedRatios.map((ratio) => (
                <tr key={ratio.name}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[rgb(var(--color-text-base))]">{ratio.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-[rgb(var(--color-text-muted))] font-mono">
                    {ratio.w1_originalWidth} x {ratio.h1_calculatedHeight}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-[rgb(var(--color-text-muted))] font-mono">
                    {ratio.w2_calculatedWidth} x {ratio.h2_originalHeight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}