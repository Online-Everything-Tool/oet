// FILE: app/t/_hooks/useToolUrlState.ts
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// Define ParamConfig interface - REMOVED stateVariable
export interface ParamConfig {
    paramName: string;
    type: 'string' | 'enum' | 'boolean' | 'number' | 'json';
    defaultValue: unknown;
}

// Define the structure of the state setters object
// Keys MUST now match paramName from metadata
// --- ADDED export keyword ---
export type StateSetters = Record<string, React.Dispatch<React.SetStateAction<unknown>>>;

export default function useToolUrlState(
    paramConfigs: ParamConfig[] | undefined,
    stateSetters: StateSetters
) {
    const searchParams = useSearchParams();
    const [shouldRunOnLoad, setShouldRunOnLoad] = useState(false);

    useEffect(() => {
        if (!paramConfigs || paramConfigs.length === 0) {
            return;
        }

        console.log("[useToolUrlState] Effect running due to searchParams change.");
        const loadedState: Record<string, unknown> = {};
        let primaryInputValueFromUrl: unknown = null;

        paramConfigs.forEach(config => {
            const urlValue = searchParams.get(config.paramName);
            let valueToSet: unknown = config.defaultValue;

            if (urlValue !== null) {
                let parsedValue: unknown = config.defaultValue;
                let isValid = false;
                try {
                    switch (config.type) {
                        case 'string':
                        case 'enum': // Treat enum same as string for parsing
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
                            try { parsedValue = JSON.parse(urlValue); isValid = true; }
                            catch(jsonError){ console.warn(`[useToolUrlState] Invalid JSON value for param '${config.paramName}'. Using default. Error:`, jsonError); }
                            break;
                        default:
                            console.warn(`[useToolUrlState] Unknown type '${config.type}' for param '${config.paramName}'. Using default.`);
                    }
                } catch (parseError) {
                    console.warn(`[useToolUrlState] Error processing param '${config.paramName}' with value '${urlValue}'`, parseError);
                }
                if (isValid) {
                    valueToSet = parsedValue;
                }
            }

            // Use paramName as the key for loadedState
            loadedState[config.paramName] = valueToSet;

            // Track primary input value (assuming first param or 'text' is primary)
            const isPrimaryInput = config.paramName === 'text' || paramConfigs[0]?.paramName === config.paramName;
            if (isPrimaryInput) {
                primaryInputValueFromUrl = valueToSet;
            }

            // Use paramName to find the setter
             if (stateSetters[config.paramName]) {
                 // Passing 'unknown' to a setter expecting SetStateAction<unknown> is valid
                 stateSetters[config.paramName](valueToSet);
             } else {
                  console.warn(`[useToolUrlState] No setter found for state variable matching paramName: ${config.paramName}`);
             }
        });

        // Determine if calculation should run based on truthiness of primary input
        let shouldTrigger = false;
        if (primaryInputValueFromUrl !== null && primaryInputValueFromUrl !== undefined) {
            if (typeof primaryInputValueFromUrl === 'string' && primaryInputValueFromUrl.trim() === '') {
                shouldTrigger = false; // Don't trigger for empty string
            } else {
                shouldTrigger = true;
            }
        }


        if (shouldTrigger) {
            console.log(`[useToolUrlState] Signaling calculation should run based on primary input param '${paramConfigs[0]?.paramName || 'text'}'.`);
            setShouldRunOnLoad(true);
        } else {
            console.log("[useToolUrlState] Signaling calculation should NOT run (no primary input value in URL / primary input is falsy/empty).");
            setShouldRunOnLoad(false); // Ensure it's false if no trigger condition met
        }

    // stateSetters should be stable due to useMemo in parent components
    }, [searchParams, paramConfigs, stateSetters]);

    return { shouldRunOnLoad, setShouldRunOnLoad };
}