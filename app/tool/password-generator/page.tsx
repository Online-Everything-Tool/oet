// FILE: app/tool/password-generator/page.tsx
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import PasswordGeneratorClient from './_components/PasswordGeneratorClient';
import type { ToolMetadata } from '@/src/types/tools';

export default function PasswordGeneratorPage() {
  // Cast the metadata to the defined ToolMetadata type
  const typedMetadata = metadata as ToolMetadata;

  // Now access urlStateParams safely
  const toolTitle = typedMetadata.title || "Password Generator";
  const toolRoute = "/tool/password-generator";

  return (
    <div className="relative flex flex-col gap-6">
      <ToolSettings toolRoute={toolRoute}></ToolSettings>
      <ToolHeader
        title={toolTitle}
        description={typedMetadata.description || ""}
      />
      <ToolSuspenseWrapper>
        
        <PasswordGeneratorClient
          toolTitle={toolTitle}
          toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}