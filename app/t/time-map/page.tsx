// File: app/t/time-map/page.tsx
import React from 'react';
import TimeMapClient from './_components/TimeMapClient';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';

export default function TimeMapPage() {
  const toolTitle = metadata.title || "Time Map";
  const toolRoute = "/t/time-map";

  return (
    <div className="relative flex flex-col gap-6">
      <ToolSettings toolRoute={toolRoute} />
      <ToolHeader title={toolTitle} description={metadata.description || ""} />
      <ToolSuspenseWrapper>
        <TimeMapClient toolTitle={toolTitle} toolRoute={toolRoute} />
      </ToolSuspenseWrapper>
    </div>
  );
}