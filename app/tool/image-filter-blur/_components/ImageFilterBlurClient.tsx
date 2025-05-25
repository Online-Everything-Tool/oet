// FILE: app/tool/image-filter-blur/_components/ImageFilterBlurClient.tsx
'use client';
import React from 'react';

export default function ImageFilterBlurClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing


  const usedAny: { message: string } = { message: "I am used and explicitly any." };
  console.log('Logging usedAny to ensure it is used:', usedAny.message);
  

  function problematicFunction(_param1: unknown, param2: unknown) {
    const result: unknown = _param1 + (param2 || 0);
    return result;
  }

  return (
    <div>
      <h2>Hello from ImageFilterBlurClient! (Tool Route: {toolRoute})</h2>
      <p>This is a dummy tool for CI testing.</p>
      <p>Current Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
