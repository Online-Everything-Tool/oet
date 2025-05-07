// FILE: app/tool/_components/form/Checkbox.tsx
'use client';

import React, { useId } from 'react';

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label?: string | React.ReactNode;
  id?: string;
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
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

  return (
    <div
      className={`flex items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <input
        type="checkbox"
        id={effectiveId}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={`
          h-4 w-4 rounded 
          border-gray-300 
          text-[rgb(var(--color-checkbox-accent))] 
          accent-[rgb(var(--color-checkbox-accent))] 
          disabled:cursor-not-allowed
          ${inputClassName}
        `}
        {...rest}
      />
      {label && (
        <label
          htmlFor={effectiveId}
          className={`ml-2 block text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'} ${!disabled ? 'cursor-pointer' : ''} ${labelClassName}`}
        >
          {label}
        </label>
      )}
    </div>
  );
};

export default Checkbox;
