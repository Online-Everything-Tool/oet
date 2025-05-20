// FILE: app/tool/hash-generator/page.tsx

import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import HashGeneratorClient from './_components/HashGeneratorClient';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';

export default function HashGeneratorPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || 'Hash Generator';
  const toolRoute = '/tool/hash-generator';

  return (
    <div className="relative flex flex-col gap-4">
      {/* Render ToolSettings */}
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <HashGeneratorClient
          urlStateParams={urlStateParams}
          toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}
