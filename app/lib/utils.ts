// FILE: app/lib/utils.ts

/**
 * Formats a number of bytes into a human-readable string (e.g., KB, MB).
 * (Moved from zip-file-explorer/_components/utils.ts)
 * @param bytes - The number of bytes.
 * @param decimals - The number of decimal places (default: 2).
 * @returns Human-readable string representation of the byte size.
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';
    if (bytes < 0) return 'Invalid Size';
    // Handle sub-byte values which might occur in calculations
    if (bytes < 1) return parseFloat(bytes.toFixed(decimals)) + ' Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k)); // Ensure log input >= 1
    // Clamp index to the highest defined unit
    const index = Math.min(i, sizes.length - 1);

    return parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + ' ' + sizes[index];
};

/**
 * Safely converts a value to a string, handling potential errors and truncating long strings.
 * (Moved from HistoryOutputPreview.tsx)
 * @param value - The value to stringify.
 * @param space - Indentation for JSON.stringify (0 for compact).
 * @returns String representation of the value.
 */
export function safeStringify(value: unknown, space: number = 2): string {
    try {
        if (value === undefined) return 'undefined';
        if (value === null) return 'null';
        // Truncate long strings
        if (typeof value === 'string' && value.length > 500) {
            return value.substring(0, 500) + '... [truncated]';
        }
        // Handle objects and arrays with truncation
        if (typeof value === 'object') {
             try {
                 const str = JSON.stringify(value, null, space);
                 const limit = space === 0 ? 100 : 500; // Shorter limit for compact view
                 return str.length > limit ? str.substring(0, limit) + '... [truncated]' : str;
             } catch {
                 // Handle circular references or other stringify errors
                 return '[Could not stringify object]';
             }
        }
        // Handle other primitive types (numbers, booleans) with truncation
        const stringValue = String(value);
        const limit = space === 0 ? 100 : 500;
        return stringValue.length > limit ? stringValue.substring(0, limit) + '... [truncated]' : stringValue;
    } catch (stringifyError: unknown) {
        console.error("Error stringifying value:", stringifyError);
        return '[Error displaying value]';
    }
}

/**
 * Converts an ArrayBuffer (like from crypto.subtle.digest) to a hexadecimal string.
 * (Moved from hash-generator/_components/HashGeneratorClient.tsx)
 * @param buffer - The ArrayBuffer to convert.
 * @returns The hexadecimal string representation.
 */
export function bufferToHex(buffer: ArrayBuffer): string {
    // Create a DataView for easier byte access
    const view = new DataView(buffer);
    let hexString = '';
    for (let i = 0; i < view.byteLength; i++) {
      // Get byte, convert to hex, pad with '0' if needed
      hexString += view.getUint8(i).toString(16).padStart(2, '0');
    }
    return hexString;
    // Alternative using Uint8Array (slightly different approach)
    // return Array.from(new Uint8Array(buffer))
    //   .map(b => b.toString(16).padStart(2, '0'))
    //   .join('');
}

/**
 * Extracts unique string values from an array of objects based on a specified key,
 * sorts them, and returns the sorted array.
 * Handles 'version' sorting specifically.
 * (Moved from emoji-explorer/_components/EmojiExplorerClient.tsx)
 * @template T - The type of the objects in the array (must be object-like).
 * @param items - The array of objects.
 * @param key - The key to extract values from.
 * @param sort - Sorting order: 'asc', 'desc', or 'version-desc'.
 * @returns A sorted array of unique string values.
 */
 // Relax the constraint from Record<string, unknown> to object
export const getUniqueSortedValues = <T extends object>(
    items: T[],
    key: keyof T, // keyof T works correctly with object constraint
    sort: 'asc' | 'desc' | 'version-desc' = 'asc'
): string[] => {
    if (!items || items.length === 0) {
        return [];
    }
    const values = new Set<string>();
    items.forEach(item => {
        // Access value using the key. Type assertion might be needed
        // if TypeScript can't infer item[key] is compatible with string.
        const value = item?.[key];
        if (typeof value === 'string' && value.trim() !== '' && value !== 'Unknown') {
            values.add(value);
        }
    });

    const sortedValues = Array.from(values);

    if (sort === 'version-desc') {
        sortedValues.sort((a, b) => parseFloat(b) - parseFloat(a));
    } else if (sort === 'desc') {
        sortedValues.sort((a, b) => b.localeCompare(a));
    } else { // 'asc'
        sortedValues.sort((a, b) => a.localeCompare(b));
    }

    return sortedValues;
};