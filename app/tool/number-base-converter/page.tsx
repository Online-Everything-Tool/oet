import React from 'react';
import ToolHeader from '@/app/_components/ToolHeader';
import ToolSettings from '@/app/_components/ToolSettings';
import ToolSuspenseWrapper from '@/app/_components/ToolSuspenseWrapper';
import metadata from './metadata.json';
import NumberBaseConverterClient from './_components/NumberBaseConverterClient';
import { toolRoute } from '@/app/lib/utils';
import type { ToolMetadata } from '@/src/types/tools';

export default function NumberBaseConverterPage() {
  const typedMetadata = metadata as ToolMetadata;
  const route = toolRoute(typedMetadata);

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader toolMetadata={typedMetadata} />
      <ToolSuspenseWrapper>
        <NumberBaseConverterClient toolRoute={route} />
      </ToolSuspenseWrapper>
    </div>
  );
}
