// --- FILE: app/tool/image-montage/_components/ImageAdjustmentCard.tsx ---
import React from 'react';
import Range from '../../_components/form/Range';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  TrashIcon,
} from '@heroicons/react/20/solid';
import Button from '../../_components/form/Button';

export interface MontageImageForCard {
  id: number;
  instanceId: string;
  imageId: string;

  alt: string;
  tilt: number;
  overlapPercent: number;
  zIndex: number;
}

interface ImageAdjustmentCardProps {
  image: MontageImageForCard;
  index: number;
  imageCount: number;
  isFirst: boolean;
  isLast: boolean;
  isTopZIndex: boolean;
  isBottomZIndex: boolean;
  isLoading: boolean;
  onTiltChange: (instanceId: string, value: number) => void;
  onOverlapChange: (instanceId: string, value: number) => void;
  onMoveLeft: (instanceId: string) => void;
  onMoveRight: (instanceId: string) => void;
  onMoveUpZIndex: (instanceId: string) => void;
  onMoveDownZIndex: (instanceId: string) => void;
  onRemoveImage: (instanceId: string) => void;
}

const MAX_TILT_DEG = 25;
const MAX_OVERLAP_PERCENT = 80;

export default function ImageAdjustmentCard({
  image,
  index,
  imageCount,
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
  onRemoveImage,
}: ImageAdjustmentCardProps) {
  return (
    <div className="flex-shrink-0 flex flex-col items-center space-y-2 p-3 border border-gray-200 rounded-lg bg-white shadow-sm w-[160px]">
      <div className="flex flex-col items-center w-full mb-1">
        <div className="w-full flex justify-end mb-0.5">
          <Button
            variant="link"
            size="sm"
            className="!p-0.5 text-red-500 hover:text-red-700"
            onClick={() => onRemoveImage(image.instanceId)}
            disabled={isLoading}
            aria-label={`Remove image ${image.alt}`}
            title="Remove this image from montage"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="neutral-outline"
          size="sm"
          className="!p-1 mb-0.5"
          onClick={() => onMoveUpZIndex(image.instanceId)}
          disabled={isLoading || imageCount <= 1 || isTopZIndex}
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
            onClick={() => onMoveLeft(image.instanceId)}
            disabled={isLoading || isFirst}
            aria-label="Move image left in layout"
            title="Move Left (Layout)"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <p
            className="text-xs font-medium text-gray-600 text-center flex-grow truncate mx-1 px-1"
            title={`${image.alt} (Order: ${index + 1}, Z:${image.zIndex})`}
          >
            {index + 1}. {image.alt}
          </p>
          <Button
            variant="neutral-outline"
            size="sm"
            className="!p-1"
            onClick={() => onMoveRight(image.instanceId)}
            disabled={isLoading || isLast}
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
          onClick={() => onMoveDownZIndex(image.instanceId)}
          disabled={isLoading || imageCount <= 1 || isBottomZIndex}
          aria-label="Move image backward (decrease stacking order)"
          title="Move Backward (Z-Index)"
        >
          <ArrowDownIcon className="h-4 w-4" />
        </Button>
      </div>
      <Range
        label="Tilt (°)"
        id={`tilt-${image.instanceId}`}
        min={-MAX_TILT_DEG}
        max={MAX_TILT_DEG}
        step={1}
        value={image.tilt}
        onChange={(e) => onTiltChange(image.instanceId, Number(e.target.value))}
        disabled={isLoading}
        containerClassName="w-full"
      />
      {!isFirst && (
        <Range
          label="Overlap (%)"
          id={`overlap-${image.instanceId}`}
          min={0}
          max={MAX_OVERLAP_PERCENT}
          step={1}
          value={image.overlapPercent}
          onChange={(e) =>
            onOverlapChange(image.instanceId, Number(e.target.value))
          }
          disabled={isLoading}
          containerClassName="w-full"
        />
      )}
    </div>
  );
}
