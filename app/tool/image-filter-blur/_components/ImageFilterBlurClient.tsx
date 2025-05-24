// FILE: app/tool/image-filter-blur/_components/ImageFilterBlurClient.tsx
'use client';
import React, { useEffect } from 'react';

export default function ImageFilterBlurClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing

  // --- Start of Intentionally Problematic Code (if includeLintError is true) ---

  let usedAny: any = { message: "I am used and explicitly any." };
  console.log('Logging usedAny to ensure it is used:', usedAny.message);
  
  const unusedAny: any = { value: "I am unused and explicitly any" }; 
  // This 'unusedAny' should trigger @typescript-eslint/no-unused-vars (likely error in Next.js)
  // The 'any' type itself might trigger @typescript-eslint/no-explicit-any (error or warning based on config)

  function problematicFunction(param1: any, param2) { // param2 implicitly any
    const anotherUnused: number = 123; // Another unused variable
    let result: any = param1 + (param2 || 0); // Using any again
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