'use client';

import React, { useState, useCallback, useEffect } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import Range from '@/app/tool/_components/form/Range';
import Input from '@/app/tool/_components/form/Input';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import Button from '@/app/tool/_components/form/Button';
import Textarea from '@/app/tool/_components/form/Textarea';
import SendToToolButton from '@/app/tool/_components/shared/SendToToolButton';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import metadata from '../metadata.json';

interface BoxShadowState {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadRadius: number;
  shadowColor: string;
  shadowOpacity: number;
  isInset: boolean;
  outputCss: string;
}

const DEFAULT_STATE: BoxShadowState = {
  offsetX: 10,
  offsetY: 10,
  blurRadius: 5,
  spreadRadius: 0,
  shadowColor: '#000000',
  shadowOpacity: 0.5,
  isInset: false,
  outputCss: '',
};

const hexToRgba = (hex: string, opacity: number): string => {
  let c: any;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    return `rgba(${r},${g},${b},${opacity.toFixed(2)})`;
  }
  // Fallback for invalid hex
  return `rgba(0,0,0,${opacity.toFixed(2)})`;
};

export default function CssBoxShadowGeneratorClient({
  toolRoute,
}: {
  toolRoute: string;
}) {
  const { state, setState, isLoadingState, clearStateAndPersist } =
    useToolState<BoxShadowState>(toolRoute, DEFAULT_STATE);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const rgbaColor = hexToRgba(state.shadowColor, state.shadowOpacity);
    const newCss = `${state.isInset ? 'inset ' : ''}${state.offsetX}px ${state.offsetY}px ${state.blurRadius}px ${state.spreadRadius}px ${rgbaColor}`;
    if (newCss !== state.outputCss) {
      setState({ outputCss: newCss });
    }
  }, [
    state.offsetX,
    state.offsetY,
    state.blurRadius,
    state.spreadRadius,
    state.shadowColor,
    state.shadowOpacity,
    state.isInset,
    state.outputCss,
    setState,
  ]);

  const handleReset = useCallback(() => {
    clearStateAndPersist();
  }, [clearStateAndPersist]);

  const handleCopy = useCallback(async () => {
    if (!state.outputCss) return;
    const textToCopy = `box-shadow: ${state.outputCss};`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }, [state.outputCss]);

  if (isLoadingState) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading CSS Box Shadow Generator...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls Panel */}
        <div className="p-6 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-subtle))] space-y-5">
          <h2 className="text-lg font-semibold text-[rgb(var(--color-text-emphasis))]">
            Shadow Controls
          </h2>
          <Range
            label="Horizontal Offset (px)"
            min={-100}
            max={100}
            value={state.offsetX}
            onChange={e => setState({ offsetX: parseInt(e.target.value, 10) })}
          />
          <Range
            label="Vertical Offset (px)"
            min={-100}
            max={100}
            value={state.offsetY}
            onChange={e => setState({ offsetY: parseInt(e.target.value, 10) })}
          />
          <Range
            label="Blur Radius (px)"
            min={0}
            max={100}
            value={state.blurRadius}
            onChange={e =>
              setState({ blurRadius: parseInt(e.target.value, 10) })
            }
          />
          <Range
            label="Spread Radius (px)"
            min={-50}
            max={100}
            value={state.spreadRadius}
            onChange={e =>
              setState({ spreadRadius: parseInt(e.target.value, 10) })
            }
          />
          <Range
            label="Shadow Opacity"
            min={0}
            max={1}
            step={0.01}
            value={state.shadowOpacity}
            onChange={e =>
              setState({ shadowOpacity: parseFloat(e.target.value) })
            }
          />
          <div className="flex items-center justify-between gap-4 pt-2">
            <Input
              label="Shadow Color"
              type="color"
              value={state.shadowColor}
              onChange={e => setState({ shadowColor: e.target.value })}
              inputClassName="h-10 w-16 p-1"
            />
            <Checkbox
              label="Inset Shadow"
              id="inset-checkbox"
              checked={state.isInset}
              onChange={e => setState({ isInset: e.target.checked })}
            />
          </div>
        </div>

        {/* Preview and Output Panel */}
        <div className="flex flex-col gap-6">
          <div className="p-6 border border-[rgb(var(--color-border-base))] rounded-lg flex-grow flex items-center justify-center bg-[rgb(var(--color-bg-subtle))]">
            <div
              className="w-48 h-48 bg-[rgb(var(--color-bg-component))] rounded-lg transition-all duration-200"
              style={{ boxShadow: state.outputCss }}
            ></div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="css-output"
                className="block text-sm font-medium text-[rgb(var(--color-text-muted))]"
              >
                Generated CSS
              </label>
              <Button
                variant="accent2"
                size="sm"
                onClick={handleCopy}
                disabled={isCopied}
                iconLeft={
                  isCopied ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  )
                }
              >
                {isCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <Textarea
              id="css-output"
              value={`box-shadow: ${state.outputCss};`}
              readOnly
              rows={3}
              textareaClassName="font-mono text-sm bg-[rgb(var(--color-bg-subtle-hover))]"
            />
          </div>
        </div>
      </div>

      {/* Global Actions */}
      <div className="flex justify-end items-center gap-4 p-4 border-t border-[rgb(var(--color-border-base))]">
        <Button
          variant="neutral"
          onClick={handleReset}
          iconLeft={<XCircleIcon className="h-5 w-5" />}
        >
          Reset to Default
        </Button>
        <SendToToolButton
          currentToolDirective={metadata.directive}
          currentToolOutputConfig={metadata.outputConfig}
        />
      </div>
    </div>
  );
}