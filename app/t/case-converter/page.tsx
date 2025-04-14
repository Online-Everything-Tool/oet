// FILE: app/t/case-converter/page.tsx

import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import CaseConverterClient from './_components/CaseConverterClient'; // Import the new client component
import type { ParamConfig } from '../_hooks/useToolUrlState'; // Import type needed for props

export default function CaseConverterPage() {
    // Pass the necessary props from metadata to the client component
    const urlStateParams = (metadata.urlStateParams || []) as ParamConfig[];
    const toolTitle = metadata.title || "Case Converter";
    const toolRoute = "/t/case-converter";

    return (
        <div className="flex flex-col gap-6">
            <ToolHeader
                title={toolTitle}
                description={metadata.description || ""}
            />
            <ToolSuspenseWrapper>
                <CaseConverterClient
                    urlStateParams={urlStateParams}
                    toolTitle={toolTitle}
                    toolRoute={toolRoute}
                />
            </ToolSuspenseWrapper>
        </div>
    );
}