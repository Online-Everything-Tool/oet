// FILE: app/tool/color-converter/_components/ColorConverterClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import type { TriggerType } from '@/src/types/history';
import useToolState from '../../_hooks/useToolState';
import Button from '../../_components/form/Button'; // Assuming Button is in form folder
// We'll use standard <input> for now, can be replaced by shared <Input /> later
import type { ParamConfig } from '@/src/types/tools';
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '@/app/lib/colorUtils';
import { useDebouncedCallback } from 'use-debounce';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type InputMode = 'hex' | 'rgb' | 'hsl';
type CopiedFormat = InputMode | null;

interface ColorConverterToolState {
  hex: string;
  r: string;
  g: string;
  b: string;
  h: string;
  s: string;
  l: string;
  lastEditedField: InputMode;
}

const DEFAULT_COLOR_TOOL_STATE: ColorConverterToolState = {
  hex: '',
  r: '',
  g: '',
  b: '',
  h: '',
  s: '',
  l: '',
  lastEditedField: 'hex',
};

const AUTO_PROCESS_DEBOUNCE_MS = 300;

interface ColorConverterClientProps {
  urlStateParams: ParamConfig[];
  toolTitle: string;
  toolRoute: string;
}

export default function ColorConverterClient({
  urlStateParams,
  toolTitle,
  toolRoute,
}: ColorConverterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
  } = useToolState<ColorConverterToolState>(
    toolRoute,
    DEFAULT_COLOR_TOOL_STATE
  );

  const [error, setError] = useState<string>('');
  const [copiedFormat, setCopiedFormat] = useState<CopiedFormat>(null);
  const { addHistoryEntry } = useHistory();

  const convertColors = useCallback(
    (
      sourceMode: InputMode,
      currentToolState: ColorConverterToolState,
      triggerType: TriggerType = 'auto'
    ) => {
      setError('');
      setCopiedFormat(null);
      let status: 'success' | 'error' = 'success';
      let currentError = '';
      let inputDetails: Record<string, unknown> = {};
      let outputDetails: Record<string, unknown> = {};

      let newHex = currentToolState.hex,
        newR = currentToolState.r,
        newG = currentToolState.g,
        newB = currentToolState.b,
        newH = currentToolState.h,
        newS = currentToolState.s,
        newL = currentToolState.l;

      try {
        if (sourceMode === 'hex') {
          if (!currentToolState.hex.trim()) {
            setToolState(DEFAULT_COLOR_TOOL_STATE);
            return;
          } // Clear all if hex is cleared
          inputDetails = { hex: currentToolState.hex };
          const rgbResult = hexToRgb(currentToolState.hex);
          if (rgbResult) {
            const hslResult = rgbToHsl(rgbResult.r, rgbResult.g, rgbResult.b);
            newR = String(rgbResult.r);
            newG = String(rgbResult.g);
            newB = String(rgbResult.b);
            newH = String(hslResult.h);
            newS = String(hslResult.s);
            newL = String(hslResult.l);
            // Re-set hex from a valid conversion to normalize it (e.g. #fff -> #FFFFFF)
            newHex = rgbToHex(rgbResult.r, rgbResult.g, rgbResult.b);
            outputDetails = {
              rgb: `rgb(${newR},${newG},${newB})`,
              hsl: `hsl(${newH},${newS}%,${newL}%)`,
            };
          } else {
            throw new Error('Invalid Hex. Use #RRGGBB, #RGB, RRGGBB, or RGB.');
          }
        } else if (sourceMode === 'rgb') {
          if (
            !currentToolState.r.trim() &&
            !currentToolState.g.trim() &&
            !currentToolState.b.trim() &&
            !currentToolState.hex.trim() &&
            !currentToolState.h.trim()
          ) {
            setToolState(DEFAULT_COLOR_TOOL_STATE);
            return;
          }
          if (
            !currentToolState.r.trim() ||
            !currentToolState.g.trim() ||
            !currentToolState.b.trim()
          )
            throw new Error('All RGB inputs are required.');
          const rNum = parseInt(currentToolState.r, 10),
            gNum = parseInt(currentToolState.g, 10),
            bNum = parseInt(currentToolState.b, 10);
          inputDetails = {
            r: currentToolState.r,
            g: currentToolState.g,
            b: currentToolState.b,
          };
          if (
            isNaN(rNum) ||
            isNaN(gNum) ||
            isNaN(bNum) ||
            rNum < 0 ||
            rNum > 255 ||
            gNum < 0 ||
            gNum > 255 ||
            bNum < 0 ||
            bNum > 255
          ) {
            throw new Error('Invalid RGB. Components: 0-255.');
          }
          newHex = rgbToHex(rNum, gNum, bNum);
          const hslResult = rgbToHsl(rNum, gNum, bNum);
          newH = String(hslResult.h);
          newS = String(hslResult.s);
          newL = String(hslResult.l);
          // Ensure r,g,b in state match parsed numbers if they were valid
          newR = String(rNum);
          newG = String(gNum);
          newB = String(bNum);
          outputDetails = {
            hex: newHex,
            hsl: `hsl(${newH},${newS}%,${newL}%)`,
          };
        } else if (sourceMode === 'hsl') {
          if (
            !currentToolState.h.trim() &&
            !currentToolState.s.trim() &&
            !currentToolState.l.trim() &&
            !currentToolState.hex.trim() &&
            !currentToolState.r.trim()
          ) {
            setToolState(DEFAULT_COLOR_TOOL_STATE);
            return;
          }
          if (
            !currentToolState.h.trim() ||
            !currentToolState.s.trim() ||
            !currentToolState.l.trim()
          )
            throw new Error('All HSL inputs are required.');
          const hNum = parseInt(currentToolState.h, 10),
            sNum = parseInt(currentToolState.s, 10),
            lNum = parseInt(currentToolState.l, 10);
          inputDetails = {
            h: currentToolState.h,
            s: currentToolState.s,
            l: currentToolState.l,
          };
          if (
            isNaN(hNum) ||
            isNaN(sNum) ||
            isNaN(lNum) ||
            hNum < 0 ||
            hNum > 360 ||
            sNum < 0 ||
            sNum > 100 ||
            lNum < 0 ||
            lNum > 100
          ) {
            throw new Error('Invalid HSL. H:0-360, S/L:0-100.');
          }
          const rgbResult = hslToRgb(hNum, sNum, lNum);
          newHex = rgbToHex(rgbResult.r, rgbResult.g, rgbResult.b);
          newR = String(rgbResult.r);
          newG = String(rgbResult.g);
          newB = String(rgbResult.b);
          // Ensure h,s,l in state match parsed numbers if they were valid
          newH = String(hNum);
          newS = String(sNum);
          newL = String(lNum);
          outputDetails = { hex: newHex, rgb: `rgb(${newR},${newG},${newB})` };
        } else {
          throw new Error('Invalid conversion source.');
        }

        setToolState({
          hex: newHex,
          r: newR,
          g: newG,
          b: newB,
          h: newH,
          s: newS,
          l: newL,
          lastEditedField: sourceMode,
        });
      } catch (err) {
        currentError =
          err instanceof Error ? err.message : 'Unknown conversion error.';
        setError(currentError);
        status = 'error';
        if (sourceMode === 'hex')
          inputDetails = { hex: currentToolState.hex, error: currentError };
        else if (sourceMode === 'rgb')
          inputDetails = {
            r: currentToolState.r,
            g: currentToolState.g,
            b: currentToolState.b,
            error: currentError,
          };
        else if (sourceMode === 'hsl')
          inputDetails = {
            h: currentToolState.h,
            s: currentToolState.s,
            l: currentToolState.l,
            error: currentError,
          };
        else inputDetails = { error: currentError };
        // Don't clear other fields on error, let user see what they typed
      }
      // Only log history if there was a definitive input attempt
      if (
        Object.keys(inputDetails).length > 0 &&
        !(Object.keys(inputDetails).length === 1 && inputDetails.error)
      ) {
        addHistoryEntry({
          toolName: toolTitle,
          toolRoute: toolRoute,
          trigger: triggerType,
          input: inputDetails,
          output:
            status === 'success' ? outputDetails : `Error: ${currentError}`,
          status: status,
          eventTimestamp: Date.now(),
        });
      }
    },
    [addHistoryEntry, toolTitle, toolRoute, setToolState]
  );

  const debouncedConvertColors = useDebouncedCallback(
    convertColors,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  // In ColorConverterClient.tsx

  // Effect for initial URL param load
  useEffect(() => {
    if (!isLoadingToolState && urlStateParams?.length > 0) {
      const params = new URLSearchParams(window.location.search);
      let determinedSourceToUse: InputMode | null = null;
      const newStateFromUrl: Partial<ColorConverterToolState> = {};
      let changedByUrl = false;

      // Check Hex first
      const pHex = params.get('hex');
      if (pHex !== null && pHex.trim()) {
        if (pHex !== toolState.hex) {
          newStateFromUrl.hex = pHex;
          changedByUrl = true;
        }
        determinedSourceToUse = 'hex';
      }

      // Check RGB
      const pR = params.get('r');
      const pG = params.get('g');
      const pB = params.get('b');
      if (pR !== null && pG !== null && pB !== null) {
        // All RGB params must be present
        if (pR.trim() || pG.trim() || pB.trim()) {
          // At least one must have content
          if (pR !== toolState.r || pG !== toolState.g || pB !== toolState.b) {
            newStateFromUrl.r = pR;
            newStateFromUrl.g = pG;
            newStateFromUrl.b = pB;
            changedByUrl = true;
          }
          if (!determinedSourceToUse) determinedSourceToUse = 'rgb';
        }
      }

      // Check HSL
      const pH = params.get('h');
      const pS = params.get('s');
      const pL = params.get('l');
      if (pH !== null && pS !== null && pL !== null) {
        // All HSL params must be present
        if (pH.trim() || pS.trim() || pL.trim()) {
          // At least one must have content
          if (pH !== toolState.h || pS !== toolState.s || pL !== toolState.l) {
            newStateFromUrl.h = pH;
            newStateFromUrl.s = pS;
            newStateFromUrl.l = pL;
            changedByUrl = true;
          }
          if (!determinedSourceToUse) determinedSourceToUse = 'hsl';
        }
      }

      if (changedByUrl && Object.keys(newStateFromUrl).length > 0) {
        setToolState((prev) => ({
          ...prev,
          ...newStateFromUrl,
          lastEditedField: determinedSourceToUse || prev.lastEditedField,
        }));
        // Auto-conversion will be triggered by the other useEffect watching toolState changes
      } else if (determinedSourceToUse) {
        // URL params were present but matched current state, or only one part of a group was present
        // but enough to determine a source. We might still want to trigger a conversion
        // if, for example, only 'hex' was in URL and it matches toolState.hex, but RGB/HSL in toolState are empty.
        // The `convertColors` function itself handles empty source fields.
        // We also need to make sure there's *some* content to trigger a conversion.
        let hasContentForSource = false;
        if (determinedSourceToUse === 'hex' && toolState.hex.trim())
          hasContentForSource = true;
        else if (
          determinedSourceToUse === 'rgb' &&
          (toolState.r.trim() || toolState.g.trim() || toolState.b.trim())
        )
          hasContentForSource = true;
        else if (
          determinedSourceToUse === 'hsl' &&
          (toolState.h.trim() || toolState.s.trim() || toolState.l.trim())
        )
          hasContentForSource = true;

        if (hasContentForSource) {
          setTimeout(
            () => convertColors(determinedSourceToUse, toolState, 'query'),
            0
          );
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingToolState, urlStateParams, setToolState]); // convertColors and toolState are intentionally omitted

  // Effect for auto-processing on toolState change (except lastEditedField if only that changes)
  useEffect(() => {
    if (!isLoadingToolState) {
      // Don't run on initial load before state is settled
      const { lastEditedField, ...colorValues } = toolState; // Get current values
      const stateToProcess: ColorConverterToolState = {
        ...colorValues,
        lastEditedField,
      }; // Reconstruct with current lastEditedField

      // Check if any actual color value is present before debouncing
      const hasAnyColorValue =
        toolState.hex.trim() ||
        toolState.r.trim() ||
        toolState.g.trim() ||
        toolState.b.trim() ||
        toolState.h.trim() ||
        toolState.s.trim() ||
        toolState.l.trim();

      if (hasAnyColorValue) {
        debouncedConvertColors(
          toolState.lastEditedField,
          stateToProcess,
          'auto'
        );
      } else {
        // If all inputs are cleared, reset everything
        setError('');
        setToolState(DEFAULT_COLOR_TOOL_STATE); // Reset to default if all inputs become empty
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    toolState.hex,
    toolState.r,
    toolState.g,
    toolState.b,
    toolState.h,
    toolState.s,
    toolState.l,
    toolState.lastEditedField,
    isLoadingToolState,
    debouncedConvertColors,
  ]); // Added setToolState to deps if clearing to default

  const createChangeHandler =
    (field: keyof ColorConverterToolState, mode: InputMode) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setToolState({
        [field]: event.target.value,
        lastEditedField: mode,
      } as Partial<ColorConverterToolState>);
      // Debounced conversion will be triggered by useEffect
      setCopiedFormat(null); // Reset copy success on any input change
    };

  const handleHexChange = createChangeHandler('hex', 'hex');
  const handleRChange = createChangeHandler('r', 'rgb');
  const handleGChange = createChangeHandler('g', 'rgb');
  const handleBChange = createChangeHandler('b', 'rgb');
  const handleHChange = createChangeHandler('h', 'hsl');
  const handleSChange = createChangeHandler('s', 'hsl');
  const handleLChange = createChangeHandler('l', 'hsl');

  const handleClear = useCallback(() => {
    setToolState(DEFAULT_COLOR_TOOL_STATE);
    setError('');
    setCopiedFormat(null);
    debouncedConvertColors.cancel();
  }, [setToolState, debouncedConvertColors]);

  const handleCopy = useCallback(
    async (format: CopiedFormat) => {
      // ... (Copy logic remains the same, using toolState values)
      if (!format) return;
      let textToCopy = '';
      setError(''); // Clear previous errors
      // setCopiedFormat(null); // Cleared by input change or new convert

      try {
        if (format === 'hex') textToCopy = toolState.hex;
        else if (format === 'rgb')
          textToCopy = `rgb(${toolState.r}, ${toolState.g}, ${toolState.b})`;
        else if (format === 'hsl')
          textToCopy = `hsl(${toolState.h}, ${toolState.s}%, ${toolState.l}%)`;

        if (
          !textToCopy.trim() ||
          (format === 'hex' && !toolState.hex.trim()) ||
          (format === 'rgb' &&
            (!toolState.r.trim() ||
              !toolState.g.trim() ||
              !toolState.b.trim())) ||
          (format === 'hsl' &&
            (!toolState.h.trim() || !toolState.s.trim() || !toolState.l.trim()))
        ) {
          throw new Error('No valid color value to copy.');
        }
        await navigator.clipboard.writeText(textToCopy);
        setCopiedFormat(format);
        setTimeout(() => setCopiedFormat(null), 2000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to copy.';
        setError(`Copy Error: ${message}`);
      }
    },
    [
      toolState.hex,
      toolState.r,
      toolState.g,
      toolState.b,
      toolState.h,
      toolState.s,
      toolState.l,
    ]
  );

  const colorSwatchStyle = useMemo(() => {
    /* ... as before, using toolState ... */
    let backgroundColor = 'transparent';
    let borderColor = 'rgb(var(--color-input-border))'; // Default border
    if (
      !error &&
      toolState.r.trim() &&
      toolState.g.trim() &&
      toolState.b.trim()
    ) {
      // Check if RGB values are non-empty
      const rNum = parseInt(toolState.r, 10);
      const gNum = parseInt(toolState.g, 10);
      const bNum = parseInt(toolState.b, 10);
      if (
        !isNaN(rNum) &&
        !isNaN(gNum) &&
        !isNaN(bNum) &&
        rNum >= 0 &&
        rNum <= 255 &&
        gNum >= 0 &&
        gNum <= 255 &&
        bNum >= 0 &&
        bNum <= 255
      ) {
        backgroundColor = `rgb(${rNum}, ${gNum}, ${bNum})`;
      } else {
        backgroundColor = 'transparent'; // Invalid RGB numbers, keep transparent
      }
    } else if (!error && toolState.hex.trim() && hexToRgb(toolState.hex)) {
      // if hex is valid, try to use it
      const rgbFromHex = hexToRgb(toolState.hex);
      if (rgbFromHex)
        backgroundColor = `rgb(${rgbFromHex.r}, ${rgbFromHex.g}, ${rgbFromHex.b})`;
    }

    if (error) {
      borderColor = 'rgb(var(--color-border-error))';
    }
    return {
      backgroundColor,
      borderColor,
      borderWidth: '2px',
      borderStyle: 'solid',
    };
  }, [toolState.r, toolState.g, toolState.b, toolState.hex, error]);

  if (isLoadingToolState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Color Converter...
      </p>
    );
  }

  // Common input classes
  const inputBaseClasses =
    'p-2 border rounded-md shadow-sm focus:outline-none text-base bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] placeholder:text-[rgb(var(--color-input-placeholder))] disabled:bg-gray-100 disabled:cursor-not-allowed';
  const inputBorderNormal =
    'border-[rgb(var(--color-input-border))] focus:border-[rgb(var(--color-input-focus-border))] focus:ring-1 focus:ring-[rgb(var(--color-input-focus-border))]';
  const inputBorderError =
    'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500';

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-5">
        {/* Hex Input */}
        <div className="md:col-span-1 space-y-1">
          <label
            htmlFor="hex-input"
            className={`block text-sm font-medium mb-1 ${toolState.lastEditedField === 'hex' ? 'text-[rgb(var(--color-text-base))] font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}
          >
            Hex Color (#RRGGBB)
          </label>
          <div className="flex">
            <input
              type="text"
              id="hex-input"
              value={toolState.hex}
              onChange={handleHexChange}
              placeholder="#ffffff"
              className={`${inputBaseClasses} flex-grow rounded-l-md font-mono ${error && toolState.lastEditedField === 'hex' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                error && toolState.lastEditedField === 'hex' ? 'true' : 'false'
              }
              aria-describedby={
                error && toolState.lastEditedField === 'hex'
                  ? 'input-error-feedback'
                  : undefined
              }
            />
            <Button
              variant={copiedFormat === 'hex' ? 'secondary' : 'neutral'}
              onClick={() => handleCopy('hex')}
              className="rounded-l-none px-3 border-l-0"
              disabled={!toolState.hex.trim() || !!error}
              iconLeft={
                copiedFormat === 'hex' ? (
                  <CheckIcon className="h-5 w-5" />
                ) : (
                  <ClipboardDocumentIcon className="h-5 w-5" />
                )
              }
              title={copiedFormat === 'hex' ? 'Copied!' : 'Copy Hex'}
            >
              {copiedFormat === 'hex' ? (
                ''
              ) : (
                <span className="sr-only">Copy Hex</span>
              )}
            </Button>
          </div>
        </div>
        {/* RGB Inputs */}
        <div className="md:col-span-1 space-y-1">
          <label
            className={`block text-sm font-medium mb-1 ${toolState.lastEditedField === 'rgb' ? 'text-[rgb(var(--color-text-base))] font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}
          >
            RGB (0-255)
          </label>
          <div className="flex items-stretch gap-1">
            <input
              type="number"
              min="0"
              max="255"
              value={toolState.r}
              placeholder="R"
              onChange={handleRChange}
              aria-label="RGB Red"
              className={`w-1/3 ${inputBaseClasses} ${error && toolState.lastEditedField === 'rgb' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                error && toolState.lastEditedField === 'rgb' ? 'true' : 'false'
              }
            />
            <input
              type="number"
              min="0"
              max="255"
              value={toolState.g}
              placeholder="G"
              onChange={handleGChange}
              aria-label="RGB Green"
              className={`w-1/3 ${inputBaseClasses} ${error && toolState.lastEditedField === 'rgb' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                error && toolState.lastEditedField === 'rgb' ? 'true' : 'false'
              }
            />
            <input
              type="number"
              min="0"
              max="255"
              value={toolState.b}
              placeholder="B"
              onChange={handleBChange}
              aria-label="RGB Blue"
              className={`w-1/3 ${inputBaseClasses} ${error && toolState.lastEditedField === 'rgb' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                error && toolState.lastEditedField === 'rgb' ? 'true' : 'false'
              }
            />
            <Button
              variant={copiedFormat === 'rgb' ? 'secondary' : 'neutral'}
              onClick={() => handleCopy('rgb')}
              className="px-3"
              disabled={
                !toolState.r.trim() ||
                !toolState.g.trim() ||
                !toolState.b.trim() ||
                !!error
              }
              iconLeft={
                copiedFormat === 'rgb' ? (
                  <CheckIcon className="h-5 w-5" />
                ) : (
                  <ClipboardDocumentIcon className="h-5 w-5" />
                )
              }
              title={copiedFormat === 'rgb' ? 'Copied!' : 'Copy RGB'}
            >
              {copiedFormat === 'rgb' ? (
                ''
              ) : (
                <span className="sr-only">Copy RGB</span>
              )}
            </Button>
          </div>
        </div>
        {/* HSL Inputs */}
        <div className="md:col-span-1 space-y-1">
          <label
            className={`block text-sm font-medium mb-1 ${toolState.lastEditedField === 'hsl' ? 'text-[rgb(var(--color-text-base))] font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}
          >
            HSL (H:0-360, S/L:0-100)
          </label>
          <div className="flex items-stretch gap-1">
            <input
              type="number"
              min="0"
              max="360"
              value={toolState.h}
              placeholder="H"
              onChange={handleHChange}
              aria-label="HSL Hue"
              className={`w-1/3 ${inputBaseClasses} ${error && toolState.lastEditedField === 'hsl' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                error && toolState.lastEditedField === 'hsl' ? 'true' : 'false'
              }
            />
            <input
              type="number"
              min="0"
              max="100"
              value={toolState.s}
              placeholder="S"
              onChange={handleSChange}
              aria-label="HSL Saturation"
              className={`w-1/3 ${inputBaseClasses} ${error && toolState.lastEditedField === 'hsl' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                error && toolState.lastEditedField === 'hsl' ? 'true' : 'false'
              }
            />
            <input
              type="number"
              min="0"
              max="100"
              value={toolState.l}
              placeholder="L"
              onChange={handleLChange}
              aria-label="HSL Lightness"
              className={`w-1/3 ${inputBaseClasses} ${error && toolState.lastEditedField === 'hsl' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                error && toolState.lastEditedField === 'hsl' ? 'true' : 'false'
              }
            />
            <Button
              variant={copiedFormat === 'hsl' ? 'secondary' : 'neutral'}
              onClick={() => handleCopy('hsl')}
              className="px-3"
              disabled={
                !toolState.h.trim() ||
                !toolState.s.trim() ||
                !toolState.l.trim() ||
                !!error
              }
              iconLeft={
                copiedFormat === 'hsl' ? (
                  <CheckIcon className="h-5 w-5" />
                ) : (
                  <ClipboardDocumentIcon className="h-5 w-5" />
                )
              }
              title={copiedFormat === 'hsl' ? 'Copied!' : 'Copy HSL'}
            >
              {copiedFormat === 'hsl' ? (
                ''
              ) : (
                <span className="sr-only">Copy HSL</span>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center border-t border-[rgb(var(--color-border-base))] pt-4 mt-1">
        {/* Convert button removed, auto-processing is active */}
        <Button variant="neutral" onClick={handleClear} className="ml-auto">
          Clear All
        </Button>
        <div className="flex items-center gap-2 order-first md:order-none md:ml-0">
          <span className="text-sm text-[rgb(var(--color-text-muted))]">
            Preview:
          </span>
          <div
            className="h-10 w-20 rounded shadow-inner"
            style={colorSwatchStyle}
          ></div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          id="input-error-feedback"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        </div>
      )}
    </div>
  );
}
