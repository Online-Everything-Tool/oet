// FILE: app/tool/penny-filter/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import PennyFilterClient from './_components/PennyFilterClient';
import { ToolMetadata } from '@/src/types/tools';

export default function PennyFilterPage() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <PennyFilterClient toolRoute="/tool/penny-filter" />
      </ToolSuspenseWrapper>
    </div>
  );
}