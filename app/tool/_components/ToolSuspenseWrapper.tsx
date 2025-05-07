// FILE: app/tool/_components/ToolSuspenseWrapper.tsx
import React, { Suspense } from 'react';

interface ToolSuspenseWrapperProps {
  children: React.ReactNode;
}

/**
 * A wrapper component to provide a consistent Suspense boundary
 * for tool client components that might depend on hooks like useSearchParams.
 */
export default function ToolSuspenseWrapper({
  children,
}: ToolSuspenseWrapperProps) {
  const defaultFallback = (
    <div className="text-center p-4 text-gray-500 italic animate-pulse">
      Loading Tool...
    </div>
  );

  return <Suspense fallback={defaultFallback}>{children}</Suspense>;
}
