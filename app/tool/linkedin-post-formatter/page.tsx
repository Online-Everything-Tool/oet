// --- FILE: app/tool/linkedin-post-formatter/page.tsx ---
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import LinkedinPostFormatterClient from './_components/LinkedinPostFormatterClient';
import type { ToolMetadata } from '@/src/types/tools';

export default function LinkedinPostFormatterPage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = typedMetadata.title || 'LinkedIn Post Formatter';
  const toolRoute = '/tool/linkedin-post-formatter';

  return (
    <div className="relative flex flex-col gap-6">
      <ToolSettings toolRoute={toolRoute} />
      <ToolHeader
        title={toolTitle}
        description={typedMetadata.description || ''}
      />
      <ToolSuspenseWrapper>
        <LinkedinPostFormatterClient
          toolTitle={toolTitle}
          toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}
