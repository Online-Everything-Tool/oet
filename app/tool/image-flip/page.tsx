// FILE: app/tool/image-flip/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ImageFlipClient from './_components/ImageFlipClient';
import { ToolMetadata } from '@/src/types/tools';
import { toolRoute } from '@/app/lib/utils';

export default function ImageFlipPage() {
  const typedMetadata = metadata as ToolMetadata;

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader toolMetadata={typedMetadata} />
      <ToolSuspenseWrapper>
        <ImageFlipClient toolRoute={toolRoute(typedMetadata)} />
      </ToolSuspenseWrapper>
    </div>
  );
}
