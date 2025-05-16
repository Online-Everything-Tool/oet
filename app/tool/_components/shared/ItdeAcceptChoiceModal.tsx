// FILE: app/tool/_components/shared/ItdeAcceptChoiceModal.tsx
'use client';

import React from 'react';
import Button, { ButtonVariant } from '../form/Button';
import { XMarkIcon } from '@heroicons/react/24/outline';

export interface ItdeChoiceOption {
  label: string;
  actionKey: string;
  variant?: ButtonVariant;
  icon?: React.ReactNode;
}

interface ItdeAcceptChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceToolTitle: string;
  dataTypeReceived: string;
  itemCount?: number;
  options: ItdeChoiceOption[];
  onOptionSelect: (actionKey: string) => void;
  title?: string;
  message?: string;
}

export default function ItdeAcceptChoiceModal({
  isOpen,
  onClose,
  sourceToolTitle,
  dataTypeReceived,
  itemCount,
  options,
  onOptionSelect,
  title = 'Confirm ITDE Action',
  message,
}: ItdeAcceptChoiceModalProps) {
  if (!isOpen) {
    return null;
  }

  const defaultMessage = `Received ${itemCount ? itemCount + ' ' : ''}${dataTypeReceived} from "${sourceToolTitle}". How would you like to proceed?`;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="itde-choice-modal-title"
    >
      <div
        className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center">
          <h2
            id="itde-choice-modal-title"
            className="text-lg font-semibold text-[rgb(var(--color-text-base))]"
          >
            {title}
          </h2>
          <Button
            variant="link"
            size="sm"
            onClick={onClose}
            aria-label="Close and defer choice"
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            {message || defaultMessage}
          </p>
        </div>

        {/* Modal Footer - Action Buttons */}
        <div className="p-4 border-t border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] flex flex-col sm:flex-row justify-end items-center gap-3">
          {options.map((option) => (
            <Button
              key={option.actionKey}
              variant={option.variant || 'primary'}
              onClick={() => onOptionSelect(option.actionKey)}
              iconLeft={option.icon}
              className="w-full sm:w-auto"
            >
              {option.label}
            </Button>
          ))}
          <Button
            variant="neutral"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Defer / Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
