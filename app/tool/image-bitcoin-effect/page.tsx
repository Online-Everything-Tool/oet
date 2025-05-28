// FILE: app/tool/image-bitcoin-effect/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageBitcoinEffectClient from './_components/ImageBitcoinEffectClient';
import { ToolMetadata } from '@/src/types/tools';

export default function ImageBitcoinEffectPage() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <ImageBitcoinEffectClient toolRoute="/tool/image-bitcoin-effect" />
      </ToolSuspenseWrapper>
    </div>
  );
}