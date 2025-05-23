// FILE: app/tool/image-filter-blur/_components/ImageFilterBlurClient.tsx
'use client';
import React, { useEffect } from 'react'; // Default to importing useEffect
export default function ImageFilterBlurClient({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing
  return (
    <div>
      <h2>Hello from ImageFilterBlurClient!</h2>
      <p>This is a dummy tool for CI testing.</p>
      <p>Tool Route: {toolRoute}</p>
      <p>Current Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}