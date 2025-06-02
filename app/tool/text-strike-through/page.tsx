// FILE: app/tool/text-strike-through/page.tsx

import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import TextStrikeThroughClient from './_components/TextStrikeThroughClient';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import { toolRoute } from '@/app/lib/utils';

export default function TextStrikeThroughPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader toolMetadata={typedMetadata} />
      <ToolSuspenseWrapper>
        <TextStrikeThroughClient
          urlStateParams={urlStateParams}
          toolRoute={toolRoute(typedMetadata)}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}
