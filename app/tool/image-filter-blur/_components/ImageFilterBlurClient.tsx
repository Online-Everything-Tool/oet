// FILE: app/tool/image-filter-blur/_components/ImageFilterBlurClient.tsx
'use client';
import React from 'react';

export default function ImageFilterBlurClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing

  // --- Start of Intentionally Problematic Code (if includeLintError is true) ---

  const usedAny: { message: string } = { message: "I am used and explicitly any." };
  console.log('Logging usedAny to ensure it is used:', usedAny.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function problematicFunction(param1: any, param2: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = param1 + (param2 || 0);
    return result;
  }
  // problematicFunction is defined but not used, which can also be an error/warning.

  // --- End of Intentionally Problematic Code ---

  return (
    <div>
      <h2>Hello from ImageFilterBlurClient! (Tool Route: {toolRoute})</h2>
      <p>This is a dummy tool for CI testing.</p>
      <p>Current Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
