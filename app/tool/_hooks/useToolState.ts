// FILE: app/tool/_hooks/useToolState.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { getDbInstance, OetDatabase } from '@/app/lib/db';
import type { StoredFile } from '@/src/types/storage';
import { safeParseState } from '@/app/lib/utils';

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

  const { addFile, updateFileBlob } = useFileLibrary();

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
          console.log(`[useToolState ${toolRoute}] LOAD: Aborted (unmounted).`);
          return;
        }
        if (file) {
          console.log(
            `[useToolState ${toolRoute}] LOAD: Found file ${file.id}, isTemporary: ${file.isTemporary}`
          );
          const loadedPersistence = file.isTemporary !== true;
          setIsPersistent(loadedPersistence);
          try {
            const stateJson = await file.blob?.text();
            console.log(
              `[useToolState ${toolRoute}] LOAD: Read blob text (length: ${stateJson?.length}):`,
              stateJson
            );
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
              `[useToolState ${toolRoute}] LOAD: Error reading blob:`,
              readError
            );
            setErrorLoadingState('Failed to read saved state.');
            setInternalState(defaultStateRef.current);
            setIsPersistent(true);
          }
        } else {
          console.log(
            `[useToolState ${toolRoute}] LOAD: No state file found. Using default:`,
            defaultStateRef.current
          );
          setInternalState(defaultStateRef.current);
          setIsPersistent(true);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
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
      console.log(`[useToolState ${toolRoute}] CLEANUP/UNMOUNT effect.`);
    };
  }, [stateFileId, getFile, toolRoute, defaultState]);

  const saveState = useCallback(
    async (stateToSave: T) => {
      const currentPersistenceFlag = isPersistentRef.current;
      if (!isInitialized.current) {
        console.warn(
          `[useToolState ${toolRoute}] SAVE: Skipping save (hook not initialized yet).`
        );
        return;
      }

      const stateToSaveString = JSON.stringify(stateToSave);
      const defaultStateString = JSON.stringify(defaultStateRef.current);

      console.log(
        `[useToolState ${toolRoute}] SAVE: Comparing state to save:`,
        stateToSaveString,
        `with default:`,
        defaultStateString
      );

      let db: OetDatabase | null = null;
      try {
        db = getDbInstance();
        if (!db) throw new Error('DB instance not available for save');

        if (stateToSaveString === defaultStateString) {
          const existingFile = await db.files.get(stateFileId);
          if (existingFile) {
            console.log(
              `[useToolState ${toolRoute}] SAVE: State matches default, deleting existing file ${stateFileId}.`
            );
            await deleteFile(stateFileId);
          } else {
            console.log(
              `[useToolState ${toolRoute}] SAVE: State matches default and no file exists. No action needed.`
            );
          }
          return;
        }

        console.log(
          `[useToolState ${toolRoute}] SAVE: Saving non-default state via PUT (isPersistent: ${currentPersistenceFlag}). State:`,
          stateToSave
        );
        const stateBlob = new Blob([stateToSaveString], {
          type: 'application/json',
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
          console.log(
            `[useToolState ${toolRoute}] SAVE: Preserving existing createdAt: ${stateFileObject.createdAt}`
          );
        } else {
          console.log(
            `[useToolState ${toolRoute}] SAVE: Setting new createdAt: ${stateFileObject.createdAt}`
          );
        }

        console.log(
          `[useToolState ${toolRoute}] SAVE: Calling db.files.put with object:`,
          stateFileObject
        );
        const resultingId = await db.files.put(stateFileObject);
        console.log(
          `[useToolState ${toolRoute}] SAVE: Put operation successful for ID ${resultingId}.`
        );
      } catch (saveError) {
        console.error(
          `[useToolState ${toolRoute}] SAVE: Error saving state:`,
          saveError
        );
        setErrorLoadingState(
          `Failed to save state: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`
        );
      }
    },
    [stateFileId, toolRoute, deleteFile, getFile, addFile, updateFileBlob]
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
        const mergedState = { ...prevState, ...partialNewState };
        if (JSON.stringify(prevState) !== JSON.stringify(mergedState)) {
          console.log(
            `[useToolState ${toolRoute}] setState: State changed, triggering debounced save with:`,
            mergedState
          );
          debouncedSaveState(mergedState);
        } else {

        }
        return mergedState;
      });
    },
    [debouncedSaveState, toolRoute]
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

      await saveState(internalState);
    } catch (err) {
      console.error(
        `[useToolState ${toolRoute}] TOGGLE: Error during saveState after toggle:`,
        err
      );
      setErrorLoadingState('Failed to update persistence setting.');
      setIsPersistent(!newPersistenceFlag);
    }
  }, [isLoadingState, saveState, toolRoute, internalState, debouncedSaveState]);

  const clearState = useCallback(async () => {
    if (isLoadingState) return;
    debouncedSaveState.cancel();
    console.log(`[useToolState ${toolRoute}] CLEAR: Clearing state.`);
    setInternalState(defaultStateRef.current);
    setIsPersistent(true);
    setErrorLoadingState(null);
    try {
      await deleteFile(stateFileId).catch((err) => {
        console.warn(
          `[useToolState ${toolRoute}] CLEAR: Delete file error (maybe ok if not found):`,
          err
        );
      });
    } catch (err) {
      console.error(
        `[useToolState ${toolRoute}] CLEAR: Unexpected error:`,
        err
      );
      setErrorLoadingState('Failed to clear saved state.');
    }
  }, [
    isLoadingState,
    stateFileId,
    deleteFile,
    toolRoute,
    /* defaultStateRef */ debouncedSaveState,
  ]);

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
