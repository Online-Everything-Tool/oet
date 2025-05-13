// --- FILE: app/tool/_hooks/useToolState.ts --- [MODIFIED FOR DEBUGGING]
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { getDbInstance, OetDatabase } from '@/app/lib/db';
import type { StoredFile } from '@/src/types/storage';
import { safeParseState } from '@/app/lib/utils';
import Dexie from 'dexie';

const SAVE_DEBOUNCE_MS = 1500;

export interface UseToolStateReturn<T> {
  state: T;
  setState: (newState: Partial<T> | ((prevState: T) => Partial<T>)) => void;
  saveState: (stateToSave: T) => Promise<void>;
  isLoadingState: boolean;
  isPersistent: boolean;
  togglePersistence: () => Promise<void>;
  clearState: () => Promise<void>;
  errorLoadingState: string | null;
}

export default function useToolState<T extends object>(
  toolRoute: string,
  defaultState: T
): UseToolStateReturn<T> {
  const { getFile, deleteFile } = useFileLibrary();

  const [internalState, setInternalState] = useState<T>(defaultState);
  const [isLoadingState, setIsLoadingState] = useState<boolean>(true);
  const [isPersistent, setIsPersistent] = useState<boolean>(true);
  const [stateFileId] = useState<string>(`state-${toolRoute}`);
  const [errorLoadingState, setErrorLoadingState] = useState<string | null>(
    null
  );
  const isInitialized = useRef(false);
  const isPersistentRef = useRef(isPersistent);
  const defaultStateRef = useRef(defaultState);

  useEffect(() => {
    defaultStateRef.current = defaultState;
  }, [defaultState]);
  useEffect(() => {
    isPersistentRef.current = isPersistent;
  }, [isPersistent]);

  useEffect(() => {
    let isMounted = true;
    isInitialized.current = false;
    console.log(
      `[useToolState ${toolRoute}] MOUNT/LOAD EFFECT: Starting load run...`
    );
    setErrorLoadingState(null);
    setIsLoadingState(true);

    getFile(stateFileId)
      .then(async (file) => {
        if (!isMounted) {
          console.log(
            `[useToolState ${toolRoute}] LOAD: Aborted (unmounted during getFile).`
          );
          return;
        }
        if (file) {
          console.log(
            `[useToolState ${toolRoute}] LOAD: Found file ${file.id}, isTemporary: ${file.isTemporary}, type: ${file.type}`
          );

          if (file.type !== 'application/x-oet-tool-state+json') {
            console.warn(
              `[useToolState ${toolRoute}] LOAD: Found file with ID ${stateFileId}, but type is incorrect ('${file.type}'). Ignoring.`
            );
            setInternalState(defaultStateRef.current);
            setIsPersistent(true);
            return;
          }

          const loadedPersistence = file.isTemporary !== true;
          setIsPersistent(loadedPersistence);
          try {
            const stateJson = await file.blob?.text();

            console.log(
              `[useToolState ${toolRoute}] LOAD: Raw blob text read (length: ${stateJson?.length}):\n${stateJson}`
            );

            if (stateJson === undefined || stateJson === null) {
              console.warn(
                `[useToolState ${toolRoute}] LOAD: Blob text was undefined/null.`
              );
              throw new Error('Blob content missing');
            }
            const loadedState = safeParseState(
              stateJson,
              defaultStateRef.current
            );
            console.log(
              `[useToolState ${toolRoute}] LOAD: Parsed state:`,
              loadedState
            );
            setInternalState(loadedState);
          } catch (readError) {
            console.error(
              `[useToolState ${toolRoute}] LOAD: Error reading/parsing blob:`,
              readError
            );
            setErrorLoadingState(
              `Failed to read saved state: ${readError instanceof Error ? readError.message : 'Unknown error'}`
            );
            setInternalState(defaultStateRef.current);
            setIsPersistent(true);
          }
        } else {
          console.log(
            `[useToolState ${toolRoute}] LOAD: No state file found (ID: ${stateFileId}). Using default.`
          );
          setInternalState(defaultStateRef.current);
          setIsPersistent(true);
        }
      })
      .catch((err) => {
        if (!isMounted) {
          console.log(
            `[useToolState ${toolRoute}] LOAD: Aborted (unmounted during getFile catch).`
          );
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Unknown DB error during load';
        console.error(
          `[useToolState ${toolRoute}] LOAD: Error calling getFile:`,
          err
        );
        setErrorLoadingState(`Error loading saved state: ${message}`);
        setInternalState(defaultStateRef.current);
        setIsPersistent(true);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingState(false);
          isInitialized.current = true;
          console.log(
            `[useToolState ${toolRoute}] LOAD: Effect run finished. isInitialized=${isInitialized.current}. isPersistent=${isPersistentRef.current}`
          );
        } else {
          console.log(
            `[useToolState ${toolRoute}] LOAD: Finally block on unmounted component.`
          );
        }
      });

    return () => {
      isMounted = false;
      console.log(`[useToolState ${toolRoute}] CLEANUP/UNMOUNT load effect.`);
    };
  }, [stateFileId, getFile, toolRoute]);

  const saveState = useCallback(
    async (stateToSave: T) => {
      const currentPersistenceFlag = isPersistentRef.current;

      if (!isInitialized.current) {
        console.warn(
          `[useToolState ${toolRoute}] SAVE: Skipping save (hook not initialized yet).`
        );
        return;
      }

      try {
        console.log(
          `[useToolState ${toolRoute}] SAVE: State object about to be stringified (isPersistent=${currentPersistenceFlag}):`,
          JSON.parse(JSON.stringify(stateToSave))
        );
      } catch (logError) {
        console.warn(
          `[useToolState ${toolRoute}] SAVE: Could not deep-clone state for logging`,
          logError
        );
        console.log(
          `[useToolState ${toolRoute}] SAVE: State object reference (may be mutated):`,
          stateToSave
        );
      }

      const stateToSaveString = JSON.stringify(stateToSave);
      const defaultStateString = JSON.stringify(defaultStateRef.current);

      try {
        const db: OetDatabase | null = getDbInstance();
        if (!db) throw new Error('DB instance not available for save');

        if (stateToSaveString === defaultStateString) {
          const existingFile = await db.files.get(stateFileId);
          if (existingFile) {
            console.log(
              `[useToolState ${toolRoute}] SAVE: State matches default, deleting existing file ${stateFileId}.`
            );
            await deleteFile(stateFileId);
          } else {
          }
          return;
        }

        console.log(
          `[useToolState ${toolRoute}] SAVE: Saving non-default state via PUT (isPersistent=${currentPersistenceFlag}).`
        );
        const stateBlob = new Blob([stateToSaveString], {
          type: 'application/x-oet-tool-state+json',
        });
        const stateName = `State: ${toolRoute.split('/tool/')[1]?.replace(/\/$/, '') || 'unknown'}`;
        const targetIsTemporary = !currentPersistenceFlag;
        const now = new Date();

        const stateFileObject: StoredFile = {
          id: stateFileId,
          name: stateName,
          type: 'application/x-oet-tool-state+json',
          size: stateBlob.size,
          blob: stateBlob,
          isTemporary: targetIsTemporary,
          toolRoute: toolRoute,
          createdAt: now,
          lastModified: now,
        };

        const existingFile = await db.files.get(stateFileId);
        if (existingFile?.createdAt) {
          stateFileObject.createdAt = existingFile.createdAt;
        } else {
        }

        await db.files.put(stateFileObject);
      } catch (saveError) {
        console.error(
          `[useToolState ${toolRoute}] SAVE: Error saving state:`,
          saveError
        );

        if (!errorLoadingState) {
          setErrorLoadingState(
            `Failed to save state: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`
          );
        }
      }
    },
    [stateFileId, toolRoute, deleteFile, errorLoadingState]
  );

  const debouncedSaveState = useDebouncedCallback((currentState: T) => {
    saveState(currentState);
  }, SAVE_DEBOUNCE_MS);

  const setState = useCallback(
    (newStateOrFn: Partial<T> | ((prevState: T) => Partial<T>)) => {
      setInternalState((prevState) => {
        const partialNewState =
          typeof newStateOrFn === 'function'
            ? newStateOrFn(prevState)
            : newStateOrFn;

        if (Object.keys(partialNewState || {}).length === 0) {
          return prevState;
        }
        const mergedState = { ...prevState, ...partialNewState };

        if (JSON.stringify(prevState) !== JSON.stringify(mergedState)) {
          debouncedSaveState(mergedState);
          return mergedState;
        } else {
          return prevState;
        }
      });
    },
    [debouncedSaveState]
  );

  const togglePersistence = useCallback(async () => {
    if (isLoadingState) {
      console.warn(
        `[useToolState ${toolRoute}] TOGGLE: Skipping toggle, still loading state.`
      );
      return;
    }
    const newPersistenceFlag = !isPersistentRef.current;
    setIsPersistent(newPersistenceFlag);

    console.log(
      `[useToolState ${toolRoute}] TOGGLE: Toggling persistence to ${newPersistenceFlag}. Triggering immediate save.`
    );
    debouncedSaveState.cancel();

    try {
      isPersistentRef.current = newPersistenceFlag;
      await saveState(internalState);
    } catch (err) {
      console.error(
        `[useToolState ${toolRoute}] TOGGLE: Error during saveState after toggle:`,
        err
      );
      setErrorLoadingState('Failed to update persistence setting.');

      setIsPersistent(!newPersistenceFlag);
      isPersistentRef.current = !newPersistenceFlag;
    }
  }, [isLoadingState, saveState, toolRoute, internalState, debouncedSaveState]);

  const clearState = useCallback(async () => {
    if (isLoadingState) return;
    debouncedSaveState.cancel();
    console.log(`[useToolState ${toolRoute}] CLEAR: Clearing state.`);
    setInternalState(defaultStateRef.current);
    setIsPersistent(true);
    isPersistentRef.current = true;
    setErrorLoadingState(null);
    try {
      await deleteFile(stateFileId).catch((err) => {
        if (
          !(
            err instanceof Dexie.ModifyError &&
            err.failures.length > 0 &&
            err.failures[0].name === 'NotFoundError'
          )
        ) {
          console.warn(
            `[useToolState ${toolRoute}] CLEAR: Delete file error (maybe ok if not found):`,
            err
          );
        }
      });
    } catch (err) {
      console.error(
        `[useToolState ${toolRoute}] CLEAR: Unexpected error during delete:`,
        err
      );
      setErrorLoadingState('Failed to clear saved state.');
    }
  }, [isLoadingState, stateFileId, deleteFile, toolRoute, debouncedSaveState]);

  return {
    state: internalState,
    setState,
    saveState,
    isLoadingState,
    isPersistent,
    togglePersistence,
    clearState,
    errorLoadingState,
  };
}
