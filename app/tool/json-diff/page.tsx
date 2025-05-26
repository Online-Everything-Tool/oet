import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import JsonDiffClient from './_components/JsonDiffClient';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';

export default function JsonDiffPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || 'JSON Diff';
  const toolRoute = '/tool/json-diff';

  return (
    <div className="relative flex flex-col gap-4">
      {/* Render ToolSettings */}
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <JsonDiffClient
          urlStateParams={urlStateParams}
          toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}