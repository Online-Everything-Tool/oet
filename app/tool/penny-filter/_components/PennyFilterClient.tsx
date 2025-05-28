// FILE: app/tool/penny-filter/_components/PennyFilterClient.tsx
'use client';
import React from 'react';

export default function PennyFilterClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing


  const logMessage = { message: "Log message" };
  console.log('Log:', logMessage.message);
  
  const logValue = { value: "Log value" }; 

  function addParams(param1: number, param2: number | undefined) {
    const htt: number = 123;
    const result: number = param1 + (param2 || 0);
    return result;
  }

  return (
    <div>
      <h2>Hello from PennyFilterClient! (Tool Route: {toolRoute})</h2>
      <p>This is a dummy tool for CI testing.</p>
      <p>Current Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
