import { useMemo } from 'react';

// Helper function for GCD
const gcd = (a: number, b: number): number => {
  if (b === 0) {
    return a;
  }
  return gcd(b, a % b);
};

export interface AspectRatioInfo {
  name: string;
  description: string;
  targetRatio: { w: number; h: number }; // The simplified target ratio (e.g., 16:9)
  targetDecimal: number; // The decimal value of the target ratio (e.g., 16/9)
}

export interface CalculatedAspectRatioResult {
  name: string;
  description: string;
  targetRatioString: string; // e.g., "16:9"
  basedOnWidth: { newW: number; newH: number };
  basedOnHeight: { newW: number; newH: number };
}

export interface SimplifiedRatio {
  width: number;
  height: number;
  string: string;
}

const COMMON_RATIOS: AspectRatioInfo[] = [
  { name: "16:9", description: "Standard HD, TVs, Monitors", targetRatio: { w: 16, h: 9 }, targetDecimal: 16 / 9 },
  { name: "4:3", description: "Traditional TV, Older Displays", targetRatio: { w: 4, h: 3 }, targetDecimal: 4 / 3 },
  { name: "1:1", description: "Square, Social Media (Instagram)", targetRatio: { w: 1, h: 1 }, targetDecimal: 1 / 1 },
  { name: "9:16", description: "Vertical Video, Mobile Stories", targetRatio: { w: 9, h: 16 }, targetDecimal: 9 / 16 },
  { name: "21:9", description: "Ultrawide Monitors, Gaming", targetRatio: { w: 21, h: 9 }, targetDecimal: 21 / 9 },
  { name: "3:2", description: "Still Photography (35mm film)", targetRatio: { w: 3, h: 2 }, targetDecimal: 3 / 2 },
  { name: "5:4", description: "Photography, Art Prints", targetRatio: { w: 5, h: 4 }, targetDecimal: 5 / 4 },
  { name: "1.85:1", description: "Widescreen Cinema (Spherical)", targetRatio: { w: 185, h: 100 }, targetDecimal: 1.85 },
  { name: "2.39:1", description: "Widescreen Cinema (Anamorphic)", targetRatio: { w: 239, h: 100 }, targetDecimal: 2.39 },
  { name: "2.76:1", description: "Ultra Panavision 70", targetRatio: { w: 276, h: 100 }, targetDecimal: 2.76 },
  { name: "2.35:1", description: "CinemaScope (Modern Cinema)", targetRatio: { w: 235, h: 100 }, targetDecimal: 2.35 },
  { name: "1.37:1", description: "Academy Ratio (Silent/Early Films)", targetRatio: { w: 137, h: 100 }, targetDecimal: 1.37 },
  { name: "2.40:1", description: "Blu-ray Scope Content", targetRatio: { w: 12, h: 5 }, targetDecimal: 2.40 }, // 2.40 = 12/5
  { name: "2.60:1", description: "Cinerama (approx.)", targetRatio: { w: 13, h: 5 }, targetDecimal: 2.60 }, // 2.60 = 13/5
];


export function useAspectRatioCalculations(originalW: number, originalH: number) {
  const simplifiedOriginalRatio = useMemo<SimplifiedRatio | null>(() => {
    if (isNaN(originalW) || isNaN(originalH) || originalW <= 0 || originalH <= 0) {
      return null;
    }
    const commonDivisor = gcd(originalW, originalH);
    const simplifiedW = originalW / commonDivisor;
    const simplifiedH = originalH / commonDivisor;
    return {
      width: simplifiedW,
      height: simplifiedH,
      string: `${simplifiedW}:${simplifiedH}`,
    };
  }, [originalW, originalH]);

  const calculatedRatios = useMemo<CalculatedAspectRatioResult[]>(() => {
    if (isNaN(originalW) || isNaN(originalH) || originalW <= 0 || originalH <= 0) {
      return [];
    }

    return COMMON_RATIOS.map(ratioInfo => {
      const { targetDecimal, targetRatio, name, description } = ratioInfo;

      // Calculate new dimensions maintaining original width
      const newH_basedOnW = Math.round(originalW / targetDecimal);
      const basedOnWidth = { newW: originalW, newH: newH_basedOnW };

      // Calculate new dimensions maintaining original height
      const newW_basedOnH = Math.round(originalH * targetDecimal);
      const basedOnHeight = { newW: newW_basedOnH, newH: originalH };
      
      const targetRatioString = `${targetRatio.w}:${targetRatio.h}`;

      return {
        name,
        description,
        targetRatioString,
        basedOnWidth,
        basedOnHeight,
      };
    });
  }, [originalW, originalH]);

  return {
    simplifiedOriginalRatio,
    calculatedRatios,
  };
}