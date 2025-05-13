// FILE: app/tool/zip-file-explorer/page.tsx
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import ZipFileExplorerClient from './_components/ZipFileExplorerClient';

export default function ZipFileExplorerPage() {
  const toolTitle = metadata.title || 'Zip File Explorer';
  const toolRoute = '/tool/zip-file-explorer';

  return (
    <div className="relative flex flex-col gap-6">
      {/* Render ToolSettings */}
      <ToolSettings toolRoute={toolRoute} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <ZipFileExplorerClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}
