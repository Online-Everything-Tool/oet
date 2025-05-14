// FILE: app/lib/utils.ts
import { getClassWithColor } from 'file-icons-js';

export const PREVIEWABLE_TEXT_EXTENSIONS: ReadonlyArray<string> = [
  'txt',
  'js',
  'jsx',
  'ts',
  'tsx',
  'css',
  'html',
  'htm',
  'json',
  'xml',
  'md',
  'csv',
  'log',
  'yaml',
  'yml',
  'ini',
  'cfg',
  'sh',
  'py',
  'rb',
  'php',
  'sql',
] as const;

export const PREVIEWABLE_IMAGE_EXTENSIONS: ReadonlyArray<string> = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
] as const;

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0) return 'Invalid Size';
  if (bytes < 1) return parseFloat(bytes.toFixed(decimals)) + ' Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k));
  const index = Math.min(i, sizes.length - 1);

  return (
    parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + ' ' + sizes[index]
  );
};

export const formatBytesCompact = (bytes: number): string => {
  if (bytes < 0) return 'N/A';
  if (bytes < 1024) return `${Math.round(bytes)}b`;

  const k = 1024;
  const sizes = ['', 'k', 'm', 'g'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  i = Math.min(i, sizes.length - 1);

  let num = bytes / Math.pow(k, i);

  if (i > 0) {
    if (num < 10 && (num * 10) % 10 !== 0) {
      num = parseFloat(num.toFixed(1));
    } else {
      num = Math.round(num);
    }
  } else {
    num = Math.round(num);
  }

  return `${num}${sizes[i]}`;
};

/**
 * Safely stringifies a value, with optional indentation and truncation.
 * @param value The value to stringify.
 * @param space The number of spaces for JSON indentation (default: 2).
 * @param truncate The maximum length before truncating. If 0 or undefined, NO truncation is applied (default: 0).
 * @returns A string representation of the value.
 */
export function safeStringify(
  value: unknown,
  space: number = 2,
  truncate: number = 0
): string {
  try {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';

    let stringifiedValue: string;

    if (typeof value === 'object') {
      try {
        stringifiedValue = JSON.stringify(value, null, space);
      } catch {
        return '[Could not stringify object]';
      }
    } else {
      stringifiedValue = String(value);
    }

    if (truncate > 0 && stringifiedValue.length > truncate) {
      return stringifiedValue.substring(0, truncate) + '... [truncated]';
    }

    return stringifiedValue;
  } catch (stringifyError: unknown) {
    console.error('Error in safeStringify function:', stringifyError);
    return '[Error displaying value]';
  }
}

export function bufferToHex(buffer: ArrayBuffer): string {
  const view = new DataView(buffer);
  let hexString = '';
  for (let i = 0; i < view.byteLength; i++) {
    hexString += view.getUint8(i).toString(16).padStart(2, '0');
  }
  return hexString;
}

export const getUniqueSortedValues = <T extends object>(
  items: T[],
  key: keyof T,
  sort: 'asc' | 'desc' | 'version-desc' = 'asc'
): string[] => {
  if (!items || items.length === 0) {
    return [];
  }
  const values = new Set<string>();
  items.forEach((item) => {
    const value = item?.[key];
    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      value !== 'Unknown'
    ) {
      values.add(value);
    }
  });

  const sortedValues = Array.from(values);

  if (sort === 'version-desc') {
    sortedValues.sort((a, b) => parseFloat(b) - parseFloat(a));
  } else if (sort === 'desc') {
    sortedValues.sort((a, b) => b.localeCompare(a));
  } else {
    sortedValues.sort((a, b) => a.localeCompare(b));
  }
  return sortedValues;
};

export const getFileIconClassName = (fileName?: string): string => {
  if (!fileName) {
    return 'icon generic-file-icon';
  }
  const iconClass = getClassWithColor(fileName);
  return iconClass || 'icon generic-file-icon';
};

export const isTextBasedMimeType = (mimeType: string | undefined): boolean => {
  if (!mimeType) return false;
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/csv'
  );
};

export function safeParseState<T>(
  jsonString: string | null | undefined,
  defaultValue: T
): T {
  if (!jsonString) return defaultValue;
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed === 'object' && parsed !== null) {
      return { ...defaultValue, ...parsed };
    }
    console.warn(
      '[useToolState] Parsed state is not a valid object structure, returning default.'
    );
    return defaultValue;
  } catch (e) {
    console.error('[useToolState] Error parsing tool state JSON:', e);
    return defaultValue;
  }
}
