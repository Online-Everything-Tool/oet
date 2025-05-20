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
  effect: MontageEffect;
  processedFileId: string | null;
}

const DEFAULT_MONTAGE_TOOL_STATE: ImageMontageToolPersistedState = {
  persistedImages: [],
  effect: 'polaroid',
  processedFileId: null,
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
  effect: MontageEffect;
  montageImagesForCanvas: MontageImage[];
  processedFileId: string | null;

  addStoredFiles: (storedFiles: StoredFile[]) => Promise<void>;
  removePersistedImage: (instanceId: string) => Promise<void>;
  clearMontage: () => Promise<void>;
  handleTiltChange: (instanceId: string, newTilt: number) => void;
  handleOverlapChange: (instanceId: string, newOverlap: number) => void;
  handleMoveImageLeft: (instanceId: string) => void;
  handleMoveImageRight: (instanceId: string) => void;
  handleZIndexChange: (instanceId: string, direction: 'up' | 'down') => void;
  handleEffectChange: (effect: MontageEffect) => void;

  setProcessedFileIdAfterPermanentSave: (fileId: string | null) => void;
  setTemporaryMontageOutput: (
    blob: Blob | null,
    tempNameRoot?: string
  ) => Promise<string | null>;

  isLoadingState: boolean;
  errorLoadingState: string | null;
  isLoadingImages: boolean;
  imageLoadingError: string | null;
  saveStateNow: () => Promise<void>;
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
              throw new Error(`Blob missing for image ID ${imageId} (${name})`);

            const objectURL = URL.createObjectURL(storedFile.blob);
            objectUrlsRef.current.set(uniqueKeyForMaps, objectURL);

            const img = new Image();
            img.onload = () => {
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
                setToolStateInternal((prevToolState) => ({
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
                }));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolState.persistedImages, isLoadingState, getFile]);

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
        const updatedState = {
          ...prevState,
          persistedImages: [...prevState.persistedImages, ...newlyAddedImages],
          processedFileId: null,
        };

        saveStateNow(updatedState);
        return updatedState;
      });
    },
    [setToolStateInternal, saveStateNow]
  );

  const removePersistedImage = useCallback(
    async (instanceIdToRemove: string) => {
      let imageIdToPotentiallyCleanup: string | null = null;
      let updatedState: ImageMontageToolPersistedState | null = null;

      setToolStateInternal((prevState) => {
        const imgToRemoveDetails = prevState.persistedImages.find(
          (p) => p.instanceId === instanceIdToRemove
        );
        if (imgToRemoveDetails)
          imageIdToPotentiallyCleanup = imgToRemoveDetails.imageId;

        const newPersistedImages = prevState.persistedImages.filter(
          (img) => img.instanceId !== instanceIdToRemove
        );
        updatedState = {
          ...prevState,
          persistedImages: newPersistedImages,
          processedFileId: null,
        };
        return updatedState;
      });
      if (updatedState) await saveStateNow(updatedState);

      if (imageIdToPotentiallyCleanup) {
        const isStillUsed = toolStateRef.current.persistedImages.some(
          (p) => p.imageId === imageIdToPotentiallyCleanup
        );
        if (!isStillUsed) {
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

      if (fileInfo && fileInfo.isTemporary) {
        orphanedSourceImageIdsToCleanup.push(sourceId);
      }
    }
    if (orphanedSourceImageIdsToCleanup.length > 0) {
      for (const idToMark of orphanedSourceImageIdsToCleanup) {
        await markFileAsTemporary(idToMark);
      }
      await cleanupOrphanedTemporaryFiles(orphanedSourceImageIdsToCleanup);
    }
  }, [
    clearPersistentToolStateAndDexie,
    getFile,
    markFileAsTemporary,
    cleanupOrphanedTemporaryFiles,
  ]);

  const modifyPersistedImage = useCallback(
    (
      instanceId: string,
      updates: Partial<
        Omit<PersistedMontageImage, 'instanceId' | 'imageId' | 'name'>
      >
    ) => {
      let finalState: ImageMontageToolPersistedState | null = null;
      setToolStateInternal((prevState) => {
        finalState = {
          ...prevState,
          persistedImages: prevState.persistedImages.map((img) =>
            img.instanceId === instanceId ? { ...img, ...updates } : img
          ),
          processedFileId: null,
        };
        return finalState;
      });
      if (finalState) saveStateNow(finalState);
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
    (instanceId: string, direction: 'left' | 'right') => {
      let finalState: ImageMontageToolPersistedState | null = null;
      setToolStateInternal((prevState) => {
        const indexToMove = prevState.persistedImages.findIndex(
          (img) => img.instanceId === instanceId
        );
        if (
          (direction === 'left' && indexToMove <= 0) ||
          (direction === 'right' &&
            indexToMove >= prevState.persistedImages.length - 1)
        )
          return prevState;
        const newTargetIndex =
          direction === 'left' ? indexToMove - 1 : indexToMove + 1;
        const newImages = [...prevState.persistedImages];
        [newImages[newTargetIndex], newImages[indexToMove]] = [
          newImages[indexToMove],
          newImages[newTargetIndex],
        ];
        finalState = {
          ...prevState,
          persistedImages: newImages,
          processedFileId: null,
        };
        return finalState;
      });
      if (finalState) saveStateNow(finalState);
    },
    [setToolStateInternal, saveStateNow]
  );
  const handleMoveImageLeft = (instanceId: string) =>
    handleMoveImageOrder(instanceId, 'left');
  const handleMoveImageRight = (instanceId: string) =>
    handleMoveImageOrder(instanceId, 'right');

  const handleZIndexChange = useCallback(
    (instanceId: string, direction: 'up' | 'down') => {
      let finalState: ImageMontageToolPersistedState | null = null;
      setToolStateInternal((prevState) => {
        const imagesSortedByZ = [...prevState.persistedImages].sort(
          (a, b) => a.zIndex - b.zIndex
        );
        const currentIndexInSorted = imagesSortedByZ.findIndex(
          (img) => img.instanceId === instanceId
        );
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
          processedFileId: null,
        };
        return finalState;
      });
      if (finalState) saveStateNow(finalState);
    },
    [setToolStateInternal, saveStateNow]
  );

  const handleEffectChange = useCallback(
    (newEffect: MontageEffect) => {
      setToolStateInternal((prevState) => ({
        ...prevState,
        effect: newEffect,
        processedFileId: null,
      }));
      saveStateNow({
        ...toolStateRef.current,
        effect: newEffect,
        processedFileId: null,
      });
    },
    [setToolStateInternal, saveStateNow]
  );

  const setProcessedFileIdAfterPermanentSave = useCallback(
    async (fileId: string | null) => {
      setToolStateInternal((prev) => ({ ...prev, processedFileId: fileId }));

      await saveStateNow({ ...toolStateRef.current, processedFileId: fileId });
    },
    [setToolStateInternal, saveStateNow]
  );

  const setTemporaryMontageOutput = useCallback(
    async (
      blob: Blob | null,
      tempNameRoot: string = 'auto-montage'
    ): Promise<string | null> => {
      const oldProcessedId = toolStateRef.current.processedFileId;
      let wasOldProcessedTemporary = false;
      if (oldProcessedId) {
        const oldFileInfo = await getFile(oldProcessedId);
        if (oldFileInfo)
          wasOldProcessedTemporary = oldFileInfo.isTemporary === true;
        else {
          setToolStateInternal((prev) => ({ ...prev, processedFileId: null }));
        }
      }

      if (!blob) {
        if (oldProcessedId && wasOldProcessedTemporary) {
          console.log(
            `[MontageState setTemporary] New blob is null, cleaning up old temp: ${oldProcessedId}`
          );
          await markFileAsTemporary(oldProcessedId);
          await cleanupOrphanedTemporaryFiles([oldProcessedId]);
        }

        if (toolStateRef.current.processedFileId !== null) {
          setToolStateInternal((prev) => ({ ...prev, processedFileId: null }));
          await saveStateNow({
            ...toolStateRef.current,
            processedFileId: null,
          });
        }
        return null;
      }

      const tempFilename = `${tempNameRoot}-${Date.now()}.png`;
      try {
        const newTempId = await addFile(blob, tempFilename, 'image/png', true);

        setToolStateInternal((prev) => ({
          ...prev,
          processedFileId: newTempId,
        }));
        await saveStateNow({
          ...toolStateRef.current,
          processedFileId: newTempId,
        });

        if (
          oldProcessedId &&
          wasOldProcessedTemporary &&
          oldProcessedId !== newTempId
        ) {
          console.log(
            `[MontageState setTemporary] Cleaning up replaced old temp: ${oldProcessedId}`
          );
          await markFileAsTemporary(oldProcessedId);
          await cleanupOrphanedTemporaryFiles([oldProcessedId]);
        }
        return newTempId;
      } catch (e) {
        console.error(
          '[MontageState setTemporary] Error saving temporary montage output:',
          e
        );
        return null;
      }
    },
    [
      addFile,
      getFile,
      markFileAsTemporary,
      cleanupOrphanedTemporaryFiles,
      setToolStateInternal,
      saveStateNow,
    ]
  );

  return {
    persistedImages: toolState.persistedImages,
    effect: toolState.effect,
    montageImagesForCanvas,
    processedFileId: toolState.processedFileId,
    addStoredFiles,
    removePersistedImage,
    clearMontage,
    handleTiltChange,
    handleOverlapChange,
    handleMoveImageLeft,
    handleMoveImageRight,
    handleZIndexChange,
    handleEffectChange,
    setProcessedFileIdAfterPermanentSave,
    setTemporaryMontageOutput,
    isLoadingState,
    errorLoadingState,
    isLoadingImages,
    imageLoadingError,
    saveStateNow,
  };
}
