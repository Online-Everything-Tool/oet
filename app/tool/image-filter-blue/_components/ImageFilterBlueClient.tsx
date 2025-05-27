// FILE: app/tool/image-filter-blue/_components/ImageFilterBlueClient.tsx
'use client';
import React from 'react';

export default function ImageFilterBlueClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing


  const usedAny: { message: string } = { message: "I am used and explicitly any." };
  console.log('Logging usedAny to ensure it is used:', usedAny.message);
  

  return (
    <div>
      <h2>Hello from ImageFilterBlueClient! (Tool Route: {toolRoute})</h2>
      <p>This is a dummy tool for CI testing.</p>
      <p>Current Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
