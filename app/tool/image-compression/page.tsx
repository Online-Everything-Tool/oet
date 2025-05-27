// FILE: app/tool/image-compression/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageCompressionClient from './_components/ImageCompressionClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageCompressionPage() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <ImageCompressionClient toolRoute="/tool/image-compression" />
      </ToolSuspenseWrapper>
    </div>
  );
}