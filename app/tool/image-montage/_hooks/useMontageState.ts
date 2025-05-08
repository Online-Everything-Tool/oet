// --- FILE: app/tool/image-montage/_hooks/useMontageState.ts ---
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useHistory } from '@/app/context/HistoryContext';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import type { StoredFile } from '@/src/types/storage';
import useToolState from '../../_hooks/useToolState';

const DEFAULT_OVERLAP_PERCENT = 20;
const MAX_OVERLAP_PERCENT = 80;
const MAX_TILT_DEG = 25;

// --- Data Structures ---

// UI Layer / Canvas Hook Data Structure
export interface MontageImage {
  id: number; // Temporary unique ID for React keys during rendering cycle
  imageId: string; // Persistent ID from FileLibrary
  image: HTMLImageElement; // The actual loaded element
  alt: string;
  tilt: number;
  overlapPercent: number;
  zIndex: number;
  originalWidth: number;
  originalHeight: number;
}

// Data Structure for Persistent State (Serializable)
interface PersistedMontageImage {
  imageId: string;
  name: string;
  tilt: number;
  overlapPercent: number;
  zIndex: number;
  originalWidth: number;
  originalHeight: number;
}

export type MontageEffect = 'polaroid' | 'natural';

interface PersistedMontageState {
  images: PersistedMontageImage[];
  effect: MontageEffect;
}

const DEFAULT_MONTAGE_STATE: PersistedMontageState = {
  images: [],
  effect: 'polaroid',
};
// **************************

const getRandomTilt = (): number => {
  const deg = Math.floor(Math.random() * (MAX_TILT_DEG + 1));
  const sign = Math.random() < 0.5 ? -1 : 1;
  return deg === 0 ? 0 : deg * sign;
};

// --- Hook Return Type ---
interface UseMontageStateReturn {
  montageImages: MontageImage[]; // Derived state for UI/Canvas
  effect: MontageEffect; // Expose current effect
  addStoredFiles: (storedFiles: StoredFile[]) => Promise<void>;
  clearMontage: () => Promise<void>; // Make async for clearState
  handleTiltChange: (imageId: string, newTilt: number) => void;
  handleOverlapChange: (imageId: string, newOverlap: number) => void;
  handleMoveImageLeft: (imageId: string) => void; // Reorders layout
  handleMoveImageRight: (imageId: string) => void; // Reorders layout
  handleMoveUp: (imageId: string) => void; // Adjusts zIndex
  handleMoveDown: (imageId: string) => void; // Adjusts zIndex
  handleEffectChange: (effect: MontageEffect) => void; // Changes effect
  isLoading: boolean; // Reflects combined loading (state + images)
  error: string | null; // Reflects combined error
}
// ***********************

export function useMontageState(
  toolTitle: string,
  toolRoute: string
): UseMontageStateReturn {
  const {
    state: persistentState,
    setState: setPersistentState,
    isLoadingState: isLoadingPersistentState,
    clearState: clearPersistentState,
    errorLoadingState,
  } = useToolState<PersistedMontageState>(toolRoute, DEFAULT_MONTAGE_STATE);

  const [loadedImageElements, setLoadedImageElements] = useState<
    Map<string, HTMLImageElement>
  >(new Map());
  const [imageLoadingStatus, setImageLoadingStatus] = useState<
    Record<string, 'idle' | 'loading' | 'loaded' | 'error'>
  >({});
  const [localError, setLocalError] = useState<string | null>(null);
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  const { addHistoryEntry } = useHistory();
  const { getImage } = useImageLibrary();

  const isLoading =
    isLoadingPersistentState ||
    Object.values(imageLoadingStatus).some((status) => status === 'loading');
  const error = errorLoadingState || localError;

  // --- Sync Effect (Load/Unload Image Elements & Store Dimensions) ---
  useEffect(() => {
    if (isLoadingPersistentState) return;
    const currentImageIds = new Set(
      persistentState.images.map((img) => img.imageId)
    );
    const nextLoadingStatus = { ...imageLoadingStatus };
    let needsStatusUpdate = false;
    let localErrorOccurred: string | null = null;
    let stateNeedsDimensionUpdate = false; // Flag to batch dimension updates
    const dimensionUpdates: {
      imageId: string;
      width: number;
      height: number;
    }[] = [];

    persistentState.images.forEach((persistedImage) => {
      const { imageId } = persistedImage;
      if (
        !loadedImageElements.has(imageId) &&
        nextLoadingStatus[imageId] !== 'loading' &&
        nextLoadingStatus[imageId] !== 'error'
      ) {
        nextLoadingStatus[imageId] = 'loading';
        needsStatusUpdate = true;
        getImage(imageId)
          .then((storedFile) => {
            if (!storedFile?.blob)
              throw new Error(`Blob missing for image ID ${imageId}`);
            const objectURL = URL.createObjectURL(storedFile.blob);
            objectUrlsRef.current.set(imageId, objectURL); // Track URL
            const img = new Image();
            img.onload = () => {
              setLoadedImageElements((prevMap) =>
                new Map(prevMap).set(imageId, img)
              );
              setImageLoadingStatus((prevStatus) => ({
                ...prevStatus,
                [imageId]: 'loaded',
              }));
              // Check if dimensions are missing (specifically check for 0 or undefined)
              const existingPersisted = persistentState.images.find(
                (pImg) => pImg.imageId === imageId
              );
              if (
                existingPersisted &&
                (!existingPersisted.originalWidth ||
                  !existingPersisted.originalHeight) &&
                img.naturalWidth > 0 &&
                img.naturalHeight > 0
              ) {
                dimensionUpdates.push({
                  imageId: imageId,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                });
                stateNeedsDimensionUpdate = true;
              }
            };
            img.onerror = () => {
              URL.revokeObjectURL(objectURL);
              objectUrlsRef.current.delete(imageId);
              setImageLoadingStatus((prevStatus) => ({
                ...prevStatus,
                [imageId]: 'error',
              }));
              setLocalError(
                (prev) =>
                  prev ||
                  `Failed to load image: ${persistedImage.name || imageId}`
              );
            };
            img.src = objectURL;
          })
          .catch((err) => {
            nextLoadingStatus[imageId] = 'error';
            setImageLoadingStatus((prevStatus) => ({
              ...prevStatus,
              [imageId]: 'error',
            }));
            const errorMsg = `Error loading ${persistedImage.name || imageId}: ${err.message}`;
            localErrorOccurred = localErrorOccurred || errorMsg;
            needsStatusUpdate = true;
          });
      }
    });

    // --- Apply dimension updates after iterating ---
    if (stateNeedsDimensionUpdate) {
      setPersistentState((prev) => {
        const updatedImages = prev.images.map((pImg) => {
          const update = dimensionUpdates.find(
            (du) => du.imageId === pImg.imageId
          );
          return update
            ? {
                ...pImg,
                originalWidth: update.width,
                originalHeight: update.height,
              }
            : pImg;
        });
        // Only update if the array content actually changed
        return JSON.stringify(prev.images) !== JSON.stringify(updatedImages)
          ? { ...prev, images: updatedImages }
          : prev;
      });
    }

    // --- Clean up stale elements and URLs ---
    let needsElementCleanup = false;
    let needsStatusCleanup = false;
    loadedImageElements.forEach((_, imageId) => {
      if (!currentImageIds.has(imageId)) {
        const url = objectUrlsRef.current.get(imageId);
        if (url) {
          URL.revokeObjectURL(url);
          objectUrlsRef.current.delete(imageId);
        }
        needsElementCleanup = true;
        if (nextLoadingStatus[imageId]) {
          delete nextLoadingStatus[imageId];
          needsStatusCleanup = true;
        }
      }
    });

    if (needsElementCleanup) {
      setLoadedImageElements((prevMap) => {
        const newMap = new Map(prevMap);
        prevMap.forEach((_, imageId) => {
          if (!currentImageIds.has(imageId)) newMap.delete(imageId);
        });
        return newMap;
      });
    }
    if (needsStatusUpdate || needsStatusCleanup) {
      if (
        JSON.stringify(nextLoadingStatus) !== JSON.stringify(imageLoadingStatus)
      ) {
        setImageLoadingStatus(nextLoadingStatus);
      }
    }
    if (localErrorOccurred && !localError) setLocalError(localErrorOccurred);
    else if (!localErrorOccurred && localError) setLocalError(null);
  }, [
    persistentState.images,
    isLoadingPersistentState,
    getImage,
    localError,
    imageLoadingStatus,
    loadedImageElements,
    setPersistentState,
  ]);

  // --- Cleanup Object URLs on Unmount ---
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  // --- Derived State for UI/Canvas ---
  const montageImages = useMemo((): MontageImage[] => {
    console.log(
      '[MontageState useMemo] Calculating derived state. Persistent state image order:',
      persistentState.images.map((p) => ({ id: p.imageId, z: p.zIndex }))
    );
    // ******************************

    const derived = persistentState.images
      .map((persistedImg, index): MontageImage | null => {
        const loadedElement = loadedImageElements.get(persistedImg.imageId);
        if (
          loadedElement &&
          imageLoadingStatus[persistedImg.imageId] === 'loaded'
        ) {
          const simpleHash = (str: string): number => {
            let hash = 0;
            if (str.length === 0) {
              return hash;
            }
            for (let i = 0; i < str.length; i++) {
              const char = str.charCodeAt(i);
              // Basic bitwise operation to combine hash and character code
              hash = (hash << 5) - hash + char;
              // Convert to 32bit integer
              hash |= 0;
            }
            // Make slightly more unique by mixing with length, ensure positive-ish
            hash = Math.abs(hash ^ (str.length * 13));
            return hash;
          };
          return {
            id: index + simpleHash(persistedImg.imageId),
            imageId: persistedImg.imageId,
            image: loadedElement,
            alt: persistedImg.name,
            tilt: persistedImg.tilt,
            overlapPercent: persistedImg.overlapPercent,
            zIndex: persistedImg.zIndex,
            originalWidth: persistedImg.originalWidth,
            originalHeight: persistedImg.originalHeight,
          };
        }
        return null;
      })
      .filter((img): img is MontageImage => img !== null);

    // *** LOG AFTER CALCULATION ***
    console.log(
      '[MontageState useMemo] Finished calculation. Derived state image order:',
      derived.map((d) => ({ id: d.imageId, z: d.zIndex }))
    );
    // *****************************
    return derived;
  }, [persistentState.images, loadedImageElements, imageLoadingStatus]);

  // --- Actions ---

  const addStoredFiles = useCallback(
    async (storedFiles: StoredFile[]): Promise<void> => {
      if (!storedFiles || storedFiles.length === 0) return;
      setLocalError(null);
      const addedFileNames: string[] = [];
      let newlyAddedImages: PersistedMontageImage[] = [];

      setPersistentState((prevState) => {
        const existingIds = new Set(prevState.images.map((img) => img.imageId));
        const maxZIndex = prevState.images.reduce(
          (max, img) => Math.max(max, img.zIndex),
          -1
        );
        const addedInThisUpdate: PersistedMontageImage[] = [];

        storedFiles.forEach((file, index) => {
          if (file.type?.startsWith('image/') && !existingIds.has(file.id)) {
            addedFileNames.push(file.name);
            const newPersistedImage = {
              imageId: file.id,
              name: file.name,
              tilt: getRandomTilt(),
              overlapPercent:
                prevState.images.length + addedInThisUpdate.length === 0
                  ? 0
                  : DEFAULT_OVERLAP_PERCENT,
              zIndex: maxZIndex + 1 + index,
              originalWidth: 0,
              originalHeight: 0,
            };
            addedInThisUpdate.push(newPersistedImage);
          } else if (file.type?.startsWith('image/')) {
            console.warn(`[MontageState Add] Image already exists: ${file.id}`);
          } else {
            console.warn(
              `[MontageState Add] Skipping non-image file: ${file.name}`
            );
          }
        });

        if (addedInThisUpdate.length === 0) return prevState;
        newlyAddedImages = addedInThisUpdate;
        return {
          ...prevState,
          images: [...prevState.images, ...addedInThisUpdate],
        };
      });

      if (newlyAddedImages.length > 0) {
        addHistoryEntry({
          toolName: toolTitle,
          toolRoute: toolRoute,
          trigger: 'transfer',
          input: {
            action: 'addImages',
            addedFileCount: newlyAddedImages.length,
            addedFileIds: newlyAddedImages.map((f) => f.imageId),
            addedFileNames: addedFileNames.join(', ').substring(0, 500),
          },
          output: {
            message: `Added ${newlyAddedImages.length} image(s) to montage queue.`,
          },
          status: 'success',
          eventTimestamp: Date.now(),
          outputFileIds: [],
        });
      }
    },
    [setPersistentState, addHistoryEntry, toolTitle, toolRoute]
  );

  const clearMontage = useCallback(async () => {
    const previousCount = persistentState.images.length;
    if (previousCount === 0) return;
    const previousImageIds = persistentState.images.map((img) => img.imageId);
    setLocalError(null);
    await clearPersistentState();
    addHistoryEntry({
      toolName: toolTitle,
      toolRoute: toolRoute,
      trigger: 'click',
      input: {
        action: 'clearMontage',
        previousImageCount: previousCount,
        previousImageIds: previousImageIds,
      },
      output: { message: `Cleared ${previousCount} image(s) from montage.` },
      status: 'success',
      eventTimestamp: Date.now(),
      outputFileIds: [],
    });
  }, [
    persistentState.images,
    clearPersistentState,
    addHistoryEntry,
    toolTitle,
    toolRoute,
  ]);

  const handleTiltChange = useCallback(
    (imageId: string, newTilt: number) => {
      setPersistentState((prevState) => ({
        ...prevState,
        images: prevState.images.map((img) =>
          img.imageId === imageId ? { ...img, tilt: newTilt } : img
        ),
      }));
    },
    [setPersistentState]
  );

  const handleOverlapChange = useCallback(
    (imageId: string, newOverlap: number) => {
      setPersistentState((prevState) => ({
        ...prevState,
        images: prevState.images.map((img, index) => {
          if (img.imageId === imageId && index > 0) {
            return {
              ...img,
              overlapPercent: Math.max(
                0,
                Math.min(MAX_OVERLAP_PERCENT, newOverlap)
              ),
            };
          }
          return img;
        }),
      }));
    },
    [setPersistentState]
  );

  const handleMoveImageLeft = useCallback(
    (imageId: string) => {
      setPersistentState((prevState) => {
        const indexToMove = prevState.images.findIndex(
          (img) => img.imageId === imageId
        );
        if (indexToMove <= 0) return prevState;
        const newImages = [...prevState.images];
        [newImages[indexToMove - 1], newImages[indexToMove]] = [
          newImages[indexToMove],
          newImages[indexToMove - 1],
        ];
        return { ...prevState, images: newImages };
      });
    },
    [setPersistentState]
  );

  const handleMoveImageRight = useCallback(
    (imageId: string) => {
      setPersistentState((prevState) => {
        const indexToMove = prevState.images.findIndex(
          (img) => img.imageId === imageId
        );
        if (indexToMove < 0 || indexToMove >= prevState.images.length - 1)
          return prevState;
        const newImages = [...prevState.images];
        [newImages[indexToMove + 1], newImages[indexToMove]] = [
          newImages[indexToMove],
          newImages[indexToMove + 1],
        ];
        return { ...prevState, images: newImages };
      });
    },
    [setPersistentState]
  );

  const handleMoveUp = useCallback(
    (imageId: string) => {
      setPersistentState((prevState) => {
        const imagesSortedByZ = [...prevState.images].sort(
          (a, b) => a.zIndex - b.zIndex
        );
        const currentIndex = imagesSortedByZ.findIndex(
          (img) => img.imageId === imageId
        );
        if (currentIndex < 0 || currentIndex >= imagesSortedByZ.length - 1)
          return prevState;
        const currentImage = imagesSortedByZ[currentIndex];
        const imageAbove = imagesSortedByZ[currentIndex + 1];
        const newImages = prevState.images.map((img) => {
          if (img.imageId === currentImage.imageId)
            return { ...img, zIndex: imageAbove.zIndex };
          if (img.imageId === imageAbove.imageId)
            return { ...img, zIndex: currentImage.zIndex };
          return img;
        });
        return { ...prevState, images: newImages };
      });
    },
    [setPersistentState]
  );

  const handleMoveDown = useCallback(
    (imageId: string) => {
      setPersistentState((prevState) => {
        const imagesSortedByZ = [...prevState.images].sort(
          (a, b) => a.zIndex - b.zIndex
        );
        const currentIndex = imagesSortedByZ.findIndex(
          (img) => img.imageId === imageId
        );
        if (currentIndex <= 0) return prevState;
        const currentImage = imagesSortedByZ[currentIndex];
        const imageBelow = imagesSortedByZ[currentIndex - 1];
        const newImages = prevState.images.map((img) => {
          if (img.imageId === currentImage.imageId)
            return { ...img, zIndex: imageBelow.zIndex };
          if (img.imageId === imageBelow.imageId)
            return { ...img, zIndex: currentImage.zIndex };
          return img;
        });
        return { ...prevState, images: newImages };
      });
    },
    [setPersistentState]
  );

  const handleEffectChange = useCallback(
    (newEffect: MontageEffect) => {
      const previousEffect = persistentState.effect;
      setPersistentState((prevState) => ({ ...prevState, effect: newEffect }));
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: {
          action: 'changeEffect',
          newEffect: newEffect,
          previousEffect: previousEffect,
        },
        output: { message: `Changed montage effect to ${newEffect}.` },
        status: 'success',
        eventTimestamp: Date.now(),
        outputFileIds: [],
      });
    },
    [
      setPersistentState,
      addHistoryEntry,
      toolTitle,
      toolRoute,
      persistentState.effect,
    ]
  );

  return {
    montageImages,
    effect: persistentState.effect,
    addStoredFiles,
    clearMontage,
    handleTiltChange,
    handleOverlapChange,
    handleMoveImageLeft,
    handleMoveImageRight,
    handleMoveUp,
    handleMoveDown,
    handleEffectChange,
    isLoading,
    error,
  };
}
