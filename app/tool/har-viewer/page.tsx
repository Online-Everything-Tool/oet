// FILE: app/tool/har-viewer/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import HarViewerClient from './_components/HarViewerClient';
import { ToolMetadata } from '@/src/types/tools';

export default function HarViewerPage() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <HarViewerClient toolRoute="/tool/har-viewer" />
      </ToolSuspenseWrapper>
    </div>
  );
}