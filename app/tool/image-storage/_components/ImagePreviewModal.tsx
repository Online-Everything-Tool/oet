// FILE: app/tool/image-storage/_components/ImagePreviewModal.tsx
'use client';

import React, { useEffect } from 'react';
import Button from '@/app/tool/_components/form/Button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  imageName?: string | null;
}

export default function ImagePreviewModal({
  isOpen,
  onClose,
  imageUrl,
  imageName = 'Image Preview',
}: ImagePreviewModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-[rgb(var(--color-overlay-backdrop))]/75 flex items-center justify-center z-[70] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-preview-modal-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center flex-shrink-0">
          <h2
            id="image-preview-modal-title"
            className="text-lg font-semibold text-[rgb(var(--color-text-emphasis))] truncate"
            title={imageName || undefined}
          >
            {imageName}
          </h2>
          <Button
            variant="link"
            size="sm"
            onClick={onClose}
            aria-label="Close image preview"
            className="p-1 text-[rgb(var(--color-text-disabled))] hover:text-[rgb(var(--color-text-subtle))]"
          >
            <XMarkIcon className="h-6 w-6" />
          </Button>
        </div>
        <div className="flex-grow p-4 flex items-center justify-center overflow-hidden">
          {/* Using next/image requires width/height or fill. For dynamic images, `fill` with a sized parent is often best. */}
          <div className="relative w-full h-full">
            <Image
              src={imageUrl}
              alt={imageName || 'Full size preview'}
              fill
              style={{ objectFit: 'contain' }}
              unoptimized
            />
          </div>
        </div>
      </div>
    </div>
  );
}
