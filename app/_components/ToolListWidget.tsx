// FILE: app/_components/ToolListWidget.tsx
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

// Re-define or import the interface for the tool data
interface ToolDisplayData {
  href: string;
  title: string;
  description: string;
}

interface ToolListWidgetProps {
    initialTools: ToolDisplayData[]; // Receive the full list as a prop
}

export default function ToolListWidget({ initialTools }: ToolListWidgetProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTools = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
        if (!lowerCaseSearchTerm) {
            return initialTools; // Return all if search is empty
        }
        return initialTools.filter(tool =>
            tool.title.toLowerCase().includes(lowerCaseSearchTerm) ||
            tool.description.toLowerCase().includes(lowerCaseSearchTerm)
        );
    }, [searchTerm, initialTools]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    return (
        // Container matching the style of other sections
        <div className="p-4 md:p-6 border border-[rgb(var(--color-border-base))] rounded-lg bg-[rgb(var(--color-bg-component))] shadow-sm space-y-4">
            {/* Search Input Section */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                 <h2 className="text-xl font-semibold text-[rgb(var(--color-text-base))] shrink-0">
                    Available Tools ({filteredTools.length}) {/* Show filtered count */}
                 </h2>
                 <div className="w-full sm:w-auto sm:max-w-xs flex-grow">
                    <label htmlFor="tool-search" className="sr-only">Search Tools</label>
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

            {/* Tool List Section */}
            <div>
                {filteredTools.length > 0 ? (
                    <ul className="space-y-4">
                        {filteredTools.map((tool) => (
                            <li key={tool.href} className="pb-3 border-b border-gray-200 last:border-b-0 last:pb-0">
                                <Link
                                    href={tool.href}
                                    className="block text-lg font-medium text-[rgb(var(--color-text-link))] hover:underline mb-1"
                                >
                                    {tool.title}
                                </Link>
                                <p className="text-sm text-[rgb(var(--color-text-muted))]">
                                    {tool.description}
                                </p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-[rgb(var(--color-text-muted))] text-center py-4">
                        No tools found matching &ldquo;{searchTerm}&rdquo;.
                    </p>
                )}
            </div>
        </div>
    );
}