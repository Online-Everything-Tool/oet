// FILE: app/tool/_components/form/Input.tsx
'use client';

import React, { useId, forwardRef } from 'react';

type InputType =
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'search'
  | 'url'
  | 'tel'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'color';

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label?: string;
  id?: string;
  type?: InputType;
  value: string | number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string | null;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const Input: React.ForwardRefRenderFunction<HTMLInputElement, InputProps> = (
  {
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
  },
  ref
) => {
  const autoId = useId();
  const effectiveId = providedId || autoId;

  const hasError = !!error;
  const isDisabled = disabled;

  const baseInputStyles = `
 block border rounded-md shadow-sm
 text-sm sm:text-base
 bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))]
 placeholder:text-[rgb(var(--color-input-placeholder))]
 `;

  const widthStyle = type === 'color' ? '' : 'w-full';

  const normalBorder = 'border-[rgb(var(--color-input-border))]';
  const errorBorder = 'border-[rgb(var(--color-border-error))]';
  const focusStyles = 'focus:border-[rgb(var(--color-input-focus-border))]';

  const disabledStyles = isDisabled
    ? 'disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed opacity-60'
    : '';

  const paddingStyles =
    type === 'color'
      ? ''
      : `${iconLeft ? 'pl-10' : 'px-3'} ${iconRight ? 'pr-10' : 'px-3'} py-2`;

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label
          htmlFor={effectiveId}
          className={`block text-sm font-medium mb-1 ${isDisabled ? 'text-[rgb(var(--color-text-disabled))]' : 'text-[rgb(var(--color-text-muted))]'} ${labelClassName}`}
        >
          {label}
        </label>
      )}
      <div className="relative rounded-md shadow-sm">
        {iconLeft && type !== 'color' && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-[rgb(var(--color-text-muted))] sm:text-sm">
              {iconLeft}
            </span>
          </div>
        )}
        <input
          ref={ref}
          type={type}
          id={effectiveId}
          name={name}
          value={value}
          onChange={onChange}
          disabled={isDisabled}
          placeholder={placeholder}
          className={`
 ${baseInputStyles}
 ${widthStyle}
 ${hasError ? errorBorder : normalBorder}
 ${!isDisabled ? focusStyles : ''}
 ${disabledStyles}
 ${paddingStyles}
 ${inputClassName}
 `}
          aria-invalid={hasError ? 'true' : 'false'}
          aria-describedby={hasError ? `${effectiveId}-error` : undefined}
          {...rest}
          style={
            type === 'color'
              ? { padding: '0px', lineHeight: 'normal', ...rest.style }
              : rest.style
          }
        />
        {iconRight && type !== 'color' && (
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

export default forwardRef(Input);
