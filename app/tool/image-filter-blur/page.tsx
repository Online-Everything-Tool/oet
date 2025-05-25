// FILE: app/tool/image-filter-blur/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageFilterBlurClient from './_components/ImageFilterBlurClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageFilterBlurPage() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <ImageFilterBlurClient toolRoute="/tool/image-filter-blur" />
      </ToolSuspenseWrapper>
    </div>
  );
}