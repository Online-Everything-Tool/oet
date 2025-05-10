// FILE: app/tool/_components/form/Input.tsx
'use client';

import React, { useId } from 'react';

// Define common HTML input types, can be expanded
type InputType =
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'search'
  | 'url'
  | 'tel'
  | 'date' // Added date as it's common
  | 'time' // Added time
  | 'datetime-local'; // Added datetime-local

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label?: string;
  id?: string;
  type?: InputType; // Use our defined InputType
  value: string | number; // Allow number for type="number"
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string | null;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string; // For direct styling of the <input> element
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({
  label,
  id: providedId,
  type = 'text',
  value,
  onChange,
  error = null,
  disabled = false,
  containerClassName = '',
  labelClassName = '',
  inputClassName = '',
  iconLeft,
  iconRight,
  placeholder,
  name,
  ...rest
}) => {
  const autoId = useId();
  const effectiveId = providedId || autoId;

  const hasError = !!error;
  const isDisabled = disabled;

  // Base styles for the input element itself
  const baseInputStyles = `
    block w-full border rounded-md shadow-sm 
    text-sm sm:text-base
    bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))]
    placeholder:text-[rgb(var(--color-input-placeholder))]
    focus:outline-none focus:ring-1
  `;

  const normalBorder = 'border-[rgb(var(--color-input-border))]';
  const errorBorder =
    'border-[rgb(var(--color-border-error))] ring-1 ring-[rgb(var(--color-border-error))]'; // Added ring for error
  const focusStyles =
    'focus:border-[rgb(var(--color-input-focus-border))] focus:ring-[rgb(var(--color-input-focus-border))]';

  const disabledStyles = isDisabled
    ? 'disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed opacity-60'
    : '';

  // Padding adjustments based on presence of icons
  const paddingLeft = iconLeft ? 'pl-10' : 'px-3'; // Or pl-3 if no iconLeft
  const paddingRight = iconRight ? 'pr-10' : 'px-3'; // Or pr-3 if no iconRight
  const verticalPadding = 'py-2'; // Standard vertical padding

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
      <div className="relative rounded-md shadow-sm">
        {iconLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-[rgb(var(--color-text-muted))] sm:text-sm">
              {iconLeft}
            </span>
          </div>
        )}
        <input
          type={type}
          id={effectiveId}
          name={name}
          value={value}
          onChange={onChange}
          disabled={isDisabled}
          placeholder={placeholder}
          className={`
            ${baseInputStyles}
            ${hasError ? errorBorder : normalBorder}
            ${!isDisabled ? focusStyles : ''}
            ${disabledStyles}
            ${paddingLeft} ${paddingRight} ${verticalPadding}
            ${inputClassName}
          `}
          aria-invalid={hasError ? 'true' : 'false'}
          aria-describedby={hasError ? `${effectiveId}-error` : undefined}
          {...rest}
        />
        {iconRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-[rgb(var(--color-text-muted))] sm:text-sm">
              {iconRight}
            </span>
          </div>
        )}
      </div>
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
};

export default Input;
