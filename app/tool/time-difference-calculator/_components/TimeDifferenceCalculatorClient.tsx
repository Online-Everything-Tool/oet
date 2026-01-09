'use client';

import React, { useMemo, useCallback } from 'react';
import Input from '@/app/tool/_components/form/Input';
import Select from '@/app/tool/_components/form/Select';
import Button from '@/app/tool/_components/form/Button';
import useToolState from '@/app/tool/_hooks/useToolState';
import { ClockIcon, ArrowsRightLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface TimeDifferenceCalculatorProps {
  toolRoute: string;
}

type ZoneOption =
  | 'system'
  | 'utc'
  | 'America/Los_Angeles'
  | 'America/New_York'
  | 'Europe/London'
  | 'Europe/Berlin'
  | 'Asia/Tokyo'
  | 'Australia/Sydney'
  | 'custom';

interface TimeDifferenceCalculatorState {
  startDateTime: string;
  endDateTime: string;
  startZone: ZoneOption;
  endZone: ZoneOption;
  startCustomZone: string;
  endCustomZone: string;
}

const DEFAULT_STATE: TimeDifferenceCalculatorState = {
  startDateTime: '',
  endDateTime: '',
  startZone: 'system',
  endZone: 'utc',
  startCustomZone: '',
  endCustomZone: '',
};

interface ParsedLocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

type ConversionResult =
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'success'; instant: number; zoneId: string };

const TIMEZONE_OPTIONS: ReadonlyArray<{ value: ZoneOption; label: string }> = [
  { value: 'system', label: 'System default' },
  { value: 'utc', label: 'UTC' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
  { value: 'America/New_York', label: 'New York (ET)' },
  { value: 'Europe/London', label: 'London (UK)' },
  { value: 'Europe/Berlin', label: 'Berlin (DE)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JP)' },
  { value: 'Australia/Sydney', label: 'Sydney (AU)' },
  { value: 'custom', label: 'Custom IANA zone' },
];

function getSystemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (_error) {
    return 'UTC';
  }
}

function pad(value: number, length = 2): string {
  return value.toString().padStart(length, '0');
}

function formatDateForInput(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseLocalDateTime(value: string): ParsedLocalDateTime | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '0', fraction = '0'] = match;
  const parsed: ParsedLocalDateTime = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    millisecond: Number(fraction.padEnd(3, '0').slice(0, 3)),
  };

  const candidate = new Date(
    Date.UTC(
      parsed.year,
      parsed.month - 1,
      parsed.day,
      parsed.hour,
      parsed.minute,
      parsed.second,
      parsed.millisecond
    )
  );

  if (
    candidate.getUTCFullYear() !== parsed.year ||
    candidate.getUTCMonth() !== parsed.month - 1 ||
    candidate.getUTCDate() !== parsed.day ||
    candidate.getUTCHours() !== parsed.hour ||
    candidate.getUTCMinutes() !== parsed.minute ||
    candidate.getUTCSeconds() !== parsed.second ||
    candidate.getUTCMilliseconds() !== parsed.millisecond
  ) {
    return null;
  }

  return parsed;
}

function getTimeZoneOffsetMinutes(instant: number, timeZone: string): number | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = formatter.formatToParts(new Date(instant));
    const values: Record<string, string> = {};
    for (const part of parts) {
      values[part.type] = part.value;
    }
    const asUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );
    return Math.round((asUtc - instant) / 60000);
  } catch (_error) {
    return null;
  }
}

function resolveZoneId(option: ZoneOption, customValue: string, systemZone: string): string | null {
  if (option === 'system') return systemZone;
  if (option === 'custom') {
    const trimmed = customValue.trim();
    return trimmed ? trimmed : null;
  }
  return option;
}

function zonedDateTimeToInstant(
  value: string,
  option: ZoneOption,
  customValue: string,
  systemZone: string
): ConversionResult {
  const parsed = parseLocalDateTime(value);
  if (!parsed) {
    if (!value.trim()) return { status: 'empty' };
    return {
      status: 'error',
      message: 'Use a complete date with time (HH:MM with optional seconds).',
    };
  }

  const zoneId = resolveZoneId(option, customValue, systemZone);
  if (!zoneId) {
    return { status: 'error', message: 'Enter a valid IANA time zone name.' };
  }

  const utcReference = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second,
    parsed.millisecond
  );

  const initialOffset = getTimeZoneOffsetMinutes(utcReference, zoneId);
  if (initialOffset === null) {
    return {
      status: 'error',
      message: `Unknown or unsupported time zone: ${zoneId}`,
    };
  }

  let instant = utcReference - initialOffset * 60000;
  const refinedOffset = getTimeZoneOffsetMinutes(instant, zoneId);
  if (refinedOffset === null) {
    return {
      status: 'error',
      message: `Unable to resolve offset for ${zoneId}.`,
    };
  }

  if (refinedOffset !== initialOffset) {
    instant = utcReference - refinedOffset * 60000;
  }

  return { status: 'success', instant, zoneId };
}

function formatZonedDate(instant: number, zoneId: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: zoneId,
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(new Date(instant));
  } catch (_error) {
    return new Date(instant).toISOString();
  }
}

function describeDifference(diffMs: number): {
  direction: 'forward' | 'backward';
  absolute: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  totalHours: number;
  totalMinutes: number;
} {
  const direction = diffMs >= 0 ? 'forward' : 'backward';
  const absolute = Math.abs(diffMs);
  const totalSeconds = Math.floor(absolute / 1000);
  const milliseconds = absolute % 1000;
  const days = Math.floor(totalSeconds / 86400);
  let remainder = totalSeconds % 86400;
  const hours = Math.floor(remainder / 3600);
  remainder %= 3600;
  const minutes = Math.floor(remainder / 60);
  const seconds = remainder % 60;

  return {
    direction,
    absolute,
    days,
    hours,
    minutes,
    seconds,
    milliseconds,
    totalHours: absolute / 3600000,
    totalMinutes: absolute / 60000,
  };
}

export default function TimeDifferenceCalculatorClient({
  toolRoute,
}: TimeDifferenceCalculatorProps) {
  const {
    state,
    setState,
    isLoadingState,
    errorLoadingState,
    clearStateAndPersist,
  } = useToolState<TimeDifferenceCalculatorState>(toolRoute, DEFAULT_STATE);

  const systemZone = useMemo(getSystemTimeZone, []);

  const startResult = useMemo(
    () =>
      zonedDateTimeToInstant(
        state.startDateTime,
        state.startZone,
        state.startCustomZone,
        systemZone
      ),
    [state.startDateTime, state.startZone, state.startCustomZone, systemZone]
  );

  const endResult = useMemo(
    () =>
      zonedDateTimeToInstant(
        state.endDateTime,
        state.endZone,
        state.endCustomZone,
        systemZone
      ),
    [state.endDateTime, state.endZone, state.endCustomZone, systemZone]
  );

  const difference = useMemo(() => {
    if (startResult.status !== 'success' || endResult.status !== 'success') {
      return null;
    }
    return describeDifference(endResult.instant - startResult.instant);
  }, [startResult, endResult]);

  const handleStartDateChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setState({ startDateTime: event.target.value });
    },
    [setState]
  );

  const handleEndDateChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setState({ endDateTime: event.target.value });
    },
    [setState]
  );

  const handleStartZoneChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = event.target.value as ZoneOption;
      setState({
        startZone: selected,
        startCustomZone: selected === 'custom' ? state.startCustomZone : '',
      });
    },
    [setState, state.startCustomZone]
  );

  const handleEndZoneChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = event.target.value as ZoneOption;
      setState({
        endZone: selected,
        endCustomZone: selected === 'custom' ? state.endCustomZone : '',
      });
    },
    [setState, state.endCustomZone]
  );

  const handleStartCustomZoneChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setState({ startCustomZone: event.target.value });
    },
    [setState]
  );

  const handleEndCustomZoneChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setState({ endCustomZone: event.target.value });
    },
    [setState]
  );

  const handleSetStartNow = useCallback(() => {
    setState({ startDateTime: formatDateForInput(new Date()) });
  }, [setState]);

  const handleSetEndNow = useCallback(() => {
    setState({ endDateTime: formatDateForInput(new Date()) });
  }, [setState]);

  const handleSwap = useCallback(() => {
    setState((prev) => ({
      startDateTime: prev.endDateTime,
      endDateTime: prev.startDateTime,
      startZone: prev.endZone,
      endZone: prev.startZone,
      startCustomZone: prev.endCustomZone,
      endCustomZone: prev.startCustomZone,
    }));
  }, [setState]);

  const handleReset = useCallback(() => {
    void clearStateAndPersist();
  }, [clearStateAndPersist]);

  if (isLoadingState) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading Time Difference Calculator...
      </p>
    );
  }

  if (errorLoadingState) {
    return (
      <div className="p-4 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-status-error))] rounded">
        Error loading saved state: {errorLoadingState}
      </div>
    );
  }

  const startError = startResult.status === 'error' ? startResult.message : null;
  const endError = endResult.status === 'error' ? endResult.message : null;

  return (
    <div className="flex flex-col gap-6 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={handleSwap} iconLeft={<ArrowsRightLeftIcon className="h-5 w-5" />}>
          Swap start & end
        </Button>
        <Button
          variant="secondary-outline"
          onClick={handleReset}
          iconLeft={<ArrowPathIcon className="h-5 w-5" />}
        >
          Reset fields
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4 rounded border border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] p-4 shadow-sm">
          <header className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Start</h3>
            <Button
              variant="accent-outline"
              onClick={handleSetStartNow}
              iconLeft={<ClockIcon className="h-5 w-5" />}
            >
              Use now
            </Button>
          </header>
          <Input
            label="Local date and time"
            type="datetime-local"
            value={state.startDateTime}
            onChange={handleStartDateChange}
            step={1}
            error={startError}
          />
          <Select
            label="Time zone"
            options={TIMEZONE_OPTIONS}
            value={state.startZone}
            onChange={handleStartZoneChange}
          />
          {state.startZone === 'custom' && (
            <Input
              label="Custom IANA time zone"
              placeholder="e.g. Asia/Kolkata"
              value={state.startCustomZone}
              onChange={handleStartCustomZoneChange}
              error={startError && !state.startCustomZone.trim() ? startError : null}
            />
          )}
          {startResult.status === 'success' && (
            <div className="rounded bg-[rgb(var(--color-bg-base))] p-3 text-sm">
              <p className="font-medium text-[rgb(var(--color-text-muted))]">
                Interpreted as
              </p>
              <p>{formatZonedDate(startResult.instant, startResult.zoneId)}</p>
            </div>
          )}
        </section>

        <section className="space-y-4 rounded border border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] p-4 shadow-sm">
          <header className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">End</h3>
            <Button
              variant="accent-outline"
              onClick={handleSetEndNow}
              iconLeft={<ClockIcon className="h-5 w-5" />}
            >
              Use now
            </Button>
          </header>
          <Input
            label="Local date and time"
            type="datetime-local"
            value={state.endDateTime}
            onChange={handleEndDateChange}
            step={1}
            error={endError}
          />
          <Select
            label="Time zone"
            options={TIMEZONE_OPTIONS}
            value={state.endZone}
            onChange={handleEndZoneChange}
          />
          {state.endZone === 'custom' && (
            <Input
              label="Custom IANA time zone"
              placeholder="e.g. Europe/Paris"
              value={state.endCustomZone}
              onChange={handleEndCustomZoneChange}
              error={endError && !state.endCustomZone.trim() ? endError : null}
            />
          )}
          {endResult.status === 'success' && (
            <div className="rounded bg-[rgb(var(--color-bg-base))] p-3 text-sm">
              <p className="font-medium text-[rgb(var(--color-text-muted))]">
                Interpreted as
              </p>
              <p>{formatZonedDate(endResult.instant, endResult.zoneId)}</p>
            </div>
          )}
        </section>
      </div>

      <section className="rounded border border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-base))] p-5 shadow-sm">
        {difference ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Time between start and end</h3>
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                {difference.direction === 'forward'
                  ? 'End occurs after start.'
                  : 'End occurs before start.'}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-medium text-[rgb(var(--color-text-muted))]">
                    Breakdown
                  </dt>
                  <dd>
                    {difference.days} days, {difference.hours} hours, {difference.minutes} minutes,
                    {' '}
                    {difference.seconds} seconds
                    {difference.milliseconds ? ` and ${difference.milliseconds} ms` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[rgb(var(--color-text-muted))]">
                    Total minutes
                  </dt>
                  <dd>{difference.totalMinutes.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[rgb(var(--color-text-muted))]">
                    Total hours
                  </dt>
                  <dd>{difference.totalHours.toLocaleString()}</dd>
                </div>
              </dl>
              {startResult.status === 'success' && endResult.status === 'success' && (
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="font-medium text-[rgb(var(--color-text-muted))]">
                      Start shown in end zone
                    </dt>
                    <dd>{formatZonedDate(startResult.instant, endResult.zoneId)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-[rgb(var(--color-text-muted))]">
                      End shown in start zone
                    </dt>
                    <dd>{formatZonedDate(endResult.instant, startResult.zoneId)}</dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Provide both dates with zones to calculate the elapsed time.
          </p>
        )}
      </section>
    </div>
  );
}
