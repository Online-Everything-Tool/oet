// FILE: app/tool/base64-encode-decode/page.tsx

import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import Base64EncodeDecodeClient from './_components/Base64EncodeDecodeClient';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';

export default function Base64EncodeDecodePage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || 'Base64 Converter';
  const toolRoute = '/tool/' + typedMetadata.directive;

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader
        title={toolTitle}
        description={typedMetadata.description || ''}
      />
      <ToolSuspenseWrapper>
        <Base64EncodeDecodeClient
          urlStateParams={urlStateParams}
          toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}
