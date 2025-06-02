// FILE: app/_components/GatedContentLoader.tsx
'use client';

import React, { useState, ReactNode } from 'react';
import ToolSuspenseWrapper from './ToolSuspenseWrapper';
import Button from '@/app/tool/_components/form/Button';

interface GatedContentLoaderProps {
  childrenToLoad: ReactNode;
  buttonText?: string;
  onButtonClick?: () => Promise<boolean>;
  gateClosedFallback?: ReactNode;
  mainSuspenseFallback?: ReactNode;
  initialButtonLoadingText?: string;
}

export default function GatedContentLoader({
  childrenToLoad,
  buttonText = 'Load Content',
  onButtonClick,
  gateClosedFallback,
  mainSuspenseFallback,
  initialButtonLoadingText = 'Loading...',
}: GatedContentLoaderProps) {
  const [isGateOpen, setIsGateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!onButtonClick) {
      setIsGateOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const shouldOpen = await onButtonClick();
      if (shouldOpen) {
        setIsGateOpen(true);
      } else {
        console.log('Button action completed but gate remains closed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
      console.error('Error during button click action:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isGateOpen) {
    return (
      <ToolSuspenseWrapper
        isGateOpen={true}
        mainSuspenseFallback={mainSuspenseFallback}
      >
        {childrenToLoad}
      </ToolSuspenseWrapper>
    );
  }
  return (
    <div className="text-center py-8">
      {gateClosedFallback ? (
        <>
          {gateClosedFallback}
          {!isLoading && !isGateOpen && onButtonClick && (
            <div className="mt-4">
              <Button
                onClick={handleClick}
                isLoading={isLoading}
                loadingText={initialButtonLoadingText}
                variant="primary"
              >
                {buttonText}
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mb-4 text-gray-600">Content is gated. Click to load.</p>
          <Button
            onClick={handleClick}
            isLoading={isLoading}
            loadingText={initialButtonLoadingText}
            variant="primary"
          >
            {buttonText}
          </Button>
        </>
      )}
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
