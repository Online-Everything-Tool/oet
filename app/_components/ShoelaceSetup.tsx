// FILE: app/_components/ShoelaceSetup.tsx
'use client';

// Remove useEffect if no longer needed for other setup
// import { useEffect } from 'react';
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';

// --- Call setBasePath directly at module level ---
// This runs once when the module is loaded on the client-side bundle.
const correctBasePath = '/assets';
console.log(`%c[ShoelaceSetup MODULE LEVEL] Setting base path to: ${correctBasePath}`, 'color: blue; font-weight: bold;');
setBasePath(correctBasePath);
// --- End Module Level Call ---


export default function ShoelaceSetup() {
  // The component still needs to exist to be rendered in the layout,
  // but the useEffect might not be strictly necessary anymore for *this* task.
  // useEffect(() => {
  //   console.log('[ShoelaceSetup useEffect] Component mounted.');
  // }, []);

  return null; // This component doesn't render anything itself
}