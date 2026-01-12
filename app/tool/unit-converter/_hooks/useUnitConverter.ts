import { useMemo, useCallback } from 'react';

export interface Unit {
  id: string;
  name: string;
  symbol: string;
}

interface ConversionUnit extends Unit {
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
}

export type CategoryId =
  | 'length'
  | 'mass'
  | 'temperature'
  | 'data'
  | 'time';

interface Category {
  id: CategoryId;
  name: string;
  baseUnit: string;
  units: Record<string, ConversionUnit>;
}

const UNIT_DEFINITIONS: Record<CategoryId, Category> = {
  length: {
    id: 'length',
    name: 'Length',
    baseUnit: 'meter',
    units: {
      meter: {
        id: 'meter',
        name: 'Meter',
        symbol: 'm',
        toBase: v => v,
        fromBase: v => v,
      },
      kilometer: {
        id: 'kilometer',
        name: 'Kilometer',
        symbol: 'km',
        toBase: v => v * 1000,
        fromBase: v => v / 1000,
      },
      centimeter: {
        id: 'centimeter',
        name: 'Centimeter',
        symbol: 'cm',
        toBase: v => v / 100,
        fromBase: v => v * 100,
      },
      millimeter: {
        id: 'millimeter',
        name: 'Millimeter',
        symbol: 'mm',
        toBase: v => v / 1000,
        fromBase: v => v * 1000,
      },
      mile: {
        id: 'mile',
        name: 'Mile',
        symbol: 'mi',
        toBase: v => v * 1609.34,
        fromBase: v => v / 1609.34,
      },
      yard: {
        id: 'yard',
        name: 'Yard',
        symbol: 'yd',
        toBase: v => v * 0.9144,
        fromBase: v => v / 0.9144,
      },
      foot: {
        id: 'foot',
        name: 'Foot',
        symbol: 'ft',
        toBase: v => v * 0.3048,
        fromBase: v => v / 0.3048,
      },
      inch: {
        id: 'inch',
        name: 'Inch',
        symbol: 'in',
        toBase: v => v * 0.0254,
        fromBase: v => v / 0.0254,
      },
    },
  },
  mass: {
    id: 'mass',
    name: 'Mass / Weight',
    baseUnit: 'kilogram',
    units: {
      kilogram: {
        id: 'kilogram',
        name: 'Kilogram',
        symbol: 'kg',
        toBase: v => v,
        fromBase: v => v,
      },
      gram: {
        id: 'gram',
        name: 'Gram',
        symbol: 'g',
        toBase: v => v / 1000,
        fromBase: v => v * 1000,
      },
      milligram: {
        id: 'milligram',
        name: 'Milligram',
        symbol: 'mg',
        toBase: v => v / 1e6,
        fromBase: v => v * 1e6,
      },
      pound: {
        id: 'pound',
        name: 'Pound',
        symbol: 'lb',
        toBase: v => v * 0.453592,
        fromBase: v => v / 0.453592,
      },
      ounce: {
        id: 'ounce',
        name: 'Ounce',
        symbol: 'oz',
        toBase: v => v * 0.0283495,
        fromBase: v => v / 0.0283495,
      },
    },
  },
  temperature: {
    id: 'temperature',
    name: 'Temperature',
    baseUnit: 'celsius',
    units: {
      celsius: {
        id: 'celsius',
        name: 'Celsius',
        symbol: '°C',
        toBase: v => v,
        fromBase: v => v,
      },
      fahrenheit: {
        id: 'fahrenheit',
        name: 'Fahrenheit',
        symbol: '°F',
        toBase: v => (v - 32) * (5 / 9),
        fromBase: v => v * (9 / 5) + 32,
      },
      kelvin: {
        id: 'kelvin',
        name: 'Kelvin',
        symbol: 'K',
        toBase: v => v - 273.15,
        fromBase: v => v + 273.15,
      },
    },
  },
  data: {
    id: 'data',
    name: 'Data Storage',
    baseUnit: 'byte',
    units: {
      byte: {
        id: 'byte',
        name: 'Byte',
        symbol: 'B',
        toBase: v => v,
        fromBase: v => v,
      },
      kilobyte: {
        id: 'kilobyte',
        name: 'Kilobyte',
        symbol: 'KB',
        toBase: v => v * 1024,
        fromBase: v => v / 1024,
      },
      megabyte: {
        id: 'megabyte',
        name: 'Megabyte',
        symbol: 'MB',
        toBase: v => v * 1024 ** 2,
        fromBase: v => v / 1024 ** 2,
      },
      gigabyte: {
        id: 'gigabyte',
        name: 'Gigabyte',
        symbol: 'GB',
        toBase: v => v * 1024 ** 3,
        fromBase: v => v / 1024 ** 3,
      },
      terabyte: {
        id: 'terabyte',
        name: 'Terabyte',
        symbol: 'TB',
        toBase: v => v * 1024 ** 4,
        fromBase: v => v / 1024 ** 4,
      },
    },
  },
  time: {
    id: 'time',
    name: 'Time',
    baseUnit: 'second',
    units: {
      second: {
        id: 'second',
        name: 'Second',
        symbol: 's',
        toBase: v => v,
        fromBase: v => v,
      },
      minute: {
        id: 'minute',
        name: 'Minute',
        symbol: 'min',
        toBase: v => v * 60,
        fromBase: v => v / 60,
      },
      hour: {
        id: 'hour',
        name: 'Hour',
        symbol: 'hr',
        toBase: v => v * 3600,
        fromBase: v => v / 3600,
      },
      day: {
        id: 'day',
        name: 'Day',
        symbol: 'd',
        toBase: v => v * 86400,
        fromBase: v => v / 86400,
      },
      week: {
        id: 'week',
        name: 'Week',
        symbol: 'wk',
        toBase: v => v * 604800,
        fromBase: v => v / 604800,
      },
    },
  },
};

export function useUnitConverter() {
  const categories = useMemo(() => {
    return Object.values(UNIT_DEFINITIONS).map(({ id, name }) => ({ id, name }));
  }, []);

  const getUnitsForCategory = useCallback((categoryId: CategoryId): Unit[] => {
    const category = UNIT_DEFINITIONS[categoryId];
    if (!category) return [];
    return Object.values(category.units).map(
      ({ id, name, symbol }) => ({ id, name, symbol })
    );
  }, []);

  const convert = useCallback(
    (
      value: number,
      categoryId: CategoryId,
      fromUnitId: string,
      toUnitId: string
    ): number | null => {
      const category = UNIT_DEFINITIONS[categoryId];
      if (!category) return null;

      const fromUnit = category.units[fromUnitId];
      const toUnit = category.units[toUnitId];
      if (!fromUnit || !toUnit) return null;

      const valueInBase = fromUnit.toBase(value);
      const valueInTarget = toUnit.fromBase(valueInBase);

      return valueInTarget;
    },
    []
  );

  return { categories, getUnitsForCategory, convert };
}