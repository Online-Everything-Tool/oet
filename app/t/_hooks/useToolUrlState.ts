// /app/t/_hooks/useToolUrlState.ts
'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

// Define ParamConfig interface based on metadata structure
export interface ParamConfig { // Export interface for use in components
    paramName: string;
    stateVariable: string;
    type: 'string' | 'enum' | 'boolean' | 'number' | 'json';
    defaultValue: any;
}

// Define the structure of the state setters object
type StateSetters = Record<string, React.Dispatch<React.SetStateAction<any>>>;

// Hook to manage tool state based on URL search parameters defined in metadata
export default function useToolUrlState(
    paramConfigs: ParamConfig[] | undefined, // Allow undefined for safety
    stateSetters: StateSetters // Expect state setters passed in
) {
    const searchParams = useSearchParams();
    const [shouldRunOnLoad, setShouldRunOnLoad] = useState(false);
    // Ref to potentially store previous searchParams string for comparison,
    // although useEffect dependency array handles object identity change well.
    // const prevParamsRef = useRef<string | null>(null);

    useEffect(() => {
        // If no config is provided, do nothing.
        if (!paramConfigs || paramConfigs.length === 0) {
            return;
        }

        // Optional: Compare current params string with previous to potentially optimize,
        // but relying on useEffect dependency is usually sufficient.
        // const currentParamsString = searchParams.toString();
        // if (currentParamsString === prevParamsRef.current) {
        //     console.log("[useToolUrlState] Skipping effect: searchParams string identical.");
        //     return;
        // }
        // prevParamsRef.current = currentParamsString;

        console.log("[useToolUrlState] Effect running due to searchParams change.");
        const loadedState: Record<string, any> = {};
        let primaryInputValueFromUrl: any = null; // Track the specific input value derived from *this* effect run

        paramConfigs.forEach(config => {
            const urlValue = searchParams.get(config.paramName);
            let valueToSet = config.defaultValue; // Start with default
            // let valueFromUrlFound = false; // Not strictly needed anymore

            if (urlValue !== null) { // Parameter exists in URL
                // valueFromUrlFound = true;
                let parsedValue = config.defaultValue; // Fallback within parsing
                let isValid = false;
                try {
                    switch (config.type) {
                        case 'string':
                            parsedValue = urlValue;
                            isValid = true;
                            break;
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
                            try { parsedValue = JSON.parse(urlValue); isValid = true; }
                            catch(jsonError){ console.warn(`[useToolUrlState] Invalid JSON value for param '${config.paramName}'. Using default. Error:`, jsonError); }
                            break;
                        default:
                            console.warn(`[useToolUrlState] Unknown type '${config.type}' for param '${config.paramName}'. Using default.`);
                    }
                } catch (parseError) {
                    console.warn(`[useToolUrlState] Error processing param '${config.paramName}' with value '${urlValue}'`, parseError);
                    // Keep default value
                }
                // Assign the parsed value if valid, otherwise default is already set
                if (isValid) {
                    valueToSet = parsedValue;
                }
            }
             // else: urlValue is null, valueToSet remains defaultValue

            // Store the determined value for this state variable
            loadedState[config.stateVariable] = valueToSet;

            // Track the primary input value determined from THIS run
            // Using convention: primary input param is named 'text' OR is the first in the config
            const isPrimaryInput = config.paramName === 'text' || paramConfigs[0]?.paramName === config.paramName;
            if (isPrimaryInput) {
                primaryInputValueFromUrl = valueToSet;
            }

            // Set state in the consuming component
             if (stateSetters[config.stateVariable]) {
                 // We still call the setter. React handles bail-out if the value hasn't changed.
                 // console.log(`[useToolUrlState] Setting ${config.stateVariable} to:`, valueToSet);
                 stateSetters[config.stateVariable](valueToSet);
             } else {
                  console.warn(`[useToolUrlState] No setter found for state variable: ${config.stateVariable}`);
             }
        });

        // --- Determine if calculation should run ---
        // Trigger calculation if the primary input derived from the *current* params is truthy
        // (Adjust the definition of "truthy" as needed - e.g., non-empty string, non-zero number)
        const shouldTrigger = !!primaryInputValueFromUrl; // Simple truthiness check

        if (shouldTrigger) {
            console.log("[useToolUrlState] Signaling calculation should run based on current URL params having primary input.");
            setShouldRunOnLoad(true);
        } else {
            console.log("[useToolUrlState] Signaling calculation should NOT run (no primary input value in URL / primary input is falsy).");
            // Set to false ensures the trigger effect in the component resets if params change to empty input
            setShouldRunOnLoad(false);
        }

    // --- Dependencies ---
    // Re-run only when searchParams object identity changes.
    // Assumes paramConfigs and stateSetters are stable.
    }, [searchParams, paramConfigs, stateSetters]);

    // Return the signal flag and its setter
    return { shouldRunOnLoad, setShouldRunOnLoad };
}