// FILE: app/t/case-converter/page.tsx

import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings'; // Import ToolSettings
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import CaseConverterClient from './_components/CaseConverterClient';
import type { ParamConfig } from '../_hooks/useToolUrlState';

export default function CaseConverterPage() {
    const urlStateParams = (metadata.urlStateParams || []) as ParamConfig[];
    const toolTitle = metadata.title || "Case Converter";
    const toolRoute = "/t/case-converter";

    return (
        // Add relative positioning
        <div className="relative flex flex-col gap-6">
            {/* Render ToolSettings */}
            <ToolSettings toolRoute={toolRoute} />
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