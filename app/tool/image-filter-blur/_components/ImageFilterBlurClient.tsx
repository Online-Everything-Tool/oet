// FILE: app/tool/image-filter-blur/_components/ImageFilterBlurClient.tsx
'use client';
import React from 'react';

export default function ImageFilterBlurClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const usedAny: any = { message: "I am used and explicitly any." };
  console.log('Logging usedAny to ensure it is used:', usedAny.message);


  function problematicFunction(_param1: any, _param2: unknown) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const result: any = _param1 + (_param2 || 0);
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
