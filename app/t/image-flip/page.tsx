'use client';
import React, { useState } from 'react';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';

export default function ImageFlipPage() {
  const [image, setImage] = useState<File | null>(null);
  const [flippedImage, setFlippedImage] = useState<string | null>(null);
  const [flipType, setFlipType] = useState<'horizontal' | 'vertical'>('horizontal');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImage(e.target.files?.[0]);
  };

  const handleFlip = async () => {
    if (!image) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      await img.decode();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;

      if (ctx) {
        if (flipType === 'horizontal') {
          ctx.scale(-1, 1);
          ctx.translate(-img.width, 0);
        } else {
          ctx.scale(1, -1);
          ctx.translate(0, -img.height);
        }
        ctx.drawImage(img, 0, 0);
        setFlippedImage(canvas.toDataURL());
      }
    };
    reader.readAsDataURL(image);
  };

  const toolTitle = metadata.title || "Image Flipper";
  const toolRoute = "/t/image-flip";

  return (
    <div className="flex flex-col gap-6">
      <ToolHeader title={toolTitle} description={metadata.description || ""} />
      <ToolSuspenseWrapper>
        <div className="flex flex-col gap-4">
          <input type="file" accept="image/*" onChange={handleImageChange} />
          <div>
            <label>
              <input type="radio" value="horizontal" checked={flipType === 'horizontal'} onChange={(e) => setFlipType(e.target.value as 'horizontal')} />
              Horizontal
            </label>
            <label>
              <input type="radio" value="vertical" checked={flipType === 'vertical'} onChange={(e) => setFlipType(e.target.value as 'vertical')} />
              Vertical
            </label>
          </div>
          <button onClick={handleFlip}>Flip Image</button>
          {flippedImage && <img src={flippedImage} alt="Flipped Image" />}
        </div>
      </ToolSuspenseWrapper>
    </div>
  );
}