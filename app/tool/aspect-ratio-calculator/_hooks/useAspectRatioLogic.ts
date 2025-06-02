import { useMemo } from 'react';

export interface AspectRatioToolState {
  originalWidth: string;
  originalHeight: string;
  newWidthInput: string;
  newHeightInput: string;
  lastChangedDimension: 'newWidth' | 'newHeight' | null;
  selectedAspectRatioKey: string; // "16:9", "4:3", "custom"
  customAspectRatioWidth: string;
  customAspectRatioHeight: string;
  ratioTargetDimension: 'width' | 'height';
  ratioTargetValue: string;
  // Output is part of the state but not directly used by this hook for calculation input
  output: {
    width: string;
    height: string;
    aspectRatio: string;
    source: 'original' | 'mode1' | 'mode2';
  } | null;
}

export interface AspectRatioCalculations {
  original: {
    aspectRatioString: string;
    error?: string;
  };
  mode1: {
    calculatedWidth: string;
    calculatedHeight: string;
    error?: string;
  };
  mode2: {
    calculatedWidth: string;
    calculatedHeight: string;
    error?: string;
  };
  customRatioError?: string;
}

const gcd = (a: number, b: number): number => {
  if (b === 0) {
    return a;
  }
  return gcd(b, a % b);
};

const COMMON_RATIOS: Record<string, { w: number; h: number } | null> = {
  '16:9': { w: 16, h: 9 },
  '4:3': { w: 4, h: 3 },
  '1:1': { w: 1, h: 1 },
  '3:2': { w: 3, h: 2 },
  'custom': null,
};

export const useAspectRatioLogic = (state: AspectRatioToolState): AspectRatioCalculations => {
  return useMemo(() => {
    const results: AspectRatioCalculations = {
      original: { aspectRatioString: '' },
      mode1: { calculatedWidth: '', calculatedHeight: '' },
      mode2: { calculatedWidth: '', calculatedHeight: '' },
    };

    const ow = parseFloat(state.originalWidth);
    const oh = parseFloat(state.originalHeight);

    // Original Aspect Ratio Calculation
    if (!isNaN(ow) && !isNaN(oh)) {
      if (ow <= 0 || oh <= 0) {
        results.original.error = 'Original dimensions must be positive.';
      } else {
        const commonDivisor = gcd(Math.round(ow), Math.round(oh));
        results.original.aspectRatioString = `${Math.round(ow / commonDivisor)}:${Math.round(oh / commonDivisor)}`;
      }
    } else if (state.originalWidth.trim() || state.originalHeight.trim()) {
      results.original.error = 'Original dimensions must be valid numbers.';
    }

    // Mode 1: Calculate new dimension based on original aspect ratio
    if (!results.original.error && !isNaN(ow) && !isNaN(oh) && ow > 0 && oh > 0) {
      const nwInput = parseFloat(state.newWidthInput);
      const nhInput = parseFloat(state.newHeightInput);

      if (state.lastChangedDimension === 'newWidth') {
        if (!isNaN(nwInput)) {
          if (nwInput <= 0) {
            results.mode1.error = 'New width must be positive.';
          } else {
            const calculatedH = (oh / ow) * nwInput;
            results.mode1.calculatedHeight = parseFloat(calculatedH.toFixed(4)).toString();
          }
        } else if (state.newWidthInput.trim()) {
          results.mode1.error = 'New width must be a valid number.';
        }
      } else if (state.lastChangedDimension === 'newHeight') {
        if (!isNaN(nhInput)) {
          if (nhInput <= 0) {
            results.mode1.error = 'New height must be positive.';
          } else {
            const calculatedW = (ow / oh) * nhInput;
            results.mode1.calculatedWidth = parseFloat(calculatedW.toFixed(4)).toString();
          }
        } else if (state.newHeightInput.trim()) {
          results.mode1.error = 'New height must be a valid number.';
        }
      }
    } else if (state.newWidthInput.trim() || state.newHeightInput.trim()) {
       if (!results.original.error) { // only show this if original dimensions are fine
         results.mode1.error = 'Set valid original dimensions first.';
       }
    }


    // Mode 2: Calculate dimension based on a selected/custom ratio
    let ratioW: number | null = null;
    let ratioH: number | null = null;

    if (state.selectedAspectRatioKey === 'custom') {
      const crw = parseFloat(state.customAspectRatioWidth);
      const crh = parseFloat(state.customAspectRatioHeight);
      if (!isNaN(crw) && !isNaN(crh)) {
        if (crw <= 0 || crh <= 0) {
          results.customRatioError = 'Custom ratio dimensions must be positive.';
        } else {
          ratioW = crw;
          ratioH = crh;
        }
      } else if (state.customAspectRatioWidth.trim() || state.customAspectRatioHeight.trim()) {
        results.customRatioError = 'Custom ratio dimensions must be valid numbers.';
      }
    } else {
      const common = COMMON_RATIOS[state.selectedAspectRatioKey];
      if (common) {
        ratioW = common.w;
        ratioH = common.h;
      }
    }

    if (ratioW !== null && ratioH !== null && ratioW > 0 && ratioH > 0) {
      const rtv = parseFloat(state.ratioTargetValue);
      if (!isNaN(rtv)) {
        if (rtv <= 0) {
          results.mode2.error = 'Dimension value must be positive.';
        } else {
          if (state.ratioTargetDimension === 'width') {
            const calculatedH = (rtv / ratioW) * ratioH;
            results.mode2.calculatedHeight = parseFloat(calculatedH.toFixed(4)).toString();
          } else { // ratioTargetDimension === 'height'
            const calculatedW = (rtv / ratioH) * ratioW;
            results.mode2.calculatedWidth = parseFloat(calculatedW.toFixed(4)).toString();
          }
        }
      } else if (state.ratioTargetValue.trim()) {
        results.mode2.error = 'Dimension value must be a valid number.';
      }
    } else if (state.ratioTargetValue.trim()) {
        if (!results.customRatioError) { // only show this if custom ratio is fine or not used
            results.mode2.error = 'Select or define a valid aspect ratio first.';
        }
    }

    return results;
  }, [
    state.originalWidth,
    state.originalHeight,
    state.newWidthInput,
    state.newHeightInput,
    state.lastChangedDimension,
    state.selectedAspectRatioKey,
    state.customAspectRatioWidth,
    state.customAspectRatioHeight,
    state.ratioTargetDimension,
    state.ratioTargetValue,
  ]);
};

export const COMMON_RATIO_OPTIONS = Object.keys(COMMON_RATIOS).map(key => ({
  value: key,
  label: key === 'custom' ? 'Custom...' : key,
}));