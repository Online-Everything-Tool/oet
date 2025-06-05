import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import AspectRatioCalculatorClient from './_components/AspectRatioCalculatorClient';
import metadata from './metadata.json';
import type { ToolMetadata, ParamConfig } from '@/src/types/tools';
import { toolRoute } from '@/app/lib/utils';

export default function AspectRatioCalculatorPage() {
  const typedMetadata = metadata as ToolMetadata;
  // urlStateParams are defined in metadata.json and used by ToolSettings and AspectRatioCalculatorClient (via useToolUrlState)
  // const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[]; 

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader toolMetadata={typedMetadata} />
      <ToolSuspenseWrapper>
        <AspectRatioCalculatorClient />
      </ToolSuspenseWrapper>
    </div>
  );
}