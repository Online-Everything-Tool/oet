'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import useToolUrlState from '@/app/tool/_hooks/useToolUrlState';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import { useTimezoneConverter, TimezoneConverterState } from '../_hooks/useTimezoneConverter';
import Input from '@/app/tool/_components/form/Input';
import Select from '@/app/tool/_components/form/Select';
import Button from '@/app/tool/_components/form/Button';
import { ArrowPathIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import importedMetadata from '../metadata.json';

const metadata = importedMetadata as ToolMetadata;

const DEFAULT_STATE: TimezoneConverterState = {
  fromDateTime: '',
  fromTimezone: '',
  toTimezone: '',
  outputValue: '',
};

interface TimezoneConverterClientProps {
  toolRoute: string;
  urlStateParams: ParamConfig[];
}

export default function TimezoneConverterClient({ toolRoute, urlStateParams }: TimezoneConverterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
  } = useToolState<TimezoneConverterState>(toolRoute, DEFAULT_STATE);

  const { urlState, isLoadingUrlState, urlParamsLoaded } = useToolUrlState(urlStateParams);
  const isUrlStateApplied = useRef(false);

  const { timezones, isLoadingTimezones, error, swapTimezones } = useTimezoneConverter(
    toolState,
    setToolState
  );

  useEffect(() => {
    if (!isLoadingUrlState && urlParamsLoaded && !isUrlStateApplied.current && !isLoadingState) {
      const updates: Partial<TimezoneConverterState> = {};
      let needsUpdate = false;

      if (urlState.datetime && typeof urlState.datetime === 'string') {
        updates.fromDateTime = urlState.datetime;
        needsUpdate = true;
      }
      if (urlState.from && typeof urlState.from === 'string') {
        updates.fromTimezone = urlState.from;
        needsUpdate = true;
      }
      if (urlState.to && typeof urlState.to === 'string') {
        updates.toTimezone = urlState.to;
        needsUpdate = true;
      }

      if (needsUpdate) {
        setToolState(updates);
      }
      isUrlStateApplied.current = true;
    }
  }, [isLoadingUrlState, urlParamsLoaded, urlState, setToolState, isLoadingState]);

  const timezoneOptions = useMemo(() => {
    return timezones.map(tz => ({ value: tz, label: tz }));
  }, [timezones]);

  if (isLoadingState || (urlParamsLoaded && !isUrlStateApplied.current)) {
    return (
      <div className="flex justify-center items-center p-8">
        <ArrowPathIcon className="h-6 w-6 animate-spin text-[rgb(var(--color-text-muted))]" />
        <p className="ml-2 text-[rgb(var(--color-text-muted))]">Loading state...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <Input
          label="Date & Time"
          type="datetime-local"
          value={toolState.fromDateTime}
          onChange={e => setToolState({ fromDateTime: e.target.value })}
          containerClassName="md:col-span-3"
        />
        
        <Select
          label="From Timezone"
          value={toolState.fromTimezone}
          onChange={e => setToolState({ fromTimezone: e.target.value })}
          options={timezoneOptions}
          disabled={isLoadingTimezones}
          placeholder={isLoadingTimezones ? 'Loading timezones...' : 'Select a timezone'}
        />

        <div className="flex justify-center items-end h-full pb-2">
          <Button
            variant="neutral"
            onClick={swapTimezones}
            title="Swap timezones"
            disabled={!toolState.fromTimezone || !toolState.toTimezone}
            iconLeft={<ArrowsRightLeftIcon className="h-5 w-5" />}
            isEmpty={true}
          />
        </div>

        <Select
          label="To Timezone"
          value={toolState.toTimezone}
          onChange={e => setToolState({ toTimezone: e.target.value })}
          options={timezoneOptions}
          disabled={isLoadingTimezones}
          placeholder={isLoadingTimezones ? 'Loading timezones...' : 'Select a timezone'}
        />
      </div>

      <div>
        <h3 className="text-lg font-medium text-[rgb(var(--color-text-emphasis))] mb-2">Converted Time</h3>
        <div className="p-4 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] min-h-[4rem] flex items-center justify-center">
          {error ? (
            <p className="text-center text-sm text-[rgb(var(--color-text-error))]">{error}</p>
          ) : toolState.outputValue ? (
            <p className="text-xl font-mono text-center text-[rgb(var(--color-text-accent))]">
              {toolState.outputValue}
            </p>
          ) : (
            <p className="text-center text-sm text-[rgb(var(--color-text-muted))]">
              {toolState.fromDateTime ? 'Calculating...' : 'Enter a date and time to begin.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}