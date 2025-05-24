import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import CalculatorClient from './_components/CalculatorClient';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';

export default function CalculatorPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || 'Calculator';
  const toolRoute = '/tool/' + typedMetadata.directive;

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={typedMetadata.description || ''} />
      <ToolSuspenseWrapper>
        <CalculatorClient urlStateParams={urlStateParams} toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}