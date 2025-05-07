// FILE: app/_components/RecentlyUsedItem.tsx
import React from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import type { HistoryEntry } from '@/src/types/history';
import type { ToolMetadata } from '@/src/types/tools';
import HistoryOutputPreview from './HistoryOutputPreview';

interface RecentlyUsedItemProps {
  entry: HistoryEntry;
  metadata: ToolMetadata | null;
  displayMode: 'homepage' | 'toolpage';
}

const RecentlyUsedItem = React.memo(
  ({ entry, metadata, displayMode }: RecentlyUsedItemProps) => {
    const eventTimestamp = entry.eventTimestamp;
    const timeAgo = formatDistanceToNowStrict(new Date(eventTimestamp), {
      addSuffix: false,
    });
    const formattedTimestamp = new Date(eventTimestamp).toLocaleString();

    const formatTime = (time: string): string => {
      time = time.replace(/ minutes?/, 'm');
      time = time.replace(/ hours?/, 'h');
      time = time.replace(/ days?/, 'd');
      time = time.replace(/ months?/, 'mo');
      time = time.replace(/ years?/, 'y');

      if (
        time.startsWith('0 second') ||
        time.includes('second') ||
        time.startsWith('less than')
      )
        return '<1m';
      return time;
    };

    if (displayMode === 'homepage') {
      return (
        <Link
          href={entry.toolRoute}
          className="flex flex-col items-center p-2 gap-1 hover:bg-[rgba(var(--color-border-base)/0.1)] rounded transition-colors duration-100 w-28 text-center group"
          title={`${entry.toolName}\nUsed: ${formattedTimestamp}`}
        >
          {/* Icon/Preview container */}
          <div className="flex-shrink-0 w-16 h-16 mx-auto mb-1 flex items-center justify-center bg-[rgb(var(--color-bg-subtle))] rounded border border-[rgb(var(--color-border-base))] overflow-hidden">
            <HistoryOutputPreview entry={entry} metadata={metadata} />
          </div>
          {/* Tool Name */}
          <div className="text-xs font-medium text-[rgb(var(--color-text-link))] group-hover:underline truncate block w-full">
            {entry.toolName}
          </div>
          {/* Time Ago */}
          <div className="text-[10px] text-[rgb(var(--color-text-muted))]">
            {formatTime(timeAgo)} ago
          </div>
        </Link>
      );
    } else {
      return (
        <div className="flex items-center p-2 gap-3 hover:bg-[rgba(var(--color-border-base)/0.1)] rounded transition-colors duration-100">
          {/* Icon/Preview container */}
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-[rgb(var(--color-bg-subtle))] rounded border border-[rgb(var(--color-border-base))] overflow-hidden">
            <HistoryOutputPreview entry={entry} metadata={metadata} />
          </div>
          {/* Link */}
          <div className="flex-grow overflow-hidden">
            <Link
              href={entry.toolRoute}
              className="text-sm font-medium text-[rgb(var(--color-text-link))] hover:underline truncate block"
              title={`Go to ${entry.toolName}`}
            >
              {entry.toolName}
            </Link>
            {/* Optionally display input summary here if needed later */}
          </div>
          {/* Time Ago */}
          <div
            className="text-xs text-right text-[rgb(var(--color-text-muted))] flex-shrink-0 w-12"
            title={formattedTimestamp}
          >
            {formatTime(timeAgo)} ago
          </div>
        </div>
      );
    }
  }
);

RecentlyUsedItem.displayName = 'RecentlyUsedItem';

export default RecentlyUsedItem;
