// FILE: app/tool/_components/form/Select.tsx
'use client';

import React, { useId } from 'react';

interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SelectProps<T extends string | number>
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label?: string;
  id?: string;
  options: ReadonlyArray<SelectOption<T>>;
  value: T | '';
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  error?: string | null;
  containerClassName?: string;
  labelClassName?: string;
  selectClassName?: string;
  placeholder?: string;
}

export default function Select<T extends string | number>({
  label,
  id: providedId,
  options,
  value,
  onChange,
  error = null,
  disabled = false,
  containerClassName = '',
  labelClassName = '',
  selectClassName = '',
  placeholder,
  name,
  ...rest
}: SelectProps<T>) {
  const autoId = useId();
  const effectiveId = providedId || autoId;

  const hasError = !!error;
  const isDisabled = disabled;

  const baseSelectStyles = `
    block w-full p-2.5 border rounded-md shadow-sm
    text-sm
    bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))]
    focus:outline-none focus:ring-1
  `;

  const normalBorder = 'border-[rgb(var(--color-input-border))]';
  const errorBorder = 'border-[rgb(var(--color-border-error))]';
  const focusStyles =
    'focus:border-[rgb(var(--color-input-focus-border))] focus:ring-[rgb(var(--color-input-focus-border))]';
  const disabledStyles = isDisabled
    ? 'disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed opacity-60'
    : '';

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label
          htmlFor={effectiveId}
          className={`block text-sm font-medium mb-1 ${isDisabled ? 'text-gray-400' : 'text-[rgb(var(--color-text-muted))]'} ${labelClassName}`}
        >
          {label}
        </label>
      )}
      <select
        id={effectiveId}
        name={name}
        value={value}
        onChange={onChange}
        disabled={isDisabled}
        className={`
          ${baseSelectStyles}
          ${hasError ? errorBorder : normalBorder}
          ${!isDisabled ? focusStyles : ''}
          ${disabledStyles}
          ${selectClassName}
        `}
        aria-invalid={hasError ? 'true' : 'false'}
        aria-describedby={hasError ? `${effectiveId}-error` : undefined}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled={value !== ''}>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={String(option.value)}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {hasError && (
        <p
          id={`${effectiveId}-error`}
          className="mt-1 text-xs text-[rgb(var(--color-text-error))]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
