// FILE: app/_components/FeedbackModal.tsx
'use client';

import React from 'react';
import type { ToolMetadata } from '@/src/types/tools';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Button from '../tool/_components/form/Button';
import { XCircleIcon } from '@heroicons/react/24/solid';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  toolMetadata?: ToolMetadata;
}

export default function FeedbackModal({
  isOpen,
  onClose,
  dialogRef,
  toolMetadata,
}: FeedbackModalProps) {
  if (!isOpen) {
    return null;
  }

  let githubIssuesUrl =
    'https://github.com/Online-Everything-Tool/oet/issues/new/choose';
  let modalTitle = 'Provide Feedback';

  if (toolMetadata) {
    modalTitle = `Provide Feedback for ${toolMetadata.title}`;
    const issueTitle = `Feedback: ${toolMetadata.title}`;
    let issueBody = `**Tool:** ${toolMetadata.title} (\`${toolMetadata.directive}\`)\n`;
    if (typeof window !== 'undefined') {
      issueBody += `**Page URL:** ${window.location.href}\n`;
    }
    issueBody += `\n**Feedback/Bug/Suggestion:**\n\n\n`;
    issueBody += `**Steps to Reproduce (if applicable):**\n1. \n2. \n3. \n`;

    const labels = `tool-feedback,${toolMetadata.directive}`;
    githubIssuesUrl = `https://github.com/Online-Everything-Tool/oet/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}&labels=${encodeURIComponent(labels)}`;
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-center justify-center p-4"
      aria-labelledby="feedback-dialog-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={dialogRef as React.RefObject<HTMLDivElement>}
        className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center">
          <h2
            id="feedback-dialog-title"
            className="text-lg font-semibold text-[rgb(var(--color-text-base))]"
          >
            {modalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
            aria-label="Close Feedback Modal"
          >
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />{' '}
            {/* MODIFIED: Use Heroicon */}
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-sm text-gray-600">
            Found a bug, have an idea for a new tool, or want to suggest an
            improvement? We appreciate your feedback!
          </p>
          <p className="text-sm text-gray-600">
            Please use our GitHub Issues page to share your thoughts.
            {toolMetadata ? " We've pre-filled some details for you." : ''}
          </p>
          <a
            href={githubIssuesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full text-center px-5 py-2.5 bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] font-medium text-sm rounded-md shadow-sm hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-button-primary-bg))] transition-colors duration-150 ease-in-out"
          >
            Open GitHub Issues
          </a>
        </div>
      </div>
    </div>
  );
}
