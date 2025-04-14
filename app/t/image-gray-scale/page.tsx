'use client';

import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { useHistory } from '../../context/HistoryContext';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';

export default function ImageGrayScalePage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [grayScaleImage, setGrayScaleImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { addHistoryEntry } = useHistory();

  const handleImageChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageSrc(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSrc) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg; // red
        data[i + 1] = avg; // green
        data[i + 2] = avg; // blue
      }
      ctx.putImageData(imageData, 0, 0);
      setGrayScaleImage(canvas.toDataURL());
      addHistoryEntry({
        toolName: metadata.title,
        toolRoute: '/t/image-gray-scale',
        action: 'grayscale',
        input: imageSrc,
        output: canvas.toDataURL(),
        status: 'success',
      });
    };
    img.onerror = (error) => {
      console.error("Error loading image:", error);
      addHistoryEntry({
        toolName: metadata.title,
        toolRoute: '/t/image-gray-scale',
        action: 'grayscale-failed',
        input: imageSrc,
        output: 'Error loading or processing image',
        status: 'error',
      });
    };
    img.src = imageSrc;
  }, [imageSrc, addHistoryEntry]);

  const handleDownload = useCallback(() => {
    if (!grayScaleImage) return;
    const link = document.createElement('a');
    link.href = grayScaleImage;
    link.download = `grayscale-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [grayScaleImage]);

  return (
    <div className="flex flex-col gap-6">
      <ToolHeader title={metadata.title} description={metadata.description} />
      <div className="flex flex-col gap-4">
        <label htmlFor="imageUpload" className="block text-sm font-medium mb-2">
          Choose Image
        </label>
        <input
          type="file"
          id="imageUpload"
          accept="image/*"
          onChange={handleImageChange}
        />
        {isLoading && <p>Processing...</p>}
        {grayScaleImage && (
          <div>
            <img src={grayScaleImage} alt="Grayscale Image" />
            <button onClick={handleDownload}>Download</button>
          </div>
        )}
      </div>
    </div>
  );
}
