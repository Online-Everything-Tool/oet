// FILE: app/build-tool/_components/BuildSuspenseWrapper.tsx
import React, { Suspense } from 'react';

interface BuildToolSuspenseWrapperProps {
  children: React.ReactNode;
}

/**
 * A wrapper component to provide a consistent Suspense boundary
 * for build-tool client components that might depend on hooks like useSearchParams.
 */
export default function BuildToolSuspenseWrapper({
  children,
}: BuildToolSuspenseWrapperProps) {
  const defaultFallback = (
    <div className="text-center p-4 text-gray-500 italic animate-pulse">
      Loading Build Tool...
    </div>
  );

  return <Suspense fallback={defaultFallback}>{children}</Suspense>;
}
