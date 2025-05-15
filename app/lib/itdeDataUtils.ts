// FILE: app/lib/itdeDataUtils.ts
import { getDbInstance } from './db';
import type {
  OutputConfig,
  TransferableOutputDetails,
} from '@/src/types/tools';
import type { StoredFile as AppStoredFile } from '@/src/types/storage';

export interface ResolvedItdeData {
  type: TransferableOutputDetails['dataType'] | 'error';
  data?:
    | AppStoredFile
    | AppStoredFile[]
    | string
    | Record<string, unknown>
    | null;
  errorMessage?: string;
}

/**
 * Resolves the actual output data object(s) from a source tool.
 * For 'fileReference', returns the StoredFile object.
 * For 'selectionReferenceList', returns an array of StoredFile objects.
 * For 'text' or 'jsonObject', returns the string or object directly.
 *
 * @param sourceDirective - The directive of the source tool.
 * @param sourceOutputConfig - The outputConfig object from the source tool's metadata.
 * @returns A Promise resolving to ResolvedItdeData.
 */
export async function resolveItdeData(
  sourceDirective: string,
  sourceOutputConfig: OutputConfig
): Promise<ResolvedItdeData> {
  const db = getDbInstance();
  const outputDetails = sourceOutputConfig.transferableContent;
  const stateFileId = `state-/tool/${sourceDirective}`;

  console.log(
    `[ITDEDataResolver] Phase 2b: Resolving full data for source: ${sourceDirective}, outputType: ${outputDetails.dataType}`
  );

  try {
    const sourceStateFile = await db.files.get(stateFileId);
    if (!sourceStateFile || !sourceStateFile.blob) {
      console.warn(
        `[ITDEDataResolver] Source state file not found or blob missing for ${stateFileId}`
      );
      return {
        type: 'error',
        errorMessage: `Source state for '${sourceDirective}' not found.`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sourceState: Record<string, any>;
    try {
      const stateJson = await sourceStateFile.blob.text();
      sourceState = JSON.parse(stateJson);
    } catch (e) {
      console.error(
        `[ITDEDataResolver] Error parsing source state JSON for ${stateFileId}`,
        e
      );
      return {
        type: 'error',
        errorMessage: `Could not parse state for '${sourceDirective}'.`,
      };
    }

    console.log(
      `[ITDEDataResolver] Parsed source state for ${sourceDirective}.`
    );

    switch (outputDetails.dataType) {
      case 'fileReference':
        if (
          outputDetails.fileIdStateKey &&
          sourceState[outputDetails.fileIdStateKey]
        ) {
          const fileId = sourceState[outputDetails.fileIdStateKey] as string;
          if (!fileId) {
            console.warn(
              `[ITDEDataResolver] File ID is null or empty in source state for key: ${outputDetails.fileIdStateKey}`
            );
            return {
              type: 'error',
              errorMessage: `No valid file ID found for output key '${outputDetails.fileIdStateKey}'.`,
            };
          }
          console.log(
            `[ITDEDataResolver] Found fileId: ${fileId} from stateKey: ${outputDetails.fileIdStateKey}. Fetching StoredFile...`
          );
          const actualFile = await db.files.get(fileId);
          if (actualFile) {
            console.log(
              `[ITDEDataResolver] Successfully fetched StoredFile: ${actualFile.name}`
            );
            return { type: 'fileReference', data: actualFile as AppStoredFile };
          } else {
            console.warn(
              `[ITDEDataResolver] StoredFile object not found in DB for ID: ${fileId}`
            );
            return {
              type: 'error',
              errorMessage: `Output file (ID: ${fileId}) not found in library.`,
            };
          }
        }
        console.warn(
          `[ITDEDataResolver] fileIdStateKey '${outputDetails.fileIdStateKey}' not found in source state or is null/undefined.`
        );
        return {
          type: 'error',
          errorMessage: `Output file ID key '${outputDetails.fileIdStateKey}' not found in source state.`,
        };

      case 'selectionReferenceList':
        if (
          outputDetails.selectionStateKey &&
          Array.isArray(sourceState[outputDetails.selectionStateKey])
        ) {
          const idList = sourceState[
            outputDetails.selectionStateKey
          ] as string[];
          if (idList.length === 0) {
            console.log(
              `[ITDEDataResolver] selectionStateKey '${outputDetails.selectionStateKey}' contained an empty list of IDs.`
            );
            return { type: 'selectionReferenceList', data: [] };
          }
          console.log(
            `[ITDEDataResolver] Found selection ID list from stateKey: ${outputDetails.selectionStateKey}. Fetching ${idList.length} StoredFile(s)...`,
            idList
          );
          const fetchedFiles: AppStoredFile[] = [];
          for (const id of idList) {
            if (!id) {
              console.warn(
                `[ITDEDataResolver] Encountered null or empty ID in selection list for key '${outputDetails.selectionStateKey}'. Skipping.`
              );
              continue;
            }
            const file = await db.files.get(id);
            if (file) {
              fetchedFiles.push(file as AppStoredFile);
            } else {
              console.warn(
                `[ITDEDataResolver] StoredFile object not found in DB for ID: ${id} during selection list processing.`
              );
            }
          }
          console.log(
            `[ITDEDataResolver] Successfully fetched ${fetchedFiles.length} StoredFile(s) for selection list.`
          );
          return { type: 'selectionReferenceList', data: fetchedFiles };
        }
        console.warn(
          `[ITDEDataResolver] selectionStateKey '${outputDetails.selectionStateKey}' not found or not an array in source state.`
        );
        return {
          type: 'error',
          errorMessage: `Output selection key '${outputDetails.selectionStateKey}' not found in source state.`,
        };

      case 'text':
        if (
          outputDetails.textStateKey &&
          typeof sourceState[outputDetails.textStateKey] !== 'undefined'
        ) {
          const textData = String(sourceState[outputDetails.textStateKey]);
          console.log(
            `[ITDEDataResolver] Resolved text data (length: ${textData.length}) from stateKey: ${outputDetails.textStateKey}`
          );
          return { type: 'text', data: textData };
        }
        console.warn(
          `[ITDEDataResolver] textStateKey '${outputDetails.textStateKey}' not found in source state.`
        );
        return {
          type: 'error',
          errorMessage: `Output text key '${outputDetails.textStateKey}' not found in source state.`,
        };

      case 'jsonObject':
        if (
          outputDetails.jsonStateKey &&
          typeof sourceState[outputDetails.jsonStateKey] === 'object' &&
          sourceState[outputDetails.jsonStateKey] !== null
        ) {
          const jsonData = sourceState[outputDetails.jsonStateKey] as Record<
            string,
            unknown
          >;
          console.log(
            `[ITDEDataResolver] Resolved JSON object from stateKey: ${outputDetails.jsonStateKey}`
          );
          return { type: 'jsonObject', data: jsonData };
        }
        console.warn(
          `[ITDEDataResolver] jsonStateKey '${outputDetails.jsonStateKey}' not found or not an object in source state.`
        );
        return {
          type: 'error',
          errorMessage: `Output JSON key '${outputDetails.jsonStateKey}' not found in source state.`,
        };

      case 'none':
        console.log(
          `[ITDEDataResolver] Source tool has dataType 'none'. No data to resolve.`
        );
        return { type: 'none', data: null };

      default:
        const exhaustiveCheck: never = outputDetails;
        console.warn(
          `[ITDEDataResolver] Unhandled dataType in sourceOutputConfig: ${JSON.stringify(exhaustiveCheck)}`
        );
        return { type: 'error', errorMessage: `Unhandled output data type.` };
    }
  } catch (error) {
    console.error(
      `[ITDEDataResolver] General error resolving data for ${sourceDirective}:`,
      error
    );
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown error during data resolution.';
    return {
      type: 'error',
      errorMessage:
        `Failed to resolve data from '${sourceDirective}'. ${message}`.trim(),
    };
  }
}
