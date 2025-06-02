// FILE: app/tool/_components/form/Textarea.tsx
'use client';

import React, { useId, forwardRef } from 'react';

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  id?: string;
  value: string;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string | null;
  containerClassName?: string;
  labelClassName?: string;
  textareaClassName?: string;
}

const Textarea: React.ForwardRefRenderFunction<
  HTMLTextAreaElement,
  TextareaProps
> = (
  {
    label,
    id: providedId,
    value,
    onChange,
    error = null,
    rows = 6,
    disabled = false,
    containerClassName = '',
    labelClassName = '',
    textareaClassName = '',
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

  const baseTextareaStyles = `
    block w-full p-3 border rounded-md shadow-sm
    text-base sm:text-sm font-mono
    resize-y
    bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))]
    placeholder:text-[rgb(var(--color-input-placeholder))]    
  `;

  const normalBorder = 'border-[rgb(var(--color-input-border))]';
  const errorBorder = 'border-[rgb(var(--color-border-error))]';
  const focusBorder = 'focus:border-[rgb(var(--color-input-focus-border))]';
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
      <textarea
        ref={ref}
        id={effectiveId}
        name={name}
        rows={rows}
        value={value}
        onChange={onChange}
        disabled={isDisabled}
        placeholder={placeholder}
        className={`
          ${baseTextareaStyles}
          ${hasError ? errorBorder : normalBorder}
          ${!isDisabled ? `${focusBorder} focus:ring-1 focus:ring-[rgb(var(--color-input-focus-border))]` : ''}
          ${disabledStyles}
          ${textareaClassName}
        `}
        aria-invalid={hasError ? 'true' : 'false'}
        aria-describedby={hasError ? `${effectiveId}-error` : undefined}
        {...rest}
      />
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

export default forwardRef(Textarea);
