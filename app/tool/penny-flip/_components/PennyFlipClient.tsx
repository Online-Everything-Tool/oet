// FILE: app/tool/penny-flip/_components/PennyFlipClient.tsx
'use client';
import React from 'react';

export default function PennyFlipClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing


  const usedAny: { message: string } = { message: "I am used and explicitly any." };
  console.log('Logging usedAny to ensure it is used:', usedAny.message);
  
  const unusedAny: { value: string } = { value: "I am unused and explicitly any" }; 

  function problematicFunction(param1: unknown, param2: unknown) {
    const anotherUnused: number = 123;
    const result = param1 as any + (param2 || 0); // Addition with unknown requires type assertion
    return result;
  }

  return (
    <div>
      <h2>Hello from PennyFlipClient! (Tool Route: {toolRoute})</h2>
      <p>This is a dummy tool for CI testing.</p>
      <p>Current Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
