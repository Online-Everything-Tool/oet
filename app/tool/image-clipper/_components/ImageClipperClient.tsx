// FILE: app/tool/image-clipper/_components/ImageClipperClient.tsx
'use client';
import React from 'react';

export default function ImageClipperClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing


  const logMessage: { message: string } = { message: "Log message" };
  console.log('Log:', logMessage.message);
  

  function _addParams(param1: number, _param2: number | undefined) {
    const htt: number = 123;
    const result: number = param1 + (_param2 || 0);
    return result;
  }

  return (
    <div>
      <h2>Hello from ImageClipperClient! (Tool Route: {toolRoute})</h2>
      <p>This is a dummy tool for CI testing.</p>
      <p>Current Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
