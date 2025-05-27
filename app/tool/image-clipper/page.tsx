// FILE: app/tool/image-clipper/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageClipperClient from './_components/ImageClipperClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageClipperPage() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <ImageClipperClient toolRoute="/tool/image-clipper" />
      </ToolSuspenseWrapper>
    </div>
  );
}