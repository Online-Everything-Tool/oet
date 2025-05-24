import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageFilterBlurClient from './_components/ImageFilterBlurClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageFilterBlurPage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = typedMetadata.title || 'Image Filter Blur';
  const toolRoute = '/tool/image-filter-blur';

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={typedMetadata.description || ''} />
      <ToolSuspenseWrapper>
        <ImageFilterBlurClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}