// FILE: app/tool/_hooks/useToolUrlState.ts
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ParamConfig } from '@/src/types/tools';

export type UrlStateObject = Partial<Record<string, unknown>>;

export interface UseToolUrlStateReturn {
  urlState: UrlStateObject;
  isLoadingUrlState: boolean;
  urlParamsLoaded: boolean;
  urlProvidedAnyValue: boolean;
}

export default function useToolUrlState(
  paramConfigs: ParamConfig[] | undefined
): UseToolUrlStateReturn {
  const searchParams = useSearchParams();

  const [urlState, setUrlState] = useState<UrlStateObject>({});
  const [isLoadingUrlState, setIsLoadingUrlState] = useState<boolean>(true);
  const [urlParamsLoaded, setUrlParamsLoaded] = useState<boolean>(false);
  const [urlProvidedAnyValue, setUrlProvidedAnyValue] =
    useState<boolean>(false);

  const memoizedParamConfigs = useMemo(
    () => paramConfigs || [],
    [paramConfigs]
  );

  useEffect(() => {
    setIsLoadingUrlState(true);
    setUrlProvidedAnyValue(false);
    const parsedStateFromUrl: UrlStateObject = {};
    let anyValueFound = false;

    if (memoizedParamConfigs.length > 0) {
      memoizedParamConfigs.forEach((config) => {
        const urlValue = searchParams.get(config.paramName);
        if (urlValue !== null) {
          let parsedValue: unknown = undefined;
          let isValid = false;
          try {
            switch (config.type) {
              case 'string':
              case 'enum':
                parsedValue = urlValue;
                isValid = true;
                break;
              case 'boolean':
                if (urlValue.toLowerCase() === 'true') {
                  parsedValue = true;
                  isValid = true;
                } else if (urlValue.toLowerCase() === 'false') {
                  parsedValue = false;
                  isValid = true;
                }
                break;
              case 'number':
                const num = parseFloat(urlValue);
                if (!isNaN(num)) {
                  parsedValue = num;
                  isValid = true;
                }
                break;
              case 'json':
                try {
                  parsedValue = JSON.parse(urlValue);
                  isValid = true;
                } catch (_jsonError) {
                  /* ignore */
                }
                break;
            }
            if (isValid) {
              parsedStateFromUrl[config.paramName] = parsedValue;
              anyValueFound = true;
            }
          } catch (_parseError) {
            /* ignore */
          }
        }
      });
    }
    setUrlState(parsedStateFromUrl);
    setUrlProvidedAnyValue(anyValueFound);
    setIsLoadingUrlState(false);
    setUrlParamsLoaded(true);
  }, [searchParams, memoizedParamConfigs]);

  return {
    urlState,
    isLoadingUrlState,
    urlParamsLoaded,
    urlProvidedAnyValue,
  };
}
