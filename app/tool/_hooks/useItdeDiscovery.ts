// FILE: app/tool/_hooks/useItdeDiscovery.ts
'use client';

import { useMemo } from 'react';
import { useMetadata } from '@/app/context/MetadataContext';
import type {
  ToolMetadata,
  OutputConfig,
  InlineDetails,
  DiscoveredTarget,
} from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';

interface UseItdeDiscoveryParams {
  currentToolDirective: string;
  currentToolOutputConfig: OutputConfig;

  selectedOutputItems?: StoredFile[];
}

function mimeTypeMatches(
  sourceMime: string,
  targetAcceptsMime: string
): boolean {
  if (targetAcceptsMime === '*/*' || sourceMime === '*/*') return true;
  if (targetAcceptsMime === sourceMime) return true;

  const [sourceType, sourceSubtype] = sourceMime.split('/');
  const [targetType, targetSubtype] = targetAcceptsMime.split('/');

  if (
    sourceType === targetType &&
    (targetSubtype === '*' || targetSubtype === sourceSubtype)
  ) {
    return true;
  }
  return false;
}

export default function useItdeDiscovery({
  currentToolDirective,
  currentToolOutputConfig,
  selectedOutputItems,
}: UseItdeDiscoveryParams): DiscoveredTarget[] {
  const { toolMetadataMap, isLoading: isLoadingMetadata } = useMetadata();

  const discoveredTargets = useMemo(() => {
    if (isLoadingMetadata || !currentToolOutputConfig) {
      return [];
    }

    const transferableContent = currentToolOutputConfig.transferableContent;
    if (transferableContent === 'none' || transferableContent.length === 0) {
      return [];
    }

    const allOtherToolsMetadata: ToolMetadata[] = Object.values(
      toolMetadataMap
    ).filter((meta) => meta.directive !== currentToolDirective);

    const compatibleTargetsMap = new Map<string, DiscoveredTarget>();

    transferableContent.forEach((outputItem) => {
      const sourceMimeTypes: string[] = [];

      if (outputItem.dataType === 'inline') {
        const inlineDetails = outputItem as InlineDetails;
        if (inlineDetails.mimeType) {
          sourceMimeTypes.push(inlineDetails.mimeType);
        }
      } else if (outputItem.dataType === 'reference') {

        if (selectedOutputItems && selectedOutputItems.length > 0) {
          selectedOutputItems.forEach((file) => {
            if (file.type && !sourceMimeTypes.includes(file.type)) {
              sourceMimeTypes.push(file.type);
            }
          });
        }

      }

      if (sourceMimeTypes.length === 0) {

        if (
          outputItem.dataType === 'reference' &&
          (!selectedOutputItems || selectedOutputItems.length === 0)
        ) {
          sourceMimeTypes.push('*/*');
        } else if (sourceMimeTypes.length === 0) {

          return;
        }
      }

      allOtherToolsMetadata.forEach((targetToolMeta) => {
        if (
          !targetToolMeta.inputConfig ||
          compatibleTargetsMap.has(targetToolMeta.directive)
        ) {
          return;
        }

        const targetAcceptsMimeTypes =
          targetToolMeta.inputConfig.acceptsMimeTypes;
        if (!targetAcceptsMimeTypes || targetAcceptsMimeTypes.length === 0) {
          return;
        }

        for (const sMime of sourceMimeTypes) {
          for (const tAcceptsMime of targetAcceptsMimeTypes) {
            if (mimeTypeMatches(sMime, tAcceptsMime)) {
              compatibleTargetsMap.set(targetToolMeta.directive, {
                directive: targetToolMeta.directive,
                title: targetToolMeta.title,
                description:
                  targetToolMeta.description || 'No description available.',
                route: `/tool/${targetToolMeta.directive}/`,
              });
              return;
            }
          }
        }
      });
    });

    const finalTargets = Array.from(compatibleTargetsMap.values());
    finalTargets.sort((a, b) => a.title.localeCompare(b.title));
    return finalTargets;
  }, [
    isLoadingMetadata,
    currentToolOutputConfig,
    toolMetadataMap,
    currentToolDirective,
    selectedOutputItems,
  ]);

  return discoveredTargets;
}
