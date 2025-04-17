// --- FILE: app/_components/HistoryOutputPreview.tsx ---
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import type { HistoryEntry } from '@/src/types/history';
import type { ToolMetadata } from '@/src/types/tools';
import { safeStringify } from '@/app/lib/utils';

interface HistoryOutputPreviewProps {
  entry: HistoryEntry;
  metadata: ToolMetadata | null;
}

export default function HistoryOutputPreview({ entry, metadata }: HistoryOutputPreviewProps) {
  const outputConfig = metadata?.outputConfig;
  const { getImage } = useImageLibrary();
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
    let isActive = true;
    let objectUrlToRevoke: string | null = null;

    const loadAndSetImage = async () => {
      // Reset state if imageId is missing or changes to null
      if (!imageId) {
        if (isActive) {
            setImageUrl(null);
            setImageError(null);
            setIsLoading(false);
        }
        return;
      }

      // Start loading for the current imageId
      setIsLoading(true);
      setImageError(null);
      setImageUrl(null); // Clear previous image URL

      try {
        // Attempt to fetch the image data
        const imageData = await getImage(imageId);

        // Check if component is still mounted after await
        if (!isActive) return;

        // --- ADDED CHECK: Handle case where image data is not found (deleted) ---
        if (!imageData) {
          console.warn(`[HistoryPreview] Image data not found for ID: ${imageId} (likely deleted).`);
          if (isActive) { // Check isActive again before setting state
             setImageError('Image deleted'); // Set specific error message
             setImageUrl(null); // Ensure URL is null
             setIsLoading(false); // Mark loading as complete (with error)
          }
          return; // Exit the function early, no image to display
        }
        // --- END ADDED CHECK ---

        // Proceed only if imageData was found
        if (imageData.thumbnailBlob) {
          objectUrlToRevoke = URL.createObjectURL(imageData.thumbnailBlob);
        } else if (imageData.blob) { // Fallback to original blob if no thumbnail
          objectUrlToRevoke = URL.createObjectURL(imageData.blob);
        } else {
          // This case is less likely if imageData exists, but handles corrupted entries
          throw new Error('Image data retrieved, but blob/thumbnailBlob missing.');
        }

        // Set the image URL if still active
        if (isActive) {
           setImageUrl(objectUrlToRevoke);
           setImageError(null); // Clear any previous error
        }

      } catch (err) {
        // Catch errors during getImage or createObjectURL
        console.error(`[HistoryPreview] Error loading image ${imageId}:`, err);
        if (isActive) { // Check isActive before setting state
           setImageError('Preview unavailable'); // Generic error
           setImageUrl(null); // Ensure URL is null
        }
      } finally {
        // Ensure loading is set to false if the component is still active
        if (isActive) {
           setIsLoading(false);
        }
      }
    };

    loadAndSetImage();

    // Cleanup function: Revoke URL and mark as inactive
    return () => {
      isActive = false;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  // Dependencies: Re-run if imageId changes or if the getImage function instance changes (unlikely for context)
  }, [imageId, getImage]); // Removed entry.id as it's not strictly needed for logic

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


  // Render logic: Prioritize image display logic (handles loading, error, success)
  if (imageId) {
    if (isLoading) {
        return <div className="w-full h-full bg-gray-200 rounded animate-pulse min-h-[40px]"></div>;
    }
    if (imageError) {
        // Display the specific error message (e.g., "Image deleted")
        return <span className="text-xs text-red-500 italic flex items-center justify-center h-full text-center px-1 leading-tight" title={imageError}>{imageError}</span>;
    }
    if (imageUrl) {
        return ( <Image src={imageUrl} alt={`Preview for ${entry.toolName}`} width={64} height={64} className="w-full h-full object-cover rounded" unoptimized={true} priority={false} /> );
    }
     // Fallback if imageId exists but URL is null (and not loading/error state) - less likely now
     return <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center"><span className="text-xs text-gray-400">...</span></div>;
  }

  // If no imageId, render the non-image fallback output
  return renderFallbackOutput();
}
// --- END FILE: app/_components/HistoryOutputPreview.tsx ---