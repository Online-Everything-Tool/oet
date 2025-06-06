// FILE: app/tool/_components/form/Button.tsx
import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/20/solid';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'accent2'
  | 'danger'
  | 'neutral'
  | 'link'
  | 'primary-outline'
  | 'secondary-outline'
  | 'accent-outline'
  | 'accent2-outline'
  | 'danger-outline'
  | 'neutral-outline';

type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  isEmpty?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  isLoading = false,
  loadingText,
  iconLeft,
  iconRight,
  fullWidth = false,
  className = '',
  type = 'button',
  disabled,
  isEmpty = false,
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-md shadow-sm transition-colors duration-150 ease-in-out';

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] hover:bg-[rgb(var(--color-button-primary-hover-bg))]',
    secondary:
      'bg-[rgb(var(--color-button-secondary-bg))] text-[rgb(var(--color-button-secondary-text))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))]',
    accent:
      'bg-[rgb(var(--color-button-accent-bg))] text-[rgb(var(--color-button-accent-text))] hover:bg-[rgb(var(--color-button-accent-hover-bg))]',
    accent2:
      'bg-[rgb(var(--color-button-accent2-bg))] text-[rgb(var(--color-button-accent2-text))] hover:bg-[rgb(var(--color-button-accent2-hover-bg))]',
    danger:
      'bg-[rgb(var(--color-button-danger-bg))] text-[rgb(var(--color-button-danger-text))] hover:bg-[rgb(var(--color-button-danger-hover-bg))]',
    neutral:
      'bg-[rgb(var(--color-button-neutral-bg))] text-[rgb(var(--color-button-neutral-text))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] border border-transparent',

    'primary-outline':
      'bg-transparent border border-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-bg))] hover:bg-[rgba(var(--color-button-primary-bg)/0.1)]',
    'secondary-outline':
      'bg-transparent border border-[rgb(var(--color-button-secondary-bg))] text-[rgb(var(--color-button-secondary-bg))] hover:bg-[rgba(var(--color-button-secondary-bg)/0.1)]',
    'accent-outline':
      'bg-transparent border border-[rgb(var(--color-button-accent-bg))] text-[rgb(var(--color-button-accent-bg))] hover:bg-[rgba(var(--color-button-accent-bg)/0.1)]',
    'accent2-outline':
      'bg-transparent border border-[rgb(var(--color-button-accent2-bg))] text-[rgb(var(--color-button-accent2-bg))] hover:bg-[rgba(var(--color-button-accent2-bg)/0.1)]',
    'danger-outline':
      'bg-transparent border border-[rgb(var(--color-button-danger-bg))] text-[rgb(var(--color-button-danger-bg))] hover:bg-[rgba(var(--color-button-danger-bg)/0.1)]',
    'neutral-outline':
      'bg-transparent border border-[rgb(var(--color-button-neutral-text))] text-[rgb(var(--color-button-neutral-text))] hover:bg-[rgba(var(--color-button-neutral-text)/0.1)]',

    link: 'bg-transparent text-[rgb(var(--color-text-link))] hover:underline shadow-none px-1 py-0.5',
  };

  const hasOnlyIcon =
    (iconLeft && !iconRight && !children && !loadingText) ||
    (iconRight && !iconLeft && !children && !loadingText);
  const iconOnlyPadding: Record<ButtonSize, string> = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const currentSizeStyles = hasOnlyIcon
    ? iconOnlyPadding[size]
    : sizeStyles[size];

  const disabledStyles = isDisabled ? 'opacity-50 cursor-not-allowed' : '';
  const fullWidthStyles = fullWidth ? 'w-full' : '';

  let currentIconLeft = iconLeft;
  if (isLoading) {
    currentIconLeft = (
      <ArrowPathIcon className="animate-spin h-5 w-5" aria-hidden="true" />
    );
  }

  return (
    <button
      type={type}
      className={`
 ${baseStyles}
 ${currentSizeStyles}
 ${variantStyles[variant]}
 ${disabledStyles}
 ${fullWidthStyles}
 ${className}
 `}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      {...rest}
    >
      {currentIconLeft && (
        <span className={(children || loadingText) && !isEmpty ? 'mr-2' : ''}>
          {currentIconLeft}
        </span>
      )}
      {isLoading && loadingText ? loadingText : children}
      {!isLoading && iconRight && (
        <span className={children && !isEmpty ? 'ml-2' : ''}>{iconRight}</span>
      )}
    </button>
  );
};

export default Button;
