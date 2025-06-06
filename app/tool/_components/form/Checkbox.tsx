// FILE: app/tool/_components/form/Checkbox.tsx
'use client';

import React, { useId, useEffect, useRef } from 'react';

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label?: string | React.ReactNode;
  id?: string;
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isIndeterminate?: boolean;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({
  label,
  id: providedId,
  checked,
  onChange,
  isIndeterminate = false,
  disabled = false,
  className = '',
  labelClassName = '',
  inputClassName = '',
  name,
  value,
  ...rest
}) => {
  const autoId = useId();
  const effectiveId = providedId || autoId;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const indeterminateStyle =
    isIndeterminate && !checked ? 'bg-[rgb(var(--color-border-emphasis))]' : '';

  return (
    <div
      className={`flex items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <input
        ref={inputRef}
        type="checkbox"
        id={effectiveId}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={`
 h-4 w-4 rounded
 border-[rgb(var(--color-border-soft))]
 text-[rgb(var(--color-checkbox-accent))]
 accent-[rgb(var(--color-checkbox-accent))]
 disabled:cursor-not-allowed
 ${indeterminateStyle}
 ${inputClassName}
 `}
        {...rest}
      />
      {label && (
        <label
          htmlFor={effectiveId}
          className={`ml-2 block text-sm ${disabled ? 'text-[rgb(var(--color-text-disabled))]' : 'text-[rgb(var(--color-text-base))]'} ${!disabled ? 'cursor-pointer' : ''} ${labelClassName}`}
        >
          {label}
        </label>
      )}
    </div>
  );
};

export default Checkbox;
