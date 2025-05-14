// FILE: app/tool/_components/shared/FilenamePromptModal.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Button from '../form/Button';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface FilenamePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (filename: string) => void;
  initialFilename?: string;
  promptMessage?: string;
  inputLabel?: string;
  confirmButtonText?: string;
  title?: string;
}

export default function FilenamePromptModal({
  isOpen,
  onClose,
  onConfirm,
  initialFilename = '',
  promptMessage = 'Please enter a filename:',
  inputLabel = 'Filename:',
  confirmButtonText = 'Confirm',
  title = 'Enter Filename',
}: FilenamePromptModalProps) {
  const [filename, setFilename] = useState(initialFilename);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFilename(initialFilename || `download-${Date.now()}.txt`);

      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, initialFilename]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filename.trim()) {
      onConfirm(filename.trim());
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="filename-prompt-title"
    >
      <div
        className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center">
          <h2
            id="filename-prompt-title"
            className="text-lg font-semibold text-[rgb(var(--color-text-base))]"
          >
            {title}
          </h2>
          <Button
            variant="link"
            size="sm"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {promptMessage && (
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                {promptMessage}
              </p>
            )}
            <div>
              <label
                htmlFor="filename-input"
                className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1"
              >
                {inputLabel}
              </label>
              <input
                ref={inputRef}
                type="text"
                id="filename-input"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-input-focus-border))] text-sm"
                placeholder="e.g., my-encoded-data.txt"
              />
              <p className="text-xs text-gray-400 mt-1">
                File extension will be added if not provided.
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] flex justify-end items-center gap-3">
            <Button variant="neutral" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!filename.trim()}>
              {confirmButtonText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
