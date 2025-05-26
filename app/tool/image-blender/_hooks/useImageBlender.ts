'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { v4 as uuidv4 } from 'uuid';
import useToolState from '../../_hooks/useToolState';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';

export interface BlenderImage {
  instanceId: string;
  imageId: string;
  filename: string;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  order: number; // Lower numbers are drawn first (further back)
  originalWidth: number;
  originalHeight: number;
  previewUrl?: string; // Object URL for thumbnail/preview
}

export interface ImageBlenderToolState {
  inputImages: BlenderImage[];
  outputWidth: number;
  outputHeight: number;
  backgroundColor: string;
  transparentBackground: boolean;
  processedFileId: string | null;
  lastUserGivenFilename: string | null;
}

const DEFAULT_STATE: ImageBlenderToolState = {
  inputImages: [],
  outputWidth: 800,
  outputHeight: 600,
  backgroundColor: '#FFFFFF',
  transparentBackground: false,
  processedFileId: null,
  lastUserGivenFilename: null,
};

const AUTO_BLEND_DEBOUNCE_MS = 1000;

export function useImageBlender(toolRoute: string) {
  const {
    state,
    setState: setToolStateInternal,
    isLoadingState,
    errorLoadingState,
    saveStateNow,
    clearStateAndPersist,
  } = useToolState<ImageBlenderToolState>(toolRoute, DEFAULT_STATE);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const { getFile, addFile, updateFileBlob, markFileAsTemporary, cleanupOrphanedTemporaryFiles, makeFilePermanentAndUpdate } = useFileLibrary();

  const [loadedHtmlImages, setLoadedHtmlImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [imageLoadingStatus, setImageLoadingStatus] = useState<Record<string, 'idle' | 'loading' | 'loaded' | 'error'>>({});
  const [htmlImageLoadingError, setHtmlImageLoadingError] = useState<string | null>(null);
  const objectUrlsRef = useRef<Map<string, string>>(new Map()); // For input image previews

  const [isBlending, setIsBlending] = useState(false);

  // Effect to load HTMLImageElements for input images and manage their object URLs
  useEffect(() => {
    if (isLoadingState) return;

    const currentImageIds = new Set(state.inputImages.map(img => img.imageId));
    const newImageLoadingStatus = { ...imageLoadingStatus };
    let didStatusChange = false;
    const errorAccumulator: string[] = [];

    // Load new images
    state.inputImages.forEach(blenderImage => {
      if (!loadedHtmlImages.has(blenderImage.imageId) && newImageLoadingStatus[blenderImage.imageId] !== 'loading' && newImageLoadingStatus[blenderImage.imageId] !== 'error') {
        newImageLoadingStatus[blenderImage.imageId] = 'loading';
        didStatusChange = true;

        getFile(blenderImage.imageId).then(storedFile => {
          if (!storedFile?.blob) throw new Error(`Blob missing for image ID ${blenderImage.imageId}`);
          const objectURL = URL.createObjectURL(storedFile.blob);
          objectUrlsRef.current.set(blenderImage.imageId, objectURL); // For ImageInputCard preview

          const img = new Image();
          img.onload = () => {
            setLoadedHtmlImages(prev => new Map(prev).set(blenderImage.imageId, img));
            setImageLoadingStatus(prev => ({ ...prev, [blenderImage.imageId]: 'loaded' }));
            // Update dimensions in state if not already set
            if (blenderImage.originalWidth === 0 || blenderImage.originalHeight === 0) {
              setToolStateInternal(prevToolState => ({
                ...prevToolState,
                inputImages: prevToolState.inputImages.map(bi =>
                  bi.instanceId === blenderImage.instanceId
                    ? { ...bi, originalWidth: img.naturalWidth, originalHeight: img.naturalHeight }
                    : bi
                ),
              }));
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectURL);
            objectUrlsRef.current.delete(blenderImage.imageId);
            setImageLoadingStatus(prev => ({ ...prev, [blenderImage.imageId]: 'error' }));
            errorAccumulator.push(`Failed to load image: ${blenderImage.filename}`);
            setHtmlImageLoadingError(errorAccumulator.join('; '));
          };
          img.src = objectURL;
        }).catch(err => {
          setImageLoadingStatus(prev => ({ ...prev, [blenderImage.imageId]: 'error' }));
          errorAccumulator.push(`Error loading ${blenderImage.filename}: ${err.message}`);
          setHtmlImageLoadingError(errorAccumulator.join('; '));
        });
      }
    });

    // Cleanup old/removed images
    let elementsCleaned = false;
    loadedHtmlImages.forEach((_, imageId) => {
      if (!currentImageIds.has(imageId)) {
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
      setLoadedHtmlImages(prevMap => {
        const newMap = new Map(prevMap);
        prevMap.forEach((_, imageId) => {
          if (!currentImageIds.has(imageId)) newMap.delete(imageId);
        });
        return newMap;
      });
    }

    if (didStatusChange && JSON.stringify(newImageLoadingStatus) !== JSON.stringify(imageLoadingStatus)) {
      setImageLoadingStatus(newImageLoadingStatus);
    }
    if (errorAccumulator.length > 0) {
      if (htmlImageLoadingError !== errorAccumulator.join('; ')) setHtmlImageLoadingError(errorAccumulator.join('; '));
    } else if (htmlImageLoadingError) {
      setHtmlImageLoadingError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.inputImages, isLoadingState, getFile, setToolStateInternal]);


  // Cleanup object URLs on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);


  const generateBlendedImageBlob = useCallback(async (): Promise<Blob | null> => {
    if (stateRef.current.inputImages.length === 0) return null;
    setIsBlending(true);

    const canvas = document.createElement('canvas');
    canvas.width = stateRef.current.outputWidth;
    canvas.height = stateRef.current.outputHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsBlending(false);
      throw new Error('Failed to get canvas context');
    }

    if (!stateRef.current.transparentBackground) {
      ctx.fillStyle = stateRef.current.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const sortedImages = [...stateRef.current.inputImages].sort((a, b) => a.order - b.order);

    for (const blenderImage of sortedImages) {
      const htmlImg = loadedHtmlImages.get(blenderImage.imageId);
      if (htmlImg && htmlImg.complete && htmlImg.naturalWidth > 0) {
        ctx.globalAlpha = blenderImage.opacity;
        ctx.globalCompositeOperation = blenderImage.blendMode;

        // Scale image to fit canvas while maintaining aspect ratio, then center
        const imgWidth = blenderImage.originalWidth || htmlImg.naturalWidth;
        const imgHeight = blenderImage.originalHeight || htmlImg.naturalHeight;
        const hRatio = canvas.width / imgWidth;
        const vRatio = canvas.height / imgHeight;
        const ratio = Math.min(hRatio, vRatio); // Use min to fit the whole image

        const drawWidth = imgWidth * ratio;
        const drawHeight = imgHeight * ratio;
        const drawX = (canvas.width - drawWidth) / 2;
        const drawY = (canvas.height - drawHeight) / 2;

        ctx.drawImage(htmlImg, drawX, drawY, drawWidth, drawHeight);
      }
    }
    
    ctx.globalAlpha = 1.0; // Reset for safety
    ctx.globalCompositeOperation = 'source-over'; // Reset for safety

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        setIsBlending(false);
        resolve(blob);
      }, 'image/png');
    });
  }, [loadedHtmlImages]); // Dependencies: stateRef is used, but its content changes are handled by debounced call

  const debouncedBlendAndUpdate = useDebouncedCallback(async () => {
    if (isLoadingState || stateRef.current.inputImages.length === 0) {
       // If no input images, clear processedFileId if it exists and is temporary
      if (stateRef.current.processedFileId) {
        const fileInfo = await getFile(stateRef.current.processedFileId);
        if (fileInfo && fileInfo.isTemporary) {
          await markFileAsTemporary(stateRef.current.processedFileId); // Mark for cleanup
          await cleanupOrphanedTemporaryFiles([stateRef.current.processedFileId]);
          setToolStateInternal(prev => ({ ...prev, processedFileId: null, lastUserGivenFilename: null }));
        } else if (!fileInfo) { // File ID in state but not in DB
           setToolStateInternal(prev => ({ ...prev, processedFileId: null, lastUserGivenFilename: null }));
        }
      }
      return;
    }

    const blob = await generateBlendedImageBlob();
    if (!blob) return;

    const tempFilename = `blended-output-${Date.now()}.png`;
    let newProcessedFileId = stateRef.current.processedFileId;

    if (newProcessedFileId) {
      const existingFile = await getFile(newProcessedFileId);
      if (existingFile && existingFile.isTemporary) {
        await updateFileBlob(newProcessedFileId, blob, false); // Don't regen thumbnail for temp processing
      } else {
        // Existing is permanent or doesn't exist, create new temp
        newProcessedFileId = await addFile(blob, tempFilename, 'image/png', true, toolRoute);
      }
    } else {
      newProcessedFileId = await addFile(blob, tempFilename, 'image/png', true, toolRoute);
    }
    
    if (newProcessedFileId !== stateRef.current.processedFileId) {
       // If old processedFileId was temporary and different, clean it up
      if (stateRef.current.processedFileId && stateRef.current.processedFileId !== newProcessedFileId) {
        const oldFileInfo = await getFile(stateRef.current.processedFileId);
        if (oldFileInfo && oldFileInfo.isTemporary) {
          await markFileAsTemporary(stateRef.current.processedFileId);
          await cleanupOrphanedTemporaryFiles([stateRef.current.processedFileId]);
        }
      }
      setToolStateInternal(prev => ({ ...prev, processedFileId: newProcessedFileId, lastUserGivenFilename: null }));
    }
  }, AUTO_BLEND_DEBOUNCE_MS);

  useEffect(() => {
    if (!isLoadingState) {
      debouncedBlendAndUpdate();
    }
  }, [state.inputImages, state.outputWidth, state.outputHeight, state.backgroundColor, state.transparentBackground, debouncedBlendAndUpdate, isLoadingState]);


  const addImages = useCallback(async (files: StoredFile[]) => {
    const newBlenderImages: BlenderImage[] = files
      .filter(f => f.type?.startsWith('image/'))
      .map((file, idx) => ({
        instanceId: uuidv4(),
        imageId: file.id,
        filename: file.filename,
        opacity: 1,
        blendMode: 'source-over' as GlobalCompositeOperation,
        order: (stateRef.current.inputImages.length > 0 ? Math.max(...stateRef.current.inputImages.map(im => im.order)) : -1) + 1 + idx,
        originalWidth: 0, // Will be updated by effect
        originalHeight: 0, // Will be updated by effect
      }));

    if (newBlenderImages.length > 0) {
      setToolStateInternal(prev => ({
        ...prev,
        inputImages: [...prev.inputImages, ...newBlenderImages],
      }));
    }
  }, [setToolStateInternal]);

  const removeImage = useCallback(async (instanceId: string) => {
    const imageToRemove = stateRef.current.inputImages.find(img => img.instanceId === instanceId);
    setToolStateInternal(prev => ({
      ...prev,
      inputImages: prev.inputImages.filter(img => img.instanceId !== instanceId),
    }));
    if (imageToRemove) {
        const isStillUsed = stateRef.current.inputImages.some(img => img.imageId === imageToRemove.imageId && img.instanceId !== instanceId);
        if (!isStillUsed) {
            const fileInfo = await getFile(imageToRemove.imageId);
            if (fileInfo && fileInfo.isTemporary) {
                await markFileAsTemporary(imageToRemove.imageId);
                await cleanupOrphanedTemporaryFiles([imageToRemove.imageId]);
            }
        }
    }
  }, [setToolStateInternal, getFile, markFileAsTemporary, cleanupOrphanedTemporaryFiles]);

  const updateImage = useCallback((instanceId: string, updates: Partial<BlenderImage>) => {
    setToolStateInternal(prev => ({
      ...prev,
      inputImages: prev.inputImages.map(img =>
        img.instanceId === instanceId ? { ...img, ...updates } : img
      ),
    }));
  }, [setToolStateInternal]);

  const reorderImage = useCallback((instanceId: string, direction: 'up' | 'down') => {
    setToolStateInternal(prev => {
      const images = [...prev.inputImages];
      const currentIndex = images.findIndex(img => img.instanceId === instanceId);
      if (currentIndex === -1) return prev;

      const currentOrder = images[currentIndex].order;
      let targetOrder: number;

      if (direction === 'up') { // Move towards start of array (visually left / earlier in order)
        if (currentIndex === 0) return prev;
        targetOrder = images[currentIndex - 1].order;
        images[currentIndex - 1].order = currentOrder;
      } else { // Move towards end of array (visually right / later in order)
        if (currentIndex === images.length - 1) return prev;
        targetOrder = images[currentIndex + 1].order;
        images[currentIndex + 1].order = currentOrder;
      }
      images[currentIndex].order = targetOrder;
      
      // Normalize order to be sequential 0, 1, 2...
      images.sort((a,b) => a.order - b.order);
      images.forEach((img, idx) => img.order = idx);

      return { ...prev, inputImages: images };
    });
  }, [setToolStateInternal]);


  const updateSetting = useCallback(<K extends keyof ImageBlenderToolState>(key: K, value: ImageBlenderToolState[K]) => {
    setToolStateInternal(prev => ({ ...prev, [key]: value }));
  }, [setToolStateInternal]);

  const clearAll = useCallback(async () => {
    const oldInputImageIds = [...new Set(stateRef.current.inputImages.map(img => img.imageId))];
    const oldProcessedId = stateRef.current.processedFileId;
    
    await clearStateAndPersist(); // This resets toolState to DEFAULT_STATE

    const idsToCleanup: string[] = [];
    if (oldProcessedId) {
        const fileInfo = await getFile(oldProcessedId);
        if (fileInfo && fileInfo.isTemporary) idsToCleanup.push(oldProcessedId);
    }
    for (const imgId of oldInputImageIds) {
        const fileInfo = await getFile(imgId);
        if (fileInfo && fileInfo.isTemporary) idsToCleanup.push(imgId);
    }
    if (idsToCleanup.length > 0) {
        for (const id of idsToCleanup) await markFileAsTemporary(id);
        await cleanupOrphanedTemporaryFiles(idsToCleanup);
    }
  }, [clearStateAndPersist, getFile, markFileAsTemporary, cleanupOrphanedTemporaryFiles]);

  const saveOutputPermanently = useCallback(async (filename: string): Promise<string | null> => {
    if (!stateRef.current.processedFileId) return null;
    
    const success = await makeFilePermanentAndUpdate(stateRef.current.processedFileId, filename);
    if (success) {
      setToolStateInternal(prev => ({ ...prev, lastUserGivenFilename: filename }));
      return stateRef.current.processedFileId;
    }
    return null;
  }, [makeFilePermanentAndUpdate, setToolStateInternal]);

  const getBlenderImageWithPreviewUrl = useCallback((instanceId: string): BlenderImage | undefined => {
    const blenderImage = state.inputImages.find(img => img.instanceId === instanceId);
    if (blenderImage) {
      return {
        ...blenderImage,
        previewUrl: objectUrlsRef.current.get(blenderImage.imageId)
      };
    }
    return undefined;
  }, [state.inputImages]);

  const isLoadingAnyImage = useMemo(() => {
    return Object.values(imageLoadingStatus).some(s => s === 'loading');
  }, [imageLoadingStatus]);

  return {
    state,
    isLoadingState,
    errorLoadingState,
    isBlending,
    isLoadingHtmlImages: isLoadingAnyImage,
    htmlImageLoadingError,
    addImages,
    removeImage,
    updateImage,
    reorderImage,
    updateSetting,
    clearAll,
    saveStateNow,
    saveOutputPermanently,
    getBlenderImageWithPreviewUrl,
    generateBlendedImageBlob, // Expose for manual trigger if needed, or for SendToTool
  };
}