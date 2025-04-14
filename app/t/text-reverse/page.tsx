// FILE: app/t/text-reverse/page.tsx

import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import TextReverseClient from './_components/TextReverseClient'; // Import client component
import type { ParamConfig } from '../_hooks/useToolUrlState';

export default function TextReversePage() {
  const urlStateParams = (metadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || "Text Reverse";
  const toolRoute = "/t/text-reverse";

  return (
    <div className="flex flex-col gap-6">
      <ToolHeader
        title={toolTitle}
        description={metadata.description || ""}
      />
      <ToolSuspenseWrapper>
        <TextReverseClient
            urlStateParams={urlStateParams}
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}