// FILE: app/tool/image-storage/page.tsx
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import ImageStorageClient from './_components/ImageStorageClient';

export default function ImageStoragePage() {
  const toolTitle = metadata.title || 'Image Storage';
  const toolRoute = '/tool/image-storage';

  return (
    <div className="relative flex flex-col gap-6">
      <ToolSettings toolRoute={toolRoute} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <ImageStorageClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}
