// /app/t/_components/ToolHeader.tsx

import React from 'react';

// Define the props the component expects
interface ToolHeaderProps {
    title: string;
    description: string;
    // Optional: Add iconName, status, etc. later if needed
    // iconName?: string | null;
    // status?: string;
}

/**
 * Renders the standardized H1 title and description paragraph
 * for a tool page, based on data passed from its metadata.
 */
export default function ToolHeader({ title, description }: ToolHeaderProps) {
    return (
        <div className="mb-6 border-b pb-4"> {/* Add some margin and a bottom border for separation */}
            {/* Main Title */}
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
                {title || '[Tool Title Missing]'} {/* Fallback text */}
            </h1>

            {/* Description Paragraph */}
            {description && ( // Only render paragraph if description exists
                <p className="text-lg text-gray-600">
                    {description}
                </p>
            )}
            {/* TODO: Optionally render status badges or icons here later */}
        </div>
    );
}

// Note: This component is intentionally simple and presentational.
// The parent page (e.g., /app/t/base64-converter/page.tsx) is responsible
// for importing its own ./metadata.json and passing the values as props.