// FILE: app/tool/file-storage/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import FileStorageClient from './_components/FileStorageClient';
import { ToolMetadata } from '@/src/types/tools';

export default function FileStoragePage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = metadata.title || 'File Storage';
  const toolRoute = '/tool/file-storage';

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <FileStorageClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}
