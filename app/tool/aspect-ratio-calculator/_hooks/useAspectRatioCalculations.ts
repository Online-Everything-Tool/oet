import { useMemo } from 'react';

export interface AspectRatioDefinition {
  name: string;
  x: number;
  y: number;
  description: string;
}

export interface CalculatedDimension {
  width: number;
  height: number;
}

export interface CalculatedRatioResult {
  name: string;
  description: string;
  targetRatio: string;
  basedOnOriginalWidth: CalculatedDimension;
  basedOnOriginalHeight: CalculatedDimension;
}

const ASPECT_RATIOS: AspectRatioDefinition[] = [
  { name: '16:9', x: 16, y: 9, description: 'The standard for most TVs, computer monitors, and high-definition video.' },
  { name: '4:3', x: 4, y: 3, description: 'A traditional aspect ratio used in older TV sets and computer displays.' },
  { name: '1:1', x: 1, y: 1, description: 'A square aspect ratio, often used on social media platforms like Instagram.' },
  { name: '9:16 (Vertical)', x: 9, y: 16, description: 'Vertical aspect ratio, popular for mobile videos and stories.' },
  { name: '21:9 (Ultrawide)', x: 21, y: 9, description: 'An ultrawide aspect ratio commonly used for gaming and desktop monitors.' },
  { name: '1.85:1 (Cinema Widescreen)', x: 1.85, y: 1, description: 'A common widescreen format used in cinema.' },
  { name: '2.39:1 (Cinema Widescreen)', x: 2.39, y: 1, description: 'Another common widescreen format used in cinema.' },
  { name: '3:2 (Photography)', x: 3, y: 2, description: 'A popular ratio for still photography, often used in 35mm film.' },
  { name: '5:4 (Photography/Art)', x: 5, y: 4, description: 'Used in photography and art prints.' },
  { name: '2.76:1 (Ultra Panavision)', x: 2.76, y: 1, description: 'A widescreen format used in some older films, like The Hateful Eight.' },
  { name: 'Cinerama (2.59:1)', x: 2.59, y: 1, description: 'A widescreen format (lower bound of Cinerama range).' },
  { name: 'Cinerama (2.65:1)', x: 2.65, y: 1, description: 'A widescreen format (upper bound of Cinerama range).' },
  { name: '2.35:1 (Cinemascope)', x: 2.35, y: 1, description: 'A common aspect ratio in modern cinema.' },
  { name: '1.37:1 (Academy Ratio)', x: 1.37, y: 1, description: 'The standard aspect ratio for silent films and early talkies.' },
  { name: 'Blu-ray Scope (2.35:1)', x: 2.35, y: 1, description: 'Commonly used in Blu-ray scope content (lower bound).' },
  { name: 'Blu-ray Scope (2.40:1)', x: 2.40, y: 1, description: 'Commonly used in Blu-ray scope content (upper bound).' },
];

const round = (value: number, decimals: number = 2): number => {
  return Number(Math.round(parseFloat(value + 'e' + decimals)) + 'e-' + decimals);
};

export function useAspectRatioCalculations() {
  const calculate = (originalWidth: number, originalHeight: number): CalculatedRatioResult[] => {
    if (isNaN(originalWidth) || isNaN(originalHeight) || originalWidth <= 0 || originalHeight <= 0) {
      return [];
    }

    return ASPECT_RATIOS.map(ratioDef => {
      const { name, x: targetX, y: targetY, description } = ratioDef;

      // Calculate new dimensions maintaining original width
      const newHeightFromOriginalWidth = (originalWidth / targetX) * targetY;
      const dimsFromWidth: CalculatedDimension = {
        width: round(originalWidth),
        height: round(newHeightFromOriginalWidth),
      };

      // Calculate new dimensions maintaining original height
      const newWidthFromOriginalHeight = (originalHeight / targetY) * targetX;
      const dimsFromHeight: CalculatedDimension = {
        width: round(newWidthFromOriginalHeight),
        height: round(originalHeight),
      };
      
      const targetRatioString = `${targetX}:${targetY}`;

      return {
        name,
        description,
        targetRatio: targetRatioString,
        basedOnOriginalWidth: dimsFromWidth,
        basedOnOriginalHeight: dimsFromHeight,
      };
    });
  };

  return {
    calculate,
    definedRatios: ASPECT_RATIOS,
  };
}