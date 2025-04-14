// FILE: app/t/image-flip/page.tsx
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import ImageFlipClient from './_components/ImageFlipClient'; // Import the new client component

export default function ImageFlipPage() {
  // Basic props from metadata
  const toolTitle = metadata.title || "Image Flip";
  const toolRoute = "/t/image-flip"; // Standard route

  return (
    <div className="flex flex-col gap-6">
      <ToolHeader
        title={toolTitle}
        description={metadata.description || ""}
      />
      <ToolSuspenseWrapper>
        {/* Render the client component and pass props */}
        <ImageFlipClient
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}