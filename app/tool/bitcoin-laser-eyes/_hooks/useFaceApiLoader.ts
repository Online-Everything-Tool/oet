// FILE: app/tool/image-bitcoin-laser-eyes/_hooks/useFaceApiLoader.ts
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';

// Corrected path according to your "public/data/<directive>/assets" convention
const MODEL_URL = '/data/image-bitcoin-laser-eyes/face-api-models';

interface UseFaceApiLoaderReturn {
  modelsLoaded: boolean;
  isLoadingModels: boolean;
  errorLoadingModels: string | null;
  loadModels: () => Promise<void>;
  detectFaces: (
    imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
  ) => Promise<faceapi.WithFaceLandmarks<faceapi.WithFaceDetection<{}>>[]>;
}

export default function useFaceApiLoader(): UseFaceApiLoaderReturn {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [errorLoadingModels, setErrorLoadingModels] = useState<string | null>(
    null
  );
  const initialLoadAttemptedRef = useRef(false);

  const loadModels = useCallback(async () => {
    if (modelsLoaded || isLoadingModels) {
      return;
    }

    console.log(
      '[useFaceApiLoader] Attempting to load models from:',
      MODEL_URL
    );
    setIsLoadingModels(true);
    setErrorLoadingModels(null);
    initialLoadAttemptedRef.current = true;

    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      ]);
      console.log('[useFaceApiLoader] Models loaded successfully.');
      setModelsLoaded(true);
    } catch (error) {
      console.error(
        '[useFaceApiLoader] Error loading face-api.js models:',
        error
      );
      setErrorLoadingModels(
        error instanceof Error
          ? error.message
          : 'Failed to load face detection models from server.'
      );
    } finally {
      setIsLoadingModels(false);
    }
  }, [modelsLoaded, isLoadingModels]);

  useEffect(() => {
    if (!initialLoadAttemptedRef.current && typeof window !== 'undefined') {
      loadModels();
    }
  }, [loadModels]);

  const detectFaces = useCallback(
    async (
      imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
    ) => {
      if (!modelsLoaded) {
        console.warn(
          '[useFaceApiLoader] FaceAPI models not loaded. Cannot detect faces.'
        );
        return [];
      }
      try {
        const detections = await faceapi
          .detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();
        return detections;
      } catch (error) {
        console.error('[useFaceApiLoader] Error detecting faces:', error);
        throw error;
      }
    },
    [modelsLoaded]
  );

  return {
    modelsLoaded,
    isLoadingModels,
    errorLoadingModels,
    loadModels,
    detectFaces,
  };
}
