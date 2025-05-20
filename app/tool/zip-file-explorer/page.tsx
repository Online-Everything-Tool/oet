// FILE: app/tool/zip-file-explorer/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ZipFileExplorerClient from './_components/ZipFileExplorerClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ZipFileExplorerPage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = metadata.title || 'Zip File Explorer';
  const toolRoute = '/tool/zip-file-explorer';

  return (
    <div className="relative flex flex-col gap-4">
      {/* Render ToolSettings */}
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <ZipFileExplorerClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}
