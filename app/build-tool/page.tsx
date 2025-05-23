import React from 'react';
import BuildToolSuspenseWrapper from './_components/BuildToolSuspenseWrapper';
import BuildToolClient from './_components/BuildToolClient';

export default function BuildToolPage() {
  return (
    <BuildToolSuspenseWrapper>
      <BuildToolClient />
    </BuildToolSuspenseWrapper>
  );
}
