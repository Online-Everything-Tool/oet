// FILE: app/tool/penny-flipper/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import PennyFlipperClient from './_components/PennyFlipperClient';
import { ToolMetadata } from '@/src/types/tools';

export default function PennyFlipperPage() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <PennyFlipperClient toolRoute="/tool/penny-flipper" />
      </ToolSuspenseWrapper>
    </div>
  );
}