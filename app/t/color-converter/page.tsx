import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import ColorConverterClient from './_components/ColorConverterClient';
import type { ParamConfig } from '../_hooks/useToolUrlState';

export default function ColorConverterPage() {
  const urlStateParams = (metadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || "Hex Color Converter";
  const toolRoute = "/t/color-converter";

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
        <ColorConverterClient
            urlStateParams={urlStateParams}
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}