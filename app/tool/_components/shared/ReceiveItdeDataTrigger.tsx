// FILE: app/tool/_components/shared/ReceiveItdeDataTrigger.tsx
'use client';

import React from 'react';
import Button from '../form/Button';
import { InboxArrowDownIcon } from '@heroicons/react/24/outline'; // Using outline for consistency if not filled by button variant

// This component now only needs to know IF there are deferred signals
// and how many, plus a way to trigger the modal opening in the parent.
// The actual modal and its detailed logic will reside in the parent tool client.
interface ReceiveItdeDataTriggerProps {
  hasDeferredSignals: boolean; // True if signals exist AND user has deferred the auto-popup
  pendingSignalCount: number;
  onReviewIncomingClick: () => void; // Parent tool provides function to open its modal
  className?: string;
}

export default function ReceiveItdeDataTrigger({
  hasDeferredSignals,
  pendingSignalCount,
  onReviewIncomingClick,
  className = '',
}: ReceiveItdeDataTriggerProps) {
  if (!hasDeferredSignals || pendingSignalCount === 0) {
    return null; // Render nothing if no deferred signals
  }

  return (
    <div className={`inline-block ${className}`}>
      {' '}
      {/* Changed to inline-block for better placement flexibility */}
      <Button
        variant="accent-outline" // Or another appropriate variant
        onClick={onReviewIncomingClick}
        iconLeft={<InboxArrowDownIcon className="h-5 w-5" />}
        size="sm"
        title={`Review ${pendingSignalCount} incoming data transfer(s)`}
      >
        Review Incoming
        {pendingSignalCount > 0 && (
          <span className="ml-1.5 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-[rgb(var(--color-button-accent-bg))] rounded-full">
            {pendingSignalCount}
          </span>
        )}
      </Button>
    </div>
  );
}
