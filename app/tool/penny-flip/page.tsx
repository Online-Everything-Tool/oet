// FILE: app/tool/penny-flip/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import PennyFlipClient from './_components/PennyFlipClient';
import { ToolMetadata } from '@/src/types/tools';

export default function PennyFlipPage() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <PennyFlipClient toolRoute="/tool/penny-flip" />
      </ToolSuspenseWrapper>
    </div>
  );
}