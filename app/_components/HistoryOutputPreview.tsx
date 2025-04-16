// FILE: app/_components/HistoryOutputPreview.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image'; // Import next/image
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import type { HistoryEntry } from '@/app/context/HistoryContext';
import type { ToolMetadata } from './RecentlyUsedWidget'; // Reuse type

interface HistoryOutputPreviewProps {
  entry: HistoryEntry;
  metadata: ToolMetadata | null;
}

// Helper to safely stringify, handling potential circular references (though less likely here)
function safeStringify(value: unknown, space: number = 2): string {
    try {
        if (value === undefined) return 'undefined';
        if (value === null) return 'null';
        // Basic check for large data before attempting stringify
        if (typeof value === 'string' && value.length > 500) return value.substring(0, 500) + '... [truncated]';
        if (typeof value === 'object') {
             // A more robust check might involve trying to stringify and catching errors,
             // or using a library that handles circular refs if those are expected.
             // For now, assume simple objects or provide a placeholder.
             try {
                 const str = JSON.stringify(value, null, space);
                 return str.length > 500 ? str.substring(0, 500) + '... [truncated]' : str;
             } catch /* istanbul ignore next */ {
                 return '[Could not stringify object]';
             }
        }
        // Handle primitives directly
        const stringValue = String(value);
        return stringValue.length > 500 ? stringValue.substring(0, 500) + '... [truncated]' : stringValue;
    } catch /* istanbul ignore next */ (stringifyError: unknown) {
        console.error("Error stringifying history output:", stringifyError);
        return '[Error displaying value]';
    }
}

export default function HistoryOutputPreview({ entry, metadata }: HistoryOutputPreviewProps) {
  const outputConfig = metadata?.outputConfig;
  const { getImage } = useImageLibrary();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const output = entry.output;

  // Safely determine if we have a valid imageId based on outputConfig
  const imageId = outputConfig && // 1. Check if outputConfig exists
                  outputConfig.referenceType === 'imageLibraryId' && // 2. Check type
                  typeof outputConfig.referenceField === 'string' && // 3. Check field name exists and is string
                  typeof output === 'object' && output !== null && // 4. Check output is an object
                  outputConfig.referenceField in output // 5. Check if the field exists in the output object
      ? (output as Record<string, unknown>)[outputConfig.referenceField] // Access the field value
      : null;

  // Safely get summary text
  const summaryText = outputConfig?.summaryField && typeof output === 'object' && output !== null && outputConfig.summaryField in output
      ? String((output as Record<string, unknown>)[outputConfig.summaryField])
      : null;


  const loadImage = useCallback(async () => {
    if (typeof imageId !== 'string' || !imageId) return;

    setIsLoading(true);
    setImageError(null);
    setImageUrl(null); // Clear previous image URL

    try {
      const imageData = await getImage(imageId);
      if (imageData?.thumbnailBlob) {
        const url = URL.createObjectURL(imageData.thumbnailBlob);
        setImageUrl(url);
      } else if (imageData?.blob) {
        // Fallback to original if thumbnail missing
        console.warn(`[HistoryPreview] Thumbnail missing for ${imageId}, using original.`);
        const url = URL.createObjectURL(imageData.blob);
        setImageUrl(url);
      } else {
        throw new Error('Image data or blob not found.');
      }
    } catch (loadErr: unknown) {
      console.error(`[HistoryPreview] Error loading image ${imageId}:`, loadErr);
      setImageError('Preview unavailable');
    } finally {
      setIsLoading(false);
    }
  }, [imageId, getImage]);

  useEffect(() => {
    if (imageId) {
      loadImage();
    }
    // Cleanup function to revoke the object URL when the component unmounts or imageId changes
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageId, loadImage, imageUrl]); // imageUrl dependency ensures cleanup runs if URL changes

  // Fallback display logic
  const renderFallbackOutput = useCallback(() => {
    if (entry.status === 'error') {
        return <span className="text-red-600 text-xs italic">Error occurred</span>;
    }
    if (summaryText !== null) {
      // Use summary text if available and no image is expected/loaded
      return <span className="text-xs italic">{summaryText.length > 100 ? summaryText.substring(0, 97) + '...' : summaryText}</span>;
    }
    // Generic fallback if no specific config matches
    return <span className="text-xs italic">{safeStringify(output, 0)}</span>;
  }, [entry.status, output, summaryText]);


  if (imageId) {
    if (isLoading) {
      return <div className="w-10 h-10 bg-gray-200 rounded animate-pulse"></div>;
    }
    if (imageError) {
      return <span className="text-xs text-red-500 italic" title={imageError}>Err</span>;
    }
    if (imageUrl) {
      return (
        <Image // Use Next.js Image
          src={imageUrl}
          alt={`Preview for ${entry.toolName}`}
          width={40} // Provide required width
          height={40} // Provide required height
          className="w-10 h-10 object-cover rounded border border-gray-300"
          unoptimized={true} // Necessary for blob URLs
        />
      );
    }
  }

  // If not an image or image loading failed, render fallback
  return renderFallbackOutput();
}