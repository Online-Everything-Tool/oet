// FILE: app/tool/ci-test-320669/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import CiTest320669Client from './_components/CiTest320669Client';
import { ToolMetadata } from '@/src/types/tools';

export default function CiTest320669Page() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <CiTest320669Client toolRoute="/tool/ci-test-320669" />
      </ToolSuspenseWrapper>
    </div>
  );
}