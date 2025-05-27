// FILE: app/tool/penny-flipper/_components/PennyFlipperClient.tsx
'use client';
import React from 'react';

export default function PennyFlipperClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing


  const logMessage = { message: "Log message" };
  console.log('Log:', logMessage.message);
  

  function addParams(param1: number, param2: number | undefined) {
    const htt: number = 123;
    const result: number = param1 + (param2 || 0);
    return result;
  }

  return (
    <div>
      <h2>Hello from PennyFlipperClient! (Tool Route: {toolRoute})</h2>
      <p>This is a dummy tool for CI testing.</p>
      <p>Current Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
