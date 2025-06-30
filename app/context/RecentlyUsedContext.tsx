// --- FILE: app/context/RecentlyUsedContext.tsx ---
'use client';

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
  ReactNode,
} from 'react';
import { getDbInstance } from '../lib/db';
import { useMetadata } from './MetadataContext';
import { liveQuery, Subscription } from 'dexie';
import { getDisplayInfoForFilePreview } from '@/app/lib/utils';
import type { StateFile } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';

import { directivePreviewFunctions } from '@/app/lib/directives';

export interface RecentToolEntry {
  directive: string;
  title: string;
  lastModified: Date;
  previewType:
    | 'image'
    | 'icon'
    | 'empty'
    | 'none'
    | 'custom_emoji'
    | 'raw_text'
    | 'text_snippet';
  previewSource: 'output' | 'input' | 'custom' | 'none';

  previewIconClassContent?: string;
  previewImageId?: string;
  previewText?: string;

  displayableItemName?: string;
  itemMimeType?: string;
}

interface RecentlyUsedContextValue {
  recentTools: RecentToolEntry[];
  isLoaded: boolean;
}

const RecentlyUsedContext = createContext<RecentlyUsedContextValue | undefined>(
  undefined
);

export const useRecentlyUsed = () => {
  const context = useContext(RecentlyUsedContext);
  if (!context) {
    throw new Error(
      'useRecentlyUsed must be used within a RecentlyUsedProvider'
    );
  }
  return context;
};

function extractFileIdsFromState(
  state: Record<string, unknown> | null,
  config: StateFile | { stateKey: string; arrayStateKey?: string } | undefined
): string[] {
  const ids: string[] = [];
  if (!config || !config.stateKey || !state) return ids;

  const { stateKey, arrayStateKey } = config;

  if (arrayStateKey) {
    const arrOfObjects = state[arrayStateKey] as unknown[];
    if (Array.isArray(arrOfObjects)) {
      arrOfObjects.forEach((itemObj) => {
        if (
          itemObj &&
          typeof itemObj === 'object' &&
          (itemObj as Record<string, unknown>)[stateKey]
        ) {
          const idValue = (itemObj as Record<string, unknown>)[stateKey];
          if (typeof idValue === 'string') ids.push(idValue);
          else if (Array.isArray(idValue)) {
            ids.push(
              ...idValue.filter((id): id is string => typeof id === 'string')
            );
          }
        }
      });
    }
  } else {
    const idValue = state[stateKey];
    if (typeof idValue === 'string') ids.push(idValue);
    else if (Array.isArray(idValue)) {
      ids.push(...idValue.filter((id): id is string => typeof id === 'string'));
    }
  }
  return [...new Set(ids)];
}

interface RecentlyUsedProviderProps {
  children: ReactNode;
}

export const RecentlyUsedProvider = ({
  children,
}: RecentlyUsedProviderProps) => {
  const [recentTools, setRecentTools] = useState<RecentToolEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const { getToolMetadata, isLoading: isLoadingMetadata } = useMetadata();

  useEffect(() => {
    if (isLoadingMetadata) {
      return;
    }

    const db = getDbInstance();
    let subscription: Subscription | undefined;

    try {
      const observable = liveQuery(async () => {
        const toolStateFilesFromDb = await db.files
          .where('type')
          .equals('application/x-oet-tool-state+json')
          .sortBy('lastModified');

        const processedEntries: RecentToolEntry[] = [];
        const uniqueDirectivesProcessed = new Set<string>();

        for (let i = toolStateFilesFromDb.length - 1; i >= 0; i--) {
          const stateFile = toolStateFilesFromDb[i];
          if (!stateFile.toolRoute || !stateFile.blob) continue;

          const directive = stateFile.toolRoute.split('/').pop();
          if (!directive || uniqueDirectivesProcessed.has(directive)) continue;

          uniqueDirectivesProcessed.add(directive);

          const metadata = getToolMetadata(directive);
          if (!metadata) {
            continue;
          }

          let toolCurrentState: Record<string, unknown>;
          try {
            const stateJson = await stateFile.blob.text();
            toolCurrentState = JSON.parse(stateJson) as Record<string, unknown>;
          } catch (e) {
            console.error(
              `[RecentlyUsedCtx] Error parsing state for ${directive}:`,
              e
            );
            continue;
          }

          const entry: Partial<RecentToolEntry> = {
            directive: directive,
            title: metadata.title,
            lastModified: stateFile.lastModified || stateFile.createdAt,
            previewType: 'none',
            previewSource: 'none',
          };
          let previewDetermined = false;

          const customPreviewFunction = directivePreviewFunctions[directive];
          if (customPreviewFunction) {
            try {
              const customPreviewDetails = customPreviewFunction(
                toolCurrentState,
                metadata
              );
              if (
                customPreviewDetails &&
                customPreviewDetails.previewType &&
                customPreviewDetails.previewType !== 'none'
              ) {
                Object.assign(entry, customPreviewDetails);
                if (!entry.previewSource) entry.previewSource = 'custom';
                previewDetermined = true;
              }
            } catch (customPreviewError) {
              console.error(
                `[RecentlyUsedCtx] Error in custom preview function for ${directive}:`,
                customPreviewError
              );
            }
          }

          if (
            !previewDetermined &&
            metadata.outputConfig?.transferableContent !== 'none'
          ) {
            for (const outDef of metadata.outputConfig.transferableContent ||
              []) {
              if (previewDetermined) break;
              if (outDef.dataType === 'reference') {
                const fileIds = extractFileIdsFromState(
                  toolCurrentState,
                  outDef
                );
                if (fileIds.length > 0) {
                  const firstFileId = fileIds[0];
                  const refFile = (await db.files.get(firstFileId)) as
                    | StoredFile
                    | undefined;
                  if (refFile) {
                    entry.itemMimeType = refFile.type;
                    const displayInfo = getDisplayInfoForFilePreview(refFile);
                    entry.displayableItemName = displayInfo.displayName;
                    if (refFile.type?.startsWith('image/')) {
                      entry.previewType = 'image';
                      entry.previewImageId = refFile.id;
                    } else {
                      entry.previewType = 'icon';
                      entry.previewIconClassContent = displayInfo.iconName;
                    }
                    entry.previewSource = 'output';
                    previewDetermined = true;
                  }
                }
              } else if (outDef.dataType === 'inline') {
                const inlineVal = toolCurrentState[outDef.stateKey] as
                  | string
                  | undefined;
                if (typeof inlineVal === 'string' && inlineVal.trim() !== '') {
                  entry.itemMimeType = outDef.mimeType;
                  const displayInfo = getDisplayInfoForFilePreview(
                    outDef.mimeType,
                    `output_from_${directive}`
                  );
                  entry.previewType = 'icon';
                  entry.previewIconClassContent = displayInfo.iconName;
                  entry.displayableItemName = displayInfo.displayName;
                  entry.previewSource = 'output';
                  previewDetermined = true;
                } else if (
                  typeof inlineVal === 'string' &&
                  inlineVal.trim() === ''
                ) {
                  entry.previewType = 'empty';
                  entry.previewSource = 'output';
                  previewDetermined = true;
                }
              }
            }
          }

          if (
            !previewDetermined &&
            metadata.inputConfig?.stateFiles &&
            metadata.inputConfig.stateFiles !== 'none'
          ) {
            const stateFilesConfig = metadata.inputConfig.stateFiles;

            if (Array.isArray(stateFilesConfig)) {
              for (const inDef of stateFilesConfig) {
                if (previewDetermined) break;

                const fileIds = extractFileIdsFromState(
                  toolCurrentState,
                  inDef
                );

                if (fileIds.length > 0) {
                  const firstFileId = fileIds[0];

                  const refFile = (await db.files.get(firstFileId)) as
                    | StoredFile
                    | undefined;

                  if (refFile) {
                    entry.itemMimeType = refFile.type;
                    const displayInfo = getDisplayInfoForFilePreview(refFile);
                    entry.displayableItemName = displayInfo.displayName;
                    if (refFile.type?.startsWith('image/')) {
                      entry.previewType = 'image';
                      entry.previewImageId = refFile.id;
                    } else {
                      entry.previewType = 'icon';
                      entry.previewIconClassContent = displayInfo.iconName;
                    }
                    entry.previewSource = 'input';
                    previewDetermined = true;
                  }
                }
              }
            }
          }

          if (
            previewDetermined &&
            entry.previewType &&
            entry.previewType !== 'none' &&
            entry.previewType !== 'empty'
          ) {
            processedEntries.push(entry as RecentToolEntry);
          } else {
            if (entry.previewType === 'empty') {
              console.log(
                `[RecentlyUsedCtx] Tool ${directive} is recent but primary content is empty. Not adding to display list.`
              );
            } else if (
              entry.previewType === 'none' &&
              !previewDetermined &&
              directivePreviewFunctions[directive]
            ) {
              console.log(
                `[RecentlyUsedCtx] Custom preview for ${directive} returned no actionable preview. Not adding.`
              );
            }
          }
        }
        return processedEntries;
      });

      subscription = observable.subscribe({
        next: (updatedRecentToolsWithPreview) => {
          setRecentTools(updatedRecentToolsWithPreview);
          if (!isLoaded) {
            setIsLoaded(true);
          }
        },
        error: (err) => {
          console.error('[RecentlyUsedCtx] LiveQuery subscription error:', err);
          setRecentTools([]);
          if (!isLoaded) setIsLoaded(true);
        },
      });
      console.log('[RecentlyUsedCtx] LiveQuery subscription established.');
    } catch (error) {
      console.error('[RecentlyUsedCtx] Error setting up LiveQuery:', error);
      setIsLoaded(true);
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [isLoadingMetadata, getToolMetadata, isLoaded]);

  const value = useMemo(
    () => ({
      recentTools,
      isLoaded,
    }),
    [recentTools, isLoaded]
  );

  return (
    <RecentlyUsedContext.Provider value={value}>
      {children}
    </RecentlyUsedContext.Provider>
  );
};
