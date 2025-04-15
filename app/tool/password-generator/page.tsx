// FILE: app/tool/password-generator/page.tsx
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import PasswordGeneratorClient from './_components/PasswordGeneratorClient';

export default function PasswordGeneratorPage() {
  const toolTitle = metadata.title || "Random Password Generator";
  const toolRoute = "/tool/random-password-generator";

  return (
    <div className="relative flex flex-col gap-6">
      <ToolSettings toolRoute={toolRoute}></ToolSettings>
      <ToolHeader
        title={toolTitle}
        description={metadata.description || ""}
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