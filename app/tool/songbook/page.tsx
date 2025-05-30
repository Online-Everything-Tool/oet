// FILE: app/tool/songbook/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import SongbookClient from './_components/SongbookClient';
import { ToolMetadata } from '@/src/types/tools';

export default function SongbookPage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = typedMetadata.title || 'Songbook';
  const toolRoute = `/tool/${typedMetadata.directive}`;

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader
        title={toolTitle}
        description={typedMetadata.description || ''}
      />
      <ToolSuspenseWrapper>
        <SongbookClient toolRoute={toolRoute} metadata={typedMetadata} />
      </ToolSuspenseWrapper>
    </div>
  );
}
