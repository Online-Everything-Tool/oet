// FILE: app/tool/image-clip/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageClipClient from './_components/ImageClipClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageClipPage() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <ImageClipClient toolRoute="/tool/image-clip" />
      </ToolSuspenseWrapper>
    </div>
  );
}