import { useMemo } from 'react';

interface AspectRatioInputs {
  originalWidthStr: string;
  originalHeightStr: string;
  maintainTargetWidthStr: string;
  maintainTargetHeightStr: string;
  selectedCommonRatioStr: string; // e.g., "16:9"
  commonRatioGivenDimensionValueStr: string;
  commonRatioGivenDimensionType: 'width' | 'height';
}

interface AspectRatioCalculatedValues {
  simplifiedRatio: string;
  heightFromTargetWidth: string;
  widthFromTargetHeight: string;
  commonRatioCalculatedWidth: string;
  commonRatioCalculatedHeight: string;
  errors: {
    original?: string;
    maintainTargetWidth?: string;
    maintainTargetHeight?: string;
    commonRatioInput?: string;
  };
}

const gcd = (a: number, b: number): number => {
  if (b === 0) {
    return a;
  }
  return gcd(b, a % b);
};

const formatDimension = (value: number): string => {
  if (isNaN(value) || !isFinite(value) || value <= 0) {
    return '';
  }
  // Show up to 2 decimal places if not an integer
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

export const useAspectRatioLogic = (inputs: AspectRatioInputs): AspectRatioCalculatedValues => {
  return useMemo(() => {
    const errors: AspectRatioCalculatedValues['errors'] = {};
    let simplifiedRatio = '';
    let heightFromTargetWidth = '';
    let widthFromTargetHeight = '';
    let commonRatioCalculatedWidth = '';
    let commonRatioCalculatedHeight = '';

    // Parse original dimensions
    const ow = parseFloat(inputs.originalWidthStr);
    const oh = parseFloat(inputs.originalHeightStr);
    const originalDimensionsValid = !isNaN(ow) && ow > 0 && !isNaN(oh) && oh > 0;

    if (inputs.originalWidthStr || inputs.originalHeightStr) {
      if (!originalDimensionsValid) {
        errors.original = 'Original width and height must be positive numbers.';
      }
    }

    // 1. Calculate Simplified Aspect Ratio
    if (originalDimensionsValid) {
      const commonDivisor = gcd(ow, oh);
      simplifiedRatio = `${ow / commonDivisor}:${oh / commonDivisor}`;
    }

    // 2. Maintain Aspect Ratio Calculations
    if (originalDimensionsValid) {
      // Based on target width
      if (inputs.maintainTargetWidthStr) {
        const mtw = parseFloat(inputs.maintainTargetWidthStr);
        if (!isNaN(mtw) && mtw > 0) {
          heightFromTargetWidth = formatDimension((mtw * oh) / ow);
        } else if (inputs.maintainTargetWidthStr.trim() !== '') {
          errors.maintainTargetWidth = 'Target width must be a positive number.';
        }
      }
      // Based on target height
      if (inputs.maintainTargetHeightStr) {
        const mth = parseFloat(inputs.maintainTargetHeightStr);
        if (!isNaN(mth) && mth > 0) {
          widthFromTargetHeight = formatDimension((mth * ow) / oh);
        } else if (inputs.maintainTargetHeightStr.trim() !== '') {
          errors.maintainTargetHeight = 'Target height must be a positive number.';
        }
      }
    } else {
      if (inputs.maintainTargetWidthStr || inputs.maintainTargetHeightStr) {
        if (!errors.original) { // Avoid double error message if original is already bad
             errors.original = 'Original dimensions must be set to calculate new dimensions.';
        }
      }
    }

    // 3. From Common Ratio Calculation
    if (inputs.selectedCommonRatioStr && inputs.commonRatioGivenDimensionValueStr) {
      const ratioParts = inputs.selectedCommonRatioStr.split(':').map(parseFloat);
      const crdv = parseFloat(inputs.commonRatioGivenDimensionValueStr);

      if (ratioParts.length === 2 && !isNaN(ratioParts[0]) && ratioParts[0] > 0 && !isNaN(ratioParts[1]) && ratioParts[1] > 0) {
        const ratioW = ratioParts[0];
        const ratioH = ratioParts[1];
        if (!isNaN(crdv) && crdv > 0) {
          if (inputs.commonRatioGivenDimensionType === 'width') {
            commonRatioCalculatedHeight = formatDimension((crdv * ratioH) / ratioW);
          } else { // 'height'
            commonRatioCalculatedWidth = formatDimension((crdv * ratioW) / ratioH);
          }
        } else if (inputs.commonRatioGivenDimensionValueStr.trim() !== '') {
          errors.commonRatioInput = 'Provided dimension must be a positive number.';
        }
      } else {
        errors.commonRatioInput = 'Invalid common ratio selected.';
      }
    }

    return {
      simplifiedRatio,
      heightFromTargetWidth,
      widthFromTargetHeight,
      commonRatioCalculatedWidth,
      commonRatioCalculatedHeight,
      errors,
    };
  }, [inputs]);
};