// --- FILE: app/tool/image-montage/_hooks/useMontageState.ts ---
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import type { StoredFile } from '@/src/types/storage';
import useToolState from '../../_hooks/useToolState';

const DEFAULT_OVERLAP_PERCENT = 20;
const MAX_OVERLAP_PERCENT = 80;
const MAX_TILT_DEG = 25;

export interface MontageImage {
  id: number;
  imageId: string;
  image: HTMLImageElement;
  alt: string;
  tilt: number;
  overlapPercent: number;
  zIndex: number;
  originalWidth: number;
  originalHeight: number;
}

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

export interface ImageMontageToolPersistedState {
  persistedImages: PersistedMontageImage[];
  effect: MontageEffect;
  processedFileId: string | null;
  outputFilename: string | null;
}

const DEFAULT_MONTAGE_TOOL_STATE: ImageMontageToolPersistedState = {
  persistedImages: [],
  effect: 'polaroid',
  processedFileId: null,
  outputFilename: null,
};

const getRandomTilt = (): number => {
  const deg = Math.floor(Math.random() * (MAX_TILT_DEG + 1));
  const sign = Math.random() < 0.5 ? -1 : 1;
  return deg === 0 ? 0 : deg * sign;
};

interface UseMontageStateReturn {
  persistedImages: PersistedMontageImage[];
  effect: MontageEffect;
  montageImagesForCanvas: MontageImage[];
  processedFileId: string | null;
  outputFilename: string | null;
  addStoredFiles: (storedFiles: StoredFile[]) => Promise<void>;
  clearMontage: () => Promise<void>;
  handleTiltChange: (imageId: string, newTilt: number) => void;
  handleOverlapChange: (imageId: string, newOverlap: number) => void;
  handleMoveImageLeft: (imageId: string) => void;
  handleMoveImageRight: (imageId: string) => void;
  handleMoveUp: (imageId: string) => void;
  handleMoveDown: (imageId: string) => void;
  handleEffectChange: (effect: MontageEffect) => void;
  setProcessedFileIdInState: (fileId: string | null) => void;
  setOutputFilenameInState: (filename: string | null) => void;
  isLoadingState: boolean;
  errorLoadingState: string | null;
  isLoadingImages: boolean;
  imageLoadingError: string | null;
}

export function useMontageState(toolRoute: string): UseMontageStateReturn {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    clearState: clearPersistentToolState,
    errorLoadingState,
  } = useToolState<ImageMontageToolPersistedState>(
    toolRoute,
    DEFAULT_MONTAGE_TOOL_STATE
  );

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

  const { getImage } = useImageLibrary();
  const isLoadingImages = Object.values(imageLoadingStatus).some(
    (status) => status === 'loading'
  );

  useEffect(() => {
    if (isLoadingState) return;

    const currentImageIdsInState = new Set(
      toolState.persistedImages.map((img) => img.imageId)
    );
    const newImageLoadingStatus = { ...imageLoadingStatus };
    let didStatusChange = false;
    let localErrorMsg: string | null = null;

    toolState.persistedImages.forEach((persistedImg) => {
      const { imageId, name } = persistedImg;
      if (
        !loadedImageElements.has(imageId) &&
        newImageLoadingStatus[imageId] !== 'loading' &&
        newImageLoadingStatus[imageId] !== 'error'
      ) {
        newImageLoadingStatus[imageId] = 'loading';
        didStatusChange = true;
        getImage(imageId)
          .then((storedFile) => {
            if (!storedFile?.blob)
              throw new Error(`Blob missing for image ID ${imageId} (${name})`);
            const objectURL = URL.createObjectURL(storedFile.blob);
            objectUrlsRef.current.set(imageId, objectURL);
            const img = new Image();
            img.onload = () => {
              setLoadedImageElements((prevMap) =>
                new Map(prevMap).set(imageId, img)
              );
              setImageLoadingStatus((prev) => ({
                ...prev,
                [imageId]: 'loaded',
              }));
              if (
                (!persistedImg.originalWidth || !persistedImg.originalHeight) &&
                img.naturalWidth > 0 &&
                img.naturalHeight > 0
              ) {
                setToolState((prevToolState) => ({
                  ...prevToolState,
                  persistedImages: prevToolState.persistedImages.map((pImg) =>
                    pImg.imageId === imageId
                      ? {
                          ...pImg,
                          originalWidth: img.naturalWidth,
                          originalHeight: img.naturalHeight,
                        }
                      : pImg
                  ),
                }));
              }
            };
            img.onerror = () => {
              URL.revokeObjectURL(objectURL);
              objectUrlsRef.current.delete(imageId);
              setImageLoadingStatus((prev) => ({
                ...prev,
                [imageId]: 'error',
              }));
              setImageLoadingError(
                (prev) => prev || `Failed to load image: ${name || imageId}`
              );
            };
            img.src = objectURL;
          })
          .catch((err) => {
            setImageLoadingStatus((prev) => ({ ...prev, [imageId]: 'error' }));
            const errorText = `Error loading ${name || imageId}: ${err.message}`;
            localErrorMsg = localErrorMsg
              ? `${localErrorMsg}; ${errorText}`
              : errorText;
            didStatusChange = true;
          });
      }
    });

    let elementsCleaned = false;
    loadedImageElements.forEach((_, imageId) => {
      if (!currentImageIdsInState.has(imageId)) {
        const url = objectUrlsRef.current.get(imageId);
        if (url) {
          URL.revokeObjectURL(url);
          objectUrlsRef.current.delete(imageId);
        }
        elementsCleaned = true;
        if (newImageLoadingStatus[imageId]) {
          delete newImageLoadingStatus[imageId];
          didStatusChange = true;
        }
      }
    });

    if (elementsCleaned) {
      setLoadedImageElements((prevMap) => {
        const newMap = new Map(prevMap);
        prevMap.forEach((_, imageId) => {
          if (!currentImageIdsInState.has(imageId)) newMap.delete(imageId);
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
    if (localErrorMsg && imageLoadingError !== localErrorMsg)
      setImageLoadingError(localErrorMsg);
    else if (!localErrorMsg && imageLoadingError) setImageLoadingError(null);
  }, [
    toolState.persistedImages,
    isLoadingState,
    getImage,
    setToolState,
    loadedImageElements,
    imageLoadingStatus,
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
          const simpleHash = (str: string): number =>
            str.split('').reduce((a, b) => {
              a = (a << 5) - a + b.charCodeAt(0);
              return a & a;
            }, 0);
          return {
            id: index + Math.abs(simpleHash(persistedImg.imageId)),
            imageId: persistedImg.imageId,
            image: loadedElement,
            alt: persistedImg.name,
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

      setToolState((prevState) => {
        const existingIds = new Set(
          prevState.persistedImages.map((img) => img.imageId)
        );
        let maxZIndex = prevState.persistedImages.reduce(
          (max, img) => Math.max(max, img.zIndex),
          -1
        );

        const newlyAddedImagesThisCall: PersistedMontageImage[] = [];
        storedFiles.forEach((file) => {
          if (file.type?.startsWith('image/') && !existingIds.has(file.id)) {
            maxZIndex++;
            newlyAddedImagesThisCall.push({
              imageId: file.id,
              name: file.name,
              tilt: getRandomTilt(),

              overlapPercent:
                prevState.persistedImages.length +
                  newlyAddedImagesThisCall.length ===
                0
                  ? 0
                  : DEFAULT_OVERLAP_PERCENT,
              zIndex: maxZIndex,
              originalWidth: 0,
              originalHeight: 0,
            });
          }
        });

        if (newlyAddedImagesThisCall.length === 0) return prevState;

        return {
          ...prevState,
          persistedImages: [
            ...prevState.persistedImages,
            ...newlyAddedImagesThisCall,
          ],
          processedFileId: null,
          outputFilename: null,
        };
      });
    },
    [setToolState]
  );

  const clearMontage = useCallback(async () => {
    if (
      JSON.stringify(toolState) === JSON.stringify(DEFAULT_MONTAGE_TOOL_STATE)
    )
      return;
    setImageLoadingError(null);
    await clearPersistentToolState();
  }, [toolState, clearPersistentToolState]);

  const modifyPersistedImage = useCallback(
    (
      imageId: string,
      updates: Partial<Omit<PersistedMontageImage, 'imageId' | 'name'>>
    ) => {
      setToolState((prevState) => ({
        ...prevState,
        persistedImages: prevState.persistedImages.map((img) =>
          img.imageId === imageId ? { ...img, ...updates } : img
        ),
      }));
    },
    [setToolState]
  );

  const handleTiltChange = useCallback(
    (imageId: string, newTilt: number) =>
      modifyPersistedImage(imageId, { tilt: newTilt }),
    [modifyPersistedImage]
  );

  const handleOverlapChange = useCallback(
    (imageId: string, newOverlap: number) =>
      modifyPersistedImage(imageId, {
        overlapPercent: Math.max(0, Math.min(MAX_OVERLAP_PERCENT, newOverlap)),
      }),
    [modifyPersistedImage]
  );

  const handleMoveImageOrder = useCallback(
    (imageId: string, direction: 'left' | 'right') => {
      setToolState((prevState) => {
        const indexToMove = prevState.persistedImages.findIndex(
          (img) => img.imageId === imageId
        );
        if (direction === 'left' && indexToMove <= 0) return prevState;
        if (
          direction === 'right' &&
          indexToMove >= prevState.persistedImages.length - 1
        )
          return prevState;

        const newTargetIndex =
          direction === 'left' ? indexToMove - 1 : indexToMove + 1;
        const newImages = [...prevState.persistedImages];
        [newImages[newTargetIndex], newImages[indexToMove]] = [
          newImages[indexToMove],
          newImages[newTargetIndex],
        ];

        return { ...prevState, persistedImages: newImages };
      });
    },
    [setToolState]
  );
  const handleMoveImageLeft = (imageId: string) =>
    handleMoveImageOrder(imageId, 'left');
  const handleMoveImageRight = (imageId: string) =>
    handleMoveImageOrder(imageId, 'right');

  const handleZIndexChange = useCallback(
    (imageId: string, direction: 'up' | 'down') => {
      setToolState((prevState) => {
        const imagesSortedByZ = [...prevState.persistedImages].sort(
          (a, b) => a.zIndex - b.zIndex
        );
        const currentIndexInSorted = imagesSortedByZ.findIndex(
          (img) => img.imageId === imageId
        );

        if (
          direction === 'up' &&
          currentIndexInSorted >= imagesSortedByZ.length - 1
        )
          return prevState;
        if (direction === 'down' && currentIndexInSorted <= 0) return prevState;

        const currentImageOriginalZ =
          imagesSortedByZ[currentIndexInSorted].zIndex;
        const otherImageOriginalZ =
          direction === 'up'
            ? imagesSortedByZ[currentIndexInSorted + 1].zIndex
            : imagesSortedByZ[currentIndexInSorted - 1].zIndex;
        const otherImageId =
          direction === 'up'
            ? imagesSortedByZ[currentIndexInSorted + 1].imageId
            : imagesSortedByZ[currentIndexInSorted - 1].imageId;

        const updatedPersistedImages = prevState.persistedImages.map((img) => {
          if (img.imageId === imageId)
            return { ...img, zIndex: otherImageOriginalZ };
          if (img.imageId === otherImageId)
            return { ...img, zIndex: currentImageOriginalZ };
          return img;
        });
        return { ...prevState, persistedImages: updatedPersistedImages };
      });
    },
    [setToolState]
  );
  const handleMoveUp = (imageId: string) => handleZIndexChange(imageId, 'up');
  const handleMoveDown = (imageId: string) =>
    handleZIndexChange(imageId, 'down');

  const handleEffectChange = useCallback(
    (newEffect: MontageEffect) => {
      setToolState((prevState) => ({ ...prevState, effect: newEffect }));
    },
    [setToolState]
  );

  const setProcessedFileIdInState = useCallback(
    (fileId: string | null) => {
      setToolState({ processedFileId: fileId });
    },
    [setToolState]
  );

  const setOutputFilenameInState = useCallback(
    (filename: string | null) => {
      setToolState({ outputFilename: filename });
    },
    [setToolState]
  );

  return {
    persistedImages: toolState.persistedImages,
    effect: toolState.effect,
    montageImagesForCanvas,
    processedFileId: toolState.processedFileId,
    outputFilename: toolState.outputFilename,
    addStoredFiles,
    clearMontage,
    handleTiltChange,
    handleOverlapChange,
    handleMoveImageLeft,
    handleMoveImageRight,
    handleMoveUp,
    handleMoveDown,
    handleEffectChange,
    setProcessedFileIdInState,
    setOutputFilenameInState,
    isLoadingState,
    errorLoadingState,
    isLoadingImages,
    imageLoadingError,
  };
}
