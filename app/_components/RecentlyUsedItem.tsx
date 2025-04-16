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

const RecentlyUsedItem = React.memo(({ entry, metadata, displayMode }: RecentlyUsedItemProps) => {
    const latestTimestamp = entry.timestamps[0];
    const timeAgo = formatDistanceToNowStrict(new Date(latestTimestamp), { addSuffix: false });

    const formatTime = (time: string): string => {
        time = time.replace(/ minutes?/, 'm');
        time = time.replace(/ hours?/, 'h');
        time = time.replace(/ days?/, 'd');
        time = time.replace(/ months?/, 'mo');
        time = time.replace(/ years?/, 'y');
        if (time.startsWith('less than') || time.includes('second')) return '< 1m';
        return time;
    };

    if (displayMode === 'homepage') {
        return (
            <div className="flex flex-col items-start p-2 gap-1 hover:bg-[rgba(var(--color-border-base)/0.1)] rounded transition-colors duration-100 w-28">
                <Link href={entry.toolRoute} className="text-sm font-medium text-[rgb(var(--color-text-link))] hover:underline truncate block w-full text-center">
                    {entry.toolName}
                </Link>
                <div className="text-xs text-[rgb(var(--color-text-muted))]" title={new Date(latestTimestamp).toLocaleString()}>
                    {formatTime(timeAgo)} ago
                </div>
                {/* Icon/Preview container */}
                <div className="flex-shrink-0 w-16 h-16 mx-auto mt-1 flex items-center justify-center bg-[rgb(var(--color-bg-subtle))] rounded border border-[rgb(var(--color-border-base))] overflow-hidden">
                    {/* Always render preview inside the box */}
                    <HistoryOutputPreview entry={entry} metadata={metadata} />
                </div>
            </div>
        );
    } else {
        // Toolpage layout
        return (
            <div className="flex items-center p-2 gap-3 hover:bg-[rgba(var(--color-border-base)/0.1)] rounded transition-colors duration-100">
                 {/* Icon/Preview container */}
                 <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-[rgb(var(--color-bg-subtle))] rounded border border-[rgb(var(--color-border-base))] overflow-hidden">
                     {/* Always render preview inside the box */}
                     <HistoryOutputPreview entry={entry} metadata={metadata} />
                </div>
                {/* Link */}
                <div className="flex-grow overflow-hidden">
                    <Link href={entry.toolRoute} className="text-sm font-medium text-[rgb(var(--color-text-link))] hover:underline truncate block">
                        {entry.toolName}
                    </Link>
                    {/* --- REMOVED Secondary text preview logic --- */}
                </div>
                 {/* Time Ago */}
                <div className="text-xs text-right text-[rgb(var(--color-text-muted))] flex-shrink-0 w-10" title={new Date(latestTimestamp).toLocaleString()}>
                    {formatTime(timeAgo)}
                </div>
            </div>
        );
    }
});

RecentlyUsedItem.displayName = 'RecentlyUsedItem';

export default RecentlyUsedItem;