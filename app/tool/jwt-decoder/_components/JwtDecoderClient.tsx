'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import type { TriggerType } from '@/src/types/history';
import useToolUrlState, { StateSetters } from '../../_hooks/useToolUrlState';
import type { ParamConfig } from '@/src/types/tools';
import jwtDecode from 'jwt-decode';

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

    const handleDecode = useCallback(() => {
        setError(null);
        setDecodedJwt(null);
        if (!jwt) return;

        try {
            const decoded = jwtDecode(jwt);
            setDecodedJwt(decoded);
            addHistoryEntry({
                toolName: toolTitle,
                toolRoute: toolRoute,
                trigger: 'click',
                input: { jwt: jwt.length > 500 ? jwt.substring(0, 500) + '...' : jwt },
                output: decoded,
                status: 'success'
            });
        } catch (err: any) {
            setError(err.message);
            addHistoryEntry({
                toolName: toolTitle,
                toolRoute: toolRoute,
                trigger: 'click',
                input: { jwt: jwt.length > 500 ? jwt.substring(0, 500) + '...' : jwt },
                output: err.message,
                status: 'error'
            });
        }
    }, [jwt, addHistoryEntry, toolTitle, toolRoute]);

    useEffect(() => {
        handleDecode();
    }, [handleDecode]);

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setJwt(event.target.value);
    };

    const handleClear = () => {
        setJwt('');
        setDecodedJwt(null);
        setError(null);
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
                    className="w-full p-3 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none resize-y text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
                    spellCheck="false"
                />
            </div>
            <button type="button" onClick={handleDecode} className="px-5 py-2 rounded-md text-[rgb(var(--color-button-primary-text))] font-medium bg-[rgb(var(--color-button-primary-bg))] hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none transition duration-150 ease-in-out">Decode JWT</button>
            <button type="button" onClick={handleClear} className="px-3 py-2 rounded-md text-[rgb(var(--color-button-neutral-text))] font-medium bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none transition duration-150 ease-in-out ml-auto">Clear</button>
            {error && (
                <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    <div><strong className="font-semibold">Error:</strong> {error}</div>
                </div>
            )}
            {decodedJwt && (
                <pre className="p-3 bg-[rgb(var(--color-bg-subtle))] rounded-md text-sm whitespace-pre-wrap font-mono">
                    {JSON.stringify(decodedJwt, null, 2)}
                </pre>
            )}
        </div>
    );
}