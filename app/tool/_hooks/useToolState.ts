// --- FILE: app/tool/_hooks/useToolState.ts --- [MODIFIED FOR DEBUGGING]
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { getDbInstance, OetDatabase } from '@/app/lib/db'; // Ensure OetDatabase type is imported if needed
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
  // Consolidate hook usage - grab all needed functions
  const { getFile, deleteFile, addFile, updateFileBlob, makeFilePermanent } =
    useFileLibrary();

  const [internalState, setInternalState] = useState<T>(defaultState);
  const [isLoadingState, setIsLoadingState] = useState<boolean>(true);
  const [isPersistent, setIsPersistent] = useState<boolean>(true);
  const [stateFileId] = useState<string>(`state-${toolRoute}`); // Use state to ensure stability if toolRoute could change (it shouldn't)
  const [errorLoadingState, setErrorLoadingState] = useState<string | null>(
    null
  );
  const isInitialized = useRef(false); // Tracks if initial load effect has completed
  const isPersistentRef = useRef(isPersistent); // Ref to track current persistence setting synchronously
  const defaultStateRef = useRef(defaultState); // Ref to hold default state without causing effect reruns

  // Update refs when state changes
  useEffect(() => {
    defaultStateRef.current = defaultState;
  }, [defaultState]); // Should only run if defaultState identity changes
  useEffect(() => {
    isPersistentRef.current = isPersistent;
  }, [isPersistent]);

  // --- LOAD EFFECT ---
  useEffect(() => {
    let isMounted = true;
    isInitialized.current = false; // Mark as not initialized until load completes
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
          return; // Abort if unmounted while fetching
        }
        if (file) {
          console.log(
            `[useToolState ${toolRoute}] LOAD: Found file ${file.id}, isTemporary: ${file.isTemporary}, type: ${file.type}`
          );
          // Ensure it's actually a state file before proceeding
          if (file.type !== 'application/x-oet-tool-state+json') {
            console.warn(
              `[useToolState ${toolRoute}] LOAD: Found file with ID ${stateFileId}, but type is incorrect ('${file.type}'). Ignoring.`
            );
            setInternalState(defaultStateRef.current); // Use default if wrong type
            setIsPersistent(true); // Assume default persistence if file is wrong type
            return; // Stop processing this file
          }

          const loadedPersistence = file.isTemporary !== true;
          setIsPersistent(loadedPersistence); // Update persistence state based on loaded file
          try {
            const stateJson = await file.blob?.text();
            // *** ADDED RAW LOG ***
            console.log(
              `[useToolState ${toolRoute}] LOAD: Raw blob text read (length: ${stateJson?.length}):\n${stateJson}`
            );
            // ********************
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
            setInternalState(loadedState); // Update state with loaded data
          } catch (readError) {
            console.error(
              `[useToolState ${toolRoute}] LOAD: Error reading/parsing blob:`,
              readError
            );
            setErrorLoadingState(
              `Failed to read saved state: ${readError instanceof Error ? readError.message : 'Unknown error'}`
            );
            setInternalState(defaultStateRef.current); // Revert to default on error
            setIsPersistent(true); // Revert persistence on error
          }
        } else {
          console.log(
            `[useToolState ${toolRoute}] LOAD: No state file found (ID: ${stateFileId}). Using default.`
          );
          setInternalState(defaultStateRef.current); // Use default state
          setIsPersistent(true); // Default to persistent if no file found
        }
      })
      .catch((err) => {
        if (!isMounted) {
          console.log(
            `[useToolState ${toolRoute}] LOAD: Aborted (unmounted during getFile catch).`
          );
          return; // Abort if unmounted during error handling
        }
        const message =
          err instanceof Error ? err.message : 'Unknown DB error during load';
        console.error(
          `[useToolState ${toolRoute}] LOAD: Error calling getFile:`,
          err
        );
        setErrorLoadingState(`Error loading saved state: ${message}`);
        setInternalState(defaultStateRef.current); // Revert to default on DB error
        setIsPersistent(true); // Revert persistence on DB error
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingState(false); // Loading finished
          isInitialized.current = true; // Mark as initialized
          console.log(
            `[useToolState ${toolRoute}] LOAD: Effect run finished. isInitialized=${isInitialized.current}. isPersistent=${isPersistentRef.current}`
          );
        } else {
          console.log(
            `[useToolState ${toolRoute}] LOAD: Finally block on unmounted component.`
          );
        }
      });

    // Cleanup function
    return () => {
      isMounted = false;
      console.log(`[useToolState ${toolRoute}] CLEANUP/UNMOUNT load effect.`);
    };
    // Dependencies: Only run when the file ID or the getFile function identity changes.
  }, [stateFileId, getFile, toolRoute]);

  // --- SAVE STATE ---
  const saveState = useCallback(
    async (stateToSave: T) => {
      const currentPersistenceFlag = isPersistentRef.current; // Get current setting from ref
      // Skip save if hook hasn't finished its initial load yet
      if (!isInitialized.current) {
        console.warn(
          `[useToolState ${toolRoute}] SAVE: Skipping save (hook not initialized yet).`
        );
        return;
      }

      // *** ADDED PRE-STRINGIFY LOG ***
      // Use try-catch for deep copy log in case state is not serializable temporarily
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
      // *******************************

      const stateToSaveString = JSON.stringify(stateToSave);
      const defaultStateString = JSON.stringify(defaultStateRef.current);

      try {
        const db: OetDatabase | null = getDbInstance();
        if (!db) throw new Error('DB instance not available for save');

        // If state matches default, delete any existing persistent file
        if (stateToSaveString === defaultStateString) {
          const existingFile = await db.files.get(stateFileId);
          if (existingFile) {
            console.log(
              `[useToolState ${toolRoute}] SAVE: State matches default, deleting existing file ${stateFileId}.`
            );
            await deleteFile(stateFileId); // Use hook function
          } else {
            // console.log(`[useToolState ${toolRoute}] SAVE: State matches default and no file exists. No action needed.`);
          }
          return; // Exit early, no need to save default state
        }

        // State is non-default, proceed with saving/updating
        console.log(
          `[useToolState ${toolRoute}] SAVE: Saving non-default state via PUT (isPersistent=${currentPersistenceFlag}).`
        );
        const stateBlob = new Blob([stateToSaveString], {
          type: 'application/x-oet-tool-state+json',
        }); // Use specific type
        const stateName = `State: ${toolRoute.split('/tool/')[1]?.replace(/\/$/, '') || 'unknown'}`;
        const targetIsTemporary = !currentPersistenceFlag;
        const now = new Date();

        // Construct the file object for Dexie's put method
        const stateFileObject: StoredFile = {
          id: stateFileId,
          name: stateName,
          type: 'application/x-oet-tool-state+json', // Ensure correct type
          size: stateBlob.size,
          blob: stateBlob,
          isTemporary: targetIsTemporary,
          toolRoute: toolRoute,
          createdAt: now, // Will be overwritten if exists
          lastModified: now,
        };

        // Preserve original creation date if file already exists
        const existingFile = await db.files.get(stateFileId);
        if (existingFile?.createdAt) {
          stateFileObject.createdAt = existingFile.createdAt; // Keep original creation date
        } else {
          // console.log(`[useToolState ${toolRoute}] SAVE: Setting new createdAt: ${stateFileObject.createdAt}`);
        }

        // console.log(`[useToolState ${toolRoute}] SAVE: Calling db.files.put with ID ${stateFileId}`);
        await db.files.put(stateFileObject); // Use Dexie's put for add/update
        // console.log(`[useToolState ${toolRoute}] SAVE: Put operation successful for ID ${stateFileId}.`);
      } catch (saveError) {
        console.error(
          `[useToolState ${toolRoute}] SAVE: Error saving state:`,
          saveError
        );
        // Avoid overwriting loading errors with save errors? Maybe only set if no loading error exists.
        if (!errorLoadingState) {
          setErrorLoadingState(
            `Failed to save state: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`
          );
        }
      }
    },
    [stateFileId, toolRoute, deleteFile, errorLoadingState] // Added errorLoadingState to dependencies
  );

  // --- Debounced Save ---
  const debouncedSaveState = useDebouncedCallback((currentState: T) => {
    saveState(currentState);
  }, SAVE_DEBOUNCE_MS);

  // --- setState ---
  const setState = useCallback(
    (newStateOrFn: Partial<T> | ((prevState: T) => Partial<T>)) => {
      setInternalState((prevState) => {
        const partialNewState =
          typeof newStateOrFn === 'function'
            ? newStateOrFn(prevState)
            : newStateOrFn;
        // Avoid unnecessary updates if partial state is empty
        if (Object.keys(partialNewState || {}).length === 0) {
          return prevState;
        }
        const mergedState = { ...prevState, ...partialNewState };
        // Check if state *actually* changed before triggering save
        if (JSON.stringify(prevState) !== JSON.stringify(mergedState)) {
          // console.log(`[useToolState ${toolRoute}] setState: State changed, triggering debounced save.`);
          debouncedSaveState(mergedState);
          return mergedState; // Return the new state
        } else {
          // console.log(`[useToolState ${toolRoute}] setState: State unchanged, skipping save trigger.`);
          return prevState; // Return previous state if no change
        }
      });
    },
    [debouncedSaveState, toolRoute] // Keep dependencies minimal
  );

  // --- togglePersistence ---
  const togglePersistence = useCallback(async () => {
    if (isLoadingState) {
      console.warn(
        `[useToolState ${toolRoute}] TOGGLE: Skipping toggle, still loading state.`
      );
      return;
    }
    const newPersistenceFlag = !isPersistentRef.current; // Calculate based on ref
    setIsPersistent(newPersistenceFlag); // Update the state variable (triggers ref update via useEffect)

    console.log(
      `[useToolState ${toolRoute}] TOGGLE: Toggling persistence to ${newPersistenceFlag}. Triggering immediate save.`
    );
    debouncedSaveState.cancel(); // Cancel any pending debounced save

    try {
      // We need to save the *current* internal state with the *new* persistence flag
      // The saveState function uses isPersistentRef.current, which is updated by the setIsPersistent effect
      // However, the effect might not run immediately. Let's manually update the ref *before* saving.
      isPersistentRef.current = newPersistenceFlag; // Update ref directly
      await saveState(internalState); // Save current state with the new flag
    } catch (err) {
      console.error(
        `[useToolState ${toolRoute}] TOGGLE: Error during saveState after toggle:`,
        err
      );
      setErrorLoadingState('Failed to update persistence setting.');
      // Revert state on error
      setIsPersistent(!newPersistenceFlag);
      isPersistentRef.current = !newPersistenceFlag;
    }
  }, [isLoadingState, saveState, toolRoute, internalState, debouncedSaveState]); // internalState needed

  // --- clearState ---
  const clearState = useCallback(async () => {
    if (isLoadingState) return; // Don't clear if still loading
    debouncedSaveState.cancel(); // Cancel pending saves
    console.log(`[useToolState ${toolRoute}] CLEAR: Clearing state.`);
    setInternalState(defaultStateRef.current); // Reset to default
    setIsPersistent(true); // Default persistence is true after clear
    isPersistentRef.current = true; // Update ref immediately
    setErrorLoadingState(null); // Clear any previous errors
    try {
      await deleteFile(stateFileId).catch((err) => {
        // Ignore "not found" errors during delete after clear
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
      // Catch unexpected errors from deleteFile itself
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
    saveState, // Expose direct save if needed
    isLoadingState,
    isPersistent,
    togglePersistence,
    clearState,
    errorLoadingState,
  };
}
