// FILE: app/tool/image-montage/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageMontageClient from './_components/ImageMontageClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageMontagePage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = metadata.title || 'Image Montage';
  const toolRoute = '/tool/image-montage';

  return (
    <div className="relative flex flex-col gap-4">
      {/* Render ToolSettings */}
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <ImageMontageClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}
