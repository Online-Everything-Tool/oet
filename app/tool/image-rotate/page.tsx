import React from 'react';
import ToolHeader from '@/app/_components/ToolHeader';
import ToolSettings from '@/app/_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '@/app/_components/ToolSuspenseWrapper';
import ImageRotateClient from './_components/ImageRotateClient';
import { ToolMetadata } from '@/src/types/tools';
import { toolRoute } from '@/app/lib/utils';

export default function ImageRotatePage() {
  const typedMetadata = metadata as ToolMetadata;

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader toolMetadata={typedMetadata} />
      <ToolSuspenseWrapper>
        <ImageRotateClient toolRoute={toolRoute(typedMetadata)} />
      </ToolSuspenseWrapper>
    </div>
  );
}
