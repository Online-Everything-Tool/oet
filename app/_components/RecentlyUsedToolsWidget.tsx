// --- FILE: app/_components/RecentlyUsedToolsWidget.tsx ---
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  useRecentlyUsed,
  RecentToolEntry,
} from '../context/RecentlyUsedContext';
import { useFileLibrary } from '../context/FileLibraryContext';
import { getFileIconClassName } from '@/app/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';

const MAX_DISPLAY_ITEMS_HEADER = 5;

interface RecentlyUsedToolsWidgetProps {
  currentToolDirectiveToExclude?: string;
  onItemClick?: () => void;
}

const RecentToolItem: React.FC<{
  entry: RecentToolEntry;
}> = React.memo(({ entry }) => {
  const { getFile } = useFileLibrary();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);

  const currentImageIdForUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let objectUrlCreatedInThisEffectRun: string | null = null;

    if (entry.previewType === 'image' && entry.previewImageId) {
      if (
        currentImageIdForUrlRef.current !== entry.previewImageId ||
        !imageUrl
      ) {
        setIsLoadingImage(true);

        if (
          imageUrl &&
          currentImageIdForUrlRef.current &&
          currentImageIdForUrlRef.current !== entry.previewImageId
        ) {
          URL.revokeObjectURL(imageUrl);
        }
        setImageUrl(null);
        currentImageIdForUrlRef.current = entry.previewImageId;

        getFile(entry.previewImageId)
          .then((storedFile) => {
            if (currentImageIdForUrlRef.current !== entry.previewImageId) {
              return;
            }
            if (storedFile) {
              const blobToUse = storedFile.thumbnailBlob || storedFile.blob;
              if (blobToUse) {
                objectUrlCreatedInThisEffectRun =
                  URL.createObjectURL(blobToUse);
                setImageUrl(objectUrlCreatedInThisEffectRun);
              } else {
                setImageUrl(null);
              }
            } else {
              setImageUrl(null);
            }
          })
          .catch((err) => {
            if (currentImageIdForUrlRef.current !== entry.previewImageId) {
              return;
            }
            console.error(
              `[RecentToolItem] Error fetching image ${entry.previewImageId}:`,
              err
            );
            setImageUrl(null);
          })
          .finally(() => {
            if (currentImageIdForUrlRef.current !== entry.previewImageId) {
              return;
            }
            setIsLoadingImage(false);
          });
      } else {
        setIsLoadingImage(false);
      }
    } else {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      setImageUrl(null);
      currentImageIdForUrlRef.current = null;
      setIsLoadingImage(false);
    }

    return () => {
      if (objectUrlCreatedInThisEffectRun) {
        URL.revokeObjectURL(objectUrlCreatedInThisEffectRun);
      }
    };
  }, [entry.previewType, entry.previewImageId, getFile]);

  const renderPreview = () => {
    if (isLoadingImage && entry.previewType === 'image') {
      return (
        <div className="animate-pulse bg-gray-200 h-full w-full rounded"></div>
      );
    }
    switch (entry.previewType) {
      case 'image':
        return imageUrl ? (
          <div className="relative w-full h-full">
            <Image
              src={imageUrl}
              alt={entry.displayableItemName || 'Image preview'}
              fill
              className="object-contain rounded"
              unoptimized
            />
          </div>
        ) : (
          <span
            className={`recent-tool-preview-icon icon-size-header ${getFileIconClassName('image.png')} text-base`}
            aria-label="Image icon placeholder"
          ></span>
        );
      case 'icon':
        return (
          <span
            className={`recent-tool-preview-icon icon-size-header ${getFileIconClassName(entry.previewIconClassContent || 'unknown.txt')} text-base`}
            aria-label="File icon"
          ></span>
        );
      default:
        return (
          <span
            className={`recent-tool-preview-icon icon-size-header ${getFileIconClassName('file.txt')} text-base opacity-60`}
            aria-label="Generic file icon"
          ></span>
        );
    }
  };

  return (
    <Link
      href={`/tool/${entry.directive}/`}
      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
    >
      <div className="flex items-center">
        <div className="flex-shrink-0 h-10 w-10 mr-3 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
          {renderPreview()}
        </div>
        <div className="flex-grow min-w-0">
          <div className="flex items-baseline justify-between w-full">
            <h3
              className="text-sm font-medium text-gray-900 truncate"
              title={entry.title}
            >
              {entry.title}
            </h3>
            <span className="text-xs text-gray-400 ml-auto whitespace-nowrap pl-2">
              {formatDistanceToNowStrict(new Date(entry.lastModified), {
                addSuffix: true,
              })}
            </span>
          </div>
          {entry.displayableItemName && (
            <p
              className="text-xs text-gray-500 truncate"
              title={entry.displayableItemName}
            >
              {entry.displayableItemName}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
});
RecentToolItem.displayName = 'RecentToolItem';

export default function RecentlyUsedToolsWidget({
  currentToolDirectiveToExclude,
  onItemClick,
}: RecentlyUsedToolsWidgetProps) {
  const { recentTools, isLoaded } = useRecentlyUsed();

  const filteredAndSortedTools = useMemo(() => {
    let tools = recentTools;
    if (currentToolDirectiveToExclude) {
      tools = tools.filter(
        (tool) => tool.directive !== currentToolDirectiveToExclude
      );
    }
    return tools;
  }, [recentTools, currentToolDirectiveToExclude]);

  const toolsToDisplay = filteredAndSortedTools.slice(
    0,
    MAX_DISPLAY_ITEMS_HEADER
  );

  const containerClasses =
    'py-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none min-w-[300px] max-w-sm';
  const titleClasses =
    'px-4 pt-3 pb-2 text-xs font-medium text-gray-500 uppercase tracking-wider';
  const listClasses = 'max-h-[400px] overflow-y-auto custom-scrollbar';

  if (!isLoaded) {
    return (
      <div className={containerClasses}>
        <h2 className={titleClasses}>Recently Used</h2>
        <p className="italic animate-pulse text-xs px-4 py-2 text-gray-500">
          Loading...
        </p>
      </div>
    );
  }

  if (toolsToDisplay.length === 0) {
    return (
      <div className={containerClasses}>
        <h2 className={titleClasses}>Recently Used Tools</h2>
        <p className="text-sm text-gray-500 italic text-center px-4 py-3">
          No other recent tools.
        </p>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="flex justify-between items-center">
        <h2 className={titleClasses}>Recently Used Tools</h2>
      </div>
      <ul className={listClasses}>
        {toolsToDisplay.map((entry) => (
          <li
            key={entry.directive}
            className="border-b border-gray-100 last:border-b-0"
            onClick={onItemClick}
          >
            <RecentToolItem entry={entry} />
          </li>
        ))}
      </ul>
    </div>
  );
}
