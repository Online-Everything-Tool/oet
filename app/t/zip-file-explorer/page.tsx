// FILE: app/t/zip-file-explorer/page.tsx
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import ZipFileExplorerClient from './_components/ZipFileExplorerClient';

export default function ZipFileExplorerPage() {
  const toolTitle = metadata.title || "Zip File Explorer";
  const toolRoute = "/t/zip-file-explorer";

  return (
    <div className="flex flex-col gap-6">
      <ToolHeader
        title={toolTitle}
        description={metadata.description || ""}
      />
      <ToolSuspenseWrapper>
        <ZipFileExplorerClient
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}