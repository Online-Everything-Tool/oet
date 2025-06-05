// FILE: app/_components/ToolListWidget.tsx
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

export interface ToolDisplayData {
  href: string;
  title: string;
  description: string;
}

interface ToolListWidgetProps {
  initialTools: ToolDisplayData[];
}

export default function ToolListWidget({ initialTools }: ToolListWidgetProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTools = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    if (!lowerCaseSearchTerm) {
      return initialTools;
    }
    return initialTools.filter(
      (tool) =>
        tool.title.toLowerCase().includes(lowerCaseSearchTerm) ||
        tool.description.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [searchTerm, initialTools]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  return (
    <div className="space-y-4">
      {/* Search Input Section (remains the same) */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <h2 className="text-xl font-semibold text-[rgb(var(--color-text-base))] shrink-0">
          Available Tools ({filteredTools.length})
        </h2>
        <div className="w-full sm:w-auto sm:max-w-xs flex-grow">
          <label htmlFor="tool-search" className="sr-only">
            Search Tools
          </label>
          <input
            type="search"
            id="tool-search"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search tools by name or description..."
            className="w-full p-2 border border-[rgb(var(--color-input-border))] bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] rounded-md shadow-sm focus:border-[rgb(var(--color-input-focus-border))] focus:outline-none text-sm placeholder:text-[rgb(var(--color-input-placeholder))]"
          />
        </div>
      </div>

      <div>
        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
            {filteredTools.map((tool) => (
              <div
                key={tool.href}
                className="flex flex-col p-4 border border-[rgb(var(--color-border-soft))] bg-[rgb(var(--color-bg-subtle))] rounded-md shadow-sm hover:shadow-md transition-shadow duration-150"
              >
                <Link
                  href={tool.href}
                  className="block text-base font-semibold text-[rgb(var(--color-text-link))] hover:underline mb-1 group"
                >
                  {tool.title}
                </Link>
                <p className="text-sm text-[rgb(var(--color-text-muted))] line-clamp-3 flex-grow">
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[rgb(var(--color-text-muted))] text-center py-4">
            No tools found matching “{searchTerm}”.
          </p>
        )}
      </div>
    </div>
  );
}
