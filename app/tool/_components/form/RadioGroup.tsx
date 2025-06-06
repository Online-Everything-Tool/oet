// FILE: app/tool/_components/form/RadioGroup.tsx
'use client';

import React, { useId } from 'react';

interface RadioOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

interface RadioGroupProps<T extends string | number> {
  options: ReadonlyArray<RadioOption<T>>;
  selectedValue: T;
  onChange: (value: T) => void;
  name: string;
  legend?: string;
  id?: string;
  disabled?: boolean;
  layout?: 'horizontal' | 'vertical';
  className?: string;
  radioClassName?: string;
  inputClassName?: string;
  labelClassName?: string;
}

export default function RadioGroup<T extends string | number>({
  options,
  selectedValue,
  onChange,
  name,
  legend,
  id: providedId,
  disabled = false,
  layout = 'horizontal',
  className = '',
  radioClassName = '',
  inputClassName = '',
  labelClassName = '',
}: RadioGroupProps<T>) {
  const autoIdBase = useId();
  const effectiveIdBase = providedId || autoIdBase;

  const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value as T);
  };

  const layoutStyles =
    layout === 'horizontal'
      ? 'flex flex-wrap gap-x-4 gap-y-2'
      : 'flex flex-col gap-2';

  return (
    <fieldset
      className={`${className} ${disabled ? 'opacity-60' : ''}`}
      disabled={disabled}
    >
      {legend && (
        <legend className="block text-sm font-medium mb-1 text-[rgb(var(--color-text-muted))]">
          {legend}
        </legend>
      )}
      <div className={layoutStyles}>
        {options.map((option) => {
          const optionId = `${effectiveIdBase}-${option.value}`;
          const isChecked = selectedValue === option.value;
          const optionDisabled = disabled || option.disabled;

          return (
            <div
              key={String(option.value)}
              className={`flex items-center ${radioClassName}`}
            >
              <input
                type="radio"
                id={optionId}
                name={name}
                value={option.value}
                checked={isChecked}
                onChange={handleRadioChange}
                disabled={optionDisabled}
                className={`
 h-4 w-4 border-[rgb(var(--color-border-soft))]
 text-[rgb(var(--color-checkbox-accent))]
 accent-[rgb(var(--color-checkbox-accent))]
 disabled:cursor-nouset-allowed disabled:opacity-50
 ${inputClassName}
 `}
              />
              <label
                htmlFor={optionId}
                className={`ml-2 block text-sm select-none ${optionDisabled ? 'text-[rgb(var(--color-text-disabled))] cursor-not-allowed' : 'text-[rgb(var(--color-text-base))] cursor-pointer'} ${labelClassName}`}
              >
                {option.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
