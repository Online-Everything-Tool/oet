// app/build-tool/_components/GenerationLoadingModal.tsx
import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/solid';

interface GenerationLoadingModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
}

export default function GenerationLoadingModal({
  isOpen,
  title = 'Processing Request',
  message = 'Please wait while we generate the tool resources. This may take a few minutes...',
}: GenerationLoadingModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-600 bg-opacity-75 flex flex-col items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 text-center max-w-md w-full">
        <ArrowPathIcon className="h-12 w-12 text-indigo-600 animate-spin mx-auto mb-4" />
        <h2
          id="loading-modal-title"
          className="text-xl font-semibold text-gray-800 mb-2"
        >
          {title}
        </h2>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}
