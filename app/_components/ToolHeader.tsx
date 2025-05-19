// /app/tool/_components/ToolHeader.tsx

import React from 'react';

interface ToolHeaderProps {
  title: string;
  description: string;
}

/**
 * Renders the standardized H1 title and description paragraph
 * for a tool page, based on data passed from its metadata.
 */
export default function ToolHeader({ title, description }: ToolHeaderProps) {
  return (
    <div className="mb-2 border-b pb-2">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">
        {title || '[Tool Title Missing]'} {/* Fallback text */}
      </h1>
      {description && <p className="text-lg text-gray-600">{description}</p>}
    </div>
  );
}
