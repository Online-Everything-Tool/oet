// FILE: app/tool/image-filter-blur/_components/ImageFilterBlurClient.tsx
'use client';
import React from 'react';

export default function ImageFilterBlurClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing

  // --- Start of Intentionally Problematic Code (if includeLintError is true) ---

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const usedAny: any = { message: "I am used and explicitly any." };
  console.log('Logging usedAny to ensure it is used:', usedAny.message);

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const unusedAny: any = { value: "I am unused and explicitly any" }; 

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  function problematicFunction(param1: any, _param2: unknown) {
    const anotherUnused: number = 123;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const result: any = param1 + (_param2 || 0);
    return result;
  }

  // --- End of Intentionally Problematic Code ---

  return (
    <div>
      <h2>Hello from ImageFilterBlurClient! (Tool Route: {toolRoute})</h2>
      <p>This is a dummy tool for CI testing.</p>
      <p>Current Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
