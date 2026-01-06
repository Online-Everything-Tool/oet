'use client';

import React, { useMemo, useCallback } from 'react';
import Input from '@/app/tool/_components/form/Input';
import Select from '@/app/tool/_components/form/Select';
import useToolState from '@/app/tool/_hooks/useToolState';

interface NumberBaseConverterProps {
  toolRoute: string;
}

interface NumberBaseConverterState {
  inputValue: string;
  inputBase: number;
  customOutputBase: number;
}

const DEFAULT_STATE: NumberBaseConverterState = {
  inputValue: '',
  inputBase: 10,
  customOutputBase: 7,
};

const BASE_NAME_LOOKUP: Record<number, string> = {
  2: 'Binary',
  3: 'Ternary',
  4: 'Quaternary',
  5: 'Quinary',
  6: 'Senary',
  7: 'Septenary',
  8: 'Octal',
  9: 'Nonary',
  10: 'Decimal',
  12: 'Duodecimal',
  16: 'Hexadecimal',
  20: 'Vigesimal',
  36: 'Hexatridecimal',
};

type ParseOutcome =
  | { status: 'empty'; sanitized: string }
  | { status: 'error'; sanitized: string; message: string }
  | { status: 'success'; sanitized: string; value: bigint };

const MIN_BASE = 2;
const MAX_BASE = 36;

function clampBase(value: number): number {
  if (Number.isNaN(value)) return MIN_BASE;
  const floored = Math.floor(value);
  return Math.min(MAX_BASE, Math.max(MIN_BASE, floored));
}

function parseInputValue(rawValue: string, base: number): ParseOutcome {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { status: 'empty', sanitized: '' };
  }

  let working = trimmed.replace(/_/g, '');
  let signMultiplier = 1n;
  if (working.startsWith('-')) {
    signMultiplier = -1n;
    working = working.slice(1);
  } else if (working.startsWith('+')) {
    working = working.slice(1);
  }

  if (!working) {
    return {
      status: 'error',
      sanitized: '',
      message: 'Value contains no digits to convert.',
    };
  }

  const digits = working.toLowerCase();
  let result = 0n;

  for (let index = 0; index < digits.length; index += 1) {
    const char = digits[index];
    let digitValue: number;
    if (char >= '0' && char <= '9') {
      digitValue = char.charCodeAt(0) - 48;
    } else if (char >= 'a' && char <= 'z') {
      digitValue = char.charCodeAt(0) - 87;
    } else {
      return {
        status: 'error',
        sanitized: '',
        message: `Character "${char}" is not valid for positional bases.`,
      };
    }

    if (digitValue >= base) {
      return {
        status: 'error',
        sanitized: '',
        message: `Digit "${char}" is invalid for base ${base}.`,
      };
    }

    result = result * BigInt(base) + BigInt(digitValue);
  }

  if (signMultiplier < 0 && result !== 0n) {
    result *= -1n;
  }

  const sanitizedDigits = working.toUpperCase();
  const sanitized =
    signMultiplier < 0 && sanitizedDigits !== '0'
      ? `-${sanitizedDigits}`
      : sanitizedDigits;

  return { status: 'success', sanitized, value: result };
}

function formatBaseLabel(base: number): string {
  const baseName = BASE_NAME_LOOKUP[base];
  return baseName ? `Base ${base} (${baseName})` : `Base ${base}`;
}

function formatWithSpacing(value: string, base: number): string {
  const sign = value.startsWith('-') ? '-' : '';
  const digits = sign ? value.slice(1) : value;
  const groupSize = (() => {
    if (base === 2) return 4;
    if (base === 8 || base === 16) return 4;
    if (base === 10) return 3;
    return 4;
  })();

  if (digits.length <= groupSize) return value;

  let grouped = '';
  for (let index = digits.length; index > 0; index -= groupSize) {
    const start = Math.max(index - groupSize, 0);
    const chunk = digits.slice(start, index);
    grouped = grouped ? `${chunk} ${grouped}` : chunk;
  }

  return sign ? `${sign}${grouped}` : grouped;
}

function convertValueToBaseString(value: bigint, base: number): string {
  const isNegative = value < 0n;
  const absValue = isNegative ? -value : value;
  const converted = absValue.toString(base).toUpperCase();
  return isNegative && converted !== '0' ? `-${converted}` : converted;
}

export default function NumberBaseConverterClient({
  toolRoute,
}: NumberBaseConverterProps) {
  const { state, setState, isLoadingState, errorLoadingState } =
    useToolState<NumberBaseConverterState>(toolRoute, DEFAULT_STATE);

  const baseOptions = useMemo(() => {
    return Array.from({ length: MAX_BASE - MIN_BASE + 1 }, (_, index) => {
      const base = index + MIN_BASE;
      return { value: base, label: formatBaseLabel(base) } as const;
    });
  }, []);

  const parseOutcome = useMemo(
    () => parseInputValue(state.inputValue, state.inputBase),
    [state.inputValue, state.inputBase]
  );

  const conversions = useMemo(() => {
    if (parseOutcome.status !== 'success') return [];

    const uniqueBases = new Set<number>();
    const orderedBases = [2, 8, 10, 16];
    const desiredBases: number[] = [];

    orderedBases.forEach((base) => {
      if (base >= MIN_BASE && base <= MAX_BASE) desiredBases.push(base);
    });

    const customBase = clampBase(state.customOutputBase);
    if (!desiredBases.includes(customBase)) {
      desiredBases.push(customBase);
    }

    const finalBases = desiredBases.filter((base) => {
      if (uniqueBases.has(base)) return false;
      uniqueBases.add(base);
      return true;
    });

    return finalBases.map((base) => {
      const converted = convertValueToBaseString(parseOutcome.value, base);
      const spaced = formatWithSpacing(converted, base);
      return {
        base,
        label: formatBaseLabel(base),
        raw: converted,
        formatted: spaced,
      };
    });
  }, [parseOutcome, state.customOutputBase]);

  const handleInputValueChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setState({ inputValue: event.target.value });
    },
    [setState]
  );

  const handleInputBaseChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextBase = clampBase(Number(event.target.value));
      setState({ inputBase: nextBase });
    },
    [setState]
  );

  const handleCustomBaseChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextBase = clampBase(Number(event.target.value));
      setState({ customOutputBase: nextBase });
    },
    [setState]
  );

  if (isLoadingState && !state.inputValue) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading Number Base Converter...
      </p>
    );
  }

  if (errorLoadingState) {
    return (
      <div className="p-4 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-status-error))] rounded">
        Error loading saved settings: {errorLoadingState}
      </div>
    );
  }

  const showError = parseOutcome.status === 'error';
  const showResults = parseOutcome.status === 'success';

  return (
    <div className="flex flex-col gap-6 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-4 p-4 bg-[rgb(var(--color-card-bg))] border border-[rgb(var(--color-border))] rounded-lg">
        <Input
          label="Value to convert"
          placeholder=""
          value={state.inputValue}
          onChange={handleInputValueChange}
          spellCheck={false}
          autoComplete="off"
        />
        <Select
          label="Input base"
          value={state.inputBase}
          onChange={handleInputBaseChange}
          options={baseOptions}
        />
        <Input
          label="Custom output base"
          type="number"
          value={state.customOutputBase}
          onChange={handleCustomBaseChange}
          min={MIN_BASE}
          max={MAX_BASE}
          inputMode="numeric"
        />
      </div>

      {parseOutcome.status === 'empty' && (
        <div className="p-4 border border-dashed border-[rgb(var(--color-border))] rounded text-[rgb(var(--color-text-muted))] bg-[rgb(var(--color-bg-subtle))]">
          Enter a value and choose an input base to see conversions.
        </div>
      )}

      {showError && (
        <div className="p-4 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] rounded text-[rgb(var(--color-status-error))]">
          {parseOutcome.message}
        </div>
      )}

      {showResults && (
        <div className="flex flex-col gap-4">
          <div className="p-4 bg-[rgb(var(--color-card-bg))] border border-[rgb(var(--color-border))] rounded-lg">
            <h2 className="text-sm font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide">
              Normalized Input
            </h2>
            <p className="mt-2 font-mono text-base break-words">
              {parseOutcome.sanitized}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {conversions.map((conversion) => (
              <div
                key={conversion.base}
                className="p-4 bg-[rgb(var(--color-card-bg))] border border-[rgb(var(--color-border))] rounded-lg flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide">
                    {conversion.label}
                  </h3>
                  <span className="text-xs text-[rgb(var(--color-text-muted))]">
                    Base {conversion.base}
                  </span>
                </div>
                <p className="font-mono text-lg break-words">
                  {conversion.formatted}
                </p>
                {conversion.formatted !== conversion.raw && (
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    Raw: <span className="font-mono">{conversion.raw}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
