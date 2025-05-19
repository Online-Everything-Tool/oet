// FILE: app/tool/image-flip/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageFlipClient from './_components/ImageFlipClient';

export default function ImageFlipPage() {
  const toolTitle = metadata.title || 'Image Flip';
  const toolRoute = '/tool/image-flip';

  return (
    <div className="relative flex flex-col gap-4">
      {/* Render ToolSettings */}
      <ToolSettings toolRoute={toolRoute} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <ImageFlipClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}
