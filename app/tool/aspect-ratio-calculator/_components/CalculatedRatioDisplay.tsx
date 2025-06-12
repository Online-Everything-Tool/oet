import React from 'react';
import type {
  RatioConfig,
  ParsedRatio,
} from '../_hooks/useAspectRatioDefinitions';

interface CalculatedValues {
  width: number;
  height: number;
}

interface CalculatedRatioDisplayProps {
  ratioConfig: RatioConfig;
  calculatedFromInputWidth: CalculatedValues | null;
  calculatedFromInputHeight: CalculatedValues | null;
  originalInputWidth: number | null;
  originalInputHeight: number | null;
}

export default function CalculatedRatioDisplay({
  ratioConfig,
  calculatedFromInputWidth,
  calculatedFromInputHeight,
  originalInputWidth,
  originalInputHeight,
}: CalculatedRatioDisplayProps) {
  return (
    <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-subtle))] shadow-sm">
      <h3 className="text-md font-semibold text-[rgb(var(--color-text-link))]">
        {ratioConfig.name}
      </h3>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mb-2">
        {ratioConfig.description}
      </p>
      <div className="space-y-1 text-sm">
        {calculatedFromInputWidth && originalInputWidth !== null && (
          <p>
            <span className="font-medium">
              If Width is {originalInputWidth}px:
            </span>{' '}
            {calculatedFromInputWidth.width}px ×{' '}
            {calculatedFromInputWidth.height}px
          </p>
        )}
        {calculatedFromInputHeight && originalInputHeight !== null && (
          <p>
            <span className="font-medium">
              If Height is {originalInputHeight}px:
            </span>{' '}
            {calculatedFromInputHeight.width}px ×{' '}
            {calculatedFromInputHeight.height}px
          </p>
        )}
        {!calculatedFromInputWidth && originalInputWidth !== null && (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">
            Enter a height to calculate based on width.
          </p>
        )}
        {!calculatedFromInputHeight && originalInputHeight !== null && (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">
            Enter a width to calculate based on height.
          </p>
        )}
        {originalInputWidth === null && originalInputHeight === null && (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">
            Enter width or height to see calculations.
          </p>
        )}
      </div>
    </div>
  );
}
