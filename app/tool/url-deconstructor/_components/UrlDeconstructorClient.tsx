'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import useToolState from '@/app/tool/_hooks/useToolState';
import Input from '@/app/tool/_components/form/Input';
import Button from '@/app/tool/_components/form/Button';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { ParamConfig } from '@/src/types/tools';
import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import { useMetadata } from '@/app/context/MetadataContext';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import importedMetadata from '../metadata.json';

interface UrlDeconstructorClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

interface DeconstructorState {
  urlInput: string;
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  queryParams: [string, string][];
  error: string | null;
}

const DEFAULT_STATE: DeconstructorState = {
  urlInput: '',
  protocol: '',
  hostname: '',
  port: '',
  pathname: '',
  search: '',
  hash: '',
  queryParams: [],
  error: null,
};

const DEBOUNCE_MS = 250;
const metadata = importedMetadata;

const OutputField = ({
  label,
  value,
  onCopy,
  fieldKey,
  copySuccess,
}: {
  label: string;
  value: string;
  onCopy: (text: string, key: string) => void;
  fieldKey: string;
  copySuccess: boolean;
}) => (
  <div>
    <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">
      {label}
    </label>
    <div className="relative">
      <Input
        type="text"
        value={value}
        readOnly
        className="!bg-[rgb(var(--color-bg-subtle))]"
        inputClassName="pr-10 font-mono"
        onChange={() => {}}
        onClick={(e) => e.currentTarget.select()}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-2">
        <Button
          variant="link"
          size="sm"
          onClick={() => onCopy(value, fieldKey)}
          disabled={!value || copySuccess}
          title={`Copy ${label}`}
          className="p-1"
        >
          {copySuccess ? (
            <CheckIcon className="h-5 w-5 text-[rgb(var(--color-status-success))]" />
          ) : (
            <ClipboardDocumentIcon className="h-5 w-5 text-[rgb(var(--color-icon-base))]" />
          )}
        </Button>
      </div>
    </div>
  </div>
);

export default function UrlDeconstructorClient({
  urlStateParams,
  toolRoute,
}: UrlDeconstructorClientProps) {
  const {
    state,
    setState,
    isLoadingState,
    saveStateNow,
  } = useToolState<DeconstructorState>(toolRoute, DEFAULT_STATE);
  const [copySuccess, setCopySuccess] = useState<Record<string, boolean>>({});
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialUrlLoadProcessedRef = useRef(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { getToolMetadata } = useMetadata();

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setState({ error: `Metadata not found for source: ${signal.sourceToolTitle}` });
        return;
      }

      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );

      if (resolvedPayload.type === 'error' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
        setState({ error: resolvedPayload.errorMessage || 'No transferable data received.' });
        return;
      }

      const textItem = resolvedPayload.data.find(item => item.type.startsWith('text/'));
      if (textItem) {
        const newText = await textItem.blob.text();
        setState({ urlInput: newText });
      } else {
        setState({ error: 'No compatible text data received.' });
      }
      setUserDeferredAutoPopup(false);
    },
    [getToolMetadata, setState]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: metadata.directive,
    onProcessSignal: handleProcessIncomingSignal,
  });

  const handleCopy = useCallback((text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopySuccess((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    });
  }, []);

  const debouncedParse = useDebouncedCallback((input: string) => {
    if (!input.trim()) {
      setState(DEFAULT_STATE);
      return;
    }

    try {
      // A common user mistake is not including a protocol. The URL API requires one.
      // We can be helpful and add one if it's missing.
      let urlToParse = input;
      if (!/^[a-zA-Z]+:\/\//.test(input)) {
        urlToParse = 'https://' + input;
      }
      
      const url = new URL(urlToParse);
      setState({
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        queryParams: Array.from(url.searchParams.entries()),
        error: null,
      });
    } catch (e) {
      setState({
        ...DEFAULT_STATE,
        urlInput: input, // Keep the user's invalid input visible
        error: 'Invalid URL provided.',
      });
    }
  }, DEBOUNCE_MS);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState({ urlInput: e.target.value });
  };

  useEffect(() => {
    if (!isLoadingState) {
      initialToolStateLoadCompleteRef.current = true;
    }
  }, [isLoadingState]);

  useEffect(() => {
    if (isLoadingState || !initialToolStateLoadCompleteRef.current) return;
    
    if (!initialUrlLoadProcessedRef.current) {
      const params = new URLSearchParams(window.location.search);
      const urlFromQuery = params.get('url');
      if (urlFromQuery && urlFromQuery !== state.urlInput) {
        setState({ urlInput: urlFromQuery });
      }
      initialUrlLoadProcessedRef.current = true;
    }
    
    debouncedParse(state.urlInput);
  }, [state.urlInput, isLoadingState, debouncedParse, setState]);

  useEffect(() => {
    if (
      !isLoadingState &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup]);

  const handleModalDeferAll = () => {
    setUserDeferredAutoPopup(true);
    itdeTarget.closeModal();
  };

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return <div className="text-center p-4 italic text-[rgb(var(--color-text-muted))]">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <ReceiveItdeDataTrigger
          hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
          pendingSignalCount={itdeTarget.pendingSignals.length}
          onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
        />
      </div>
      <Input
        type="text"
        value={state.urlInput}
        onChange={handleInputChange}
        placeholder="e.g., https://www.example.com/path/to/page?foo=bar&baz=qux#section-1"
        label="Full URL"
        autoFocus
      />

      {state.error && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-status-error))] rounded-md text-sm flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OutputField label="Protocol" value={state.protocol} onCopy={handleCopy} fieldKey="protocol" copySuccess={!!copySuccess.protocol} />
        <OutputField label="Hostname" value={state.hostname} onCopy={handleCopy} fieldKey="hostname" copySuccess={!!copySuccess.hostname} />
        <OutputField label="Port" value={state.port} onCopy={handleCopy} fieldKey="port" copySuccess={!!copySuccess.port} />
        <OutputField label="Pathname" value={state.pathname} onCopy={handleCopy} fieldKey="pathname" copySuccess={!!copySuccess.pathname} />
        <OutputField label="Search (Query String)" value={state.search} onCopy={handleCopy} fieldKey="search" copySuccess={!!copySuccess.search} />
        <OutputField label="Hash (Fragment)" value={state.hash} onCopy={handleCopy} fieldKey="hash" copySuccess={!!copySuccess.hash} />
      </div>

      {state.queryParams.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-medium text-[rgb(var(--color-text-emphasis))]">Query Parameters</h3>
          <div className="overflow-x-auto border border-[rgb(var(--color-border-base))] rounded-md">
            <table className="w-full text-sm border-collapse">
              <thead className="text-left bg-[rgb(var(--color-bg-subtle))]">
                <tr>
                  <th className="p-2 border-b border-[rgb(var(--color-border-base))] font-medium text-[rgb(var(--color-text-muted))]">Parameter</th>
                  <th className="p-2 border-b border-[rgb(var(--color-border-base))] font-medium text-[rgb(var(--color-text-muted))]">Value</th>
                </tr>
              </thead>
              <tbody>
                {state.queryParams.map(([key, value], index) => (
                  <tr key={`${key}-${index}`} className="group hover:bg-[rgb(var(--color-bg-subtle-hover))]">
                    <td className="p-2 border-b border-[rgb(var(--color-border-soft))] font-mono break-all">{key}</td>
                    <td className="p-2 border-b border-[rgb(var(--color-border-soft))] font-mono break-all">
                      <div className="flex justify-between items-center gap-2">
                        <span>{value}</span>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleCopy(value, `param-${key}-${index}`)}
                          disabled={!value || !!copySuccess[`param-${key}-${index}`]}
                          title={`Copy value for ${key}`}
                          className="p-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        >
                          {copySuccess[`param-${key}-${index}`] ? (
                            <CheckIcon className="h-5 w-5 text-[rgb(var(--color-status-success))]" />
                          ) : (
                            <ClipboardDocumentIcon className="h-5 w-5 text-[rgb(var(--color-icon-base))]" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={itdeTarget.acceptSignal}
        onIgnore={itdeTarget.ignoreSignal}
        onDeferAll={handleModalDeferAll}
        onIgnoreAll={itdeTarget.ignoreAllSignals}
      />
    </div>
  );
}