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
import { InlineDetails, OutputConfig } from '@/app/tool/_types/Tool';

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
  let c: number[];
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    let hexChars = hex.substring(1).split('');
    if (hexChars.length === 3) {
      hexChars = [
        hexChars[0],
        hexChars[0],
        hexChars[1],
        hexChars[1],
        hexChars[2],
        hexChars[2],
      ];
    }
    const hexValue = parseInt('0x' + hexChars.join(''), 16);
    const r = (hexValue >> 16) & 255;
    const g = (hexValue >> 8) & 255;
    const b = hexValue & 255;
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
    const newCss = `${state.isInset ? 'inset ' : ''}${state.offsetX}px ${
      state.offsetY
    }px ${state.blurRadius}px ${state.spreadRadius}px ${rgbaColor}`;
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

  const metadataOutputConfig: OutputConfig = {
    transferableContent: [
      {
        dataType: 'inline',
        stateKey: 'outputCss',
        mimeType: 'text/css',
      } as InlineDetails,
    ],
  };


  return (
    <div className="flex flex-col gap-6">
      {/* ... other JSX ... */}
      <SendToToolButton
        currentToolDirective={metadata.directive}
        currentToolOutputConfig={metadataOutputConfig}
      />
      {/* ... other JSX ... */}
    </div>
  );
}
