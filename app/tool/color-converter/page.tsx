import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import ColorConverterClient from './_components/ColorConverterClient';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';

export default function ColorConverterPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];

  const toolTitle = metadata.title || 'Hex Color Converter';
  const toolRoute = '/tool/color-converter';

  return (
    <div className="relative flex flex-col gap-6">
      {/* Render ToolSettings */}
      <ToolSettings toolRoute={toolRoute} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
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
