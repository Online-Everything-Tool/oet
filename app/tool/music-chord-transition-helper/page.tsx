import React from 'react';
import ToolHeader from '@/app/_components/ToolHeader';
import ToolSettings from '@/app/_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '@/app/_components/ToolSuspenseWrapper';
import MusicChordTransitionHelperClient from './_components/MusicChordTransitionHelperClient';
import type { ToolMetadata } from '@/src/types/tools';
import { toolRoute } from '@/app/lib/utils';

export default function MusicChordTransitionHelperPage() {
  const typedMetadata = metadata as ToolMetadata;

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader toolMetadata={typedMetadata} />
      <ToolSuspenseWrapper>
        <MusicChordTransitionHelperClient
          toolRoute={toolRoute(typedMetadata)}
          metadata={typedMetadata}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}