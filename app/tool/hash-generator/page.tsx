// FILE: app/tool/hash-generator/page.tsx

import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings'; // Import ToolSettings
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import HashGeneratorClient from './_components/HashGeneratorClient';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';

export default function HashGeneratorPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || 'Hash Generator';
  const toolRoute = '/tool/hash-generator';

  return (
    // Add relative positioning
    <div className="relative flex flex-col gap-6">
      {/* Render ToolSettings */}
      <ToolSettings toolRoute={toolRoute} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <HashGeneratorClient
          urlStateParams={urlStateParams}
          toolTitle={toolTitle}
          toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}
