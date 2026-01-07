import React from 'react';
import ToolHeader from '@/app/_components/ToolHeader';
import ToolSettings from '@/app/_components/ToolSettings';
import ToolSuspenseWrapper from '@/app/_components/ToolSuspenseWrapper';
import metadata from './metadata.json';
import TimestampConverterClient from './_components/TimestampConverterClient';
import { toolRoute } from '@/app/lib/utils';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';

export default function TimestampConverterPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader toolMetadata={typedMetadata} />
      <ToolSuspenseWrapper>
        <TimestampConverterClient
          urlStateParams={urlStateParams}
          toolRoute={toolRoute(typedMetadata)}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}
