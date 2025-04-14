// FILE: app/t/json-validate-format/page.tsx

import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import JsonValidateFormatClient from './_components/JsonValidateFormatClient'; // Import client component
import type { ParamConfig } from '../_hooks/useToolUrlState';

export default function JsonValidateFormatPage() {
  const urlStateParams = (metadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || "JSON Validate Format";
  const toolRoute = "/t/json-validate-format";

  return (
    <div className="flex flex-col gap-6">
      <ToolHeader
        title={toolTitle}
        description={metadata.description || ""}
      />
      <ToolSuspenseWrapper>
        <JsonValidateFormatClient
            urlStateParams={urlStateParams}
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}