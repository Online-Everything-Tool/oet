// FILE: app/t/url-encode-decode/page.tsx

import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings'; // Import ToolSettings
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import UrlEncodeDecodeClient from './_components/UrlEncodeDecodeClient';
import type { ParamConfig } from '../_hooks/useToolUrlState';

export default function UrlEncodeDecodePage() {
  const urlStateParams = (metadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || "URL Encode Decode";
  const toolRoute = "/t/url-encode-decode"; // Corrected route

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
        <UrlEncodeDecodeClient
            urlStateParams={urlStateParams}
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}