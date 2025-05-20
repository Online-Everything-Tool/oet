// FILE: app/tool/image-storage/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageStorageClient from './_components/ImageStorageClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageStoragePage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = metadata.title || 'Image Storage';
  const toolRoute = '/tool/image-storage';

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <ImageStorageClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}
