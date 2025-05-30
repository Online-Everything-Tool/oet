import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import GzipFileExplorerClient from './_components/GzipFileExplorerClient';
import { ToolMetadata } from '@/src/types/tools';

export default function GzipFileExplorerPage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = typedMetadata.title || 'Gzip File Explorer';
  const toolRoute = `/tool/${typedMetadata.directive}`;

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={typedMetadata.description || ''} />
      <ToolSuspenseWrapper>
        <GzipFileExplorerClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}