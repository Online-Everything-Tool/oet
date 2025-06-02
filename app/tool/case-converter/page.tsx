// FILE: app/tool/case-converter/page.tsx

import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import CaseConverterClient from './_components/CaseConverterClient';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import { toolRoute } from '@/app/lib/utils';

export default function CaseConverterPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader toolMetadata={typedMetadata} />
      <ToolSuspenseWrapper>
        <CaseConverterClient
          urlStateParams={urlStateParams}
          toolRoute={toolRoute(typedMetadata)}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}
