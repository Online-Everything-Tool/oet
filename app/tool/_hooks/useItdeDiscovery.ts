// FILE: app/tool/_hooks/useItdeDiscovery.ts
'use client';

import { useMemo } from 'react';
import { useMetadata } from '@/app/context/MetadataContext';
import type {
  ToolMetadata,
  OutputConfig, // No longer optional
  InputConfig, // No longer optional
  DiscoveredTarget,
} from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';

interface UseItdeDiscoveryParams {
  currentToolDirective: string;
  currentToolOutputConfig: OutputConfig; // Now guaranteed
  // Optional: For outputs like file-storage where category is '*'
  // and actual file types of selected items need to be checked.
  selectedOutputItems?: StoredFile[];
}

export default function useItdeDiscovery({
  currentToolDirective,
  currentToolOutputConfig, // Type is now just OutputConfig, not OutputConfig | undefined
  selectedOutputItems,
}: UseItdeDiscoveryParams): DiscoveredTarget[] {
  const { toolMetadataMap, isLoading: isLoadingMetadata } = useMetadata();

  const discoveredTargets = useMemo(() => {
    // No longer need to check if currentToolOutputConfig exists, as it's guaranteed.
    if (isLoadingMetadata) {
      return [];
    }

    const outputDetails = currentToolOutputConfig.transferableContent;
    if (outputDetails.dataType === 'none') {
      return [];
    }

    const allOtherTools = Object.values(toolMetadataMap).filter(
      (meta) =>
        meta.title && // Ensure it has a title to be a valid tool
        meta.title !== toolMetadataMap[currentToolDirective]?.title // Exclude current tool
    );

    const compatibleTargets: DiscoveredTarget[] = [];

    allOtherTools.forEach((targetToolMeta: ToolMetadata) => {
      // No longer need to check if targetToolMeta.inputConfig exists, as it's guaranteed.
      if (targetToolMeta.inputConfig.acceptsMimeTypes.length === 0) {
        return; // Target tool doesn't accept any input (empty array)
      }

      const targetDirective = Object.keys(toolMetadataMap).find(
        (key) => toolMetadataMap[key].title === targetToolMeta.title
      );

      if (!targetDirective) return;

      if (
        isOutputCompatibleWithInput(
          outputDetails,
          targetToolMeta.inputConfig,
          selectedOutputItems
        )
      ) {
        compatibleTargets.push({
          title: targetToolMeta.title,
          directive: targetDirective,
          route: `/tool/${targetDirective}/`,
          description:
            targetToolMeta.description || 'No description available.',
        });
      }
    });

    return compatibleTargets.sort((a, b) => a.title.localeCompare(b.title));
  }, [
    isLoadingMetadata,
    currentToolOutputConfig,
    toolMetadataMap,
    currentToolDirective,
    selectedOutputItems,
  ]);

  return discoveredTargets;
}

// Helper function to determine compatibility (remains the same)
function isOutputCompatibleWithInput(
  outputDetails: ToolMetadata['outputConfig']['transferableContent'],
  targetInputConfig: InputConfig,
  selectedOutputItems?: StoredFile[]
): boolean {
  if (outputDetails.dataType === 'none') return false;

  const sourceMimeTypes: string[] = [];

  // Determine the MIME type(s) of the output
  if (
    outputDetails.dataType === 'fileReference' ||
    outputDetails.dataType === 'selectionReferenceList'
  ) {
    const category =
      outputDetails.dataType === 'fileReference'
        ? outputDetails.fileCategory
        : outputDetails.selectionFileCategory;
    if (category === 'image') sourceMimeTypes.push('image/*');
    else if (category === 'text') sourceMimeTypes.push('text/*');
    else if (category === 'document') sourceMimeTypes.push('application/pdf');
    else if (category === 'archive')
      sourceMimeTypes.push('application/zip', 'application/x-zip-compressed');
    else if (category === 'other')
      sourceMimeTypes.push('application/octet-stream');
    else if (category === '*') {
      if (selectedOutputItems && selectedOutputItems.length > 0) {
        selectedOutputItems.forEach((item) => {
          if (item.type && !sourceMimeTypes.includes(item.type)) {
            sourceMimeTypes.push(item.type);
          }
        });
        if (sourceMimeTypes.length === 0) sourceMimeTypes.push('*/*');
      } else {
        sourceMimeTypes.push('*/*');
      }
    }
  } else if (outputDetails.dataType === 'text') {
    sourceMimeTypes.push('text/plain');
  } else if (outputDetails.dataType === 'jsonObject') {
    sourceMimeTypes.push('application/json');
  }

  if (sourceMimeTypes.length === 0) return false;

  const targetAccepts = targetInputConfig.acceptsMimeTypes;
  // No need to check if targetAccepts exists, as InputConfig is guaranteed
  if (targetAccepts.length === 0) return false; // Target doesn't specify what it accepts (empty array)

  for (const sourceMime of sourceMimeTypes) {
    for (const targetMime of targetAccepts) {
      if (mimeTypeMatches(sourceMime, targetMime)) {
        return true;
      }
    }
  }

  return false;
}

// Helper for MIME type matching (remains the same)
function mimeTypeMatches(
  sourceMime: string,
  targetMimePattern: string
): boolean {
  if (targetMimePattern === '*/*' || sourceMime === '*/*') return true;
  if (targetMimePattern === sourceMime) return true;

  const [sourceType, sourceSubtype] = sourceMime.split('/');
  const [targetType, targetSubtype] = targetMimePattern.split('/');

  if (
    sourceType === targetType &&
    (targetSubtype === '*' || targetSubtype === sourceSubtype)
  ) {
    return true;
  }
  return false;
}
