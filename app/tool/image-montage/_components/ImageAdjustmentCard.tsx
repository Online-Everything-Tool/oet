// --- FILE: app/tool/image-montage/_components/ImageAdjustmentCard.tsx ---
import React from 'react';

// Types (import or define)
interface MontageImage {
  id: number;
  image: HTMLImageElement;
  alt: string;
  tilt: number;
  overlapPercent: number;
}

interface ImageAdjustmentCardProps {
  image: MontageImage;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isLoading: boolean; // Pass down loading state to disable controls
  onTiltChange: (id: number, value: number) => void;
  onOverlapChange: (id: number, value: number) => void;
  onMoveLeft: (index: number) => void;
  onMoveRight: (index: number) => void;
}

const MAX_TILT_DEG = 25; // Define or import constants
const MAX_OVERLAP_PERCENT = 80;

export default function ImageAdjustmentCard({
  image,
  index,
  isFirst,
  isLast,
  isLoading,
  onTiltChange,
  onOverlapChange,
  onMoveLeft,
  onMoveRight,
}: ImageAdjustmentCardProps) {
  return (
    <div className="flex-shrink-0 flex flex-col items-center space-y-2 p-3 border border-gray-200 rounded-lg bg-white shadow-sm w-[180px]">
      {/* Reorder Controls Row */}
      <div className="flex justify-between items-center w-full mb-1">
        <button
          type="button"
          onClick={() => onMoveLeft(index)}
          disabled={isFirst || isLoading}
          className="p-1 rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-400"
          aria-label="Move image left"
          title="Move Left"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {' '}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />{' '}
          </svg>
        </button>
        <p
          className="text-xs font-medium text-gray-600 text-center flex-grow mx-1 truncate"
          title={image.alt}
        >
          {index + 1}. {image.alt}
        </p>
        <button
          type="button"
          onClick={() => onMoveRight(index)}
          disabled={isLast || isLoading}
          className="p-1 rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-400"
          aria-label="Move image right"
          title="Move Right"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {' '}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />{' '}
          </svg>
        </button>
      </div>

      {/* Tilt Control */}
      <div className="w-full">
        <label
          htmlFor={`tilt-${image.id}`}
          className="text-[10px] text-gray-500 block text-center mb-0.5"
        >
          Tilt ({image.tilt}°)
        </label>
        <input
          id={`tilt-${image.id}`}
          type="range"
          min={-MAX_TILT_DEG}
          max={MAX_TILT_DEG}
          step="1"
          value={image.tilt}
          onChange={(e) => onTiltChange(image.id, Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer range-sm accent-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
          disabled={isLoading}
        />
      </div>
      {/* Overlap Control (Conditional) */}
      {!isFirst && ( // Show overlap only for images after the first
        <div className="w-full">
          <label
            htmlFor={`overlap-${image.id}`}
            className="text-[10px] text-gray-500 block text-center mb-0.5"
          >
            Overlap ({image.overlapPercent}%)
          </label>
          <input
            id={`overlap-${image.id}`}
            type="range"
            min="0"
            max={MAX_OVERLAP_PERCENT}
            step="1"
            value={image.overlapPercent}
            onChange={(e) => onOverlapChange(image.id, Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer range-sm accent-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-400"
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );
}
// --- END FILE: app/tool/image-montage/_components/ImageAdjustmentCard.tsx ---
