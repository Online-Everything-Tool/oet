'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseBitcoinLaserEyesOptions {
  modelPath: string;
  laserBeamAssetPath: string;
}

export function useBitcoinLaserEyes(options: UseBitcoinLaserEyesOptions) {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [laserImage, setLaserImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadResources() {
      setIsLoading(true);
      setError(null);
      try {
        const faceapi = await import('face-api.js'); // Dynamic import to resolve build issue

        // Check if nets are already loaded to prevent re-loading
        if (!faceapi.nets.tinyFaceDetector.params) {
           await faceapi.nets.tinyFaceDetector.loadFromUri(options.modelPath);
        }
        if (!faceapi.nets.faceLandmark68TinyNet.params) {
          await faceapi.nets.faceLandmark68TinyNet.loadFromUri(options.modelPath);
        }
        if (!isMounted) return;
        setModelsLoaded(true);

        const img = new Image();
        img.src = options.laserBeamAssetPath;
        await img.decode();
        if (!isMounted) return;
        setLaserImage(img);

      } catch (e) {
        if (isMounted) {
          const errMsg = `Failed to load face detection models or laser asset: ${(e as Error).message}`;
          console.error(errMsg, e);
          setError(errMsg);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadResources();
    return () => {
      isMounted = false;
    };
  }, [options.modelPath, options.laserBeamAssetPath]);

  const applyLaserEyes = useCallback(async (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement
  ) => {
    // Draw original image first
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

    if (isLoading || error || !modelsLoaded || !laserImage) {
      console.warn("BitcoinLaserEyes: Models or laser image not ready. Drawing original image only.");
      if (error) { // Optionally draw error message on canvas
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.font = '16px Arial';
        ctx.fillText(`Error: ${error}`, 10, 20);
      }
      return;
    }
    const faceapi = await import('face-api.js'); // Dynamic import within useCallback

    const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks(true);

    if (detections.length === 0) {
        console.log("BitcoinLaserEyes: No faces detected.");
        // Optionally indicate no faces detected on canvas
        ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
        ctx.font = '16px Arial';
        ctx.fillText("No faces detected", 10, img.naturalHeight - 20);
        return;
    }

    detections.forEach(detection => {
      const landmarks = detection.landmarks;
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();

      [leftEye, rightEye].forEach((eyePoints, eyeIndex) => {
        if (eyePoints.length === 0) return;

        const eyeCenterX = eyePoints.reduce((sum, p) => sum + p.x, 0) / eyePoints.length;
        const eyeCenterY = eyePoints.reduce((sum, p) => sum + p.y, 0) / eyePoints.length;

        const eyeXCoords = eyePoints.map(p => p.x);
        const eyeWidth = Math.max(...eyeXCoords) - Math.min(...eyeXCoords);
        
        const desiredLaserWidthOnFace = eyeWidth * 1.5;
        const laserScale = desiredLaserWidthOnFace / laserImage.width;

        const laserW = laserImage.width * laserScale;
        const laserH = laserImage.height * laserScale;

        ctx.save();
        ctx.translate(eyeCenterX, eyeCenterY);
        
        if (eyeIndex === 0) {
            ctx.scale(-1, 1);
        }

        ctx.drawImage(laserImage, 0, -laserH / 2, laserW, laserH);
        ctx.restore();
      });
    });
  }, [modelsLoaded, laserImage, isLoading, error]);

  return { applyLaserEyes, isLoadingResources: isLoading, resourcesError: error };
}
