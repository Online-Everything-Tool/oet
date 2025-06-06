// FILE: app/build/tool/_components/BuildSuspenseWrapper.tsx
import React, { Suspense } from 'react';

interface BuildToolSuspenseWrapperProps {
  children: React.ReactNode;
}

export default function BuildToolSuspenseWrapper({
  children,
}: BuildToolSuspenseWrapperProps) {
  const defaultFallback = (
    <div className="text-center p-4 text-[rgb(var(--color-text-muted))] italic animate-pulse">
      Loading Build Tool...
    </div>
  );

  return <Suspense fallback={defaultFallback}>{children}</Suspense>;
}
