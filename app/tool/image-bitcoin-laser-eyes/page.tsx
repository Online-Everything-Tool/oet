import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageBitcoinLaserEyesClient from './_components/ImageBitcoinLaserEyesClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageBitcoinLaserEyesPage() {
  const typedMetadata = metadata as ToolMetadata;
  const toolTitle = metadata.title || 'Bitcoin Laser Eyes';
  const toolRoute = '/tool/image-bitcoin-laser-eyes';

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <ImageBitcoinLaserEyesClient toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}