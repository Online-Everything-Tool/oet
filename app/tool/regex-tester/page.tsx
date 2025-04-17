'use server';
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import RegexTesterClient from './_components/RegexTesterClient';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';

export default function RegexTesterPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || "Regex Tester";
  const toolRoute = "/tool/regex-tester";

  return (
    <div className="relative flex flex-col gap-6">
      <ToolSettings toolRoute={toolRoute} />
      <ToolHeader
        title={toolTitle}
        description={metadata.description || ""}
      />
      <ToolSuspenseWrapper>
        <RegexTesterClient
          urlStateParams={urlStateParams}
          toolTitle={toolTitle}
          toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}