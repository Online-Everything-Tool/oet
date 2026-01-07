'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Input from '@/app/tool/_components/form/Input';
import Select from '@/app/tool/_components/form/Select';
import RadioGroup from '@/app/tool/_components/form/RadioGroup';
import Button from '@/app/tool/_components/form/Button';
import useToolState from '@/app/tool/_hooks/useToolState';
import type { ParamConfig } from '@/src/types/tools';
import { ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export type TimestampPrecision = 'seconds' | 'milliseconds';
export type TimestampZone = 'system' | 'utc';

interface TimestampConverterState {
  unixValue: string;
  precision: TimestampPrecision;
  datetimeLocal: string;
  timezone: TimestampZone;
}

const DEFAULT_STATE: TimestampConverterState = {
  unixValue: '',
  precision: 'seconds',
  datetimeLocal: '',
  timezone: 'system',
};

interface TimestampConverterClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

const RELATIVE_TIME_UNITS: Array<{
  unit: Intl.RelativeTimeFormatUnit;
  ms: number;
}> = [
  { unit: 'year', ms: 1000 * 60 * 60 * 24 * 365 },
  { unit: 'month', ms: 1000 * 60 * 60 * 24 * 30 },
  { unit: 'week', ms: 1000 * 60 * 60 * 24 * 7 },
  { unit: 'day', ms: 1000 * 60 * 60 * 24 },
  { unit: 'hour', ms: 1000 * 60 * 60 },
  { unit: 'minute', ms: 1000 * 60 },
  { unit: 'second', ms: 1000 },
];

function parseUnixTimestamp(
  value: string,
  precision: TimestampPrecision
): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return null;
  const millis = precision === 'milliseconds' ? numeric : numeric * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDatetimeLocalValue(
  value: string,
  timezone: TimestampZone
): Date | null {
  if (!value) return null;
  const normalized = timezone === 'utc' ? `${value}Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number, length = 2): string {
  return value.toString().padStart(length, '0');
}

function trimTrailingZeros(value: string): string {
  return value.replace(/(?:\.0+|(\.\d+?)0+)$/, '$1');
}

function formatDatetimeLocalValue(
  date: Date,
  timezone: TimestampZone
): string {
  const year = timezone === 'utc' ? date.getUTCFullYear() : date.getFullYear();
  const month =
    timezone === 'utc' ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const day = timezone === 'utc' ? date.getUTCDate() : date.getDate();
  const hours = timezone === 'utc' ? date.getUTCHours() : date.getHours();
  const minutes = timezone === 'utc' ? date.getUTCMinutes() : date.getMinutes();
  const seconds = timezone === 'utc' ? date.getUTCSeconds() : date.getSeconds();
  const milliseconds =
    timezone === 'utc' ? date.getUTCMilliseconds() : date.getMilliseconds();

  const base = `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return milliseconds ? `${base}.${pad(milliseconds, 3)}` : base;
}

function formatUnixValue(
  date: Date,
  precision: TimestampPrecision
): string {
  const millis = date.getTime();
  if (precision === 'milliseconds') {
    return String(Math.trunc(millis));
  }
  const seconds = millis / 1000;
  if (Number.isInteger(seconds)) {
    return String(seconds);
  }
  return trimTrailingZeros(seconds.toFixed(6));
}

function formatRelativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  if (Math.abs(diffMs) < 500) {
    return 'Right now';
  }
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const { unit, ms } of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffMs) >= ms || unit === 'second') {
      const value = diffMs / ms;
      return rtf.format(Math.round(value), unit);
    }
  }
  return '';
}

export default function TimestampConverterClient({
  urlStateParams,
  toolRoute,
}: TimestampConverterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    errorLoadingState,
    clearStateAndPersist,
  } = useToolState<TimestampConverterState>(toolRoute, DEFAULT_STATE);

  const [unixError, setUnixError] = useState<string | null>(null);
  const [datetimeError, setDatetimeError] = useState<string | null>(null);

  const initialUrlLoadProcessedRef = useRef(false);

  useEffect(() => {
    if (isLoadingState || initialUrlLoadProcessedRef.current) return;
    if (typeof window === 'undefined') return;

    initialUrlLoadProcessedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    if (!params || urlStateParams.length === 0) return;

    const timestampParam = params.get('timestamp');
    const isoParam = params.get('iso');
    const zoneParam = params.get('zone');

    let nextTimezone: TimestampZone = toolState.timezone;
    if (zoneParam === 'utc' || zoneParam === 'system') {
      nextTimezone = zoneParam;
    }

    let derivedDate: Date | null = null;
    let derivedPrecision: TimestampPrecision = toolState.precision;

    if (isoParam) {
      const isoParsed = new Date(isoParam);
      if (!Number.isNaN(isoParsed.getTime())) {
        derivedDate = isoParsed;
      }
    }

    if (!derivedDate && timestampParam) {
      const trimmed = timestampParam.trim();
      const normalizedLength = trimmed.startsWith('-')
        ? trimmed.slice(1)
        : trimmed;
      const guessedPrecision: TimestampPrecision =
        trimmed.includes('.') || normalizedLength.length <= 11
          ? 'seconds'
          : 'milliseconds';
      const timestampDate = parseUnixTimestamp(trimmed, guessedPrecision);
      if (timestampDate) {
        derivedDate = timestampDate;
        derivedPrecision = guessedPrecision;
      }
    }

    if (!derivedDate) {
      const updates: Partial<TimestampConverterState> = {};
      if (zoneParam === 'utc' || zoneParam === 'system') {
        updates.timezone = nextTimezone;
      }
      if (timestampParam !== null) {
        updates.unixValue = timestampParam;
      }
      if (isoParam !== null) {
        const fallback = parseDatetimeLocalValue(isoParam, 'utc');
        updates.datetimeLocal = fallback
          ? formatDatetimeLocalValue(fallback, nextTimezone)
          : '';
      }
      if (Object.keys(updates).length > 0) {
        setToolState(updates);
      }
      return;
    }

    setUnixError(null);
    setDatetimeError(null);
    setToolState({
      unixValue: formatUnixValue(derivedDate, derivedPrecision),
      datetimeLocal: formatDatetimeLocalValue(derivedDate, nextTimezone),
      precision: derivedPrecision,
      timezone: nextTimezone,
    });
  }, [
    isLoadingState,
    urlStateParams.length,
    setToolState,
    toolState.precision,
    toolState.timezone,
  ]);

  const derivedDate = useMemo(() => {
    const viaDatetime = parseDatetimeLocalValue(
      toolState.datetimeLocal,
      toolState.timezone
    );
    if (viaDatetime) return viaDatetime;
    return parseUnixTimestamp(toolState.unixValue, toolState.precision);
  }, [
    toolState.datetimeLocal,
    toolState.timezone,
    toolState.unixValue,
    toolState.precision,
  ]);

  const systemTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local system';
    } catch (err) {
      return 'Local system';
    }
  }, []);

  const outputDetails = useMemo(() => {
    if (!derivedDate) return null;

    const unixSeconds = formatUnixValue(derivedDate, 'seconds');
    const unixMilliseconds = formatUnixValue(derivedDate, 'milliseconds');
    const isoUtc = derivedDate.toISOString();
    const localeFormat = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(derivedDate);
    const weekday = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
    }).format(derivedDate);

    return {
      unixSeconds,
      unixMilliseconds,
      isoUtc,
      localeFormat,
      weekday,
      relative: formatRelativeTime(derivedDate),
    };
  }, [derivedDate]);

  const handleUnixChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      setUnixError(null);
      setDatetimeError(null);

      if (!rawValue.trim()) {
        setToolState({ unixValue: '', datetimeLocal: '' });
        return;
      }

      const parsed = parseUnixTimestamp(rawValue, toolState.precision);
      if (!parsed) {
        setUnixError('Enter a valid Unix timestamp.');
        setToolState({ unixValue: rawValue });
        return;
      }

      setToolState({
        unixValue: rawValue,
        datetimeLocal: formatDatetimeLocalValue(parsed, toolState.timezone),
      });
    },
    [setToolState, toolState.precision, toolState.timezone]
  );

  const handleDatetimeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      setUnixError(null);
      setDatetimeError(null);

      if (!rawValue.trim()) {
        setToolState({ datetimeLocal: '', unixValue: '' });
        return;
      }

      const parsed = parseDatetimeLocalValue(rawValue, toolState.timezone);
      if (!parsed) {
        setDatetimeError('Enter a valid date and time.');
        setToolState({ datetimeLocal: rawValue });
        return;
      }

      setToolState({
        datetimeLocal: rawValue,
        unixValue: formatUnixValue(parsed, toolState.precision),
      });
    },
    [setToolState, toolState.timezone, toolState.precision]
  );

  const handlePrecisionChange = useCallback(
    (value: string) => {
      const nextPrecision = value === 'milliseconds' ? 'milliseconds' : 'seconds';
      setToolState((prev) => {
        const parsed = parseDatetimeLocalValue(prev.datetimeLocal, prev.timezone) ??
          parseUnixTimestamp(prev.unixValue, prev.precision);
        if (!parsed) {
          return { ...prev, precision: nextPrecision };
        }
        return {
          ...prev,
          precision: nextPrecision,
          unixValue: formatUnixValue(parsed, nextPrecision),
          datetimeLocal: formatDatetimeLocalValue(parsed, prev.timezone),
        };
      });
    },
    [setToolState]
  );

  const handleTimezoneChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextTimezone = event.target.value === 'utc' ? 'utc' : 'system';
      setToolState((prev) => {
        if (prev.timezone === nextTimezone) return prev;
        const parsed = parseDatetimeLocalValue(prev.datetimeLocal, prev.timezone) ??
          parseUnixTimestamp(prev.unixValue, prev.precision);
        if (!parsed) {
          return { ...prev, timezone: nextTimezone };
        }
        return {
          ...prev,
          timezone: nextTimezone,
          datetimeLocal: formatDatetimeLocalValue(parsed, nextTimezone),
          unixValue: formatUnixValue(parsed, prev.precision),
        };
      });
    },
    [setToolState]
  );

  const handleUseNow = useCallback(() => {
    setUnixError(null);
    setDatetimeError(null);
    const now = new Date();
    setToolState((prev) => ({
      ...prev,
      unixValue: formatUnixValue(now, prev.precision),
      datetimeLocal: formatDatetimeLocalValue(now, prev.timezone),
    }));
  }, [setToolState]);

  const handleClear = useCallback(() => {
    setUnixError(null);
    setDatetimeError(null);
    void clearStateAndPersist();
  }, [clearStateAndPersist]);

  if (isLoadingState) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading Timestamp Converter...
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

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <RadioGroup
            legend="Unix precision"
            name="precision"
            selectedValue={toolState.precision}
            onChange={handlePrecisionChange}
            options={[
              { value: 'seconds', label: 'Seconds (10-digit epoch)' },
              { value: 'milliseconds', label: 'Milliseconds (13-digit epoch)' },
            ]}
          />
          <Input
            label="Unix timestamp"
            value={toolState.unixValue}
            onChange={handleUnixChange}
            placeholder={
              toolState.precision === 'seconds' ? '1704585600' : '1704585600000'
            }
            inputMode="numeric"
            error={unixError}
          />
          <Input
            label={`Calendar date (${toolState.timezone === 'utc' ? 'UTC' : 'local'})`}
            type="datetime-local"
            value={toolState.datetimeLocal}
            onChange={handleDatetimeChange}
            step={1}
            error={datetimeError}
          />
          <Select
            label="Interpret input as"
            options={[
              { value: 'system', label: `Local system time (${systemTimeZone})` },
              { value: 'utc', label: 'Coordinated Universal Time (UTC)' },
            ]}
            value={toolState.timezone}
            onChange={handleTimezoneChange}
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={handleUseNow} iconLeft={<ClockIcon className="h-5 w-5" />}>
              Use current time
            </Button>
            <Button
              variant="secondary-outline"
              onClick={handleClear}
              iconLeft={<ArrowPathIcon className="h-5 w-5" />}
            >
              Reset fields
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-base))] p-5 shadow-sm">
        {outputDetails ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">
              Converted values
            </h3>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="font-medium text-[rgb(var(--color-text-muted))]">Unix timestamp (seconds)</dt>
                <dd className="truncate text-[rgb(var(--color-text-base))]">
                  {outputDetails.unixSeconds}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="font-medium text-[rgb(var(--color-text-muted))]">Unix timestamp (milliseconds)</dt>
                <dd className="truncate text-[rgb(var(--color-text-base))]">
                  {outputDetails.unixMilliseconds}
                </dd>
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <dt className="font-medium text-[rgb(var(--color-text-muted))]">ISO 8601 (UTC)</dt>
                <dd className="break-all text-[rgb(var(--color-text-base))]">
                  {outputDetails.isoUtc}
                </dd>
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <dt className="font-medium text-[rgb(var(--color-text-muted))]">Readable format</dt>
                <dd className="text-[rgb(var(--color-text-base))]">
                  {outputDetails.localeFormat}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="font-medium text-[rgb(var(--color-text-muted))]">Weekday</dt>
                <dd className="text-[rgb(var(--color-text-base))]">
                  {outputDetails.weekday}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="font-medium text-[rgb(var(--color-text-muted))]">Relative to now</dt>
                <dd className="text-[rgb(var(--color-text-base))]">
                  {outputDetails.relative}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Enter a Unix timestamp or calendar date to see conversions.
          </p>
        )}
      </div>
    </div>
  );
}
