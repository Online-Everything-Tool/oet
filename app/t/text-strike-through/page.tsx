// FILE: app/t/text-strike-through/page.tsx

import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import TextStrikeThroughClient from './_components/TextStrikeThroughClient'; // Import client component
import type { ParamConfig } from '../_hooks/useToolUrlState';

export default function TextStrikeThroughPage() {
  const urlStateParams = (metadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || "Text Strike Through";
  const toolRoute = "/t/text-strike-through";

  return (
    <div className="flex flex-col gap-6">
      <ToolHeader
        title={toolTitle}
        description={metadata.description || ""}
      />
      <ToolSuspenseWrapper>
        <TextStrikeThroughClient
            urlStateParams={urlStateParams}
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}