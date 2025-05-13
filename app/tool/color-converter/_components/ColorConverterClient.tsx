// FILE: app/tool/color-converter/_components/ColorConverterClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import useToolState from '../../_hooks/useToolState';
import Button from '../../_components/form/Button';
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

// For storing the validated, numeric color values
interface ValidColorValues {
  hex: string; // Normalized hex (e.g., #RRGGBB)
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  l: number;
}

interface ColorConverterToolState {
  // User input fields - always strings
  hexInput: string;
  rInput: string;
  gInput: string;
  bInput: string;
  hInput: string;
  sInput: string;
  lInput: string;

  lastEditedField: InputMode;
  // Holds the structured, validated color data if current inputs are valid
  validColorValues: ValidColorValues | null;
}

const DEFAULT_COLOR_TOOL_STATE: ColorConverterToolState = {
  hexInput: '',
  rInput: '',
  gInput: '',
  bInput: '',
  hInput: '',
  sInput: '',
  lInput: '',
  lastEditedField: 'hex',
  validColorValues: null, // Initialize as null
};

const AUTO_PROCESS_DEBOUNCE_MS = 300;

interface ColorConverterClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function ColorConverterClient({
  urlStateParams,
  toolRoute,
}: ColorConverterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    clearState: persistentClearState,
  } = useToolState<ColorConverterToolState>(
    toolRoute,
    DEFAULT_COLOR_TOOL_STATE
  );

  const [uiError, setUiError] = useState<string>(''); // For UI display of errors
  const [copiedFormat, setCopiedFormat] = useState<CopiedFormat>(null);

  // console.log(`[ColorConverter] RENDER. LastEdited: ${toolState.lastEditedField}, Hex: ${toolState.hexInput}, Valid: ${!!toolState.validColorValues}, Error: "${uiError}"`);

  const convertAndSetColors = useCallback(
    (
      sourceMode: InputMode,
      currentInputState: Omit<
        ColorConverterToolState,
        'validColorValues' | 'lastEditedField'
      >
    ) => {
      // console.log(`[convertAndSetColors] Source: ${sourceMode}, Inputs:`, currentInputState);
      let newValidValues: ValidColorValues | null = null;
      let currentErrorMsg = '';

      let tempHex = currentInputState.hexInput;
      let tempR = currentInputState.rInput;
      let tempG = currentInputState.gInput;
      let tempB = currentInputState.bInput;
      let tempH = currentInputState.hInput;
      let tempS = currentInputState.sInput;
      let tempL = currentInputState.lInput;

      try {
        if (sourceMode === 'hex') {
          if (!currentInputState.hexInput.trim()) throw new Error('empty');
          const rgb = hexToRgb(currentInputState.hexInput);
          if (!rgb)
            throw new Error('Invalid Hex. Use #RRGGBB, #RGB, RRGGBB, or RGB.');
          const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
          newValidValues = {
            hex: rgbToHex(rgb.r, rgb.g, rgb.b),
            ...rgb,
            ...hsl,
          };
          tempR = String(rgb.r);
          tempG = String(rgb.g);
          tempB = String(rgb.b);
          tempH = String(hsl.h);
          tempS = String(hsl.s);
          tempL = String(hsl.l);
          tempHex = newValidValues.hex; // Use normalized hex
        } else if (sourceMode === 'rgb') {
          if (
            !currentInputState.rInput.trim() &&
            !currentInputState.gInput.trim() &&
            !currentInputState.bInput.trim()
          )
            throw new Error('empty');
          if (
            !currentInputState.rInput.trim() ||
            !currentInputState.gInput.trim() ||
            !currentInputState.bInput.trim()
          )
            throw new Error('All RGB inputs required if any is present.');
          const r = parseInt(currentInputState.rInput, 10),
            g = parseInt(currentInputState.gInput, 10),
            b = parseInt(currentInputState.bInput, 10);
          if (
            isNaN(r) ||
            isNaN(g) ||
            isNaN(b) ||
            r < 0 ||
            r > 255 ||
            g < 0 ||
            g > 255 ||
            b < 0 ||
            b > 255
          ) {
            throw new Error('Invalid RGB. Components must be numbers 0-255.');
          }
          const hex = rgbToHex(r, g, b);
          const hsl = rgbToHsl(r, g, b);
          newValidValues = { hex, r, g, b, ...hsl };
          tempHex = hex;
          tempH = String(hsl.h);
          tempS = String(hsl.s);
          tempL = String(hsl.l);
          // Keep user's valid number input string for r,g,b if they are valid numbers
          tempR = String(r);
          tempG = String(g);
          tempB = String(b);
        } else if (sourceMode === 'hsl') {
          if (
            !currentInputState.hInput.trim() &&
            !currentInputState.sInput.trim() &&
            !currentInputState.lInput.trim()
          )
            throw new Error('empty');
          if (
            !currentInputState.hInput.trim() ||
            !currentInputState.sInput.trim() ||
            !currentInputState.lInput.trim()
          )
            throw new Error('All HSL inputs required if any is present.');
          const h = parseInt(currentInputState.hInput, 10),
            s = parseInt(currentInputState.sInput, 10),
            l = parseInt(currentInputState.lInput, 10);
          if (
            isNaN(h) ||
            isNaN(s) ||
            isNaN(l) ||
            h < 0 ||
            h > 360 ||
            s < 0 ||
            s > 100 ||
            l < 0 ||
            l > 100
          ) {
            throw new Error('Invalid HSL. H: 0-360, S/L: 0-100.');
          }
          const rgb = hslToRgb(h, s, l);
          const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
          newValidValues = { hex, ...rgb, h, s, l };
          tempHex = hex;
          tempR = String(rgb.r);
          tempG = String(rgb.g);
          tempB = String(rgb.b);
          // Keep user's valid number input string for h,s,l
          tempH = String(h);
          tempS = String(s);
          tempL = String(l);
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'empty') {
          // If all relevant inputs for the sourceMode are empty, reset to default.
          // This means user cleared the source input field.
          setToolState(DEFAULT_COLOR_TOOL_STATE);
          setUiError(''); // Clear any previous error
          return; // Exit early
        }
        currentErrorMsg =
          err instanceof Error ? err.message : 'Unknown conversion error.';
      }

      setToolState({
        hexInput: tempHex,
        rInput: tempR,
        gInput: tempG,
        bInput: tempB,
        hInput: tempH,
        sInput: tempS,
        lInput: tempL,
        lastEditedField: sourceMode,
        validColorValues: newValidValues,
      });

      if (currentErrorMsg && uiError !== currentErrorMsg)
        setUiError(currentErrorMsg);
      else if (!currentErrorMsg && uiError) setUiError('');
    },
    [setToolState, uiError] // Added uiError to dependencies
  );

  const debouncedConvertAndSetColors = useDebouncedCallback(
    convertAndSetColors,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  // Effect for URL Param Loading
  useEffect(() => {
    if (isLoadingToolState || !urlStateParams || urlStateParams.length === 0)
      return;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<ColorConverterToolState> = {};
    let sourceForProcessing: InputMode | null = null;

    // Prioritize Hex from URL
    const pHex = params.get('hex');
    if (pHex !== null && pHex !== toolState.hexInput) {
      updates.hexInput = pHex;
      sourceForProcessing = 'hex';
    }

    // Then RGB from URL (all must be present to be considered an RGB update attempt)
    const pR = params.get('r');
    const pG = params.get('g');
    const pB = params.get('b');
    if (pR !== null && pG !== null && pB !== null) {
      if (
        pR !== toolState.rInput ||
        pG !== toolState.gInput ||
        pB !== toolState.bInput
      ) {
        updates.rInput = pR;
        updates.gInput = pG;
        updates.bInput = pB;
        if (!sourceForProcessing) sourceForProcessing = 'rgb';
      }
    }

    // Then HSL from URL
    const pH = params.get('h');
    const pS = params.get('s');
    const pL = params.get('l');
    if (pH !== null && pS !== null && pL !== null) {
      if (
        pH !== toolState.hInput ||
        pS !== toolState.sInput ||
        pL !== toolState.lInput
      ) {
        updates.hInput = pH;
        updates.sInput = pS;
        updates.lInput = pL;
        if (!sourceForProcessing) sourceForProcessing = 'hsl';
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.lastEditedField =
        sourceForProcessing || toolState.lastEditedField;
      updates.validColorValues = null; // Clear valid values, will be recalculated
      setToolState(updates);
    } else if (sourceForProcessing) {
      // URL params matched current state, but ensure processing happens for initial display
      const currentInputState = {
        hexInput: toolState.hexInput,
        rInput: toolState.rInput,
        gInput: toolState.gInput,
        bInput: toolState.bInput,
        hInput: toolState.hInput,
        sInput: toolState.sInput,
        lInput: toolState.lInput,
      };
      convertAndSetColors(sourceForProcessing, currentInputState);
    }
  }, [
    isLoadingToolState,
    urlStateParams,
    setToolState,
    convertAndSetColors,
    toolState.bInput,
    toolState.gInput,
    toolState.hInput,
    toolState.hexInput,
    toolState.lInput,
    toolState.lastEditedField,
    toolState.rInput,
    toolState.sInput,
  ]);

  // Main Effect for Processing input changes
  useEffect(() => {
    if (isLoadingToolState) return;

    const currentInputState = {
      hexInput: toolState.hexInput,
      rInput: toolState.rInput,
      gInput: toolState.gInput,
      bInput: toolState.bInput,
      hInput: toolState.hInput,
      sInput: toolState.sInput,
      lInput: toolState.lInput,
    };
    // Don't trigger if all inputs are effectively empty
    const hasAnyInput = Object.values(currentInputState).some(
      (val) => val.trim() !== ''
    );
    if (!hasAnyInput && !toolState.validColorValues && !uiError) {
      // if all inputs empty and no current valid color or error
      if (
        toolState.hexInput !== '' ||
        toolState.rInput !== '' ||
        toolState.gInput !== '' ||
        toolState.bInput !== '' ||
        toolState.hInput !== '' ||
        toolState.sInput !== '' ||
        toolState.lInput !== '' ||
        toolState.validColorValues !== null
      ) {
        // If any part of toolState is not default for empty, reset it.
        setToolState(DEFAULT_COLOR_TOOL_STATE);
      }
      if (uiError) setUiError('');
      return;
    }

    debouncedConvertAndSetColors(toolState.lastEditedField, currentInputState);
  }, [
    toolState.hexInput,
    toolState.rInput,
    toolState.gInput,
    toolState.bInput,
    toolState.hInput,
    toolState.sInput,
    toolState.lInput,
    toolState.lastEditedField,
    isLoadingToolState,
    debouncedConvertAndSetColors,
    setToolState,
    toolState.validColorValues,
    uiError,
  ]);

  const createChangeHandler =
    (
      field: keyof Omit<
        ColorConverterToolState,
        'lastEditedField' | 'validColorValues'
      >,
      mode: InputMode
    ) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setToolState({
        [field]: event.target.value,
        lastEditedField: mode,
        validColorValues: null, // Clear valid color on input change, it will be re-calculated
      } as Partial<ColorConverterToolState>);
      setCopiedFormat(null);
    };

  const handleHexChange = createChangeHandler('hexInput', 'hex');
  const handleRChange = createChangeHandler('rInput', 'rgb');
  const handleGChange = createChangeHandler('gInput', 'rgb');
  const handleBChange = createChangeHandler('bInput', 'rgb');
  const handleHChange = createChangeHandler('hInput', 'hsl');
  const handleSChange = createChangeHandler('sInput', 'hsl');
  const handleLChange = createChangeHandler('lInput', 'hsl');

  const handleClear = useCallback(async () => {
    await persistentClearState(); // This sets toolState to default and clears Dexie
    setUiError('');
    setCopiedFormat(null);
    debouncedConvertAndSetColors.cancel();
  }, [persistentClearState, debouncedConvertAndSetColors]);

  const handleCopy = useCallback(
    async (format: InputMode) => {
      if (!toolState.validColorValues) {
        setUiError('No valid color to copy.');
        return;
      }
      let textToCopy = '';
      try {
        if (format === 'hex') textToCopy = toolState.validColorValues.hex;
        else if (format === 'rgb')
          textToCopy = `rgb(${toolState.validColorValues.r}, ${toolState.validColorValues.g}, ${toolState.validColorValues.b})`;
        else if (format === 'hsl')
          textToCopy = `hsl(${toolState.validColorValues.h}, ${toolState.validColorValues.s}%, ${toolState.validColorValues.l}%)`;

        if (!textToCopy) throw new Error('Selected format has no value.');

        await navigator.clipboard.writeText(textToCopy);
        setCopiedFormat(format);
        if (uiError) setUiError('');
        setTimeout(() => setCopiedFormat(null), 2000);
      } catch (err) {
        setUiError(
          `Copy Error: ${err instanceof Error ? err.message : 'Failed to copy.'}`
        );
      }
    },
    [toolState.validColorValues, uiError]
  );

  const colorSwatchStyle = useMemo(() => {
    let backgroundColor = 'transparent';
    let borderColor = 'rgb(var(--color-input-border))';
    if (toolState.validColorValues) {
      backgroundColor = toolState.validColorValues.hex;
    } else if (uiError) {
      borderColor = 'rgb(var(--color-border-error))';
    }
    return {
      backgroundColor,
      borderColor,
      borderWidth: '2px',
      borderStyle: 'solid',
    };
  }, [toolState.validColorValues, uiError]);

  if (isLoadingToolState) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Color Converter...
      </p>
    );
  }

  const inputBaseClasses =
    'p-2 border rounded-md shadow-sm focus:outline-none text-base bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] placeholder:text-[rgb(var(--color-input-placeholder))] disabled:bg-gray-100 disabled:cursor-not-allowed';
  const inputBorderNormal =
    'border-[rgb(var(--color-input-border))] focus:border-[rgb(var(--color-input-focus-border))] focus:ring-1 focus:ring-[rgb(var(--color-input-focus-border))]';
  const inputBorderError =
    'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500';

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-5">
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
              value={toolState.hexInput}
              onChange={handleHexChange}
              placeholder="#ffffff"
              className={`${inputBaseClasses} flex-grow rounded-l-md font-mono ${uiError && toolState.lastEditedField === 'hex' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                uiError && toolState.lastEditedField === 'hex'
                  ? 'true'
                  : 'false'
              }
              aria-describedby={
                uiError && toolState.lastEditedField === 'hex'
                  ? 'input-error-feedback'
                  : undefined
              }
            />
            <Button
              variant={copiedFormat === 'hex' ? 'secondary' : 'neutral'}
              onClick={() => handleCopy('hex')}
              className="rounded-l-none px-3 border-l-0"
              disabled={!toolState.validColorValues}
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
              value={toolState.rInput}
              placeholder="R"
              onChange={handleRChange}
              aria-label="RGB Red"
              className={`w-1/3 ${inputBaseClasses} ${uiError && toolState.lastEditedField === 'rgb' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                uiError && toolState.lastEditedField === 'rgb'
                  ? 'true'
                  : 'false'
              }
            />
            <input
              type="number"
              min="0"
              max="255"
              value={toolState.gInput}
              placeholder="G"
              onChange={handleGChange}
              aria-label="RGB Green"
              className={`w-1/3 ${inputBaseClasses} ${uiError && toolState.lastEditedField === 'rgb' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                uiError && toolState.lastEditedField === 'rgb'
                  ? 'true'
                  : 'false'
              }
            />
            <input
              type="number"
              min="0"
              max="255"
              value={toolState.bInput}
              placeholder="B"
              onChange={handleBChange}
              aria-label="RGB Blue"
              className={`w-1/3 ${inputBaseClasses} ${uiError && toolState.lastEditedField === 'rgb' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                uiError && toolState.lastEditedField === 'rgb'
                  ? 'true'
                  : 'false'
              }
            />
            <Button
              variant={copiedFormat === 'rgb' ? 'secondary' : 'neutral'}
              onClick={() => handleCopy('rgb')}
              className="px-3"
              disabled={!toolState.validColorValues}
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
              value={toolState.hInput}
              placeholder="H"
              onChange={handleHChange}
              aria-label="HSL Hue"
              className={`w-1/3 ${inputBaseClasses} ${uiError && toolState.lastEditedField === 'hsl' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                uiError && toolState.lastEditedField === 'hsl'
                  ? 'true'
                  : 'false'
              }
            />
            <input
              type="number"
              min="0"
              max="100"
              value={toolState.sInput}
              placeholder="S"
              onChange={handleSChange}
              aria-label="HSL Saturation"
              className={`w-1/3 ${inputBaseClasses} ${uiError && toolState.lastEditedField === 'hsl' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                uiError && toolState.lastEditedField === 'hsl'
                  ? 'true'
                  : 'false'
              }
            />
            <input
              type="number"
              min="0"
              max="100"
              value={toolState.lInput}
              placeholder="L"
              onChange={handleLChange}
              aria-label="HSL Lightness"
              className={`w-1/3 ${inputBaseClasses} ${uiError && toolState.lastEditedField === 'hsl' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={
                uiError && toolState.lastEditedField === 'hsl'
                  ? 'true'
                  : 'false'
              }
            />
            <Button
              variant={copiedFormat === 'hsl' ? 'secondary' : 'neutral'}
              onClick={() => handleCopy('hsl')}
              className="px-3"
              disabled={!toolState.validColorValues}
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

      <div className="flex flex-wrap gap-4 items-center border-t border-[rgb(var(--color-border-base))] pt-4 mt-1 ml-auto">
        <div className="flex items-center gap-2 order-first md:order-none md:ml-0">
          <span className="text-sm text-[rgb(var(--color-text-muted))]">
            Preview:
          </span>
          <div
            className="h-10 w-20 rounded shadow-inner"
            style={colorSwatchStyle}
          ></div>
        </div>
        <Button variant="neutral" onClick={handleClear}>
          Clear All
        </Button>
      </div>

      {uiError && (
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
            <strong className="font-semibold">Error:</strong> {uiError}
          </div>
        </div>
      )}
    </div>
  );
}
