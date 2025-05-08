// FILE: app/lib/utils.ts
import { getClassWithColor } from 'file-icons-js';

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

export function safeStringify(value: unknown, space: number = 2): string {
  try {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string' && value.length > 500) {
      return value.substring(0, 500) + '... [truncated]';
    }
    if (typeof value === 'object') {
      try {
        const str = JSON.stringify(value, null, space);
        const limit = space === 0 ? 100 : 500;
        return str.length > limit
          ? str.substring(0, limit) + '... [truncated]'
          : str;
      } catch {
        return '[Could not stringify object]';
      }
    }
    const stringValue = String(value);
    const limit = space === 0 ? 100 : 500;
    return stringValue.length > limit
      ? stringValue.substring(0, limit) + '... [truncated]'
      : stringValue;
  } catch (stringifyError: unknown) {
    console.error('Error stringifying value:', stringifyError);
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
