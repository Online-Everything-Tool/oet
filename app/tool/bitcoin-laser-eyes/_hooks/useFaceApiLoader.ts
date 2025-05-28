// FILE: app/tool/image-bitcoin-laser-eyes/_hooks/useFaceApiLoader.ts
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';

// Corrected path according to your "public/data/<directive>/assets" convention
const MODEL_URL = '/data/image-bitcoin-laser-eyes/face-api-models';
// const MODEL_URL = '/models/face-api'; // Original AI suggestion

interface UseFaceApiLoaderReturn {
  modelsLoaded: boolean;
  isLoadingModels: boolean;
  errorLoadingModels: string | null;
  loadModels: () => Promise<void>;
  detectFaces: (
    imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
  ) => Promise<faceapi.WithFaceLandmarks<faceapi.WithFaceDetection<unknown>>[]>;
}

export default function useFaceApiLoader(): UseFaceApiLoaderReturn {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [errorLoadingModels, setErrorLoadingModels] = useState<string | null>(
    null
  );
  // useRef to track if the initial load attempt has been made,
  // to prevent multiple auto-loads if component re-renders.
  const initialLoadAttemptedRef = useRef(false);

  const loadModels = useCallback(async () => {
    // Check if already loaded or currently loading
    if (modelsLoaded || isLoadingModels) {
      return;
    }

    console.log(
      '[useFaceApiLoader] Attempting to load models from:',
      MODEL_URL
    );
    setIsLoadingModels(true);
    setErrorLoadingModels(null);
    initialLoadAttemptedRef.current = true; // Mark that an attempt is being made / has been made

    try {
      // Using specific models mentioned in the AI feedback for clarity
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        // Add other models if your drawLaserEyesFunction intends to use more, e.g., for expressions or age/gender
        // faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        // faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
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
      // Keep initialLoadAttemptedRef.current as true, because an attempt was made.
      // The UI can offer a retry button that calls loadModels() again.
      // If we reset initialLoadAttemptedRef to false here, an auto-retry might loop on error.
    } finally {
      setIsLoadingModels(false);
    }
  }, [modelsLoaded, isLoadingModels]); // Dependencies are stable states managed by this hook

  // Optional: Auto-initiate model loading once when hook is first used, if desired
  // Or, require the consuming component to call loadModels() explicitly.
  // For auto-load:
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
        // Could throw error or return empty array, based on desired behavior
        // throw new Error('FaceAPI models are not loaded. Call loadModels() first.');
        return [];
      }
      try {
        // Ensure you are using the correct options for the loaded detector (TinyFaceDetectorOptions for tinyFaceDetector)
        const detections = await faceapi
          .detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(); // Use .withFaceLandmarks() as per model loaded
        return detections;
      } catch (error) {
        console.error('[useFaceApiLoader] Error detecting faces:', error);
        throw error; // Re-throw for the calling component to handle if needed
      }
    },
    [modelsLoaded] // Depends only on modelsLoaded state
  );

  return {
    modelsLoaded,
    isLoadingModels,
    errorLoadingModels,
    loadModels, // Expose loadModels so components can trigger a retry if needed
    detectFaces,
  };
}
