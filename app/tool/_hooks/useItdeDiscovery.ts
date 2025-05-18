// FILE: app/tool/_hooks/useItdeDiscovery.ts
'use client';

import { useMemo } from 'react';
import { useMetadata } from '@/app/context/MetadataContext';
import type {
  ToolMetadata,
  OutputConfig,
  InlineDetails,
  DiscoveredTarget,
  ReferenceDetails,
} from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';

interface UseItdeDiscoveryParams {
  currentToolDirective: string;
  currentToolOutputConfig: OutputConfig;
  selectedOutputItems?: StoredFile[];
}

interface EffectiveSourceOutputItem {
  definition: InlineDetails | ReferenceDetails;
  actualMimeTypes: Set<string>;
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
    if (isLoadingMetadata || !currentToolOutputConfig) return [];

    const sourceOutputDefinitionItems =
      currentToolOutputConfig.transferableContent;
    if (
      sourceOutputDefinitionItems === 'none' ||
      sourceOutputDefinitionItems.length === 0
    )
      return [];

    const effectiveSourceOutputItems: EffectiveSourceOutputItem[] = [];
    for (const sourceOutputDef of sourceOutputDefinitionItems) {
      const uniqueSourceMimeTypes = new Set<string>();
      if (sourceOutputDef.dataType === 'inline') {
        uniqueSourceMimeTypes.add((sourceOutputDef as InlineDetails).mimeType);
      } else if (sourceOutputDef.dataType === 'reference') {
        if (selectedOutputItems && selectedOutputItems.length > 0) {
          selectedOutputItems.forEach((file) => {
            if (file.type) uniqueSourceMimeTypes.add(file.type);
          });
        }
      }

      if (uniqueSourceMimeTypes.size === 0) {
        return [];
      }
      effectiveSourceOutputItems.push({
        definition: sourceOutputDef,
        actualMimeTypes: uniqueSourceMimeTypes,
      });
    }

    if (
      effectiveSourceOutputItems.length === 0 &&
      sourceOutputDefinitionItems.length > 0
    ) {
      return [];
    }

    const allOtherToolsMetadata: ToolMetadata[] = Object.values(
      toolMetadataMap
    ).filter((meta) => meta.directive !== currentToolDirective);
    const compatibleTargets: DiscoveredTarget[] = [];

    allOtherToolsMetadata.forEach((targetToolMeta) => {
      if (!targetToolMeta.inputConfig?.acceptsMimeTypes?.length) return;

      let targetCanAcceptAllEffectiveSourceItems = true;

      for (const effectiveSourceItem of effectiveSourceOutputItems) {
        if (effectiveSourceItem.definition.dataType === 'inline') {
          const sMime = Array.from(effectiveSourceItem.actualMimeTypes)[0];
          let accepted = false;
          for (const tAcceptsMime of targetToolMeta.inputConfig
            .acceptsMimeTypes) {
            if (mimeTypeMatches(sMime, tAcceptsMime)) {
              accepted = true;
              break;
            }
          }
          if (!accepted) {
            targetCanAcceptAllEffectiveSourceItems = false;
            break;
          }
        } else if (effectiveSourceItem.definition.dataType === 'reference') {
          for (const sMime of Array.from(effectiveSourceItem.actualMimeTypes)) {
            let thisSpecificSelectedMimeTypeIsAccepted = false;
            for (const tAcceptsMime of targetToolMeta.inputConfig
              .acceptsMimeTypes) {
              if (mimeTypeMatches(sMime, tAcceptsMime)) {
                thisSpecificSelectedMimeTypeIsAccepted = true;
                break;
              }
            }
            if (!thisSpecificSelectedMimeTypeIsAccepted) {
              targetCanAcceptAllEffectiveSourceItems = false;
              break;
            }
          }
          if (!targetCanAcceptAllEffectiveSourceItems) {
            break;
          }
        }
      }

      if (targetCanAcceptAllEffectiveSourceItems) {
        compatibleTargets.push({
          directive: targetToolMeta.directive,
          title: targetToolMeta.title,
          description:
            targetToolMeta.description || 'No description available.',
          route: `/tool/${targetToolMeta.directive}/`,
        });
      }
    });

    compatibleTargets.sort((a, b) => a.title.localeCompare(b.title));
    return compatibleTargets;
  }, [
    isLoadingMetadata,
    currentToolOutputConfig,
    toolMetadataMap,
    currentToolDirective,
    selectedOutputItems,
  ]);

  return discoveredTargets;
}
