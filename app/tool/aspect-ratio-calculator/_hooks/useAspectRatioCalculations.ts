import { useMemo } from 'react';

const COMMON_ASPECT_RATIOS = [
  { name: "16:9 (HD Video, Monitors)", value: 16 / 9 },
  { name: "4:3 (Older TVs, Monitors)", value: 4 / 3 },
  { name: "1:1 (Square, Social Media)", value: 1 / 1 },
  { name: "9:16 (Vertical Video)", value: 9 / 16 },
  { name: "21:9 (Ultrawide Monitors)", value: 21 / 9 },
  { name: "3:2 (Photography, 35mm Film)", value: 3 / 2 },
  { name: "5:4 (Photography, Art Prints)", value: 5 / 4 },
  { name: "1.85:1 (Cinema Widescreen)", value: 1.85 / 1 },
  { name: "2.39:1 (Cinema Widescreen)", value: 2.39 / 1 },
  { name: "2.76:1 (Ultra Panavision)", value: 2.76 / 1 },
  { name: "2.62:1 (Cinerama approx.)", value: 2.62 / 1 },
  { name: "2.35:1 (Cinemascope)", value: 2.35 / 1 },
  { name: "1.37:1 (Academy Ratio)", value: 1.37 / 1 },
  { name: "2.375:1 (Blu-ray Scope approx.)", value: 2.375 / 1 },
];

export interface CalculatedAspectRatioResult {
  name: string;
  targetRatioValue: number;
  // Option 1: Keep original width, calculate new height
  w1_originalWidth: number;
  h1_calculatedHeight: number;
  // Option 2: Keep original height, calculate new width
  w2_calculatedWidth: number;
  h2_originalHeight: number;
}

export function useAspectRatioCalculations(originalWidth: number | null, originalHeight: number | null) {
  const calculatedRatios = useMemo((): CalculatedAspectRatioResult[] => {
    if (originalWidth === null || originalHeight === null || originalWidth <= 0 || originalHeight <= 0) {
      return COMMON_ASPECT_RATIOS.map(ratio => ({
        name: ratio.name,
        targetRatioValue: ratio.value,
        w1_originalWidth: 0,
        h1_calculatedHeight: 0,
        w2_calculatedWidth: 0,
        h2_originalHeight: 0,
      }));
    }

    return COMMON_ASPECT_RATIOS.map(ratio => {
      const w1 = originalWidth;
      const h1 = originalWidth / ratio.value;

      const h2 = originalHeight;
      const w2 = originalHeight * ratio.value;

      return {
        name: ratio.name,
        targetRatioValue: ratio.value,
        w1_originalWidth: parseFloat(w1.toFixed(2)),
        h1_calculatedHeight: parseFloat(h1.toFixed(2)),
        w2_calculatedWidth: parseFloat(w2.toFixed(2)),
        h2_originalHeight: parseFloat(h2.toFixed(2)),
      };
    });
  }, [originalWidth, originalHeight]);

  return { calculatedRatios };
}