// FILE: app/tool/base64-converter/page.tsx

import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings'; // Import ToolSettings
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import Base64ConverterClient from './_components/Base64ConverterClient';
import type { ParamConfig } from '../_hooks/useToolUrlState';
import { ToolMetadata } from '@/app/api/tool-metadata/route';

export default function Base64ConverterPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || "Base64 Converter";
  const toolRoute = "/tool/base64-converter";

  return (
    // Add relative positioning
    <div className="relative flex flex-col gap-6">
       {/* Render ToolSettings */}
       <ToolSettings toolRoute={toolRoute} />
      <ToolHeader
        title={toolTitle}
        description={metadata.description || ""}
      />
      <ToolSuspenseWrapper>
        <Base64ConverterClient
            urlStateParams={urlStateParams}
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}