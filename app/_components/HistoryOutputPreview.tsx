// --- FILE: app/_components/HistoryOutputPreview.tsx ---
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useImageLibrary } from '@/app/context/ImageLibraryContext'; // Stays the same
import type { HistoryEntry } from '@/src/types/history';
import type { ToolMetadata } from '@/src/types/tools';
import { safeStringify } from '@/app/lib/utils';
// Import StoredFile type if needed for explicit typing, though inference might work
import type { StoredFile } from '@/src/types/storage';

interface HistoryOutputPreviewProps {
  entry: HistoryEntry;
  metadata: ToolMetadata | null;
}

export default function HistoryOutputPreview({ entry, metadata }: HistoryOutputPreviewProps) {
  const outputConfig = metadata?.outputConfig;
  const { getImage } = useImageLibrary(); // Hook usage stays the same
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const output = entry.output;

  const imageId = useMemo(() => {
    const id = outputConfig?.referenceType === 'imageLibraryId' &&
               typeof outputConfig.referenceField === 'string' &&
               typeof output === 'object' && output !== null &&
               outputConfig.referenceField in output
        ? (output as Record<string, unknown>)[outputConfig.referenceField]
        : null;
     return typeof id === 'string' ? id : null;
  }, [outputConfig, output]);

  // Summary text logic remains the same
   const summaryText = useMemo(() => {
       const text = outputConfig?.summaryField &&
                    typeof output === 'object' && output !== null &&
                    outputConfig.summaryField in output
            ? String((output as Record<string, unknown>)[outputConfig.summaryField])
            : null;
       return text;
   }, [outputConfig, output]);

  // --- Image Loading useEffect ---
  // The core logic remains the same, but the type of `imageData` retrieved
  // from `getImage` is now implicitly `StoredFile | undefined`.
  useEffect(() => {
    let isActive = true;
    let objectUrlToRevoke: string | null = null;

    const loadAndSetImage = async () => {
      if (!imageId) {
        if (isActive) {
            setImageUrl(null); setImageError(null); setIsLoading(false);
        }
        return;
      }

      setIsLoading(true); setImageError(null); setImageUrl(null);

      try {
        // getImage now returns Promise<StoredFile | undefined>
        const imageData: StoredFile | undefined = await getImage(imageId); // Type annotation added for clarity

        if (!isActive) return;

        if (!imageData) {
          console.warn(`[HistoryPreview] Image data not found for ID: ${imageId} (likely deleted).`);
          if (isActive) {
             setImageError('Image deleted'); setImageUrl(null); setIsLoading(false);
          }
          return;
        }

        // Access properties from StoredFile type
        if (imageData.thumbnailBlob) {
          objectUrlToRevoke = URL.createObjectURL(imageData.thumbnailBlob);
        } else if (imageData.blob) { // Fallback to original blob
          objectUrlToRevoke = URL.createObjectURL(imageData.blob);
        } else {
          throw new Error('Image data retrieved, but blob/thumbnailBlob missing.');
        }

        if (isActive) {
           setImageUrl(objectUrlToRevoke); setImageError(null);
        }

      } catch (err) {
        console.error(`[HistoryPreview] Error loading image ${imageId}:`, err);
        if (isActive) {
           setImageError('Preview unavailable'); setImageUrl(null);
        }
      } finally {
        if (isActive) {
           setIsLoading(false);
        }
      }
    };

    loadAndSetImage();

    // Cleanup
    return () => {
      isActive = false;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [imageId, getImage]); // Dependencies remain the same

  // Fallback display logic (unchanged)
  const renderFallbackOutput = useCallback(() => {
    if (entry.status === 'error') {
      return <span className="text-red-600 text-xs italic">Error</span>;
    }
    if (summaryText !== null) {
        return <span className="text-xl" title={typeof output === 'object' && output !== null && 'name' in output ? String((output as Record<string, unknown>).name) : undefined}>{summaryText}</span>;
    }
    // Use safeStringify for better fallback display
    return <span className="text-xs italic">{safeStringify(output, 0)}</span>;
  }, [entry.status, output, summaryText]);


  // Render logic (unchanged, as it relies on derived state like imageUrl/isLoading/imageError)
  if (imageId) {
    if (isLoading) {
        return <div className="w-full h-full bg-gray-200 rounded animate-pulse min-h-[40px]"></div>;
    }
    if (imageError) {
        return <span className="text-xs text-red-500 italic flex items-center justify-center h-full text-center px-1 leading-tight" title={imageError}>{imageError}</span>;
    }
    if (imageUrl) {
        return ( <Image src={imageUrl} alt={`Preview for ${entry.toolName}`} width={64} height={64} className="w-full h-full object-cover rounded" unoptimized={true} priority={false} /> );
    }
     return <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center"><span className="text-xs text-gray-400">...</span></div>;
  }

  // If no imageId, render the non-image fallback output
  return renderFallbackOutput();
}
// --- END FILE: app/_components/HistoryOutputPreview.tsx ---