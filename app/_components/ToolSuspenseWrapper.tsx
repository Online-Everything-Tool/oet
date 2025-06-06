// FILE: app/_components/ToolSuspenseWrapper.tsx
'use client';

import React, { Suspense, ReactNode } from 'react';

interface ToolSuspenseWrapperProps {
  children: ReactNode;
  isGateOpen?: boolean;
  gateClosedFallback?: ReactNode;
  mainSuspenseFallback?: ReactNode;
}

export default function ToolSuspenseWrapper({
  children,
  isGateOpen = true,
  gateClosedFallback,
  mainSuspenseFallback,
}: ToolSuspenseWrapperProps) {
  const defaultGateClosedFallback = (
    <div className="text-center p-4 text-[rgb(var(--color-text-muted))] italic">
      Content is currently gated.
    </div>
  );

  const defaultMainSuspenseFallback = (
    <div className="text-center p-4 text-[rgb(var(--color-text-muted))] italic animate-pulse">
      Loading Gated Content...
    </div>
  );

  if (!isGateOpen) {
    return (
      <>
        {gateClosedFallback !== undefined
          ? gateClosedFallback
          : defaultGateClosedFallback}
      </>
    );
  }

  return (
    <Suspense
      fallback={
        mainSuspenseFallback !== undefined
          ? mainSuspenseFallback
          : defaultMainSuspenseFallback
      }
    >
      {children}
    </Suspense>
  );
}
