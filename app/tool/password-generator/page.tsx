// FILE: app/tool/password-generator/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import PasswordGeneratorClient from './_components/PasswordGeneratorClient';
import type { ToolMetadata } from '@/src/types/tools';
import { toolRoute } from '@/app/lib/utils';

export default function PasswordGeneratorPage() {
  const typedMetadata = metadata as ToolMetadata;

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader toolMetadata={typedMetadata} />
      <ToolSuspenseWrapper>
        <PasswordGeneratorClient toolRoute={toolRoute(typedMetadata)} />
      </ToolSuspenseWrapper>
    </div>
  );
}
