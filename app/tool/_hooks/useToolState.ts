// FILE: app/tool/_hooks/useToolState.ts
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { getDbInstance, OetDatabase } from '@/app/lib/db'; // Assuming OetDatabase type is useful
import type { StoredFile } from '@/src/types/storage';
import { safeParseState } from '@/app/lib/utils';
import Dexie from 'dexie'; // For Dexie.ModifyError if needed for specific error handling

const SAVE_DEBOUNCE_MS = 1500;

export interface UseToolStateReturn<T> {
  state: T;
  setState: (newState: Partial<T> | ((prevState: T) => T)) => void; // setState can now also take full state
  saveStateNow: (optionalNewState?: T) => Promise<void>; // Saves current or provided state immediately
  isLoadingState: boolean;
  isPersistent: boolean; // This might be better named something like 'isStateSavedToDexie'
  togglePersistence: () => Promise<void>; // This function might need careful re-evaluation
  clearStateAndPersist: () => Promise<void>; // Specific function for clearing and ensuring save
  errorLoadingState: string | null;
}

export default function useToolState<T extends object>(
  toolRoute: string,
  defaultState: T
): UseToolStateReturn<T> {
  const [internalState, setInternalState] = useState<T>(defaultState);
  const internalStateRef = useRef<T>(defaultState); // Ref to hold the latest state for immediate saves
  const [isLoadingState, setIsLoadingState] = useState<boolean>(true);
  const [isPersistent, setIsPersistent] = useState<boolean>(true); // Tracks if the *current state in Dexie* is permanent or temporary
  const stateFileId = useMemo(() => `state-${toolRoute}`, [toolRoute]);
  const [errorLoadingState, setErrorLoadingState] = useState<string | null>(
    null
  );

  const isInitialized = useRef(false); // Tracks if initial load from Dexie is complete
  const defaultStateRef = useRef(defaultState);

  useEffect(() => {
    // Keep refs in sync with state
    internalStateRef.current = internalState;
    defaultStateRef.current = defaultState;
  }, [internalState, defaultState]);

  // Internal save function (the actual Dexie interaction)
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
          // Only delete if it's default AND we're not trying to make it temp
          const existingFile = await db.files.get(stateFileId);
          if (existingFile) {
            console.log(
              `[useToolState ${toolRoute}] State matches default, deleting existing file ${stateFileId}.`
            );
            await db.files.delete(stateFileId);
          }
          setIsPersistent(true); // Default state is conceptually "permanent" (or rather, not a temporary override)
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
          name: stateName,
          type: 'application/x-oet-tool-state+json',
          size: stateBlob.size,
          blob: stateBlob,
          isTemporary: makeTemporary, // Use the flag
          toolRoute: toolRoute,
          createdAt: createdAt,
          lastModified: now,
        };
        await db.files.put(stateFileObject);
        setIsPersistent(!makeTemporary); // Update persistence status
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
      // Only save if initial load is done
      _saveStateToDexie(stateToSave, !isPersistentRef.current); // isPersistentRef reflects user's choice
    }
  }, SAVE_DEBOUNCE_MS);
  const isPersistentRef = useRef(isPersistent); // Ref for debouncedSave
  useEffect(() => {
    isPersistentRef.current = isPersistent;
  }, [isPersistent]);

  // Initial load from Dexie
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
            setInternalState(defaultStateRef.current); // Fallback to default
            setIsPersistent(true); // Default to persistent on error
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
          setIsPersistent(true); // Default state implies it's persistent unless made temporary
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
  }, [stateFileId, toolRoute /* defaultStateRef is stable */]);

  const setState = useCallback(
    (newStateOrFn: Partial<T> | ((prevState: T) => T)) => {
      setInternalState((prevState) => {
        const updatedState =
          typeof newStateOrFn === 'function'
            ? newStateOrFn(prevState)
            : { ...prevState, ...newStateOrFn };

        if (JSON.stringify(prevState) !== JSON.stringify(updatedState)) {
          internalStateRef.current = updatedState; // Keep ref updated for immediate saves
          if (isInitialized.current) debouncedSave(updatedState); // Debounce normal state changes after init
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
        // If called very early without a state, it might save the default if internalStateRef isn't updated yet.
        // Or, ensure internalStateRef is always up-to-date or error out.
        // Forcing a save of default if not initialized might be a safe bet if this scenario is hit.
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
      // If optionalNewState is provided, also update React state if it's different
      if (
        optionalNewState !== undefined &&
        JSON.stringify(internalStateRef.current) !==
          JSON.stringify(optionalNewState)
      ) {
        setInternalState(optionalNewState); // Update React state too
        internalStateRef.current = optionalNewState;
      }
      await _saveStateToDexie(stateToPersist, !isPersistentRef.current); // Save with current persistence setting
    },
    [
      _saveStateToDexie,
      debouncedSave,
      toolRoute /* defaultStateRef, isPersistentRef are stable */,
    ]
  );

  const togglePersistence = useCallback(async () => {
    if (isLoadingState) {
      console.warn(
        `[useToolState ${toolRoute}] Toggle persistence skipped: still loading.`
      );
      return;
    }
    const newPersistedFlag = !isPersistentRef.current;
    // The state to save is the current internalState. We are just changing its temporary flag.
    // No need to call setInternalState here as the content isn't changing.
    debouncedSave.cancel();
    await _saveStateToDexie(internalStateRef.current, !newPersistedFlag); // Pass inverse: makeTemporary = !newPersistedFlag
    // setIsPersistent(newPersistedFlag); // _saveStateToDexie will call setIsPersistent
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
    setInternalState(defaultStateRef.current); // Update React state
    internalStateRef.current = defaultStateRef.current; // Update ref
    await _saveStateToDexie(defaultStateRef.current, false); // Save default as permanent (or delete if it matches)
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
