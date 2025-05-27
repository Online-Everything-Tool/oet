// FILE: app/tool/har-viewer/_components/HarViewerClient.tsx
'use client';
import React, { useEffect } from 'react';

export default function HarViewerClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing


  let usedAny: any = { message: "I am used and explicitly any." };
  console.log('Logging usedAny to ensure it is used:', usedAny.message);
  
  const unusedAny: any = { value: "I am unused and explicitly any" }; 

  function problematicFunction(param1: any, param2) {
    const anotherUnused: number = 123;
    let result: any = param1 + (param2 || 0);
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