// FILE: app/tool/color-converter/_components/ColorConverterClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import Button from '@/app/tool/_components/form/Button';
import type { ParamConfig } from '@/src/types/tools';
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '@/app/lib/colorUtils';
import { useDebouncedCallback } from 'use-debounce';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

type InputMode = 'hex' | 'rgb' | 'hsl';
type CopiedFormat = InputMode | null;

interface ValidColorValues {
  hex: string;
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  l: number;
}

interface ColorConverterToolState {
  hexInput: string;
  rInput: string;
  gInput: string;
  bInput: string;
  hInput: string;
  sInput: string;
  lInput: string;
  lastEditedField: InputMode;
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
  validColorValues: null,
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
    clearStateAndPersist: persistentClearState,
  } = useToolState<ColorConverterToolState>(
    toolRoute,
    DEFAULT_COLOR_TOOL_STATE
  );

  const [uiError, setUiError] = useState<string>('');
  const [copiedFormat, setCopiedFormat] = useState<CopiedFormat>(null);

  const convertAndSetColors = useCallback(
    (
      sourceMode: InputMode,
      currentInputState: Omit<
        ColorConverterToolState,
        'lastEditedField' | 'validColorValues'
      >
    ) => {
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
          tempHex = newValidValues.hex;
        } else if (sourceMode === 'rgb') {
          if (
            !currentInputState.rInput.trim() &&
            !currentInputState.gInput.trim() &&
            !currentInputState.bInput.trim()
          )
            throw new Error('empty');
          if (
            currentInputState.rInput.trim() === '' ||
            currentInputState.gInput.trim() === '' ||
            currentInputState.bInput.trim() === ''
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
            currentInputState.hInput.trim() === '' ||
            currentInputState.sInput.trim() === '' ||
            currentInputState.lInput.trim() === ''
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

          tempH = String(h);
          tempS = String(s);
          tempL = String(l);
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'empty') {
          setToolState(DEFAULT_COLOR_TOOL_STATE);
          setUiError('');
          return;
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

      if (currentErrorMsg && uiError !== currentErrorMsg) {
        setUiError(currentErrorMsg);
      } else if (!currentErrorMsg && uiError) {
        setUiError('');
      }
    },
    [setToolState, uiError]
  );

  const debouncedConvertAndSetColors = useDebouncedCallback(
    convertAndSetColors,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (isLoadingToolState || !urlStateParams || urlStateParams.length === 0)
      return;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<ColorConverterToolState> = {};
    let sourceForProcessing: InputMode | null = null;

    const pHex = params.get('hex');
    if (pHex !== null && pHex !== toolState.hexInput) {
      updates.hexInput = pHex;
      sourceForProcessing = 'hex';
    }

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
      }
    }

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
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.lastEditedField =
        sourceForProcessing || toolState.lastEditedField;
      updates.validColorValues = null;
      setToolState((prev) => ({ ...prev, ...updates }));
    }
  }, [isLoadingToolState, urlStateParams, setToolState, toolState]);

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

    const hasAnyInput = Object.values(currentInputState).some(
      (val) => val.trim() !== ''
    );

    if (!hasAnyInput) {
      if (
        JSON.stringify(toolState) !== JSON.stringify(DEFAULT_COLOR_TOOL_STATE)
      ) {
        setToolState(DEFAULT_COLOR_TOOL_STATE);
      }
      if (uiError) setUiError('');
      debouncedConvertAndSetColors.cancel();
      return;
    }

    debouncedConvertAndSetColors(toolState.lastEditedField, currentInputState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        validColorValues: null,
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
    await persistentClearState();
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
      backgroundColor = 'rgba(var(--color-bg-error-subtle), 0.5)';
    }
    return {
      backgroundColor,
      borderColor,
      borderWidth: '2px',
      borderStyle: 'solid',

      minHeight: '2.5rem',
      minWidth: '5rem',
    };
  }, [toolState.validColorValues, uiError]);

  if (isLoadingToolState) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading Color Converter...
      </p>
    );
  }

  const inputBaseClasses =
    'p-2 border rounded-md shadow-sm focus:outline-none text-base bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] placeholder:text-[rgb(var(--color-input-placeholder))] disabled:bg-[rgb(var(--color-bg-subtle-hover))] disabled:cursor-not-allowed';
  const inputBorderNormal =
    'border-[rgb(var(--color-input-border))] focus:border-[rgb(var(--color-input-focus-border))]';
  const inputBorderError =
    'border-[rgb(var(--color-border-error))] focus:border-[rgb(var(--color-border-error))]';

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-5">
        {/* Hex Input Group */}
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
              aria-invalid={!!(uiError && toolState.lastEditedField === 'hex')}
              aria-describedby={
                uiError && toolState.lastEditedField === 'hex'
                  ? 'conversion-error-feedback'
                  : undefined
              }
            />
            <Button
              variant="accent2"
              onClick={() => handleCopy('hex')}
              className="rounded-l-none px-3 border-l-0"
              disabled={copiedFormat === 'hex'}
              iconLeft={
                copiedFormat === 'hex' ? (
                  <CheckIcon className="h-5 w-5" />
                ) : (
                  <ClipboardDocumentIcon className="h-5 w-5" />
                )
              }
              title={copiedFormat === 'hex' ? 'Copied!' : 'Copy Hex'}
            >
              Copy
            </Button>
          </div>
        </div>

        {/* RGB Input Group */}
        <div className="md:col-span-1 space-y-1">
          <label
            className={`block text-sm font-medium mb-1 ${toolState.lastEditedField === 'rgb' ? 'text-[rgb(var(--color-text-base))] font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}
          >
            RGB (0-255)
          </label>
          <div className="flex items-stretch gap-1">
            <input
              type="number"
              id="rgb-r-input"
              min="0"
              max="255"
              value={toolState.rInput}
              placeholder="R"
              onChange={handleRChange}
              aria-label="RGB Red"
              className={`w-1/3 ${inputBaseClasses} ${uiError && toolState.lastEditedField === 'rgb' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={!!(uiError && toolState.lastEditedField === 'rgb')}
              aria-describedby={
                uiError && toolState.lastEditedField === 'rgb'
                  ? 'conversion-error-feedback'
                  : undefined
              }
            />
            <input
              type="number"
              id="rgb-g-input"
              min="0"
              max="255"
              value={toolState.gInput}
              placeholder="G"
              onChange={handleGChange}
              aria-label="RGB Green"
              className={`w-1/3 ${inputBaseClasses} ${uiError && toolState.lastEditedField === 'rgb' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={!!(uiError && toolState.lastEditedField === 'rgb')}
            />
            <input
              type="number"
              id="rgb-b-input"
              min="0"
              max="255"
              value={toolState.bInput}
              placeholder="B"
              onChange={handleBChange}
              aria-label="RGB Blue"
              className={`w-1/3 ${inputBaseClasses} ${uiError && toolState.lastEditedField === 'rgb' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={!!(uiError && toolState.lastEditedField === 'rgb')}
            />
            <Button
              variant="accent2"
              onClick={() => handleCopy('rgb')}
              className="rounded-l-none px-3 border-l-0"
              disabled={copiedFormat === 'rgb'}
              iconLeft={
                copiedFormat === 'rgb' ? (
                  <CheckIcon className="h-5 w-5" />
                ) : (
                  <ClipboardDocumentIcon className="h-5 w-5" />
                )
              }
              title={copiedFormat === 'rgb' ? 'Copied!' : 'Copy RGB'}
            >
              Copy
            </Button>
          </div>
        </div>

        {/* HSL Input Group */}
        <div className="md:col-span-1 space-y-1">
          <label
            className={`block text-sm font-medium mb-1 ${toolState.lastEditedField === 'hsl' ? 'text-[rgb(var(--color-text-base))] font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}
          >
            HSL (H:0-360, S/L:0-100)
          </label>
          <div className="flex items-stretch gap-1">
            <input
              type="number"
              id="hsl-h-input"
              min="0"
              max="360"
              value={toolState.hInput}
              placeholder="H"
              onChange={handleHChange}
              aria-label="HSL Hue"
              className={`w-1/3 ${inputBaseClasses} ${uiError && toolState.lastEditedField === 'hsl' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={!!(uiError && toolState.lastEditedField === 'hsl')}
              aria-describedby={
                uiError && toolState.lastEditedField === 'hsl'
                  ? 'conversion-error-feedback'
                  : undefined
              }
            />
            <input
              type="number"
              id="hsl-s-input"
              min="0"
              max="100"
              value={toolState.sInput}
              placeholder="S"
              onChange={handleSChange}
              aria-label="HSL Saturation"
              className={`w-1/3 ${inputBaseClasses} ${uiError && toolState.lastEditedField === 'hsl' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={!!(uiError && toolState.lastEditedField === 'hsl')}
            />
            <input
              type="number"
              id="hsl-l-input"
              min="0"
              max="100"
              value={toolState.lInput}
              placeholder="L"
              onChange={handleLChange}
              aria-label="HSL Lightness"
              className={`w-1/3 ${inputBaseClasses} ${uiError && toolState.lastEditedField === 'hsl' ? inputBorderError : inputBorderNormal}`}
              aria-invalid={!!(uiError && toolState.lastEditedField === 'hsl')}
            />
            <Button
              variant="accent2"
              onClick={() => handleCopy('hsl')}
              className="rounded-l-none px-3 border-l-0"
              disabled={copiedFormat === 'hsl'}
              iconLeft={
                copiedFormat === 'hsl' ? (
                  <CheckIcon className="h-5 w-5" />
                ) : (
                  <ClipboardDocumentIcon className="h-5 w-5" />
                )
              }
              title={copiedFormat === 'hsl' ? 'Copied!' : 'Copy HSL'}
            >
              Copy
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end flex-wrap gap-4 items-center border-t border-[rgb(var(--color-border-base))] pt-4 mt-1 pl-auto">
        <div className="flex items-center gap-2 order-first md:order-none md:ml-0">
          <span className="text-sm text-[rgb(var(--color-text-muted))]">
            Preview:
          </span>
          <div
            className="h-10 w-20 rounded shadow-inner"
            style={colorSwatchStyle}
            aria-label="Current color preview"
          ></div>
        </div>
        <Button
          variant="neutral"
          onClick={handleClear}
          iconLeft={<XCircleIcon className="h-5 w-5" />}
        >
          Clear
        </Button>
      </div>

      {uiError && (
        <div
          role="alert"
          id="conversion-error-feedback"
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
