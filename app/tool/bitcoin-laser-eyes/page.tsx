import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import BitcoinLaserEyesClient from './_components/BitcoinLaserEyesClient';
import { ToolMetadata } from '@/src/types/tools';

export default function BitcoinLaserEyesPage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = metadata.title || 'Bitcoin Laser Eyes';
  const toolRoute = '/tool/bitcoin-laser-eyes';

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <BitcoinLaserEyesClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}
