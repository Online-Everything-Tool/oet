'use client';

import React from 'react';
import Image from 'next/image';
import type { BlenderImage } from '../_hooks/useImageBlender';
import Button from '../../_components/form/Button';
import Range from '../../_components/form/Range';
import Select from '../../_components/form/Select';
import { TrashIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/20/solid';

interface ImageInputCardProps {
  image: BlenderImage;
  onUpdate: (instanceId: string, updates: Partial<BlenderImage>) => void;
  onRemove: (instanceId: string) => void;
  onReorder: (instanceId: string, direction: 'up' | 'down') => void;
  isLoading: boolean;
  isFirst: boolean;
  isLast: boolean;
}

const blendModeOptions: { value: GlobalCompositeOperation; label: string }[] = [
  { value: 'source-over', label: 'Normal (Source Over)' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
];

export default function ImageInputCard({
  image,
  onUpdate,
  onRemove,
  onReorder,
  isLoading,
  isFirst,
  isLast,
}: ImageInputCardProps) {
  
  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(image.instanceId, { opacity: parseFloat(e.target.value) });
  };

  const handleBlendModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate(image.instanceId, { blendMode: e.target.value as GlobalCompositeOperation });
  };

  return (
    <div className="flex-shrink-0 w-64 border border-[rgb(var(--color-border-base))] rounded-lg p-3 space-y-3 bg-[rgb(var(--color-bg-component))] shadow-sm">
      <div className="flex justify-between items-start">
        <div className="w-16 h-16 relative bg-[rgb(var(--color-bg-subtle))] rounded overflow-hidden border border-[rgb(var(--color-border-base))]">
          {image.previewUrl ? (
            <Image src={image.previewUrl} alt={image.filename} layout="fill" objectFit="cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-[rgb(var(--color-text-muted))]">Loading...</div>
          )}
        </div>
        <div className="flex-1 ml-2 space-y-1">
            <p className="text-xs font-medium text-[rgb(var(--color-text-base))] break-all" title={image.filename}>
                {image.filename}
            </p>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">
                Order: {image.order + 1}
            </p>
        </div>
        <Button variant="danger-outline" size="sm" onClick={() => onRemove(image.instanceId)} disabled={isLoading} className="!p-1">
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>
      
      <Range
        label="Opacity"
        id={`opacity-${image.instanceId}`}
        min={0}
        max={1}
        step={0.01}
        value={image.opacity}
        onChange={handleOpacityChange}
        disabled={isLoading}
      />
      <Select
        label="Blend Mode"
        id={`blendmode-${image.instanceId}`}
        options={blendModeOptions}
        value={image.blendMode}
        onChange={handleBlendModeChange}
        disabled={isLoading}
      />
      <div className="flex justify-between items-center pt-2 border-t border-[rgb(var(--color-border-base))]">
        <span className="text-xs text-[rgb(var(--color-text-muted))]">Reorder:</span>
        <div className="flex gap-2">
          <Button variant="neutral-outline" size="sm" onClick={() => onReorder(image.instanceId, 'up')} disabled={isLoading || isFirst} className="!p-1.5">
            <ArrowUpIcon className="h-4 w-4" /> <span className="ml-1">Up</span>
          </Button>
          <Button variant="neutral-outline" size="sm" onClick={() => onReorder(image.instanceId, 'down')} disabled={isLoading || isLast} className="!p-1.5">
            <ArrowDownIcon className="h-4 w-4" /> <span className="ml-1">Down</span>
          </Button>
        </div>
      </div>
    </div>
  );
}