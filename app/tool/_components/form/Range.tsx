// --- FILE: app/tool/_components/form/Range.tsx ---
'use client';

import React, { useId } from 'react';

interface RangeProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label: string;
  value: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  id?: string;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  showValue?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  valueDisplayClassName?: string;
}

const Range: React.FC<RangeProps> = ({
  label,
  id: providedId,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  showValue = true,
  containerClassName = '',
  labelClassName = '',
  inputClassName = '',
  valueDisplayClassName = '',
  name,
  ...rest
}) => {
  const autoId = useId();
  const effectiveId = providedId || autoId;
  const isDisabled = disabled;

  const baseInputStyles = `
 w-full h-2 rounded-lg cursor-pointer
 bg-[rgb(var(--color-indicator-track-bg))]
 disabled:cursor-not-allowed disabled:opacity-50
 accent-[rgb(var(--color-checkbox-accent))]
 `;

  return (
    <div
      className={`w-full ${containerClassName} ${isDisabled ? 'opacity-60' : ''}`}
    >
      <div className="flex justify-between items-center mb-1">
        <label
          htmlFor={effectiveId}
          className={`block text-xs font-medium ${isDisabled ? 'text-[rgb(var(--color-text-disabled))]' : 'text-[rgb(var(--color-text-muted))]'} ${labelClassName}`}
        >
          {label}
        </label>
        {showValue && (
          <span
            className={`text-xs font-mono ${isDisabled ? 'text-[rgb(var(--color-text-disabled))]' : 'text-[rgb(var(--color-text-base))]'} ${valueDisplayClassName}`}
          >
            {value}
          </span>
        )}
      </div>
      <input
        type="range"
        id={effectiveId}
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        disabled={isDisabled}
        className={`${baseInputStyles} ${inputClassName}`}
        {...rest}
      />
    </div>
  );
};

export default Range;
