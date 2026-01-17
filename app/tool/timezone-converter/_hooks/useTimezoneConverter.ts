'use client';

import { useState, useEffect, useCallback } from 'react';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { format, isValid } from 'date-fns';

export interface TimezoneConverterState {
  fromDateTime: string;
  fromTimezone: string;
  toTimezone: string;
  outputValue: string;
}

export function useTimezoneConverter(
  state: TimezoneConverterState,
  setState: (newState: Partial<TimezoneConverterState>) => void
) {
  const [timezones, setTimezones] = useState<string[]>([]);
  const [isLoadingTimezones, setIsLoadingTimezones] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchTimezones() {
      try {
        const response = await fetch('/data/timezone-converter/timezones.json');
        if (!response.ok) {
          throw new Error('Failed to load timezone list.');
        }
        const tzData: string[] = await response.json();
        if (isMounted) {
          setTimezones(tzData);
        }
      } catch (err) {
        if (isMounted) {
          setError('Could not load timezones. Please refresh the page.');
          console.error(err);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTimezones(false);
        }
      }
    }
    fetchTimezones();
    return () => {
      isMounted = false;
    };
  }, []);

  const initializeDateTime = useCallback(() => {
    const now = new Date();
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const updates: Partial<TimezoneConverterState> = {};
    if (!state.fromDateTime) {
      // Format to YYYY-MM-DDTHH:mm which is required by datetime-local input
      updates.fromDateTime = format(now, "yyyy-MM-dd'T'HH:mm");
    }
    if (!state.fromTimezone && userTimezone) {
      updates.fromTimezone = userTimezone;
    }
    if (!state.toTimezone) {
      updates.toTimezone = 'UTC';
    }

    if (Object.keys(updates).length > 0) {
      setState(updates);
    }
  }, [state.fromDateTime, state.fromTimezone, state.toTimezone, setState]);

  useEffect(() => {
    if (!isLoadingTimezones && timezones.length > 0) {
      initializeDateTime();
    }
  }, [isLoadingTimezones, timezones, initializeDateTime]);

  const convertTime = useCallback(() => {
    setError(null);
    if (!state.fromDateTime || !state.fromTimezone || !state.toTimezone) {
      setState({ outputValue: '' });
      return;
    }

    try {
      // The input string from 'datetime-local' is like '2024-01-01T12:30'
      // This is treated as a "local" time. We need to tell date-fns that this local time
      // is in the `fromTimezone`.
      const dateInFromTz = fromZonedTime(state.fromDateTime, state.fromTimezone);
      
      if (!isValid(dateInFromTz)) {
        throw new Error('Invalid date/time input.');
      }

      // Now convert this date object to the target timezone.
      const dateInToTz = toZonedTime(dateInFromTz, state.toTimezone);

      // Format the result for display.
      const formattedOutput = format(dateInToTz, "yyyy-MM-dd HH:mm:ss ' ('zzz')'");
      
      setState({ outputValue: formattedOutput });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Conversion failed: ${errorMessage}`);
      setState({ outputValue: '' });
      console.error(err);
    }
  }, [state.fromDateTime, state.fromTimezone, state.toTimezone, setState]);

  useEffect(() => {
    convertTime();
  }, [convertTime]);

  const swapTimezones = useCallback(() => {
    setState({
      fromTimezone: state.toTimezone,
      toTimezone: state.fromTimezone,
    });
  }, [state.toTimezone, state.fromTimezone, setState]);

  return {
    timezones,
    isLoadingTimezones,
    error,
    swapTimezones,
  };
}