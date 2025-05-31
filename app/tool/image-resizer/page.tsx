import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageResizerClient from './_components/ImageResizerClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageResizerPage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = metadata.title || 'Image Resizer';
  const toolRoute = '/tool/image-resizer';

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <ImageResizerClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}