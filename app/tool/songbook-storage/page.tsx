import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import SongbookStorageClient from './_components/SongbookStorageClient';
import metadata from './metadata.json';
import type { ToolMetadata } from '@/src/types/tools';

export default function SongbookStoragePage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = typedMetadata.title || 'Songbook Storage';
  const toolRoute = '/tool/songbook-storage'; // Matches the tool's base path

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={typedMetadata.description || ''} />
      <ToolSuspenseWrapper>
        <SongbookStorageClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}