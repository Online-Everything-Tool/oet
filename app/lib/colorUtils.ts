// FILE: app/lib/colorUtils.ts

/**
 * Converts a HEX color string to an RGB object.
 * Handles both shorthand (#RGB) and full (#RRGGBB) formats.
 * @param hex - The hex color string (e.g., "#FF5733", "ff5733", "#f53", "f53").
 * @returns An object { r, g, b } or null if the hex is invalid.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    if (!hex || typeof hex !== 'string') return null;

    // Expand shorthand form (e.g., "03F") to full form ("0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Converts RGB color values to a HEX string.
 * @param r - Red component (0-255).
 * @param g - Green component (0-255).
 * @param b - Blue component (0-255).
 * @returns The hex color string (e.g., "#FF5733"). Rounds and clamps values.
 */
export function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (c: number) => {
        // Ensure value is integer, clamp between 0-255
        const clamped = Math.round(Math.max(0, Math.min(255, c)));
        const hex = clamped.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts RGB color values to an HSL object.
 * @param r - Red component (0-255).
 * @param g - Green component (0-255).
 * @param b - Blue component (0-255).
 * @returns An object { h, s, l } (h: 0-360, s/l: 0-100).
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    // Clamp and normalize RGB values
    r = Math.max(0, Math.min(255, r)) / 255;
    g = Math.max(0, Math.min(255, g)) / 255;
    b = Math.max(0, Math.min(255, b)) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s: number;
    const l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            // default: h = 0; // Not strictly needed as max will be one of r, g, b
        }
        h /= 6;
    }
    // Return rounded integer values
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

/**
 * Converts HSL color values to an RGB object.
 * @param h - Hue (0-360).
 * @param s - Saturation (0-100).
 * @param l - Lightness (0-100).
 * @returns An object { r, g, b } (0-255).
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    // Clamp and normalize HSL values
    h = ((h % 360) + 360) % 360 / 360; // Normalize hue to 0-1, handling negative/large values
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p: number, q: number, t: number): number => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    // Return rounded integer values
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}