// FILE: app/t/color-converter/_components/ColorConverterClient.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useHistory, TriggerType } from '../../../context/HistoryContext';
import useToolUrlState, { ParamConfig, StateSetters } from '../../_hooks/useToolUrlState';

interface ColorConverterClientProps {
    urlStateParams: ParamConfig[];
    toolTitle: string;
    toolRoute: string;
}

type InputMode = 'hex' | 'rgb' | 'hsl';
type CopiedFormat = 'hex' | 'rgb' | 'hsl' | null;

// --- Helper Functions (Unchanged) ---

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (c: number) => {
        const hex = Math.round(Math.max(0, Math.min(255, c))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s: number;
    const l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            default: h = 0; break; // Should not happen
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}


function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// --- Component ---
export default function ColorConverterClient({
    urlStateParams,
    toolTitle,
    toolRoute
}: ColorConverterClientProps) {
    const [hex, setHex] = useState<string>('');
    const [r, setR] = useState<string>('');
    const [g, setG] = useState<string>('');
    const [b, setB] = useState<string>('');
    const [h, setH] = useState<string>('');
    const [s, setS] = useState<string>('');
    const [l, setL] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [lastEditedField, setLastEditedField] = useState<InputMode>('hex'); // Default to hex
    const [copiedFormat, setCopiedFormat] = useState<CopiedFormat>(null);

    const { addHistoryEntry } = useHistory();

    const stateSetters = useMemo(() => ({
        hex: setHex, r: setR, g: setG, b: setB, h: setH, s: setS, l: setL,
    }), []);

    const { shouldRunOnLoad, setShouldRunOnLoad } = useToolUrlState(
        urlStateParams,
        stateSetters as StateSetters
    );

    // --- Conversion Handler ---
    const handleConvert = useCallback((triggerType: TriggerType, sourceFieldOverride?: InputMode) => {
        const source = sourceFieldOverride || lastEditedField; // Use override if provided (e.g., from URL load)
        console.log(`[ColorConverter] handleConvert triggered. Source: ${source}, Trigger: ${triggerType}`); // Debug log

        setError('');
        setCopiedFormat(null);
        let status: 'success' | 'error' = 'success';
        let currentError = '';
        let inputDetails: Record<string, unknown> = {};
        let outputDetails: Record<string, unknown> = {};
        let currentHex = '';
        let currentR = 0, currentG = 0, currentB = 0;
        let currentH = 0, currentS = 0, currentL = 0;

        try {
            if (source === 'hex') {
                if (!hex.trim()) throw new Error("Hex input cannot be empty.");
                inputDetails = { hex: hex };
                const rgbResult = hexToRgb(hex);
                if (rgbResult) {
                    ({ r: currentR, g: currentG, b: currentB } = rgbResult);
                    const hslResult = rgbToHsl(currentR, currentG, currentB);
                    ({ h: currentH, s: currentS, l: currentL } = hslResult);
                    currentHex = rgbToHex(currentR, currentG, currentB);
                    outputDetails = { rgb: `rgb(${currentR}, ${currentG}, ${currentB})`, hsl: `hsl(${currentH}, ${currentS}%, ${currentL}%)` };
                } else {
                    throw new Error('Invalid Hex code format. Use #RRGGBB or RRGGBB.');
                }
            } else if (source === 'rgb') {
                 if (!r.trim() || !g.trim() || !b.trim()) throw new Error("RGB inputs cannot be empty.");
                 currentR = parseInt(r, 10); currentG = parseInt(g, 10); currentB = parseInt(b, 10);
                 inputDetails = { r: String(currentR), g: String(currentG), b: String(currentB) };
                if (isNaN(currentR) || isNaN(currentG) || isNaN(currentB) || currentR < 0 || currentR > 255 || currentG < 0 || currentG > 255 || currentB < 0 || currentB > 255) {
                    throw new Error('Invalid RGB value. Each component must be between 0 and 255.');
                }
                currentHex = rgbToHex(currentR, currentG, currentB);
                const hslResult = rgbToHsl(currentR, currentG, currentB);
                ({ h: currentH, s: currentS, l: currentL } = hslResult);
                outputDetails = { hex: currentHex, hsl: `hsl(${currentH}, ${currentS}%, ${currentL}%)` };
            } else if (source === 'hsl') {
                if (!h.trim() || !s.trim() || !l.trim()) throw new Error("HSL inputs cannot be empty.");
                 currentH = parseInt(h, 10); currentS = parseInt(s, 10); currentL = parseInt(l, 10);
                 inputDetails = { h: String(currentH), s: String(currentS), l: String(currentL) };
                 if (isNaN(currentH) || isNaN(currentS) || isNaN(currentL) || currentH < 0 || currentH > 360 || currentS < 0 || currentS > 100 || currentL < 0 || currentL > 100) {
                    throw new Error('Invalid HSL value. H: 0-360, S/L: 0-100.');
                }
                const rgbResult = hslToRgb(currentH, currentS, currentL);
                ({ r: currentR, g: currentG, b: currentB } = rgbResult);
                currentHex = rgbToHex(currentR, currentG, currentB);
                outputDetails = { hex: currentHex, rgb: `rgb(${currentR}, ${currentG}, ${currentB})` };
            } else {
                // Should not happen with InputMode type, but good fallback
                throw new Error("Invalid conversion source specified.");
            }

            // Update all state fields after successful conversion
            setHex(currentHex);
            setR(String(currentR)); setG(String(currentG)); setB(String(currentB));
            setH(String(currentH)); setS(String(currentS)); setL(String(currentL));

        } catch (err) {
            currentError = err instanceof Error ? err.message : 'An unknown conversion error occurred.';
            setError(currentError);
            status = 'error';
            // Log the original input attempt that caused the error
             if (source === 'hex') inputDetails = { hex: hex, error: currentError };
             else if (source === 'rgb') inputDetails = { r: r, g: g, b: b, error: currentError };
             else if (source === 'hsl') inputDetails = { h: h, s: s, l: l, error: currentError };
             else inputDetails = { error: currentError }; // Fallback

            // Only clear dependent output fields on error
            if (source === 'hex') { setR(''); setG(''); setB(''); setH(''); setS(''); setL(''); }
            else if (source === 'rgb') { setHex(''); setH(''); setS(''); setL(''); }
            else if (source === 'hsl') { setHex(''); setR(''); setG(''); setB(''); }
        }

        // Log History
        addHistoryEntry({
            toolName: toolTitle,
            toolRoute: toolRoute,
            trigger: triggerType,
            input: inputDetails, // Uses keys matching metadata
            output: status === 'success' ? outputDetails : `Error: ${currentError}`,
            status: status,
        });

    }, [hex, r, g, b, h, s, l, lastEditedField, addHistoryEntry, toolTitle, toolRoute]);


    // --- UPDATED Effect for URL load ---
    useEffect(() => {
        if (shouldRunOnLoad) {
            let sourceToUse: InputMode | null = null;
            console.log("[ColorConverter] URL Load Effect Triggered. Checking params:", { hex, r, g, b, h, s, l });

            // Check for complete input groups based on state populated by useToolUrlState
            // Priority: Hex > RGB > HSL
            if (hex && hex.trim()) {
                sourceToUse = 'hex';
            } else if (r && r.trim() && g && g.trim() && b && b.trim()) {
                sourceToUse = 'rgb';
            } else if (h && h.trim() && s && s.trim() && l && l.trim()) {
                sourceToUse = 'hsl';
            }

            if (sourceToUse) {
                console.log(`[ColorConverter] URL Load: Detected source '${sourceToUse}'. Triggering conversion.`);
                // Update lastEditedField FIRST, then trigger conversion with the override
                setLastEditedField(sourceToUse);
                // Call handleConvert directly, overriding the source determination logic inside it for this load
                handleConvert('query', sourceToUse);
            } else {
                 console.log("[ColorConverter] URL Load: No valid/complete input group detected in URL params. No conversion triggered.");
            }

            // Mark shouldRunOnLoad as false AFTER attempting conversion logic
            setShouldRunOnLoad(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shouldRunOnLoad]); // Dependencies simplified: Only run when shouldRunOnLoad becomes true


    // --- Input Handlers ---
    const handleHexChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setHex(event.target.value);
        setLastEditedField('hex');
        setError(''); // Clear error on new input
        setCopiedFormat(null);
        // Don't clear other fields instantly, wait for convert
    }, []);

    const handleRgbChange = useCallback((event: React.ChangeEvent<HTMLInputElement>, component: 'r' | 'g' | 'b') => {
        const value = event.target.value;
        const setter = component === 'r' ? setR : component === 'g' ? setG : setB;
        setter(value);
        setLastEditedField('rgb');
        setError('');
        setCopiedFormat(null);
    }, []);

    const handleHslChange = useCallback((event: React.ChangeEvent<HTMLInputElement>, component: 'h' | 's' | 'l') => {
        const value = event.target.value;
        const setter = component === 'h' ? setH : component === 's' ? setS : setL;
        setter(value);
        setLastEditedField('hsl');
        setError('');
        setCopiedFormat(null);
    }, []);

    // --- Clear Handler ---
    const handleClear = useCallback(() => {
        setHex(''); setR(''); setG(''); setB(''); setH(''); setS(''); setL('');
        setError(''); setLastEditedField('hex'); setCopiedFormat(null);
        // No history log for clear
    }, []);

    // --- Copy Handler ---
    const handleCopy = useCallback(async (format: CopiedFormat) => {
        if (!format) return;
        let textToCopy = '';
        setError('');
        setCopiedFormat(null);

        try {
            if (format === 'hex') { textToCopy = hex; }
            else if (format === 'rgb') { textToCopy = `rgb(${r}, ${g}, ${b})`; }
            else if (format === 'hsl') { textToCopy = `hsl(${h}, ${s}%, ${l}%)`; }

            if (!textToCopy || (format === 'hex' && !hex.trim()) || (format === 'rgb' && (!r.trim() || !g.trim() || !b.trim())) || (format === 'hsl' && (!h.trim() || !s.trim() || !l.trim()))) {
                 throw new Error("No valid color value to copy for the selected format.");
            }

            await navigator.clipboard.writeText(textToCopy);
            setCopiedFormat(format);
            setTimeout(() => setCopiedFormat(null), 2000);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to copy.";
            setError(`Copy Error: ${message}`);
            console.error(`Copy ${format} failed:`, err);
        }
    }, [hex, r, g, b, h, s, l]);


    // --- Determine Color Swatch Style ---
    const colorSwatchStyle = useMemo(() => {
        let backgroundColor = 'transparent';
        let borderColor = 'rgb(var(--color-input-border))';

        if (!error) {
            const rNum = parseInt(r, 10); const gNum = parseInt(g, 10); const bNum = parseInt(b, 10);
            if (!isNaN(rNum) && !isNaN(gNum) && !isNaN(bNum) && rNum >= 0 && rNum <= 255 && gNum >= 0 && gNum <= 255 && bNum >= 0 && bNum <= 255) {
                backgroundColor = `rgb(${rNum}, ${gNum}, ${bNum})`;
            }
        }
         if (error) {
             borderColor = 'rgb(var(--color-border-error))';
         }

        return { backgroundColor, borderColor, borderWidth: '2px', borderStyle: 'solid' };
    }, [r, g, b, error]); // Depend only on final RGB state and error


    return (
        <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
            {/* Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-5">
                {/* Hex Input */}
                <div className="md:col-span-1 space-y-1">
                    <label htmlFor="hex-input" className={`block text-sm font-medium mb-1 ${lastEditedField === 'hex' ? 'text-[rgb(var(--color-text-base))] font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>Hex Color (#RRGGBB)</label>
                    <div className="flex">
                        <input
                            type="text" id="hex-input" value={hex} onChange={handleHexChange} placeholder="#ffffff"
                            className={`flex-grow p-2 border rounded-l-md shadow-sm focus:outline-none text-base font-mono ${error && lastEditedField === 'hex' ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-[rgb(var(--color-input-border))] focus:border-[rgb(var(--color-input-focus-border))] focus:ring-indigo-500'} bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] placeholder:text-[rgb(var(--color-input-placeholder))]`}
                            aria-invalid={error && lastEditedField === 'hex' ? 'true' : 'false'}
                            aria-describedby={error && lastEditedField === 'hex' ? "input-error-feedback" : undefined}
                        />
                         <button type="button" onClick={() => handleCopy('hex')} title="Copy Hex" className={`px-3 border-y border-r rounded-r-md transition-colors ${copiedFormat === 'hex' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-[rgb(var(--color-button-neutral-bg))] text-[rgb(var(--color-button-neutral-text))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))]'} ${!hex || error ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!hex || !!error}>
                             {copiedFormat === 'hex' ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>

                {/* RGB Inputs */}
                 <div className="md:col-span-1 space-y-1">
                    <label className={`block text-sm font-medium mb-1 ${lastEditedField === 'rgb' ? 'text-[rgb(var(--color-text-base))] font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>RGB (0-255)</label>
                     <div className="flex items-stretch gap-1">
                         {([
                             { comp: 'r', value: r, setter: handleRgbChange, label: 'R' },
                             { comp: 'g', value: g, setter: handleRgbChange, label: 'G' },
                             { comp: 'b', value: b, setter: handleRgbChange, label: 'B' }
                         ] as const).map(({ comp, value, setter, label }) => (
                             <input key={comp} type="number" min="0" max="255" value={value} placeholder={label} onChange={(e) => setter(e, comp)} aria-label={`RGB ${label}`}
                                 className={`w-1/3 p-2 border rounded-md shadow-sm focus:outline-none text-base ${error && lastEditedField === 'rgb' ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-[rgb(var(--color-input-border))] focus:border-[rgb(var(--color-input-focus-border))] focus:ring-indigo-500'} bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] placeholder:text-[rgb(var(--color-input-placeholder))]`}
                                 aria-invalid={error && lastEditedField === 'rgb' ? 'true' : 'false'}
                             />
                         ))}
                         <button type="button" onClick={() => handleCopy('rgb')} title="Copy RGB" className={`px-3 border rounded-md transition-colors ${copiedFormat === 'rgb' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-[rgb(var(--color-button-neutral-bg))] text-[rgb(var(--color-button-neutral-text))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))]'} ${!r || !g || !b || error ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!r || !g || !b || !!error}>
                             {copiedFormat === 'rgb' ? 'Copied!' : 'Copy'}
                         </button>
                     </div>
                 </div>

                {/* HSL Inputs */}
                 <div className="md:col-span-1 space-y-1">
                    <label className={`block text-sm font-medium mb-1 ${lastEditedField === 'hsl' ? 'text-[rgb(var(--color-text-base))] font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>HSL (H: 0-360, S/L: 0-100)</label>
                    <div className="flex items-stretch gap-1">
                        {([
                            { comp: 'h', value: h, setter: handleHslChange, label: 'H', max: 360 },
                            { comp: 's', value: s, setter: handleHslChange, label: 'S', max: 100 },
                            { comp: 'l', value: l, setter: handleHslChange, label: 'L', max: 100 }
                        ] as const).map(({ comp, value, setter, label, max }) => (
                            <input key={comp} type="number" min="0" max={max} value={value} placeholder={label} onChange={(e) => setter(e, comp)} aria-label={`HSL ${label}`}
                                className={`w-1/3 p-2 border rounded-md shadow-sm focus:outline-none text-base ${error && lastEditedField === 'hsl' ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-[rgb(var(--color-input-border))] focus:border-[rgb(var(--color-input-focus-border))] focus:ring-indigo-500'} bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] placeholder:text-[rgb(var(--color-input-placeholder))]`}
                                aria-invalid={error && lastEditedField === 'hsl' ? 'true' : 'false'}
                            />
                        ))}
                         <button type="button" onClick={() => handleCopy('hsl')} title="Copy HSL" className={`px-3 border rounded-md transition-colors ${copiedFormat === 'hsl' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-[rgb(var(--color-button-neutral-bg))] text-[rgb(var(--color-button-neutral-text))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))]'} ${!h || !s || !l || error ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!h || !s || !l || !!error}>
                             {copiedFormat === 'hsl' ? 'Copied!' : 'Copy'}
                         </button>
                    </div>
                 </div>
            </div>

            {/* Actions and Color Swatch */}
            <div className="flex flex-wrap gap-4 items-center border-t border-b border-[rgb(var(--color-border-base))] py-4">
                 <button
                    type="button"
                    // Pass undefined for source override, so it uses lastEditedField
                    onClick={() => handleConvert('click', undefined)}
                    className="px-6 py-2 rounded-md text-[rgb(var(--color-button-primary-text))] font-medium bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[rgb(var(--color-button-primary-bg))] transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
                    disabled={!hex.trim() && (!r.trim() || !g.trim() || !b.trim()) && (!h.trim() || !s.trim() || !l.trim())} // Disable if all inputs are empty
                 >
                    Convert
                 </button>
                 <button type="button" onClick={handleClear} className="px-4 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition duration-150 ease-in-out">Clear</button>
                 <div className="ml-auto flex items-center gap-2">
                     <span className="text-sm text-[rgb(var(--color-text-muted))]">Preview:</span>
                     <div className="h-8 w-14 rounded shadow-inner" style={colorSwatchStyle}></div>
                 </div>
            </div>

            {/* Error Display */}
            {error && (
                <div role="alert" id="input-error-feedback" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    <div><strong className="font-semibold">Error:</strong> {error}</div>
                </div>
            )}
        </div>
    );
}