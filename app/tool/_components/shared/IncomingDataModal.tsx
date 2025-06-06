// FILE: app/tool/_components/shared/IncomingDataModal.tsx
'use client';

import React from 'react';
import Button from '../form/Button';
import {
  XMarkIcon,
  ArrowDownCircleIcon,
  InboxArrowDownIcon,
  ArchiveBoxXMarkIcon,
  StopCircleIcon,
} from '@heroicons/react/24/outline';
import type { IncomingSignal } from '@/app/tool/_hooks/useItdeTargetHandler';
import { XCircleIcon } from '@heroicons/react/24/solid';

interface IncomingDataModalProps {
  isOpen: boolean;
  signals: IncomingSignal[];
  onAccept: (sourceDirective: string) => void;
  onIgnore: (sourceDirective: string) => void;
  onDeferAll: () => void;
  onIgnoreAll: () => void;
}

export default function IncomingDataModal({
  isOpen,
  signals,
  onAccept,
  onIgnore,
  onDeferAll,
  onIgnoreAll,
}: IncomingDataModalProps) {
  if (!isOpen || signals.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-[rgb(var(--color-overlay-backdrop))]/80 flex items-center justify-center z-[60] p-4"
      onClick={onDeferAll}
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-data-title"
    >
      <div
        className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <InboxArrowDownIcon className="h-6 w-6 text-[rgb(var(--color-text-link))]" />
            <h2
              id="incoming-data-title"
              className="text-lg font-semibold text-[rgb(var(--color-text-base))]"
            >
              Incoming Data Transfers ({signals.length})
            </h2>
          </div>
          <Button
            variant="link"
            size="sm"
            onClick={onDeferAll}
            aria-label="Close and defer all transfers"
            className="p-1 text-[rgb(var(--color-text-disabled))] hover:text-[rgb(var(--color-text-subtle))]"
          >
            <XMarkIcon className="h-6 w-6" />
          </Button>
        </div>

        <div className="p-1 overflow-y-auto flex-grow">
          <p className="px-4 pt-3 pb-2 text-sm text-[rgb(var(--color-text-muted))]">
            One or more tools have sent data. Accepting will typically replace
            or add to your current input.
          </p>
          <ul className="divide-y divide-gray-200">
            {signals.map((signal) => (
              <li
                key={signal.sourceDirective}
                className="px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
              >
                <div>
                  <p className="text-sm font-medium text-[rgb(var(--color-text-base))]">
                    From: {signal.sourceToolTitle}
                  </p>
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    (<code>{signal.sourceDirective}</code>)
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                  <Button
                    variant="neutral-outline"
                    onClick={() => onIgnore(signal.sourceDirective)}
                    iconLeft={<StopCircleIcon className="h-5 w-5" />}
                  >
                    Ignore
                  </Button>
                  <Button
                    variant="primary-outline"
                    onClick={() => onAccept(signal.sourceDirective)}
                    iconLeft={<ArrowDownCircleIcon className="h-5 w-5" />}
                  >
                    Accept
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 border-t border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] flex flex-col sm:flex-row justify-between items-center gap-3">
          <Button
            variant="danger-outline"
            onClick={onIgnoreAll}
            iconLeft={<ArchiveBoxXMarkIcon className="h-5 w-5" />}
          >
            Ignore All ({signals.length})
          </Button>
          <Button
            variant="neutral"
            onClick={onDeferAll}
            iconLeft={<XCircleIcon className="h-5 w-5" />}
          >
            Defer
          </Button>
        </div>
      </div>
    </div>
  );
}
