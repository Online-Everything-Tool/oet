import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import HexColorConverterClient from './_components/HexColorConverterClient';
import type { ParamConfig } from '../_hooks/useToolUrlState';

export default function HexColorConverterPage() {
  const urlStateParams = (metadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || "Hex Color Converter";
  const toolRoute = "/t/hex-color-converter";

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
        <HexColorConverterClient
            urlStateParams={urlStateParams}
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}