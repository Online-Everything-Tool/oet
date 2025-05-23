import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageBlurClient from './_components/ImageBlurClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageBlurPage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = typedMetadata.title || 'Image Blur';
  const toolRoute = '/tool/image-blur';

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={typedMetadata.description || ''} />
      <ToolSuspenseWrapper>
        <ImageBlurClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}