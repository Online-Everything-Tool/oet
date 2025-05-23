// FILE: app/context/MetadataContext.tsx
'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
  useCallback,
} from 'react';
import type { ToolMetadata } from '@/src/types/tools';

interface MetadataContextValue {
  toolMetadataMap: Record<string, ToolMetadata>;
  getToolMetadata: (directive: string) => ToolMetadata | null;
  getAllToolMetadataArray: () => ToolMetadata[];
  isLoading: boolean;
  error: string | null;
}

const defaultContextValue: MetadataContextValue = {
  toolMetadataMap: {},
  getToolMetadata: () => null,
  getAllToolMetadataArray: () => [],
  isLoading: true,
  error: null,
};

const MetadataContext =
  createContext<MetadataContextValue>(defaultContextValue);

export const useMetadata = () => {
  const context = useContext(MetadataContext);
  if (context === undefined) {
    throw new Error('useMetadata must be used within a MetadataProvider');
  }
  return context;
};

interface MetadataProviderProps {
  children: ReactNode;
}

export const MetadataProvider = ({ children }: MetadataProviderProps) => {
  const [toolMetadataMap, setToolMetadataMap] = useState<
    Record<string, ToolMetadata>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchBundledMetadata = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/all-tool-metadata.json');
        if (!response.ok) {
          throw new Error(
            `Failed to fetch bundled tool metadata: ${response.status} ${response.statusText}`
          );
        }
        const bundledData: Record<string, ToolMetadata> = await response.json();

        if (!isMounted) return;

        if (typeof bundledData === 'object' && bundledData !== null) {
          setToolMetadataMap(bundledData);
        } else {
          console.warn(
            '[MetadataContext] Fetched bundled metadata is not a valid object.'
          );
          setToolMetadataMap({});
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : 'An unknown error occurred while fetching bundled metadata.';
          console.error(
            '[MetadataContext] Failed to load bundled tool metadata:',
            errorMessage,
            err
          );
          setError(errorMessage);
          setToolMetadataMap({});
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchBundledMetadata();

    return () => {
      isMounted = false;
    };
  }, []);

  const getToolMetadata = useCallback(
    (directive: string): ToolMetadata | null => {
      return toolMetadataMap[directive] || null;
    },
    [toolMetadataMap]
  );

  const getAllToolMetadataArray = useCallback((): ToolMetadata[] => {
    return Object.values(toolMetadataMap);
  }, [toolMetadataMap]);

  const value = useMemo(
    () => ({
      toolMetadataMap,
      getToolMetadata,
      getAllToolMetadataArray,
      isLoading,
      error,
    }),
    [
      toolMetadataMap,
      getToolMetadata,
      getAllToolMetadataArray,
      isLoading,
      error,
    ]
  );

  return (
    <MetadataContext.Provider value={value}>
      {children}
    </MetadataContext.Provider>
  );
};
