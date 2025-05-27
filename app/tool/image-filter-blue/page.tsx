// FILE: app/tool/image-filter-blue/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageFilterBlueClient from './_components/ImageFilterBlueClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageFilterBluePage() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <ImageFilterBlueClient toolRoute="/tool/image-filter-blue" />
      </ToolSuspenseWrapper>
    </div>
  );
}