// --- FILE: app/tool/image-montage/_components/ImageAdjustmentCard.tsx ---
import React from 'react';
import Range from '../../_components/form/Range';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '@heroicons/react/20/solid';
import Button from '../../_components/form/Button';

interface MontageImage {
  id: number;
  imageId: string;
  image: HTMLImageElement;
  alt: string;
  tilt: number;
  overlapPercent: number;
  zIndex: number;
  originalWidth: number;
  originalHeight: number;
}

interface ImageAdjustmentCardProps {
  image: MontageImage;
  index: number;
  imageCount: number; // Added: total number of images in the montage
  isFirst: boolean;
  isLast: boolean;
  isTopZIndex: boolean; // Renamed for clarity
  isBottomZIndex: boolean; // Renamed for clarity
  isLoading: boolean;
  onTiltChange: (imageId: string, value: number) => void;
  onOverlapChange: (imageId: string, value: number) => void;
  onMoveLeft: (imageId: string) => void;
  onMoveRight: (imageId: string) => void;
  onMoveUpZIndex: (imageId: string) => void; // Renamed for clarity
  onMoveDownZIndex: (imageId: string) => void; // Renamed for clarity
}

const MAX_TILT_DEG = 25;
const MAX_OVERLAP_PERCENT = 80;

export default function ImageAdjustmentCard({
  image,
  index,
  imageCount, // Consuming new prop
  isFirst,
  isLast,
  isTopZIndex,
  isBottomZIndex,
  isLoading,
  onTiltChange,
  onOverlapChange,
  onMoveLeft,
  onMoveRight,
  onMoveUpZIndex,
  onMoveDownZIndex,
}: ImageAdjustmentCardProps) {
  return (
    <div className="flex-shrink-0 flex flex-col items-center space-y-2 p-3 border border-gray-200 rounded-lg bg-white shadow-sm w-[180px]">
      <div className="flex flex-col items-center w-full mb-2">
        <Button
          variant="neutral-outline"
          size="sm"
          className="!p-1 mb-0.5"
          onClick={() => onMoveUpZIndex(image.imageId)}
          disabled={isLoading || imageCount <= 1 || isTopZIndex} // Updated disabled logic
          aria-label="Move image forward (increase stacking order)"
          title="Move Forward (Z-Index)"
        >
          <ArrowUpIcon className="h-4 w-4" />
        </Button>
        <div className="flex items-center justify-between w-full">
          <Button
            variant="neutral-outline"
            size="sm"
            className="!p-1"
            onClick={() => onMoveLeft(image.imageId)}
            disabled={isLoading || isFirst} // Layout move still depends on isFirst/isLast
            aria-label="Move image left in layout"
            title="Move Left (Layout)"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <p
            className="text-xs font-medium text-gray-600 text-center flex-grow truncate mx-1 px-1"
            title={`${image.alt} (Z:${image.zIndex})`}
          >
            {index + 1}. {image.alt}
          </p>
          <Button
            variant="neutral-outline"
            size="sm"
            className="!p-1"
            onClick={() => onMoveRight(image.imageId)}
            disabled={isLoading || isLast} // Layout move still depends on isFirst/isLast
            aria-label="Move image right in layout"
            title="Move Right (Layout)"
          >
            <ArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="neutral-outline"
          size="sm"
          className="!p-1 mt-0.5"
          onClick={() => onMoveDownZIndex(image.imageId)}
          disabled={isLoading || imageCount <= 1 || isBottomZIndex} // Updated disabled logic
          aria-label="Move image backward (decrease stacking order)"
          title="Move Backward (Z-Index)"
        >
          <ArrowDownIcon className="h-4 w-4" />
        </Button>
      </div>
      <Range
        label="Tilt (°)"
        id={`tilt-${image.imageId}`}
        min={-MAX_TILT_DEG}
        max={MAX_TILT_DEG}
        step={1}
        value={image.tilt}
        onChange={(e) => onTiltChange(image.imageId, Number(e.target.value))}
        disabled={isLoading}
        containerClassName="w-full"
      />
      {!isFirst && (
        <Range
          label="Overlap (%)"
          id={`overlap-${image.imageId}`}
          min={0}
          max={MAX_OVERLAP_PERCENT}
          step={1}
          value={image.overlapPercent}
          onChange={(e) =>
            onOverlapChange(image.imageId, Number(e.target.value))
          }
          disabled={isLoading}
          containerClassName="w-full"
        />
      )}
    </div>
  );
}
