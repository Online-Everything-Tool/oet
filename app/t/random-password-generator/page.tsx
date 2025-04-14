// FILE: app/t/random-password-generator/page.tsx
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import RandomPasswordGeneratorClient from './_components/RandomPasswordGeneratorClient';

export default function RandomPasswordGeneratorPage() {
  const toolTitle = metadata.title || "Random Password Generator";
  const toolRoute = "/t/random-password-generator";

  return (
    <div className="flex flex-col gap-6">
      <ToolHeader
        title={toolTitle}
        description={metadata.description || ""}
      />
      <ToolSuspenseWrapper>
        <RandomPasswordGeneratorClient
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}