// FILE: app/tool/_components/shared/ReceiveItdeDataTrigger.tsx
'use client';

import React from 'react';
import Button from '../form/Button';
import { InboxArrowDownIcon } from '@heroicons/react/24/outline';

interface ReceiveItdeDataTriggerProps {
  hasDeferredSignals: boolean;
  pendingSignalCount: number;
  onReviewIncomingClick: () => void;
  className?: string;
}

export default function ReceiveItdeDataTrigger({
  hasDeferredSignals,
  pendingSignalCount,
  onReviewIncomingClick,
  className = '',
}: ReceiveItdeDataTriggerProps) {
  if (!hasDeferredSignals || pendingSignalCount === 0) {
    return null;
  }

  return (
    <div className={`inline-block ${className}`}>
      <Button
        variant="accent-outline"
        onClick={onReviewIncomingClick}
        iconLeft={<InboxArrowDownIcon className="h-5 w-5" />}
        title={`Review ${pendingSignalCount} incoming data transfer(s)`}
      >
        Incoming
        {pendingSignalCount > 0 && (
          <span className="ml-1.5 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-[rgb(var(--color-button-accent-bg))] rounded-full">
            {pendingSignalCount}
          </span>
        )}
      </Button>
    </div>
  );
}
