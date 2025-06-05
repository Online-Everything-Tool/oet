import { useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedRatio {
  w: number;
  h: number;
}

export interface RatioConfig {
  id: string;
  name: string; // e.g., "16:9"
  description: string;
  category: string;
  parsedRatio: ParsedRatio | null;
}

const RAW_RATIO_DEFINITIONS = [
  // Common Ratios
  { name: "16:9", description: "The standard for most TVs, computer monitors, and high-definition video.", category: "Common Screen & Video" },
  { name: "4:3", description: "A traditional aspect ratio used in older TV sets and computer displays.", category: "Common Screen & Video" },
  { name: "1:1", description: "A square aspect ratio, often used on social media platforms like Instagram.", category: "Social Media & Square" },
  { name: "9:16", description: "Vertical aspect ratio, popular for mobile videos and stories.", category: "Mobile & Vertical" },
  { name: "21:9", description: "An ultrawide aspect ratio commonly used for gaming and desktop monitors.", category: "Ultrawide & Cinematic Monitors" },
  
  // Cinema Ratios
  { name: "1.85:1", description: "Widescreen format used in cinema (Flat).", category: "Cinema" },
  { name: "2.39:1", description: "Widescreen format used in cinema (Scope). Often rounded from 2.35:1 or 2.40:1.", category: "Cinema" },
  { name: "2.35:1", description: "Cinemascope - A common aspect ratio in modern cinema.", category: "Cinema" },
  // { name: "2.35-2.40:1", description: "Commonly used in Blu-ray scope content.", category: "Cinema" }, // Covered by 2.39:1 or specific ones
  { name: "2.76:1", description: "Ultra Panavision - A widescreen format used in some older films (e.g., The Hateful Eight).", category: "Cinema" },
  { name: "2.59:1", description: "Cinerama (approx.) - A widescreen format.", category: "Cinema" }, // Using 2.59 from 2.59:1 - 2.65:1 range
  { name: "1.37:1", description: "Academy Ratio - The standard aspect ratio for silent films and early talkies.", category: "Cinema" },

  // Photography Ratios
  { name: "3:2", description: "A popular ratio for still photography, often used in 35mm film.", category: "Photography" },
  { name: "5:4", description: "Used in photography and art prints (e.g., 8x10, 16x20 inches).", category: "Photography" },
];

function parseRatioString(ratioStr: string): ParsedRatio | null {
  if (!ratioStr) return null;
  const parts = ratioStr.split(':');
  if (parts.length === 2) {
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      return { w, h };
    }
  }
  return null;
}

export function useAspectRatioDefinitions() {
  const categorizedRatioConfigs = useMemo((): Record<string, RatioConfig[]> => {
    const processed = RAW_RATIO_DEFINITIONS.map(def => ({
      ...def,
      id: uuidv4(),
      parsedRatio: parseRatioString(def.name),
    })).filter(def => def.parsedRatio !== null) as RatioConfig[];

    return processed.reduce((acc, ratio) => {
      if (!acc[ratio.category]) {
        acc[ratio.category] = [];
      }
      acc[ratio.category].push(ratio);
      return acc;
    }, {} as Record<string, RatioConfig[]>);
  }, []);

  const calculateOutputDimensions = useCallback((
    sourceValue: number,
    sourceType: 'width' | 'height',
    targetRatio: ParsedRatio
  ): { width: number; height: number } => {
    if (sourceType === 'width') {
      const newHeight = Math.round((sourceValue / targetRatio.w) * targetRatio.h);
      return { width: sourceValue, height: newHeight };
    } else { // sourceType === 'height'
      const newWidth = Math.round((sourceValue / targetRatio.h) * targetRatio.w);
      return { width: newWidth, height: sourceValue };
    }
  }, []);

  return { categorizedRatioConfigs, calculateOutputDimensions };
}