// FILE: app/lib/utils.ts
import { getClassWithColor } from 'file-icons-js';
import mime from 'mime-types';
import { StoredFile } from './db';
import { ToolMetadata } from '@/src/types/tools';

export interface FilePreviewDisplayInfo {
  iconName: string;
  displayName: string;
  mimeType?: string;
}

export function getDisplayInfoForFilePreview(
  fileOrMime: StoredFile | string,
  originalName?: string
): FilePreviewDisplayInfo {
  if (typeof fileOrMime === 'object' && fileOrMime.filename) {
    return {
      iconName: fileOrMime.filename,
      displayName: fileOrMime.filename,
      mimeType: fileOrMime.type,
    };
  }

  const mimeTypeStr =
    typeof fileOrMime === 'string' ? fileOrMime : fileOrMime.type;
  const baseName = originalName
    ? originalName.substring(0, originalName.lastIndexOf('.')) || originalName
    : 'file';

  const extension = mime.extension(mimeTypeStr || '');

  if (extension) {
    const generatedName = `${baseName}.${extension}`;
    return {
      iconName: generatedName,
      displayName: originalName || generatedName,
      mimeType: mimeTypeStr,
    };
  }

  return {
    iconName: originalName || baseName + '.dat',
    displayName:
      originalName || (mimeTypeStr ? `${mimeTypeStr} data` : 'Unknown File'),
    mimeType: mimeTypeStr,
  };
}

const FILENAME_TO_MIMETYPE_OVERRIDES: Record<string, string> = {
  ts: 'application/typescript',
  tsx: 'text/tsx',
  py: 'text/x-python',
  rb: 'text/x-ruby',
  go: 'text/x-go',
  swift: 'text/x-swift',
  kt: 'text/x-kotlin',
  cs: 'text/x-csharp',
  hpp: 'text/x-c++hdr',
  graphql: 'application/graphql',
  cfg: 'text/plain',
  rs: 'text/rust',
};

/**
 * Determines a common MIME type based on a filename's extension.
 * Prioritizes a small list of overrides, then uses the 'mime-types' library.
 * @param filename The full filename (e.g., "document.pdf", "archive.zip").
 * @returns A string representing the guessed MIME type, or 'application/octet-stream' as a fallback.
 */
export function getMimeTypeForFile(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'application/octet-stream';
  }

  const lastDot = filename.lastIndexOf('.');
  const extension =
    lastDot < 0 || lastDot === filename.length - 1
      ? ''
      : filename.slice(lastDot + 1).toLowerCase();

  if (extension && FILENAME_TO_MIMETYPE_OVERRIDES[extension]) {
    return FILENAME_TO_MIMETYPE_OVERRIDES[extension];
  }

  const type = mime.lookup(filename);
  return type || 'application/octet-stream';
}

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
  'svg',
  'go',
  'swift',
  'kt',
  'cs',
  'hpp',
  'graphql',
  'java',
  'c',
  'cpp',
  'h',
  'rs',
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
  'avif',
  'tiff',
  'heic',
  'heif',
] as const;

export const isTextBasedMimeType = (mimeType: string | undefined): boolean => {
  if (!mimeType) return false;
  if (mimeType.startsWith('text/')) return true;

  const knownTextApplicationTypes = [
    'application/json',
    'application/xml',
    'application/javascript',
    'application/ecmascript',
    'application/yaml',
    'application/x-yaml',
    'application/xhtml+xml',
    'application/svg+xml',
    'application/ld+json',
    'application/graphql',
    'application/sql',
    'application/x-sh',
    'application/x-httpd-php',
    'application/rtf',
    'application/typescript',
  ];
  if (knownTextApplicationTypes.includes(mimeType)) return true;

  if (mime.charset(mimeType)) {
    return true;
  }

  return false;
};

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
    if (num < 10 && (num * 10) % 10 !== 0) num = parseFloat(num.toFixed(1));
    else num = Math.round(num);
  } else num = Math.round(num);
  return `${num}${sizes[i]}`;
};

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
  if (!items || items.length === 0) return [];
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
  if (sort === 'version-desc')
    sortedValues.sort((a, b) => parseFloat(b) - parseFloat(a));
  else if (sort === 'desc') sortedValues.sort((a, b) => b.localeCompare(a));
  else sortedValues.sort((a, b) => a.localeCompare(b));
  return sortedValues;
};

export const getFileIconClassName = (fileName?: string): string => {
  if (!fileName) return 'icon generic-file-icon';
  const iconClass = getClassWithColor(fileName);
  return iconClass || 'icon generic-file-icon';
};

export function safeParseState<T>(
  jsonString: string | null | undefined,
  defaultValue: T
): T {
  if (!jsonString) return defaultValue;
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed === 'object' && parsed !== null)
      return { ...defaultValue, ...parsed };
    console.warn(
      '[safeParseState] Parsed state is not a valid object, returning default.'
    );
    return defaultValue;
  } catch (e) {
    console.error('[safeParseState] Error parsing JSON:', e);
    return defaultValue;
  }
}

export function toolRoute(metadata: ToolMetadata) {
  return `/tool/${metadata.directive}`;
}
