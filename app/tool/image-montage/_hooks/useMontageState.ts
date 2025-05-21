// --- FILE: app/tool/image-montage/_hooks/useMontageState.ts ---
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { StoredFile } from '@/src/types/storage';
import useToolState from '../../_hooks/useToolState';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { v4 as uuidv4 } from 'uuid';

export interface MontageImage {
  id: number;
  instanceId: string;
  imageId: string;
  image: HTMLImageElement;
  alt: string;
  tilt: number;
  overlapPercent: number;
  zIndex: number;
  originalWidth: number;
  originalHeight: number;
}

export interface PersistedMontageImage {
  instanceId: string;
  imageId: string;
  filename: string;
  tilt: number;
  overlapPercent: number;
  zIndex: number;
  originalWidth: number;
  originalHeight: number;
}

export type MontageEffect = 'polaroid' | 'natural';

export interface ImageMontageToolPersistedState {
  persistedImages: PersistedMontageImage[];
  montageEffect: MontageEffect;
  processedFileId: string | null;
  lastUserGivenFilename: string | null;
}

const DEFAULT_MONTAGE_TOOL_STATE: ImageMontageToolPersistedState = {
  persistedImages: [],
  montageEffect: 'polaroid',
  processedFileId: null,
  lastUserGivenFilename: null,
};

const DEFAULT_OVERLAP_PERCENT = 20;
const MAX_OVERLAP_PERCENT = 80;
const MAX_TILT_DEG = 25;

const getRandomTilt = (): number => {
  const deg = Math.floor(Math.random() * (MAX_TILT_DEG + 1));
  const sign = Math.random() < 0.5 ? -1 : 1;
  return deg === 0 ? 0 : deg * sign;
};

interface UseMontageStateProps {
  toolRoute: string;
}

export interface UseMontageStateReturn {
  persistedImages: PersistedMontageImage[];
  montageEffect: MontageEffect;
  montageImagesForCanvas: MontageImage[];
  processedFileId: string | null;
  lastUserGivenFilename: string | null;

  addStoredFiles: (storedFiles: StoredFile[]) => Promise<void>;
  removePersistedImage: (instanceId: string) => Promise<void>;
  clearMontage: () => Promise<void>;
  handleTiltChange: (instanceId: string, newTilt: number) => void;
  handleOverlapChange: (instanceId: string, newOverlap: number) => void;
  handleMoveImageLeft: (instanceId: string) => void;
  handleMoveImageRight: (instanceId: string) => void;
  handleZIndexChange: (instanceId: string, direction: 'up' | 'down') => void;
  handleEffectChange: (montageEffect: MontageEffect) => void;

  handleSaveSuccess: (
    savedFileId: string,
    chosenFilename: string
  ) => Promise<void>;
  setTemporaryMontageOutput: (
    blob: Blob | null,
    tempNameRoot?: string
  ) => Promise<string | null>;

  isLoadingState: boolean;
  errorLoadingState: string | null;
  isLoadingImages: boolean;
  imageLoadingError: string | null;
  saveStateNow: (
    optionalNewState?: ImageMontageToolPersistedState
  ) => Promise<void>;
}

export function useMontageState({
  toolRoute,
}: UseMontageStateProps): UseMontageStateReturn {
  const {
    state: toolState,
    setState: setToolStateInternal,
    isLoadingState,
    clearStateAndPersist: clearPersistentToolStateAndDexie,
    errorLoadingState,
    saveStateNow,
  } = useToolState<ImageMontageToolPersistedState>(
    toolRoute,
    DEFAULT_MONTAGE_TOOL_STATE
  );

  const toolStateRef = useRef(toolState);
  useEffect(() => {
    toolStateRef.current = toolState;
  }, [toolState]);

  const [loadedImageElements, setLoadedImageElements] = useState<
    Map<string, HTMLImageElement>
  >(new Map());
  const [imageLoadingStatus, setImageLoadingStatus] = useState<
    Record<string, 'idle' | 'loading' | 'loaded' | 'error'>
  >({});
  const [imageLoadingError, setImageLoadingError] = useState<string | null>(
    null
  );
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  const {
    getFile,
    addFile,
    updateFileBlob,
    markFileAsTemporary,
    cleanupOrphanedTemporaryFiles,
  } = useFileLibrary();

  const isLoadingImages = useMemo(
    () =>
      Object.values(imageLoadingStatus).some((status) => status === 'loading'),
    [imageLoadingStatus]
  );

  useEffect(() => {
    if (isLoadingState) return;
    const newImageLoadingStatus = { ...imageLoadingStatus };
    let didStatusChange = false;
    const localErrorAccumulator: string[] = [];

    toolState.persistedImages.forEach((persistedImg) => {
      const { imageId, instanceId, filename } = persistedImg;
      const uniqueKeyForMaps = imageId;

      if (
        !loadedImageElements.has(uniqueKeyForMaps) &&
        newImageLoadingStatus[uniqueKeyForMaps] !== 'loading' &&
        newImageLoadingStatus[uniqueKeyForMaps] !== 'error'
      ) {
        newImageLoadingStatus[uniqueKeyForMaps] = 'loading';
        didStatusChange = true;
        getFile(imageId)
          .then((storedFile) => {
            if (!storedFile?.blob)
              throw new Error(
                `Blob missing for image ID ${imageId} (${filename})`
              );
            const objectURL = URL.createObjectURL(storedFile.blob);
            objectUrlsRef.current.set(uniqueKeyForMaps, objectURL);
            const img = new Image();
            img.onload = async () => {
              setLoadedImageElements((prevMap) =>
                new Map(prevMap).set(uniqueKeyForMaps, img)
              );
              setImageLoadingStatus((prev) => ({
                ...prev,
                [uniqueKeyForMaps]: 'loaded',
              }));
              const currentPImages = toolStateRef.current.persistedImages;
              const pImgForDimension = currentPImages.find(
                (pi) => pi.instanceId === instanceId
              );
              if (
                pImgForDimension &&
                (!pImgForDimension.originalWidth ||
                  !pImgForDimension.originalHeight) &&
                img.naturalWidth > 0 &&
                img.naturalHeight > 0
              ) {
                let updatedStateForDimensions: ImageMontageToolPersistedState | null =
                  null;
                setToolStateInternal((prevToolState) => {
                  updatedStateForDimensions = {
                    ...prevToolState,
                    persistedImages: prevToolState.persistedImages.map((p) =>
                      p.instanceId === instanceId
                        ? {
                            ...p,
                            originalWidth: img.naturalWidth,
                            originalHeight: img.naturalHeight,
                          }
                        : p
                    ),
                  };
                  return updatedStateForDimensions;
                });
                if (updatedStateForDimensions)
                  await saveStateNow(updatedStateForDimensions);
              }
            };
            img.onerror = () => {
              URL.revokeObjectURL(objectURL);
              objectUrlsRef.current.delete(uniqueKeyForMaps);
              setImageLoadingStatus((prev) => ({
                ...prev,
                [uniqueKeyForMaps]: 'error',
              }));
              localErrorAccumulator.push(
                `Failed to load image: ${filename || imageId}`
              );
              setImageLoadingError(localErrorAccumulator.join('; '));
            };
            img.src = objectURL;
          })
          .catch((err) => {
            setImageLoadingStatus((prev) => ({
              ...prev,
              [uniqueKeyForMaps]: 'error',
            }));
            const errorText = `Error loading ${filename || imageId}: ${err.message || String(err)}`;
            localErrorAccumulator.push(errorText);
            setImageLoadingError(localErrorAccumulator.join('; '));
          });
      }
    });
    let elementsCleaned = false;
    const imageIdsInCurrentPersistedImages = new Set(
      toolState.persistedImages.map((p) => p.imageId)
    );
    loadedImageElements.forEach((_, loadedImageIdKey) => {
      if (!imageIdsInCurrentPersistedImages.has(loadedImageIdKey)) {
        const url = objectUrlsRef.current.get(loadedImageIdKey);
        if (url) {
          URL.revokeObjectURL(url);
          objectUrlsRef.current.delete(loadedImageIdKey);
        }
        elementsCleaned = true;
        if (newImageLoadingStatus[loadedImageIdKey]) {
          delete newImageLoadingStatus[loadedImageIdKey];
          didStatusChange = true;
        }
      }
    });
    if (elementsCleaned) {
      setLoadedImageElements((prevMap) => {
        const newMap = new Map(prevMap);
        prevMap.forEach((_, loadedImageIdKey) => {
          if (!imageIdsInCurrentPersistedImages.has(loadedImageIdKey))
            newMap.delete(loadedImageIdKey);
        });
        return newMap;
      });
    }
    if (
      didStatusChange &&
      JSON.stringify(newImageLoadingStatus) !==
        JSON.stringify(imageLoadingStatus)
    ) {
      setImageLoadingStatus(newImageLoadingStatus);
    }
    if (localErrorAccumulator.length > 0) {
      if (imageLoadingError !== localErrorAccumulator.join('; '))
        setImageLoadingError(localErrorAccumulator.join('; '));
    } else if (localErrorAccumulator.length === 0 && imageLoadingError) {
      setImageLoadingError(null);
    }
  }, [
    toolState.persistedImages,
    isLoadingState,
    getFile,
    saveStateNow,
    setToolStateInternal,
    imageLoadingStatus,
    loadedImageElements,
    imageLoadingError,
  ]);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const montageImagesForCanvas = useMemo((): MontageImage[] => {
    return toolState.persistedImages
      .map((persistedImg, index): MontageImage | null => {
        const loadedElement = loadedImageElements.get(persistedImg.imageId);
        if (
          loadedElement &&
          imageLoadingStatus[persistedImg.imageId] === 'loaded'
        ) {
          return {
            id: index,
            instanceId: persistedImg.instanceId,
            imageId: persistedImg.imageId,
            image: loadedElement,
            alt: persistedImg.filename,
            tilt: persistedImg.tilt,
            overlapPercent: persistedImg.overlapPercent,
            zIndex: persistedImg.zIndex,
            originalWidth:
              persistedImg.originalWidth || loadedElement.naturalWidth,
            originalHeight:
              persistedImg.originalHeight || loadedElement.naturalHeight,
          };
        }
        return null;
      })
      .filter((img): img is MontageImage => img !== null);
  }, [toolState.persistedImages, loadedImageElements, imageLoadingStatus]);

  const addStoredFiles = useCallback(
    async (storedFiles: StoredFile[]): Promise<void> => {
      if (!storedFiles || storedFiles.length === 0) return;
      setImageLoadingError(null);
      let finalUpdatedState: ImageMontageToolPersistedState | null = null;
      setToolStateInternal((prevState) => {
        let maxZIndex = prevState.persistedImages.reduce(
          (max, img) => Math.max(max, img.zIndex),
          -1
        );
        const newlyAddedImages: PersistedMontageImage[] = [];
        storedFiles.forEach((file) => {
          if (file.type?.startsWith('image/')) {
            maxZIndex++;
            newlyAddedImages.push({
              instanceId: uuidv4(),
              imageId: file.id,
              filename: file.filename,
              tilt: getRandomTilt(),
              overlapPercent:
                prevState.persistedImages.length + newlyAddedImages.length === 0
                  ? 0
                  : DEFAULT_OVERLAP_PERCENT,
              zIndex: maxZIndex,
              originalWidth: 0,
              originalHeight: 0,
            });
          }
        });
        if (newlyAddedImages.length === 0) return prevState;
        finalUpdatedState = {
          ...prevState,
          persistedImages: [...prevState.persistedImages, ...newlyAddedImages],
        };
        return finalUpdatedState;
      });
      if (finalUpdatedState) await saveStateNow(finalUpdatedState);
    },
    [setToolStateInternal, saveStateNow]
  );

  const removePersistedImage = useCallback(
    async (instanceIdToRemove: string) => {
      let imageIdToPotentiallyCleanup: string | null = null;
      let updatedStateForSave: ImageMontageToolPersistedState | null = null;
      setToolStateInternal((prevState) => {
        const imgToRemoveDetails = prevState.persistedImages.find(
          (p) => p.instanceId === instanceIdToRemove
        );
        if (imgToRemoveDetails)
          imageIdToPotentiallyCleanup = imgToRemoveDetails.imageId;
        const newPersistedImages = prevState.persistedImages.filter(
          (img) => img.instanceId !== instanceIdToRemove
        );
        updatedStateForSave = {
          ...prevState,
          persistedImages: newPersistedImages,
        };
        return updatedStateForSave;
      });
      if (updatedStateForSave) await saveStateNow(updatedStateForSave);
      if (imageIdToPotentiallyCleanup) {
        const isStillUsedByOtherInstances =
          toolStateRef.current.persistedImages.some(
            (p) => p.imageId === imageIdToPotentiallyCleanup
          );
        if (!isStillUsedByOtherInstances) {
          const fileInfo = await getFile(imageIdToPotentiallyCleanup);
          if (fileInfo && fileInfo.isTemporary) {
            await markFileAsTemporary(imageIdToPotentiallyCleanup);
            await cleanupOrphanedTemporaryFiles([imageIdToPotentiallyCleanup]);
          }
        }
      }
    },
    [
      setToolStateInternal,
      saveStateNow,
      getFile,
      markFileAsTemporary,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  const clearMontage = useCallback(async () => {
    const oldProcessedId = toolStateRef.current.processedFileId;
    const oldPersistedImageSourceIds = [
      ...new Set(toolStateRef.current.persistedImages.map((p) => p.imageId)),
    ];
    await clearPersistentToolStateAndDexie();
    if (oldProcessedId) {
      const fileInfo = await getFile(oldProcessedId);
      if (fileInfo && fileInfo.isTemporary) {
        await markFileAsTemporary(oldProcessedId);
        await cleanupOrphanedTemporaryFiles([oldProcessedId]);
      }
    }
    const orphanedSourceImageIdsToCleanup: string[] = [];
    for (const sourceId of oldPersistedImageSourceIds) {
      const fileInfo = await getFile(sourceId);
      if (fileInfo && fileInfo.isTemporary)
        orphanedSourceImageIdsToCleanup.push(sourceId);
    }
    if (orphanedSourceImageIdsToCleanup.length > 0) {
      for (const idToMark of orphanedSourceImageIdsToCleanup)
        await markFileAsTemporary(idToMark);
      await cleanupOrphanedTemporaryFiles(orphanedSourceImageIdsToCleanup);
    }
  }, [
    clearPersistentToolStateAndDexie,
    getFile,
    markFileAsTemporary,
    cleanupOrphanedTemporaryFiles,
  ]);

  const modifyPersistedImage = useCallback(
    async (
      instanceId: string,
      updates: Partial<
        Omit<PersistedMontageImage, 'instanceId' | 'imageId' | 'filename'>
      >
    ) => {
      let finalState: ImageMontageToolPersistedState | null = null;
      setToolStateInternal((prevState) => {
        finalState = {
          ...prevState,
          persistedImages: prevState.persistedImages.map((img) =>
            img.instanceId === instanceId ? { ...img, ...updates } : img
          ),
        };
        return finalState;
      });
      if (finalState) await saveStateNow(finalState);
    },
    [setToolStateInternal, saveStateNow]
  );

  const handleTiltChange = useCallback(
    (instanceId: string, newTilt: number) =>
      modifyPersistedImage(instanceId, { tilt: newTilt }),
    [modifyPersistedImage]
  );
  const handleOverlapChange = useCallback(
    (instanceId: string, newOverlap: number) =>
      modifyPersistedImage(instanceId, {
        overlapPercent: Math.max(0, Math.min(MAX_OVERLAP_PERCENT, newOverlap)),
      }),
    [modifyPersistedImage]
  );

  const handleMoveImageOrder = useCallback(
    async (instanceId: string, direction: 'left' | 'right') => {
      let finalState: ImageMontageToolPersistedState | null = null;
      setToolStateInternal((prevState) => {
        const indexToMove = prevState.persistedImages.findIndex(
          (img) => img.instanceId === instanceId
        );
        if (indexToMove === -1) return prevState;
        const newTargetIndex =
          direction === 'left' ? indexToMove - 1 : indexToMove + 1;
        if (
          newTargetIndex < 0 ||
          newTargetIndex >= prevState.persistedImages.length
        )
          return prevState;
        const newImages = [...prevState.persistedImages];
        const itemToMove = newImages.splice(indexToMove, 1)[0];
        newImages.splice(newTargetIndex, 0, itemToMove);
        finalState = {
          ...prevState,
          persistedImages:
            newImages /* processedFileId & lastUserGivenFilename unchanged */,
        };
        return finalState;
      });
      if (finalState) await saveStateNow(finalState);
    },
    [setToolStateInternal, saveStateNow]
  );
  const handleMoveImageLeft = (instanceId: string) =>
    handleMoveImageOrder(instanceId, 'left');
  const handleMoveImageRight = (instanceId: string) =>
    handleMoveImageOrder(instanceId, 'right');

  const handleZIndexChange = useCallback(
    async (instanceId: string, direction: 'up' | 'down') => {
      let finalState: ImageMontageToolPersistedState | null = null;
      setToolStateInternal((prevState) => {
        const imagesSortedByZ = [...prevState.persistedImages].sort(
          (a, b) => a.zIndex - b.zIndex
        );
        const currentIndexInSorted = imagesSortedByZ.findIndex(
          (img) => img.instanceId === instanceId
        );
        if (currentIndexInSorted === -1) return prevState;
        if (
          (direction === 'up' &&
            currentIndexInSorted >= imagesSortedByZ.length - 1) ||
          (direction === 'down' && currentIndexInSorted <= 0)
        )
          return prevState;
        const otherImageIndexInSorted =
          direction === 'up'
            ? currentIndexInSorted + 1
            : currentIndexInSorted - 1;
        const otherImageInstanceId =
          imagesSortedByZ[otherImageIndexInSorted].instanceId;
        const currentImageOriginalZ =
          imagesSortedByZ[currentIndexInSorted].zIndex;
        const otherImageOriginalZ =
          imagesSortedByZ[otherImageIndexInSorted].zIndex;
        finalState = {
          ...prevState,
          persistedImages: prevState.persistedImages.map((img) => {
            if (img.instanceId === instanceId)
              return { ...img, zIndex: otherImageOriginalZ };
            if (img.instanceId === otherImageInstanceId)
              return { ...img, zIndex: currentImageOriginalZ };
            return img;
          }),
          /* processedFileId & lastUserGivenFilename unchanged */
        };
        return finalState;
      });
      if (finalState) await saveStateNow(finalState);
    },
    [setToolStateInternal, saveStateNow]
  );

  const handleEffectChange = useCallback(
    async (newEffect: MontageEffect) => {
      const newState = {
        ...toolStateRef.current,
        montageEffect:
          newEffect /* processedFileId & lastUserGivenFilename unchanged */,
      };
      setToolStateInternal(newState);
      await saveStateNow(newState);
    },
    [setToolStateInternal, saveStateNow]
  );

  const handleSaveSuccess = useCallback(
    async (savedFileId: string, chosenFilename: string) => {
      const oldProcessedId = toolStateRef.current.processedFileId;
      let wasOldProcessedTemporary = false;

      if (oldProcessedId && oldProcessedId !== savedFileId) {
        const oldFileInfo = await getFile(oldProcessedId);
        if (oldFileInfo && oldFileInfo.isTemporary === true) {
          wasOldProcessedTemporary = true;
        }
      }

      const newState = {
        ...toolStateRef.current,
        processedFileId: savedFileId,
        lastUserGivenFilename: chosenFilename,
      };
      setToolStateInternal(newState);
      await saveStateNow(newState);

      if (
        oldProcessedId &&
        oldProcessedId !== savedFileId &&
        wasOldProcessedTemporary
      ) {
        await markFileAsTemporary(oldProcessedId);
        await cleanupOrphanedTemporaryFiles([oldProcessedId]);
      }
    },
    [
      setToolStateInternal,
      saveStateNow,
      getFile,
      markFileAsTemporary,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  const setTemporaryMontageOutput = useCallback(
    async (
      blob: Blob | null,
      tempNameRoot: string = 'auto'
    ): Promise<string | null> => {
      const currentPersistedProcessedIdInState =
        toolStateRef.current.processedFileId;
      let currentOutputStoredFile: StoredFile | undefined = undefined;

      if (currentPersistedProcessedIdInState) {
        currentOutputStoredFile = await getFile(
          currentPersistedProcessedIdInState
        );
        if (
          !currentOutputStoredFile &&
          toolStateRef.current.processedFileId !== null
        ) {
          const stateWithoutOldId = {
            ...toolStateRef.current,
            processedFileId: null,
          };
          setToolStateInternal(stateWithoutOldId);
          await saveStateNow(stateWithoutOldId);
        }
      }

      if (!blob) {
        if (
          currentOutputStoredFile &&
          currentOutputStoredFile.isTemporary === true
        ) {
          await markFileAsTemporary(currentOutputStoredFile.id);
          await cleanupOrphanedTemporaryFiles([currentOutputStoredFile.id]);
        }
        if (toolStateRef.current.processedFileId !== null) {
          const stateWithNullId = {
            ...toolStateRef.current,
            processedFileId: null,
          };
          setToolStateInternal(stateWithNullId);
          await saveStateNow(stateWithNullId);
        }
        return null;
      }

      const tempFilename = `${tempNameRoot}-${toolRoute.split('/').pop() || 'montage'}.png`;

      if (
        currentOutputStoredFile &&
        currentOutputStoredFile.isTemporary === true
      ) {
        try {
          await updateFileBlob(currentOutputStoredFile.id, blob, false);

          return currentOutputStoredFile.id;
        } catch (_e) {
          /* Fall through */
        }
      }

      try {
        const newTempId = await addFile(
          blob,
          tempFilename,
          'image/png',
          true,
          toolRoute
        );
        if (
          currentOutputStoredFile &&
          currentOutputStoredFile.id !== newTempId &&
          currentOutputStoredFile.isTemporary === true
        ) {
          await markFileAsTemporary(currentOutputStoredFile.id);
          await cleanupOrphanedTemporaryFiles([currentOutputStoredFile.id]);
        }
        const stateWithNewTempId = {
          ...toolStateRef.current,
          processedFileId: newTempId,
        };
        setToolStateInternal(stateWithNewTempId);
        await saveStateNow(stateWithNewTempId);
        return newTempId;
      } catch (_e) {
        return null;
      }
    },
    [
      toolRoute,
      addFile,
      getFile,
      updateFileBlob,
      markFileAsTemporary,
      cleanupOrphanedTemporaryFiles,
      setToolStateInternal,
      saveStateNow,
    ]
  );

  return {
    persistedImages: toolState.persistedImages,
    montageEffect: toolState.montageEffect,
    montageImagesForCanvas,
    processedFileId: toolState.processedFileId,
    lastUserGivenFilename: toolState.lastUserGivenFilename,
    addStoredFiles,
    removePersistedImage,
    clearMontage,
    handleTiltChange,
    handleOverlapChange,
    handleMoveImageLeft,
    handleMoveImageRight,
    handleZIndexChange,
    handleEffectChange,
    handleSaveSuccess,
    setTemporaryMontageOutput,
    isLoadingState,
    errorLoadingState,
    isLoadingImages,
    imageLoadingError,
    saveStateNow,
  };
}
