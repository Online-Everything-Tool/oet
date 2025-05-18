// FILE: app/lib/itdeDataUtils.ts
import { getDbInstance } from './db';
import type {
  OutputConfig,
  ReferenceDetails,
  InlineDetails,
} from '@/src/types/tools';
import type { StoredFile, InlineFile } from '@/src/types/storage';

export interface ResolvedItdeData {
  type: 'itemList' | 'none' | 'error';
  data?: (StoredFile | InlineFile)[] | null;
  errorMessage?: string;
}

export async function resolveItdeData(
  sourceDirective: string,
  sourceOutputConfig: OutputConfig
): Promise<ResolvedItdeData> {
  const db = getDbInstance();
  const stateFileId = `state-/tool/${sourceDirective}`;
  const transferableContent = sourceOutputConfig.transferableContent;

  if (transferableContent === 'none' || transferableContent.length === 0) {
    return { type: 'none', data: null };
  }

  try {
    const sourceStateFile = await db.files.get(stateFileId);
    if (!sourceStateFile?.blob) {
      return {
        type: 'error',
        errorMessage: `Source state for '${sourceDirective}' not found or empty.`,
      };
    }

    // prettier-ignore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourceState = JSON.parse(await sourceStateFile.blob.text()) as Record<string, any>;
    const allResolvedItems: (StoredFile | InlineFile)[] = [];

    for (const outputItem of transferableContent) {
      if (outputItem.dataType === 'inline') {
        const inlineDetails = outputItem as InlineDetails;
        const dataValue = sourceState[inlineDetails.stateKey];
        if (typeof dataValue === 'undefined') {
          console.warn(
            `[ITDE Resolver] Inline key '${inlineDetails.stateKey}' not found in ${sourceDirective} state.`
          );
          continue;
        }
        const blob = new Blob([dataValue as BlobPart], {
          type: inlineDetails.mimeType,
        });
        allResolvedItems.push({ type: inlineDetails.mimeType, blob });
      } else if (outputItem.dataType === 'reference') {
        const refDetails = outputItem as ReferenceDetails;
        const { stateKey, arrayStateKey } = refDetails;
        const fileIdsToFetch: string[] = [];

        if (arrayStateKey) {
          const arrOfObjects = sourceState[arrayStateKey];
          if (Array.isArray(arrOfObjects)) {
            arrOfObjects.forEach((itemObj) => {
              if (itemObj && typeof itemObj === 'object' && itemObj[stateKey]) {
                const idValue = itemObj[stateKey];

                if (typeof idValue === 'string') {
                  fileIdsToFetch.push(idValue);
                } else if (Array.isArray(idValue)) {
                  idValue.forEach((id) => {
                    if (typeof id === 'string') fileIdsToFetch.push(id);
                  });
                } else {
                }
              }
            });
          } else {
            console.warn(
              `[ITDE Resolver] Ref key '${arrayStateKey}' (expected array of objects) not an array in ${sourceDirective} state.`
            );
          }
        } else {
          const valueFromState = sourceState[stateKey];
          if (typeof valueFromState === 'string') {
            fileIdsToFetch.push(valueFromState);
          } else if (Array.isArray(valueFromState)) {
            valueFromState.forEach((id) => {
              if (typeof id === 'string') fileIdsToFetch.push(id);
            });
          } else if (typeof valueFromState !== 'undefined') {
            console.warn(
              `[ITDE Resolver] Ref key '${stateKey}' (no arrayStateKey) not string or array in ${sourceDirective} state.`
            );
          } else {
            console.warn(
              `[ITDE Resolver] Ref key '${stateKey}' not found in ${sourceDirective} state.`
            );
          }
        }

        if (fileIdsToFetch.length > 0) {
          for (const id of fileIdsToFetch) {
            const file = await db.files.get(id);
            if (file) {
              allResolvedItems.push(file as StoredFile);
            } else {
              console.warn(
                `[ITDE Resolver] StoredFile (ID: ${id}) for reference output not found.`
              );
            }
          }
        }
      }
    }
    return { type: 'itemList', data: allResolvedItems };
  } catch (error) {
    console.error(
      `[ITDE Resolver] Error resolving data for ${sourceDirective}:`,
      error
    );
    return {
      type: 'error',
      errorMessage: `Failed to resolve data from '${sourceDirective}'. ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
