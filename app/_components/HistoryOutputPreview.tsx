// FILE: app/_components/HistoryOutputPreview.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import type { HistoryEntry } from '@/src/types/history';
import type { ToolMetadata } from '@/src/types/tools';
import { safeStringify } from '@/app/lib/utils'

interface HistoryOutputPreviewProps {
  entry: HistoryEntry;
  metadata: ToolMetadata | null;
}

export default function HistoryOutputPreview({ entry, metadata }: HistoryOutputPreviewProps) {
  const outputConfig = metadata?.outputConfig;
  const { getImage } = useImageLibrary(); // getImage from context should be stable
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const output = entry.output;

  // Memoize derived values from props
  const imageId = useMemo(() => {
    const id = outputConfig?.referenceType === 'imageLibraryId' &&
               typeof outputConfig.referenceField === 'string' &&
               typeof output === 'object' && output !== null &&
               outputConfig.referenceField in output
        ? (output as Record<string, unknown>)[outputConfig.referenceField]
        : null;
     return typeof id === 'string' ? id : null; // Ensure it's string or null
  }, [outputConfig, output]);

  const summaryText = useMemo(() => {
       const text = outputConfig?.summaryField &&
                    typeof output === 'object' && output !== null &&
                    outputConfig.summaryField in output
            ? String((output as Record<string, unknown>)[outputConfig.summaryField])
            : null;
       return text;
   }, [outputConfig, output]);

  // --- Revised useEffect for Image Loading and Cleanup ---
  useEffect(() => {
    let isActive = true; // Flag to track if the component is still mounted during async ops
    let objectUrlToRevoke: string | null = null; // Store the URL created in *this* effect run

    const loadAndSetImage = async () => {
      if (!imageId) {
        // No image ID, reset state if mounted
        if (isActive) {
            setImageUrl(null);
            setImageError(null);
            setIsLoading(false);
        }
        return;
      }

      // Start loading: Reset previous state, set loading true
      setIsLoading(true);
      setImageError(null);
      setImageUrl(null); // Clear previous URL immediately

      try {
        const imageData = await getImage(imageId);
        if (!isActive) return; // Check after await

        if (imageData?.thumbnailBlob) {
          objectUrlToRevoke = URL.createObjectURL(imageData.thumbnailBlob);
        } else if (imageData?.blob) {
          objectUrlToRevoke = URL.createObjectURL(imageData.blob);
        } else {
          throw new Error('Image data or blob not found in library.');
        }

        if (isActive) {
           setImageUrl(objectUrlToRevoke); // Set the new URL
           setImageError(null); // Clear any previous error
        }
      } catch (err) {
        console.error(`[HistoryPreview] Error loading image ${imageId}:`, err);
        if (isActive) {
           setImageError('Preview unavailable');
           setImageUrl(null); // Ensure URL is null on error
        }
      } finally {
        if (isActive) {
           setIsLoading(false); // Set loading false once done
        }
      }
    };

    loadAndSetImage();

    // Cleanup function
    return () => {
      isActive = false; // Mark as unmounted
      if (objectUrlToRevoke) {
        // console.log(`[Effect Cleanup] ID: ${entry.id} - Revoking URL: ${objectUrlToRevoke.substring(0,50)}...`);
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  // Only dependency is imageId. getImage from context is stable.
  }, [imageId, getImage, entry.id]); // entry.id added for potential debug logging clarity

  // Fallback display logic (unchanged)
  const renderFallbackOutput = useCallback(() => {
    if (entry.status === 'error') {
      return <span className="text-red-600 text-xs italic">Error</span>;
    }
    if (summaryText !== null) {
        return <span className="text-xl" title={typeof output === 'object' && output !== null && 'name' in output ? String((output as Record<string, unknown>).name) : undefined}>{summaryText}</span>;
    }
    return <span className="text-xs italic">{safeStringify(output, 0)}</span>;
  }, [entry.status, output, summaryText]);


  // Render logic: Prioritize image if imageId exists
  if (imageId) {
    if (isLoading) {
        // Loading placeholder - ensure consistent size
        return <div className="w-full h-full bg-gray-200 rounded animate-pulse min-h-[40px]"></div>;
    }
    if (imageError) {
        // Error placeholder
        return <span className="text-xs text-red-500 italic flex items-center justify-center h-full" title={imageError}>Err</span>;
    }
    if (imageUrl) {
        // Render the image
        return ( <Image src={imageUrl} alt={`Preview for ${entry.toolName}`} width={64} height={64} className="w-full h-full object-cover rounded" unoptimized={true} priority={false} /> );
    }
    // If imageId exists but URL is null (and not loading/error), show a temp state
     return <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center"><span className="text-xs text-gray-400">...</span></div>;
  }

  // If no imageId, render the fallback (summary text or stringified output)
  return renderFallbackOutput();
}