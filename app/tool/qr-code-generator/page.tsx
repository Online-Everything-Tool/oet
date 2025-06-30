import React from 'react';
import ToolHeader from '@/app/_components/ToolHeader';
import ToolSettings from '@/app/_components/ToolSettings';
import ToolSuspenseWrapper from '@/app/_components/ToolSuspenseWrapper';
import metadata from './metadata.json';
import type { ToolMetadata } from '@/src/types/tools';
import QRCodeGeneratorClient from './_components/QRCodeGeneratorClient';
import { toolRoute } from '@/app/lib/utils';

export default function QRCodeGeneratorPage() {
  const typedMetadata = metadata as ToolMetadata;

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader toolMetadata={typedMetadata} />
      <ToolSuspenseWrapper>
        <QRCodeGeneratorClient toolRoute={toolRoute(typedMetadata)} />
      </ToolSuspenseWrapper>
    </div>
  );
}