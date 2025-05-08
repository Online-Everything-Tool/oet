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
  index: number; // Represents layout order
  isFirst: boolean; // First in layout order
  isLast: boolean; // Last in layout order
  isTop: boolean; // Highest zIndex
  isBottom: boolean; // Lowest zIndex
  isLoading: boolean;
  onTiltChange: (imageId: string, value: number) => void;
  onOverlapChange: (imageId: string, value: number) => void;
  onMoveLeft: (imageId: string) => void; // Layout move
  onMoveRight: (imageId: string) => void; // Layout move
  onMoveUp: (imageId: string) => void; // zIndex move up
  onMoveDown: (imageId: string) => void; // zIndex move down
}

const MAX_TILT_DEG = 25;
const MAX_OVERLAP_PERCENT = 80;

export default function ImageAdjustmentCard({
  image,
  index,
  isFirst,
  isLast,
  isTop,
  isBottom,
  isLoading,
  onTiltChange,
  onOverlapChange,
  onMoveLeft,
  onMoveRight,
  onMoveUp,
  onMoveDown,
}: ImageAdjustmentCardProps) {
  return (
    <div className="flex-shrink-0 flex flex-col items-center space-y-2 p-3 border border-gray-200 rounded-lg bg-white shadow-sm w-[180px]">
      {/* *** New Layout: All 4 Arrows Around Name *** */}
      <div className="flex flex-col items-center w-full mb-2">
        {/* Up Button (Z-index) */}
        <Button
          variant="neutral-outline"
          size="sm"
          className="!p-1 mb-0.5" // Added margin bottom
          onClick={() => onMoveUp(image.imageId)}
          disabled={isTop || isLoading}
          aria-label="Move image forward (increase stacking order)"
          title="Move Forward"
        >
          {' '}
          <ArrowUpIcon className="h-4 w-4" />{' '}
        </Button>

        {/* Middle Row: Left Arrow, Name, Right Arrow */}
        <div className="flex items-center justify-between w-full">
          {/* Left Button (Layout) */}
          <Button
            variant="neutral-outline"
            size="sm"
            className="!p-1"
            onClick={() => onMoveLeft(image.imageId)}
            disabled={isFirst || isLoading}
            aria-label="Move image left"
            title="Move Left"
          >
            {' '}
            <ArrowLeftIcon className="h-4 w-4" />{' '}
          </Button>

          {/* Filename/Index */}
          <p
            className="text-xs font-medium text-gray-600 text-center flex-grow truncate mx-1 px-1" // Added horizontal margin/padding
            title={`${image.alt} (Z:${image.zIndex})`}
          >
            {index + 1}. {image.alt}
          </p>

          {/* Right Button (Layout) */}
          <Button
            variant="neutral-outline"
            size="sm"
            className="!p-1"
            onClick={() => onMoveRight(image.imageId)}
            disabled={isLast || isLoading}
            aria-label="Move image right"
            title="Move Right"
          >
            {' '}
            <ArrowRightIcon className="h-4 w-4" />{' '}
          </Button>
        </div>

        {/* Down Button (Z-index) */}
        <Button
          variant="neutral-outline"
          size="sm"
          className="!p-1 mt-0.5" // Added margin top
          onClick={() => onMoveDown(image.imageId)}
          disabled={isBottom || isLoading}
          aria-label="Move image backward (decrease stacking order)"
          title="Move Backward"
        >
          {' '}
          <ArrowDownIcon className="h-4 w-4" />{' '}
        </Button>
      </div>
      {/* ******************************************* */}

      {/* Tilt Control */}
      <Range
        label="Tilt (°)"
        id={`tilt-${image.imageId}`}
        min={-MAX_TILT_DEG}
        max={MAX_TILT_DEG}
        step={1}
        value={image.tilt}
        onChange={(e) => onTiltChange(image.imageId, Number(e.target.value))}
        disabled={isLoading}
        containerClassName="w-full" // Removed margin top here
      />

      {/* Overlap Control (Conditional) */}
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
          containerClassName="w-full" // Removed margin top here
        />
      )}

      {/* Removed the separate Left/Right button row from the bottom */}
    </div>
  );
}
