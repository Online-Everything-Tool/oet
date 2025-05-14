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

interface DirectivesResponse {
  directives: string[];
}

export const MetadataProvider = ({ children }: MetadataProviderProps) => {
  const [toolMetadataMap, setToolMetadataMap] = useState<
    Record<string, ToolMetadata>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAllMetadata = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const directivesResponse = await fetch('/api/directives.json');
        if (!directivesResponse.ok) {
          throw new Error(
            `Failed to fetch directives list: ${directivesResponse.status}`
          );
        }
        const directivesData: DirectivesResponse =
          await directivesResponse.json();
        const directives = directivesData.directives;

        if (!Array.isArray(directives) || directives.length === 0) {
          setToolMetadataMap({});
          if (isMounted) setIsLoading(false);
          console.warn(
            '[MetadataContext] No directives found or invalid format in directives.json'
          );
          return;
        }

        const metadataPromises = directives.map(async (directive) => {
          try {
            const metaResponse = await fetch(
              `/api/tool-metadata/${directive}.json`
            );
            if (!metaResponse.ok) {
              console.warn(
                `[MetadataContext] Failed to fetch metadata for ${directive}: ${metaResponse.status}`
              );
              return { directive, metadata: null };
            }
            const metadata: ToolMetadata = await metaResponse.json();
            return { directive, metadata };
          } catch (fetchError) {
            console.error(
              `[MetadataContext] Error fetching metadata for ${directive}:`,
              fetchError
            );
            return { directive, metadata: null };
          }
        });

        const results = await Promise.all(metadataPromises);

        if (!isMounted) return;

        const newMetadataMap: Record<string, ToolMetadata> = {};
        results.forEach((result) => {
          if (result.metadata) {
            newMetadataMap[result.directive] = result.metadata;
          }
        });
        setToolMetadataMap(newMetadataMap);
      } catch (err) {
        if (isMounted) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : 'An unknown error occurred while fetching metadata.';
          console.error(
            '[MetadataContext] Failed to load tool metadata:',
            errorMessage
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

    fetchAllMetadata();

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
