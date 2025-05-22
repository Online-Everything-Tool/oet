// FILE: app/tool/image-blur/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageBlurClient from './_components/ImageBlurClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageBlurPage() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <ImageBlurClient toolRoute="/tool/image-blur" />
      </ToolSuspenseWrapper>
    </div>
  );
}