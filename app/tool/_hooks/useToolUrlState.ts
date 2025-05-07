// FILE: app/tool/_hooks/useToolUrlState.ts
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ParamConfig } from '@/src/types/tools';

export type StateSetters = Record<
  string,
  React.Dispatch<React.SetStateAction<unknown>>
>;

export default function useToolUrlState(
  paramConfigs: ParamConfig[] | undefined,
  stateSetters: StateSetters
) {
  const searchParams = useSearchParams();
  const [shouldRunOnLoad, setShouldRunOnLoad] = useState(false);

  useEffect(() => {
    if (!paramConfigs || paramConfigs.length === 0) {
      setShouldRunOnLoad(false);
      return;
    }

    console.log('[useToolUrlState] Effect running due to searchParams change.');
    let urlProvidedAnyValue = false;

    paramConfigs.forEach((config) => {
      const urlValue = searchParams.get(config.paramName);
      let valueToSet: unknown = config.defaultValue;
      let isValid = false;

      if (urlValue !== null) {
        let parsedValue: unknown;
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
              } else {
                console.warn(
                  `[useToolUrlState] Invalid boolean value '${urlValue}' for param '${config.paramName}'. Using default.`
                );
              }
              break;
            case 'number':
              const num = parseFloat(urlValue);
              if (!isNaN(num)) {
                parsedValue = num;
                isValid = true;
              } else {
                console.warn(
                  `[useToolUrlState] Invalid number value '${urlValue}' for param '${config.paramName}'. Using default.`
                );
              }
              break;
            case 'json':
              try {
                const potentialJson = JSON.parse(urlValue);
                if (potentialJson !== null && potentialJson !== undefined) {
                  parsedValue = potentialJson;
                  isValid = true;
                } else {
                  console.warn(
                    `[useToolUrlState] Parsed JSON value for param '${config.paramName}' is null/undefined. Using default.`
                  );
                }
              } catch (jsonError) {
                console.warn(
                  `[useToolUrlState] Invalid JSON value for param '${config.paramName}'. Using default. Error:`,
                  jsonError
                );
              }
              break;
            default:
              console.warn(
                `[useToolUrlState] Unknown type '${config.type}' for param '${config.paramName}'. Using default.`
              );
          }

          if (isValid) {
            valueToSet = parsedValue;

            const defaultValueAsString = String(config.defaultValue ?? '');
            const valueToSetAsString = String(valueToSet ?? '');

            const isDefaultEffectivelyEmpty =
              defaultValueAsString === '' ||
              defaultValueAsString === 'null' ||
              defaultValueAsString === 'undefined';
            const isValueEffectivelyEmpty =
              valueToSetAsString === '' ||
              valueToSetAsString === 'null' ||
              valueToSetAsString === 'undefined';

            if (
              !isValueEffectivelyEmpty &&
              valueToSetAsString !== defaultValueAsString
            ) {
              urlProvidedAnyValue = true;
              console.log(
                `[useToolUrlState] Param '${config.paramName}' has non-default value '${valueToSetAsString}' from URL.`
              );
            } else if (isValueEffectivelyEmpty && !isDefaultEffectivelyEmpty) {
              urlProvidedAnyValue = true;
              console.log(
                `[useToolUrlState] Param '${config.paramName}' was explicitly cleared in URL (default was '${defaultValueAsString}').`
              );
            }
          }
        } catch (parseError) {
          console.warn(
            `[useToolUrlState] Error processing param '${config.paramName}' with value '${urlValue}'`,
            parseError
          );

          valueToSet = config.defaultValue;
        }
      }

      if (stateSetters[config.paramName]) {
        stateSetters[config.paramName](valueToSet);
      } else {
        console.warn(
          `[useToolUrlState] No setter found for state variable matching paramName: ${config.paramName}`
        );
      }
    });

    if (urlProvidedAnyValue) {
      console.log(
        '[useToolUrlState] Signaling calculation should run because at least one non-default or explicitly cleared parameter value was found in the URL.'
      );
      setShouldRunOnLoad(true);
    } else {
      console.log(
        '[useToolUrlState] Signaling calculation should NOT run (no non-default or explicitly cleared parameter values found in URL).'
      );
      setShouldRunOnLoad(false);
    }
  }, [searchParams, paramConfigs, stateSetters]);

  return { shouldRunOnLoad, setShouldRunOnLoad };
}
