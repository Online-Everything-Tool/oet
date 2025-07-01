'use client';

import React, { useEffect, useRef, useState, memo } from 'react';
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { DocumentCheckIcon } from '@heroicons/react/24/solid';

interface PageThumbnailProps {
  page: PDFPageProxy;
  isSelected: boolean;
  onSelect: () => void;
  pageNumber: number;
}

const PageThumbnail: React.FC<PageThumbnailProps> = ({
  page,
  isSelected,
  onSelect,
  pageNumber,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let renderTask: RenderTask | null = null;

    const renderPage = async () => {
      if (!canvasRef.current) return;
      setIsLoading(true);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale: 0.3 }); // Low-res scale for thumbnail
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      renderTask = page.render({ canvasContext: context, viewport: viewport });

      try {
        await renderTask.promise;
        if (isMounted) setIsLoading(false);
      } catch (error) {
        // We can ignore the "cancelled" error which is expected on fast unmounts
        if ((error as Error).name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${page.pageNumber}:`, error);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [page]);

  return (
    <div
      onClick={onSelect}
      className={`relative border-2 rounded-md shadow-sm cursor-pointer transition-all duration-150 ease-in-out bg-white ${isSelected ? 'border-[rgb(var(--color-border-info))]' : 'border-transparent hover:border-[rgb(var(--color-border-soft))]'}`}
    >
      <div className="relative aspect-[8.5/11] w-full flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          className={`transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        />
        {isLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>
        )}
      </div>
      <div className="absolute bottom-1 right-1 text-xs bg-black/50 text-white px-1.5 py-0.5 rounded">
        {pageNumber}
      </div>
      {isSelected && (
        <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center">
          <DocumentCheckIcon className="h-8 w-8 text-white drop-shadow-lg" />
        </div>
      )}
    </div>
  );
};

export default memo(PageThumbnail);
