// /app/tool/_components/ToolHeader.tsx

import { ToolMetadata } from '@/src/types/tools';
import React from 'react';

interface ToolHeaderProps {
  toolMetadata: ToolMetadata;
}

/**
 * Renders the standardized H1 title and description paragraph
 * for a tool page, based on data passed from its metadata.
 */
export default function ToolHeader({ toolMetadata }: ToolHeaderProps) {
  return (
    <div className="mb-2 border-b pb-2">
      <h1 className="text-3xl font-bold text-[rgb(var(--color-text-emphasis))] mb-2">
        {toolMetadata.title || '[Tool Title Missing]'} {/* Fallback text */}
      </h1>
      {toolMetadata.description && (
        <p className="text-lg text-[rgb(var(--color-text-subtle))]">
          {toolMetadata.description}
        </p>
      )}
    </div>
  );
}
