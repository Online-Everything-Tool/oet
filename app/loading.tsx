// FILE: app/loading.tsx
import React from 'react';

export default function Loading() {
  return (
    <div
      className="flex flex-col items-center justify-center p-4 text-center"
      style={{
        minHeight:
          'calc(100vh - (var(--header-height, 70px) + var(--footer-height, 60px)))',
      }}
    >
      <svg
        className="animate-spin h-12 w-12 text-[rgb(var(--color-text-link))]"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
        role="status"
        aria-live="polite"
      >
        <title>Loading page content</title> {/* Accessible title */}
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <p className="mt-4 text-lg font-semibold text-[rgb(var(--color-text-base))]">
        Loading OET Homepage...
      </p>
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Fetching the latest tools and information for you. Please wait.
      </p>
    </div>
  );
}
