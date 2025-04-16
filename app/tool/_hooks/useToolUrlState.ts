// FILE: app/tool/_hooks/useToolUrlState.ts
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ParamConfig } from '@/src/types/tools';


export type StateSetters = Record<string, React.Dispatch<React.SetStateAction<unknown>>>;

export default function useToolUrlState(
    paramConfigs: ParamConfig[] | undefined,
    stateSetters: StateSetters
) {
    const searchParams = useSearchParams();
    const [shouldRunOnLoad, setShouldRunOnLoad] = useState(false);

    useEffect(() => {
        if (!paramConfigs || paramConfigs.length === 0) {
            // If no params are defined, never signal to run on load based on URL
            setShouldRunOnLoad(false);
            return;
        }

        console.log("[useToolUrlState] Effect running due to searchParams change.");
        let urlProvidedAnyValue = false; // Flag to track if ANY param had a value in the URL

        paramConfigs.forEach(config => {
            const urlValue = searchParams.get(config.paramName);
            let valueToSet: unknown = config.defaultValue;
            let isValid = false; // Flag to track if parsing succeeded for this param

            if (urlValue !== null) {
                // Found a value for this param in the URL
                let parsedValue: unknown; // Keep default until successfully parsed
                try {
                    switch (config.type) {
                        case 'string':
                        case 'enum':
                            parsedValue = urlValue;
                            isValid = true;
                            break;
                        case 'boolean':
                            if (urlValue.toLowerCase() === 'true') { parsedValue = true; isValid = true; }
                            else if (urlValue.toLowerCase() === 'false') { parsedValue = false; isValid = true; }
                            else { console.warn(`[useToolUrlState] Invalid boolean value '${urlValue}' for param '${config.paramName}'. Using default.`); }
                            break;
                        case 'number':
                             const num = parseFloat(urlValue);
                             if (!isNaN(num)) { parsedValue = num; isValid = true; }
                             else { console.warn(`[useToolUrlState] Invalid number value '${urlValue}' for param '${config.paramName}'. Using default.`); }
                             break;
                        case 'json':
                            // Only consider JSON valid if it parses AND isn't just the string "null" or "undefined"
                            try {
                                const potentialJson = JSON.parse(urlValue);
                                if (potentialJson !== null && potentialJson !== undefined) {
                                     parsedValue = potentialJson;
                                     isValid = true;
                                } else {
                                    console.warn(`[useToolUrlState] Parsed JSON value for param '${config.paramName}' is null/undefined. Using default.`);
                                }
                            } catch (jsonError){ console.warn(`[useToolUrlState] Invalid JSON value for param '${config.paramName}'. Using default. Error:`, jsonError); }
                            break;
                        default:
                            console.warn(`[useToolUrlState] Unknown type '${config.type}' for param '${config.paramName}'. Using default.`);
                    }

                    if (isValid) {
                        valueToSet = parsedValue;
                        // --- REVISED LOGIC ---
                        // Check if the value is meaningfully different from the default
                        // Simple string conversion handles primitives, null, undefined adequately for this check.
                        const defaultValueAsString = String(config.defaultValue ?? ''); // Handle null/undefined default
                        const valueToSetAsString = String(valueToSet ?? '');       // Handle null/undefined value

                        // Consider empty string ('') as equivalent to null/undefined for triggering check
                        const isDefaultEffectivelyEmpty = defaultValueAsString === '' || defaultValueAsString === 'null' || defaultValueAsString === 'undefined';
                        const isValueEffectivelyEmpty = valueToSetAsString === '' || valueToSetAsString === 'null' || valueToSetAsString === 'undefined';

                        // Trigger if value is not effectively empty AND it's different from default
                        // OR if value IS effectively empty but default was NOT
                        if (!isValueEffectivelyEmpty && valueToSetAsString !== defaultValueAsString) {
                             urlProvidedAnyValue = true;
                             console.log(`[useToolUrlState] Param '${config.paramName}' has non-default value '${valueToSetAsString}' from URL.`);
                        } else if (isValueEffectivelyEmpty && !isDefaultEffectivelyEmpty) {
                             // If URL explicitly clears a value that had a default, still consider it a trigger?
                             // Let's say yes for now, as it's an explicit URL action.
                             urlProvidedAnyValue = true;
                             console.log(`[useToolUrlState] Param '${config.paramName}' was explicitly cleared in URL (default was '${defaultValueAsString}').`);
                        }
                        // --- END REVISED LOGIC ---
                    }

                } catch (parseError) {
                    console.warn(`[useToolUrlState] Error processing param '${config.paramName}' with value '${urlValue}'`, parseError);
                    // Ensure valueToSet remains defaultValue on error
                    valueToSet = config.defaultValue;
                }
            }

            // Update state regardless of whether it came from URL or is default
            if (stateSetters[config.paramName]) {
                 stateSetters[config.paramName](valueToSet);
            } else {
                  console.warn(`[useToolUrlState] No setter found for state variable matching paramName: ${config.paramName}`);
            }
        });

        // --- REVISED LOGIC ---
        // Signal to run if *any* parameter had a valid, non-default value provided in the URL
        if (urlProvidedAnyValue) {
            console.log("[useToolUrlState] Signaling calculation should run because at least one non-default or explicitly cleared parameter value was found in the URL.");
            setShouldRunOnLoad(true);
        } else {
            console.log("[useToolUrlState] Signaling calculation should NOT run (no non-default or explicitly cleared parameter values found in URL).");
            setShouldRunOnLoad(false);
        }
        // --- END REVISED LOGIC ---

    // stateSetters should be stable due to useMemo in parent components
    }, [searchParams, paramConfigs, stateSetters]); // Dependencies remain the same

    return { shouldRunOnLoad, setShouldRunOnLoad };
}