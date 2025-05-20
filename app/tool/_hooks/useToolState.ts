// FILE: app/tool/_hooks/useToolState.ts
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { getDbInstance } from '@/app/lib/db';
import type { StoredFile } from '@/src/types/storage';
import { safeParseState } from '@/app/lib/utils';

const SAVE_DEBOUNCE_MS = 1500;

export interface UseToolStateReturn<T> {
  state: T;
  setState: (newState: Partial<T> | ((prevState: T) => T)) => void;
  saveStateNow: (optionalNewState?: T) => Promise<void>;
  isLoadingState: boolean;
  isPersistent: boolean;
  togglePersistence: () => Promise<void>;
  clearStateAndPersist: () => Promise<void>;
  errorLoadingState: string | null;
}

export default function useToolState<T extends object>(
  toolRoute: string,
  defaultState: T
): UseToolStateReturn<T> {
  const [internalState, setInternalState] = useState<T>(defaultState);
  const internalStateRef = useRef<T>(defaultState);
  const [isLoadingState, setIsLoadingState] = useState<boolean>(true);
  const [isPersistent, setIsPersistent] = useState<boolean>(true);
  const stateFileId = useMemo(() => `state-${toolRoute}`, [toolRoute]);
  const [errorLoadingState, setErrorLoadingState] = useState<string | null>(
    null
  );

  const isInitialized = useRef(false);
  const defaultStateRef = useRef(defaultState);

  useEffect(() => {
    internalStateRef.current = internalState;
    defaultStateRef.current = defaultState;
  }, [internalState, defaultState]);

  const _saveStateToDexie = useCallback(
    async (stateToPersist: T, makeTemporary: boolean) => {
      console.log(
        `[useToolState ${toolRoute}] _saveStateToDexie called. State:`,
        stateToPersist,
        `MakeTemporary: ${makeTemporary}`
      );
      const stateToSaveString = JSON.stringify(stateToPersist);
      const defaultStateString = JSON.stringify(defaultStateRef.current);

      try {
        const db = getDbInstance();
        if (stateToSaveString === defaultStateString && !makeTemporary) {
          const existingFile = await db.files.get(stateFileId);
          if (existingFile) {
            console.log(
              `[useToolState ${toolRoute}] State matches default, deleting existing file ${stateFileId}.`
            );
            await db.files.delete(stateFileId);
          }
          setIsPersistent(true);
          return;
        }

        const stateBlob = new Blob([stateToSaveString], {
          type: 'application/x-oet-tool-state+json',
        });
        const stateName = `State: ${toolRoute.split('/').pop() || 'unknown'}`;
        const now = new Date();

        const existingFile = await db.files.get(stateFileId);
        const createdAt = existingFile?.createdAt || now;

        const stateFileObject: StoredFile = {
          id: stateFileId,
          filename: stateName,
          type: 'application/x-oet-tool-state+json',
          size: stateBlob.size,
          blob: stateBlob,
          isTemporary: makeTemporary,
          toolRoute: toolRoute,
          createdAt: createdAt,
          lastModified: now,
        };
        await db.files.put(stateFileObject);
        setIsPersistent(!makeTemporary);
        console.log(
          `[useToolState ${toolRoute}] State saved to Dexie. Temporary: ${makeTemporary}. ID: ${stateFileId}`
        );
      } catch (saveError) {
        const msg =
          saveError instanceof Error ? saveError.message : String(saveError);
        console.error(
          `[useToolState ${toolRoute}] Error saving state:`,
          msg,
          saveError
        );
        setErrorLoadingState(`Failed to save state: ${msg}`);
      }
    },
    [stateFileId, toolRoute /* defaultStateRef is stable */]
  );

  const debouncedSave = useDebouncedCallback((stateToSave: T) => {
    if (isInitialized.current) {
      _saveStateToDexie(stateToSave, !isPersistentRef.current);
    }
  }, SAVE_DEBOUNCE_MS);

  const isPersistentRef = useRef(isPersistent);
  useEffect(() => {
    isPersistentRef.current = isPersistent;
  }, [isPersistent]);

  useEffect(() => {
    let isMounted = true;
    isInitialized.current = false;
    console.log(
      `[useToolState ${toolRoute}] MOUNT/LOAD: Starting initial load.`
    );
    setErrorLoadingState(null);
    setIsLoadingState(true);

    getDbInstance()
      .files.get(stateFileId)
      .then(async (file) => {
        if (!isMounted) return;
        if (file && file.type === 'application/x-oet-tool-state+json') {
          console.log(
            `[useToolState ${toolRoute}] LOAD: Found state file. isTemporary: ${file.isTemporary}`
          );
          setIsPersistent(file.isTemporary !== true);
          try {
            const stateJson = await file.blob?.text();
            if (stateJson === undefined || stateJson === null)
              throw new Error('Blob content missing');
            const loadedState = safeParseState(
              stateJson,
              defaultStateRef.current
            );
            setInternalState(loadedState);
          } catch (readError) {
            const msg =
              readError instanceof Error
                ? readError.message
                : String(readError);
            setErrorLoadingState(`Failed to read saved state: ${msg}`);
            setInternalState(defaultStateRef.current);
            setIsPersistent(true);
          }
        } else {
          if (file)
            console.warn(
              `[useToolState ${toolRoute}] LOAD: Found file for state but type mismatch: ${file.type}. Using default.`
            );
          else
            console.log(
              `[useToolState ${toolRoute}] LOAD: No state file found. Using default.`
            );
          setInternalState(defaultStateRef.current);
          setIsPersistent(true);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorLoadingState(`Error loading state: ${msg}`);
        setInternalState(defaultStateRef.current);
        setIsPersistent(true);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingState(false);
          isInitialized.current = true;
          console.log(
            `[useToolState ${toolRoute}] LOAD: Initial load finished. isInitialized: true, isPersistent (from loaded file): ${isPersistentRef.current}`
          );
        }
      });
    return () => {
      isMounted = false;
    };
  }, [stateFileId, toolRoute]);

  const setState = useCallback(
    (newStateOrFn: Partial<T> | ((prevState: T) => T)) => {
      setInternalState((prevState) => {
        const updatedState =
          typeof newStateOrFn === 'function'
            ? newStateOrFn(prevState)
            : { ...prevState, ...newStateOrFn };

        if (JSON.stringify(prevState) !== JSON.stringify(updatedState)) {
          internalStateRef.current = updatedState;
          if (isInitialized.current) debouncedSave(updatedState);
          return updatedState;
        }
        return prevState;
      });
    },
    [debouncedSave]
  );

  const saveStateNow = useCallback(
    async (optionalNewState?: T) => {
      if (!isInitialized.current && !optionalNewState) {
        console.warn(
          `[useToolState ${toolRoute}] saveStateNow called before initialization without explicit state. Saving default.`
        );

        await _saveStateToDexie(
          defaultStateRef.current,
          !isPersistentRef.current
        );
        return;
      }
      debouncedSave.cancel();
      const stateToPersist =
        optionalNewState !== undefined
          ? optionalNewState
          : internalStateRef.current;

      if (
        optionalNewState !== undefined &&
        JSON.stringify(internalStateRef.current) !==
          JSON.stringify(optionalNewState)
      ) {
        setInternalState(optionalNewState);
        internalStateRef.current = optionalNewState;
      }
      await _saveStateToDexie(stateToPersist, !isPersistentRef.current);
    },
    [_saveStateToDexie, debouncedSave, toolRoute]
  );

  const togglePersistence = useCallback(async () => {
    if (isLoadingState) {
      console.warn(
        `[useToolState ${toolRoute}] Toggle persistence skipped: still loading.`
      );
      return;
    }
    const newPersistedFlag = !isPersistentRef.current;

    debouncedSave.cancel();
    await _saveStateToDexie(internalStateRef.current, !newPersistedFlag);

    console.log(
      `[useToolState ${toolRoute}] Toggled persistence. State in Dexie is now: ${newPersistedFlag ? 'Permanent' : 'Temporary'}`
    );
  }, [
    isLoadingState,
    _saveStateToDexie,
    toolRoute,
    debouncedSave /* internalStateRef, isPersistentRef are stable */,
  ]);

  const clearStateAndPersist = useCallback(async () => {
    if (isLoadingState) {
      console.warn(
        `[useToolState ${toolRoute}] Clear state skipped: still loading.`
      );
      return;
    }
    debouncedSave.cancel();
    setInternalState(defaultStateRef.current);
    internalStateRef.current = defaultStateRef.current;
    await _saveStateToDexie(defaultStateRef.current, false);
    console.log(
      `[useToolState ${toolRoute}] State cleared and default state persisted.`
    );
  }, [
    isLoadingState,
    _saveStateToDexie,
    debouncedSave,
    toolRoute /* defaultStateRef is stable */,
  ]);

  return {
    state: internalState,
    setState,
    saveStateNow,
    isLoadingState,
    isPersistent,
    togglePersistence,
    clearStateAndPersist,
    errorLoadingState,
  };
}
