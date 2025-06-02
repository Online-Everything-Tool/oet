import { useState, useEffect, useCallback, useRef } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { rgbToHex } from '@/app/lib/colorUtils'; // Assuming this utility exists

export interface PickedColorData {
  hex: string;
  rgbString: string;
  r: number;
  g: number;
  b: number;
}

interface UseImageEyeDropperLogicReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isLoadingImage: boolean;
  imageError: string | null;
  pickedColorData: PickedColorData | null;
  handleCanvasClick: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  clearLogicState: () => void;
  imageNaturalDimensions: { width: number; height: number } | null;
}

export default function useImageEyeDropperLogic(
  selectedFileId: string | null
): UseImageEyeDropperLogicReturn {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [pickedColorData, setPickedColorData] = useState<PickedColorData | null>(null);
  const [imageNaturalDimensions, setImageNaturalDimensions] = useState<{ width: number; height: number } | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const { getFile } = useFileLibrary();

  const clearLogicState = useCallback(() => {
    setIsLoadingImage(false);
    setImageError(null);
    setPickedColorData(null);
    setImageNaturalDimensions(null);
    if (imageRef.current) {
      imageRef.current.src = '';
      imageRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.width = 300; // Reset to default
      canvas.height = 150;
    }
  }, []);

  useEffect(() => {
    if (!selectedFileId) {
      clearLogicState();
      return;
    }

    setIsLoadingImage(true);
    setImageError(null);
    setPickedColorData(null); // Clear previous color when new image is selected
    setImageNaturalDimensions(null);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    getFile(selectedFileId)
      .then((file) => {
        if (!file || !file.blob) {
          throw new Error('Image file or blob not found.');
        }
        if (!file.type?.startsWith('image/')) {
          throw new Error('Selected file is not a valid image type.');
        }

        objectUrlRef.current = URL.createObjectURL(file.blob);
        const img = new Image();
        imageRef.current = img;

        img.onload = () => {
          if (img !== imageRef.current) return; // Stale load
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            setImageNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
              setIsLoadingImage(false);
            } else {
              setImageError('Failed to get canvas context.');
              setIsLoadingImage(false);
            }
          }
        };

        img.onerror = () => {
          if (img !== imageRef.current) return; // Stale load
          setImageError('Failed to load image.');
          setIsLoadingImage(false);
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
          }
        };
        img.src = objectUrlRef.current;
      })
      .catch((err) => {
        setImageError(err.message || 'Error loading image file.');
        setIsLoadingImage(false);
      });

    // Cleanup function
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      imageRef.current = null; // Ensure we don't use stale image on next effect run
    };
  }, [selectedFileId, getFile, clearLogicState]);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current || !imageRef.current.complete || imageRef.current.naturalWidth === 0) {
      setPickedColorData(null);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
        // Click was outside the actual image bounds on a scaled canvas
        setPickedColorData(null);
        return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      try {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const r = pixel[0];
        const g = pixel[1];
        const b = pixel[2];
        // const a = pixel[3] / 255; // Alpha if needed

        const hex = rgbToHex(r, g, b);
        const rgbString = `rgb(${r}, ${g}, ${b})`;
        setPickedColorData({ hex, rgbString, r, g, b });
        setImageError(null); // Clear any previous errors on successful pick
      } catch (e) {
        console.error("Error picking color: ", e);
        setImageError("Could not pick color. The image might be cross-origin or corrupted.");
        setPickedColorData(null);
      }
    }
  }, []);

  return {
    canvasRef,
    isLoadingImage,
    imageError,
    pickedColorData,
    handleCanvasClick,
    clearLogicState,
    imageNaturalDimensions,
  };
}