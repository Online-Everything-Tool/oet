import { useMemo } from 'react';

interface RatioDefinition {
  name: string;
  value: [number, number] | number; // e.g., [16, 9] or 1.85 (implies 1.85:1)
  description: string;
}

export interface CalculatedAspectRatio {
  name: string;
  description: string;
  ratioDisplayText: string; // e.g., "16:9" or "1.85:1"
  // Dimensions when original width is maintained
  maintainingOriginalWidth?: {
    width: number;
    height: number;
  };
  // Dimensions when original height is maintained
  maintainingOriginalHeight?: {
    width: number;
    height: number;
  };
}

const RATIOS: RatioDefinition[] = [
  { name: "16:9", value: [16, 9], description: "The standard for most TVs, computer monitors, and high-definition video." },
  { name: "4:3", value: [4, 3], description: "A traditional aspect ratio used in older TV sets and computer displays." },
  { name: "1:1", value: [1, 1], description: "A square aspect ratio, often used on social media platforms like Instagram." },
  { name: "9:16", value: [9, 16], description: "Vertical aspect ratio, popular for mobile videos and stories." },
  { name: "21:9", value: [21, 9], description: "An ultrawide aspect ratio commonly used for gaming and desktop monitors." },
  { name: "1.85:1", value: 1.85, description: "Widescreen format used in cinema." },
  { name: "2.39:1", value: 2.39, description: "Widescreen format used in cinema." },
  { name: "3:2", value: [3, 2], description: "A popular ratio for still photography, often used in 35mm film." },
  { name: "5:4", value: [5, 4], description: "Used in photography and art prints." },
  { name: "2.76:1 (Ultra Panavision)", value: 2.76, description: "A widescreen format used in some older films, like The Hateful Eight." },
  { name: "2.59:1 (Cinerama)", value: 2.59, description: "A widescreen format." },
  { name: "2.35:1 (Cinemascope)", value: 2.35, description: "A common aspect ratio in modern cinema." },
  { name: "1.37:1 (Academy Ratio)", value: 1.37, description: "The standard aspect ratio for silent films and early talkies." },
  { name: "2.40:1 (Blu-ray Scope)", value: 2.40, description: "Commonly used in Blu-ray scope content." },
];

function parseRatioValue(value: [number, number] | number): { ratioWidth: number; ratioHeight: number; displayText: string } {
  if (typeof value === 'number') {
    return { ratioWidth: value, ratioHeight: 1, displayText: `${value}:1` };
  }
  // Could add GCD simplification here for displayText if needed, e.g. [1920, 1080] -> "16:9"
  // For now, direct display is fine as names are descriptive.
  return { ratioWidth: value[0], ratioHeight: value[1], displayText: `${value[0]}:${value[1]}` };
}


export function useAspectRatioCalculations(originalWidth: number, originalHeight: number): CalculatedAspectRatio[] {
  return useMemo(() => {
    if (originalWidth <= 0 && originalHeight <= 0) {
      return [];
    }

    return RATIOS.map(ratioDef => {
      const { ratioWidth, ratioHeight, displayText } = parseRatioValue(ratioDef.value);
      const result: CalculatedAspectRatio = {
        name: ratioDef.name,
        description: ratioDef.description,
        ratioDisplayText: displayText,
      };

      if (originalWidth > 0 && ratioWidth > 0) {
        result.maintainingOriginalWidth = {
          width: originalWidth,
          height: Math.round((originalWidth / ratioWidth) * ratioHeight),
        };
      }

      if (originalHeight > 0 && ratioHeight > 0) {
        result.maintainingOriginalHeight = {
          width: Math.round((originalHeight / ratioHeight) * ratioWidth),
          height: originalHeight,
        };
      }
      
      // Ensure calculated dimensions are at least 1 if source was positive
      if (result.maintainingOriginalWidth && result.maintainingOriginalWidth.height <= 0) {
        result.maintainingOriginalWidth.height = 1;
      }
      if (result.maintainingOriginalHeight && result.maintainingOriginalHeight.width <= 0) {
        result.maintainingOriginalHeight.width = 1;
      }

      return result;
    });
  }, [originalWidth, originalHeight]);
}