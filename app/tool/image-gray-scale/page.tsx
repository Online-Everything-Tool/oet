// FILE: app/tool/image-gray-scale/page.tsx
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import ImageGrayScaleClient from './_components/ImageGrayScaleClient';

export default function ImageGrayScalePage() {
  const toolTitle = metadata.title || 'Image GrayScale';
  const toolRoute = '/tool/image-gray-scale';

  return (
    <div className="relative flex flex-col gap-6">
      {/* Render ToolSettings */}
      <ToolSettings toolRoute={toolRoute} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <ImageGrayScaleClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}
