// FILE: app/tool/_hooks/useItdeDiscovery.ts
'use client';

import { useMemo } from 'react';
import { useMetadata } from '@/app/context/MetadataContext';
import type {
  ToolMetadata,
  OutputConfig,
  InputConfig,
  DiscoveredTarget,
} from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';

interface UseItdeDiscoveryParams {
  currentToolDirective: string;
  currentToolOutputConfig: OutputConfig;

  selectedOutputItems?: StoredFile[];
}

export default function useItdeDiscovery({
  currentToolDirective,
  currentToolOutputConfig,
  selectedOutputItems,
}: UseItdeDiscoveryParams): DiscoveredTarget[] {
  const { toolMetadataMap, isLoading: isLoadingMetadata } = useMetadata();

  const discoveredTargets = useMemo(() => {
    if (isLoadingMetadata) {
      return [];
    }

    const outputDetails = currentToolOutputConfig.transferableContent;
    if (outputDetails.dataType === 'none') {
      return [];
    }

    const allOtherTools = Object.values(toolMetadataMap).filter(
      (meta) =>
        meta.title &&
        meta.title !== toolMetadataMap[currentToolDirective]?.title
    );

    const compatibleTargets: DiscoveredTarget[] = [];

    allOtherTools.forEach((targetToolMeta: ToolMetadata) => {
      if (targetToolMeta.inputConfig.acceptsMimeTypes.length === 0) {
        return;
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

function isOutputCompatibleWithInput(
  outputDetails: ToolMetadata['outputConfig']['transferableContent'],
  targetInputConfig: InputConfig,
  selectedOutputItems?: StoredFile[]
): boolean {
  if (outputDetails.dataType === 'none') return false;

  const sourceMimeTypes: string[] = [];

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

  if (targetAccepts.length === 0) return false;

  for (const sourceMime of sourceMimeTypes) {
    for (const targetMime of targetAccepts) {
      if (mimeTypeMatches(sourceMime, targetMime)) {
        return true;
      }
    }
  }

  return false;
}

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
