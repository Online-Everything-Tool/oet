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

const MAX_DISPLAY_ITEMS_DEFAULT = 5;
const MAX_DISPLAY_ITEMS_HEADER = 5;

interface RecentlyUsedToolsWidgetProps {
  variant?: 'default' | 'header';
  currentToolDirectiveToExclude?: string;
}

const RecentToolItem: React.FC<{
  entry: RecentToolEntry;
  variant: 'default' | 'header';
}> = React.memo(({ entry, variant }) => {
  const { getFile } = useFileLibrary();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const activeImageUrlIdRef = useRef<string | null>(null);

  useEffect(() => {
    let objectUrlCreatedInThisEffectRun: string | null = null;

    if (entry.previewType === 'image' && entry.previewImageId) {
      if (entry.previewImageId !== activeImageUrlIdRef.current || !imageUrl) {
        setIsLoadingImage(true);

        setImageUrl(null);
        activeImageUrlIdRef.current = entry.previewImageId;

        getFile(entry.previewImageId)
          .then((storedFile) => {
            if (activeImageUrlIdRef.current !== entry.previewImageId) return;
            if (storedFile) {
              const blobToUse = storedFile.thumbnailBlob || storedFile.blob;
              if (blobToUse) {
                objectUrlCreatedInThisEffectRun =
                  URL.createObjectURL(blobToUse);
                setImageUrl(objectUrlCreatedInThisEffectRun);
              } else {
                setImageUrl(null);
                activeImageUrlIdRef.current = null;
              }
            } else {
              setImageUrl(null);
              activeImageUrlIdRef.current = null;
            }
          })
          .catch((err) => {
            if (activeImageUrlIdRef.current !== entry.previewImageId) return;
            console.error(
              `[RecentToolItem] Error fetching image ${entry.previewImageId}:`,
              err
            );
            setImageUrl(null);
            activeImageUrlIdRef.current = null;
          })
          .finally(() => {
            if (activeImageUrlIdRef.current !== entry.previewImageId) return;
            setIsLoadingImage(false);
          });
      } else {
        setIsLoadingImage(false);
      }
    } else {
      setImageUrl(null);
      activeImageUrlIdRef.current = null;
      setIsLoadingImage(false);
    }

    return () => {
      if (objectUrlCreatedInThisEffectRun) {
        URL.revokeObjectURL(objectUrlCreatedInThisEffectRun);
      }
    };
  }, [entry.previewType, entry.previewImageId, getFile, imageUrl]);

  useEffect(() => {
    const urlInStateWhenEffectRan = imageUrl;
    return () => {
      if (urlInStateWhenEffectRan) {
        URL.revokeObjectURL(urlInStateWhenEffectRan);
      }
    };
  }, [imageUrl]);

  const itemLinkClasses =
    variant === 'header'
      ? 'block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900'
      : 'block p-3 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-subtle))] hover:bg-[rgba(var(--color-border-base)/0.1)] hover:border-[rgb(var(--color-text-link))] transition-colors duration-150';

  const toolTitleClasses =
    variant === 'header'
      ? 'text-sm font-medium text-gray-900 truncate'
      : 'text-base font-semibold text-[rgb(var(--color-text-link))] truncate';

  const previewOuterContainerClasses =
    variant === 'header'
      ? 'flex-shrink-0 h-6 w-6 mr-3 bg-gray-100 rounded flex items-center justify-center overflow-hidden'
      : 'w-full h-24 mb-2 bg-gray-100 rounded flex items-center justify-center overflow-hidden';

  const iconFontClasses = variant === 'header' ? 'text-base' : 'text-3xl';

  const displayableNameClasses =
    variant === 'header'
      ? 'text-xs text-gray-500 truncate'
      : 'text-xs text-center text-[rgb(var(--color-text-muted))] truncate mt-1';

  const timeAgoClasses =
    variant === 'header'
      ? 'text-xs text-gray-400 ml-auto whitespace-nowrap pl-2'
      : 'text-xs text-[rgb(var(--color-text-muted))] mt-0.5';

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
            className={`recent-tool-preview-icon ${variant === 'header' ? 'icon-size-header' : 'icon-size-default'} ${getFileIconClassName('image.png')} ${iconFontClasses}`}
            aria-label="Image icon placeholder"
          ></span>
        );
      case 'icon':
        return (
          <span
            className={`recent-tool-preview-icon ${variant === 'header' ? 'icon-size-header' : 'icon-size-default'} ${getFileIconClassName(entry.previewIconClassContent || 'unknown.txt')} ${iconFontClasses}`}
            aria-label="File icon"
          ></span>
        );
      default:
        return (
          <span
            className={`recent-tool-preview-icon ${variant === 'header' ? 'icon-size-header' : 'icon-size-default'} ${getFileIconClassName('file.txt')} ${iconFontClasses} opacity-60`}
            aria-label="Generic file icon"
          ></span>
        );
    }
  };

  return (
    <Link href={`/tool/${entry.directive}/`} className={itemLinkClasses}>
      <div
        className={`flex ${variant === 'header' ? 'items-center' : 'flex-col'}`}
      >
        <div className={previewOuterContainerClasses}>{renderPreview()}</div>
        <div
          className={`flex-grow ${variant === 'header' ? 'min-w-0' : 'w-full text-center'}`}
        >
          <div
            className={`${variant === 'header' ? 'flex items-baseline justify-between w-full' : ''}`}
          >
            <h3 className={toolTitleClasses} title={entry.title}>
              {entry.title}
            </h3>
            {variant === 'header' && (
              <span className={timeAgoClasses}>
                {formatDistanceToNowStrict(new Date(entry.lastModified), {
                  addSuffix: true,
                  unit: 'second',
                })}
              </span>
            )}
          </div>
          {entry.displayableItemName && (
            <p
              className={displayableNameClasses}
              title={entry.displayableItemName}
            >
              {entry.displayableItemName}
            </p>
          )}
          {variant === 'default' && (
            <p className={timeAgoClasses}>
              {formatDistanceToNowStrict(new Date(entry.lastModified), {
                addSuffix: true,
              })}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
});
RecentToolItem.displayName = 'RecentToolItem';

export default function RecentlyUsedToolsWidget({
  variant = 'default',
  currentToolDirectiveToExclude,
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

  const maxItems =
    variant === 'header' ? MAX_DISPLAY_ITEMS_HEADER : MAX_DISPLAY_ITEMS_DEFAULT;
  const toolsToDisplay = filteredAndSortedTools.slice(0, maxItems);

  const containerClasses =
    variant === 'header'
      ? 'py-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none min-w-[300px] max-w-sm'
      : 'p-4 border rounded-lg shadow-sm bg-[rgb(var(--color-bg-component))] mb-8';

  const titleClasses =
    variant === 'header'
      ? 'px-4 pt-3 pb-2 text-xs font-medium text-gray-500 uppercase tracking-wider'
      : 'text-lg font-semibold text-[rgb(var(--color-text-base))]';

  const listClasses =
    variant === 'header'
      ? 'max-h-[400px] overflow-y-auto'
      : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3';

  if (!isLoaded) {
    const loadingTitleMargin = variant === 'default' ? 'mb-3' : '';
    return (
      <div className={containerClasses}>
        <h2 className={`${titleClasses} ${loadingTitleMargin}`}>
          Recently Used
        </h2>
        <p
          className={`italic animate-pulse ${variant === 'header' ? 'text-xs px-4 py-2 text-gray-500' : 'text-sm text-center p-4 text-[rgb(var(--color-text-muted))]'}`}
        >
          Loading...
        </p>
      </div>
    );
  }

  if (toolsToDisplay.length === 0) {
    if (variant === 'header') return null;
    return (
      <div className={containerClasses}>
        <h2 className={`${titleClasses} mb-3`}>Recently Used</h2>{' '}
        {/* Corrected: always mb-3 here */}
        <p className="text-sm text-[rgb(var(--color-text-muted))] italic text-center py-4">
          No tools with recent activity to display.
        </p>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div
        className={`flex justify-between items-center ${variant === 'default' ? 'mb-3' : ''}`}
      >
        <h2 className={titleClasses}>Recently Used Tools</h2>
      </div>
      <ul className={listClasses}>
        {toolsToDisplay.map((entry) => (
          <li
            key={entry.directive}
            className={
              variant === 'header'
                ? 'border-b border-gray-100 last:border-b-0'
                : ''
            }
          >
            <RecentToolItem entry={entry} variant={variant} />
          </li>
        ))}
      </ul>
    </div>
  );
}
