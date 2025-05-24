import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import CsvJsonConverterClient from './_components/CsvJsonConverterClient';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';

export default function CsvJsonConverterPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || 'CSV/JSON Converter';
  const toolRoute = '/tool/' + typedMetadata.directive;

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={typedMetadata.description || ''} />
      <ToolSuspenseWrapper>
        <CsvJsonConverterClient
          urlStateParams={urlStateParams}
          toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}