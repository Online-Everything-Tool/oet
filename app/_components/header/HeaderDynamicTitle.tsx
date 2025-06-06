// FILE: app/_components/header/HeaderDynamicTitle.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { getDefaultHomeNarrativeSync } from '@/app/lib/narrativeService';

export default function HeaderDynamicTitle() {
  const homeNarrative = getDefaultHomeNarrativeSync();

  const brandName = homeNarrative?.epicCompanyName || 'OET';
  const brandEmoji = homeNarrative?.epicCompanyEmoji || '✨';

  return (
    <Link
      href="/"
      className="text-xl font-bold hover:text-[rgb(var(--color-header-brand-text-hover))] transition-colors duration-200 flex items-center"
      title={`${brandName} Home`}
    >
      {brandEmoji && (
        <span className="mr-2 text-2xl leading-none align-middle">
          {brandEmoji}
        </span>
      )}
      <span className="align-middle">{brandName}</span>
    </Link>
  );
}
