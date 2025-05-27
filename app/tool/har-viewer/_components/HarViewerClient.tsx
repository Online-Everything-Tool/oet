// FILE: app/tool/har-viewer/_components/HarViewerClient.tsx
'use client';
import React from 'react';

export default function HarViewerClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing


  const usedAny: { message: string } = { message: "I am used and explicitly any." };
  console.log('Logging usedAny to ensure it is used:', usedAny.message);

  const _unusedAny: { value: string } = { value: "I am unused and explicitly any" };

  function _problematicFunction(_param1: unknown, param2: unknown) {
    const _anotherUnused: number = 123;
    const result: unknown = _param1 + (param2 || 0);
    return result;
  }

  return (
    <div>
      <h2>Hello from HarViewerClient! (Tool Route: {toolRoute})</h2>
      <p>This is a dummy tool for CI testing.</p>
      <p>Current Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
