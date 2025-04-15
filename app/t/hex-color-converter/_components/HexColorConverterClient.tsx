'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useHistory, TriggerType } from '../../../context/HistoryContext';
import useToolUrlState, { ParamConfig, StateSetters } from '../../_hooks/useToolUrlState';

interface HexColorConverterClientProps {
    urlStateParams: ParamConfig[];
    toolTitle: string;
    toolRoute: string;
}

export default function HexColorConverterClient({
    urlStateParams,
    toolTitle,
    toolRoute
}: HexColorConverterClientProps) {
    const [hex, setHex] = useState<string>('');
    const [r, setR] = useState<number>(0);
    const [g, setG] = useState<number>(0);
    const [b, setB] = useState<number>(0);
    const [h, setH] = useState<number>(0);
    const [s, setS] = useState<number>(0);
    const [l, setL] = useState<number>(0);
    const [error, setError] = useState<string>('');

    const { addHistoryEntry } = useHistory();

    const stateSetters = useMemo(() => ({
        hex: setHex,
        r: setR,
        g: setG,
        b: setB,
        h: setH,
        s: setS,
        l: setL,
    }), []);

    const { shouldRunOnLoad, setShouldRunOnLoad } = useToolUrlState(
        urlStateParams,
        stateSetters as StateSetters
    );

    const hexToRgb = useCallback(() => {
        const hexRegex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
        const match = hex.match(hexRegex);
        if (match) {
            setR(parseInt(match[1], 16));
            setG(parseInt(match[2], 16));
            setB(parseInt(match[3], 16));
            setError('');
            return;
        }
        setError('Invalid hex code');
    }, [hex]);

    const rgbToHsl = useCallback(() => {
        const rNorm = r / 255;
        const gNorm = g / 255;
        const bNorm = b / 255;
        const max = Math.max(rNorm, gNorm, bNorm);
        const min = Math.min(rNorm, gNorm, bNorm);
        const l = (max + min) / 2;

        let h, s;
        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
                case gNorm: h = (bNorm - rNorm) / d + 2; break;
                case bNorm: h = (rNorm - gNorm) / d + 4; break;
            }
            h /= 6;
        }
        setH(Math.round(h * 360));
        setS(Math.round(s * 100));
        setL(Math.round(l * 100));
    }, [r, g, b]);

    useEffect(() => {
        if (shouldRunOnLoad && hex) {
            hexToRgb();
            rgbToHsl();
            setShouldRunOnLoad(false);
        }
    }, [shouldRunOnLoad, setShouldRunOnLoad, hex, hexToRgb, rgbToHsl]);

    const handleHexChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setHex(event.target.value);
        setR(0);
        setG(0);
        setB(0);
        setH(0);
        setS(0);
        setL(0);
        setError('');
    }, []);

    const handleRgbChange = useCallback(() => {
        hexToRgb();
        rgbToHsl();
    }, [hexToRgb, rgbToHsl]);

    const handleClear = () => {
        setHex('');
        setR(0);
        setG(0);
        setB(0);
        setH(0);
        setS(0);
        setL(0);
        setError('');
    };

    return (
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
            <div>
                <label htmlFor="hex-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Hex Color Code:</label>
                <input
                    type="text"
                    id="hex-input"
                    value={hex}
                    onChange={handleHexChange}
                    placeholder="#RRGGBB or RRGGBB"
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">RGB:</label>
                <div className="flex gap-2">
                    <input type="number" min="0" max="255" value={r} onChange={() => handleRgbChange()} className="w-1/3 p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base" />
                    <input type="number" min="0" max="255" value={g} onChange={() => handleRgbChange()} className="w-1/3 p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base" />
                    <input type="number" min="0" max="255" value={b} onChange={() => handleRgbChange()} className="w-1/3 p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base" />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">HSL:</label>
                <div className="flex gap-2">
                    <input type="number" min="0" max="360" value={h} onChange={() => {}} className="w-1/3 p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base" readOnly/>
                    <input type="number" min="0" max="100" value={s} onChange={() => {}} className="w-1/3 p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base" readOnly/>
                    <input type="number" min="0" max="100" value={l} onChange={() => {}} className="w-1/3 p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-base" readOnly/>
                </div>
            </div>
            {error && (
                <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    <div><strong className="font-semibold">Error:</strong> {error}</div>
                </div>
            )}
            <button type="button" onClick={handleClear} className="px-5 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition duration-150 ease-in-out">Clear</button>
        </div>
    );
}