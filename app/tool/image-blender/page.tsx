import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageBlenderClient from './_components/ImageBlenderClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageBlenderPage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = typedMetadata.title || 'Image Blender';
  const toolRoute = `/tool/${typedMetadata.directive}`;

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={typedMetadata.description || ''} />
      <ToolSuspenseWrapper>
        <ImageBlenderClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}