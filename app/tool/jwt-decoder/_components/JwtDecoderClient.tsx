'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import type { TriggerType } from '@/src/types/history';
import useToolUrlState, { StateSetters } from '../../_hooks/useToolUrlState';
import type { ParamConfig } from '@/src/types/tools';

interface JwtDecoderClientProps {
    urlStateParams: ParamConfig[];
    toolTitle: string;
    toolRoute: string;
}

export default function JwtDecoderClient({
    urlStateParams,
    toolTitle,
    toolRoute
}: JwtDecoderClientProps) {
    const [jwt, setJwt] = useState<string>('');
    const [decodedJwt, setDecodedJwt] = useState<object | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { addHistoryEntry } = useHistory();

    const stateSetters = useToolUrlState(urlStateParams, {
        jwt: setJwt,
    });

    const handleDecode = useCallback(() => {
        setError(null);
        setDecodedJwt(null);
        try {
            const decoded = decodeJwt(jwt);
            setDecodedJwt(decoded);
            addHistoryEntry({
                toolName: toolTitle,
                toolRoute: toolRoute,
                trigger: 'click',
                input: { jwt: jwt.length > 500 ? jwt.substring(0, 500) + '...' : jwt },
                output: { decodedJwt: decoded },
                status: 'success',
            });
        } catch (err) {
            console.error('JWT Decode Error:', err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            addHistoryEntry({
                toolName: toolTitle,
                toolRoute: toolRoute,
                trigger: 'click',
                input: { jwt: jwt.length > 500 ? jwt.substring(0, 500) + '...' : jwt },
                output: { error: err instanceof Error ? err.message : 'An unknown error occurred.' },
                status: 'error',
            });
        }
    }, [jwt, addHistoryEntry, toolTitle, toolRoute]);

    useEffect(() => {
        if (stateSetters.jwt) {
            stateSetters.jwt(jwt);
        }
    }, [stateSetters.jwt, jwt]);

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setJwt(event.target.value);
    };

    const handleClear = () => {
        setJwt('');
        setDecodedJwt(null);
        setError(null);
    };

    const decodeJwt = (token: string) => {
        // Basic JWT decoding (replace with more robust library if needed)
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format.');
        }
        const payload = parts[1];
        try {
            return JSON.parse(atob(payload));
        } catch (err) {
            throw new Error('Invalid JWT payload.');
        }
    };

    return (
        <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
            <div>
                <label htmlFor="jwt-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">JWT:</label>
                <textarea
                    id="jwt-input"
                    rows={8}
                    value={jwt}
                    onChange={handleInputChange}
                    placeholder="Paste your JWT here..."
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-sm font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                    spellCheck="false"
                />
            </div>
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={handleDecode}
                    disabled={!jwt}
                    className="px-5 py-2 rounded-md text-[rgb(var(--color-button-accent-text))] font-medium bg-[rgb(var(--color-button-accent-bg))] hover:bg-[rgb(var(--color-button-accent-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out disabled:bg-[rgb(var(--color-bg-disabled))] disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted))]"
                >
                    Decode
                </button>
                <button
                    type="button"
                    onClick={handleClear}
                    className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition-colors duration-150 ease-in-out"
                >
                    Clear
                </button>
            </div>
            {error && (
                <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm">
                    <strong className="font-semibold">Error:</strong> {error}
                </div>
            )}
            {decodedJwt && (
                <div>
                    <label htmlFor="jwt-output" className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Decoded JWT:</label>
                    <pre className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-bg-subtle))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm text-sm font-mono whitespace-pre-wrap" id="jwt-output">
                        {JSON.stringify(decodedJwt, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}