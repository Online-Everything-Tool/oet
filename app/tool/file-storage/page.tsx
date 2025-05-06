// FILE: app/tool/file-storage/page.tsx
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json'; // Import this tool's metadata
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import FileStorageClient from './_components/FileStorageClient'; // Import the client component

export default function FileStoragePage() {
  const toolTitle = metadata.title || 'File Storage';
  const toolRoute = '/tool/file-storage/'; // Use trailing slash consistently

  return (
    <div className="relative flex flex-col gap-6">
      {/* Add ToolSettings component */}
      <ToolSettings toolRoute={toolRoute} />

      {/* Add ToolHeader component */}
      <ToolHeader title={toolTitle} description={metadata.description || ''} />

      {/* Wrap Client Component in Suspense */}
      <ToolSuspenseWrapper>
        <FileStorageClient toolTitle={toolTitle} toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}
